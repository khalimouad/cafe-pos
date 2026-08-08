import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type { Cashier, DB, Order, OrderLine, PrinterTransport, Product, Session, Shop } from './types'

const EMPTY: DB = {
  shop: {
    name: 'Café',
    address: '',
    phone: '',
    currency: 'DH',
    footer: '',
    printerEnabled: false,
    printerTransport: 'tcp',
    printerTarget: '',
    printerAgentUrl: 'http://127.0.0.1:7777',
    printerIp: '192.168.123.100',
    printerPort: 9100,
    printerCut: true,
    printerBeep: false,
  },
  cashiers: [],
  products: [],
  sessions: [],
  orders: [],
}

type Row = Record<string, unknown>

const toShop = (r: Row): Shop => ({
  name: String(r.name ?? ''),
  address: String(r.address ?? ''),
  phone: String(r.phone ?? ''),
  currency: String(r.currency ?? 'DH'),
  footer: String(r.footer ?? ''),
  printerEnabled: Boolean(r.printer_enabled),
  printerTransport: (String(r.printer_transport ?? 'tcp') as PrinterTransport),
  printerTarget: String(r.printer_target ?? ''),
  printerAgentUrl: String(r.printer_agent_url ?? 'http://127.0.0.1:7777'),
  printerIp: String(r.printer_ip ?? '192.168.123.100'),
  printerPort: Number(r.printer_port ?? 9100),
  printerCut: r.printer_cut === undefined ? true : Boolean(r.printer_cut),
  printerBeep: Boolean(r.printer_beep),
})

const toProduct = (r: Row): Product => ({
  id: String(r.id),
  name: String(r.name),
  price: Number(r.price),
  category: String(r.category),
  emoji: String(r.emoji),
  active: Boolean(r.active),
})

const toSession = (r: Row): Session => ({
  id: String(r.id),
  openedAt: String(r.opened_at),
  openedBy: String(r.opened_by),
  openingFloat: Number(r.opening_float),
  closedAt: r.closed_at ? String(r.closed_at) : null,
  closedBy: r.closed_by ? String(r.closed_by) : null,
  countedCash: r.counted_cash === null || r.counted_cash === undefined ? null : Number(r.counted_cash),
})

const toOrder = (r: Row): Order => ({
  id: String(r.id),
  number: Number(r.number),
  sessionId: String(r.session_id),
  cashierId: r.cashier_id ? String(r.cashier_id) : null,
  cashierName: String(r.cashier_name),
  createdAt: String(r.created_at),
  lines: (r.lines as OrderLine[]) ?? [],
  total: Number(r.total),
  cancelledAt: r.cancelled_at ? String(r.cancelled_at) : null,
  cancelledBy: r.cancelled_by ? String(r.cancelled_by) : null,
})

/** Commandes qui comptent : une annulation sort des totaux mais reste à l'écran. */
export const isActive = (o: Order) => !o.cancelledAt

async function fetchAll(): Promise<DB> {
  const [shop, cashiers, products, sessions, orders] = await Promise.all([
    supabase.from('cafe_shop').select('*').eq('id', true).maybeSingle(),
    supabase.from('cafe_cashiers_public').select('*'),
    supabase.from('cafe_products').select('*').order('created_at'),
    supabase.from('cafe_sessions').select('*').order('opened_at', { ascending: false }),
    supabase.from('cafe_orders').select('*').order('number', { ascending: false }).limit(500),
  ])

  const err = shop.error || cashiers.error || products.error || sessions.error || orders.error
  if (err) throw err

  return {
    shop: shop.data ? toShop(shop.data) : EMPTY.shop,
    cashiers: (cashiers.data ?? []).map((r) => ({ id: String(r.id), name: String(r.name), admin: Boolean(r.admin) })),
    products: (products.data ?? []).map(toProduct),
    sessions: (sessions.data ?? []).map(toSession),
    orders: (orders.data ?? []).map(toOrder),
  }
}

/**
 * Charge l'état du café depuis Supabase et le garde à jour en temps réel :
 * le téléphone du gérant et le poste de caisse voient la même chose.
 */
export function useDB() {
  const [db, setDb] = useState<DB>(EMPTY)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef(false)
  const queued = useRef(false)

  const reload = useCallback(async () => {
    if (pending.current) {
      queued.current = true
      return
    }
    pending.current = true
    try {
      setDb(await fetchAll())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      pending.current = false
      setReady(true)
      if (queued.current) {
        queued.current = false
        void reload()
      }
    }
  }, [])

  useEffect(() => {
    void reload()

    const channel = supabase
      .channel('cafe-pos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cafe_orders' }, () => void reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cafe_sessions' }, () => void reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cafe_products' }, () => void reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cafe_shop' }, () => void reload())
      .subscribe()

    // Les caissiers ne sont pas écoutés en temps réel : leur table n'est pas lisible
    // par le client (codes protégés). Le rafraîchissement périodique s'en charge.

    // Filet de sécurité si le canal temps réel tombe (réseau du café).
    const poll = setInterval(() => void reload(), 60_000)

    return () => {
      void supabase.removeChannel(channel)
      clearInterval(poll)
    }
  }, [reload])

  return { db, ready, error, reload, ...useActions(reload) }
}

function useActions(reload: () => Promise<void>) {
  return {
    verifyPin: async (cashierId: string, pin: string) => {
      const { data, error } = await supabase.rpc('cafe_verify_pin', { p_cashier_id: cashierId, p_pin: pin })
      if (error) throw error
      return data === true
    },

    openSession: async (openedBy: string, openingFloat: number) => {
      const { error } = await supabase
        .from('cafe_sessions')
        .insert({ opened_by: openedBy, opening_float: openingFloat })
      if (error) throw error
      await reload()
    },

    closeSession: async (id: string, closedBy: string, countedCash: number) => {
      const { error } = await supabase
        .from('cafe_sessions')
        .update({ closed_at: new Date().toISOString(), closed_by: closedBy, counted_cash: countedCash })
        .eq('id', id)
      if (error) throw error
      await reload()
    },

    createOrder: async (input: {
      sessionId: string
      cashier: Cashier
      lines: OrderLine[]
      total: number
    }): Promise<Order> => {
      const { data, error } = await supabase
        .from('cafe_orders')
        .insert({
          session_id: input.sessionId,
          cashier_id: input.cashier.id,
          cashier_name: input.cashier.name,
          lines: input.lines,
          total: input.total,
        })
        .select()
        .single()
      if (error) throw error
      await reload()
      return toOrder(data)
    },

    // L'annulation est réservée au responsable : la base vérifie son code.
    cancelOrder: async (orderId: string, pin: string) => {
      const { data, error } = await supabase.rpc('cafe_cancel_order', { p_order_id: orderId, p_pin: pin })
      if (error) throw error
      await reload()
      return String(data)
    },

    updateShop: async (patch: Partial<Shop>) => {
      // Les champs de l'application sont en camelCase, les colonnes en snake_case.
      const columns: Record<keyof Shop, string> = {
        name: 'name',
        address: 'address',
        phone: 'phone',
        currency: 'currency',
        footer: 'footer',
        printerEnabled: 'printer_enabled',
        printerTransport: 'printer_transport',
        printerTarget: 'printer_target',
        printerAgentUrl: 'printer_agent_url',
        printerIp: 'printer_ip',
        printerPort: 'printer_port',
        printerCut: 'printer_cut',
        printerBeep: 'printer_beep',
      }
      const row = Object.fromEntries(Object.entries(patch).map(([k, v]) => [columns[k as keyof Shop], v]))
      const { error } = await supabase.from('cafe_shop').update(row).eq('id', true)
      if (error) throw error
      await reload()
    },

    addProduct: async (p: Omit<Product, 'id' | 'active'>) => {
      const { error } = await supabase.from('cafe_products').insert(p)
      if (error) throw error
      await reload()
    },

    removeProduct: async (id: string) => {
      const { error } = await supabase.from('cafe_products').delete().eq('id', id)
      if (error) throw error
      await reload()
    },

    updateProduct: async (id: string, patch: Partial<Product>) => {
      const { error } = await supabase.from('cafe_products').update(patch).eq('id', id)
      if (error) throw error
      await reload()
    },

    // La table des caissiers n'est lisible par personne côté client : sans cela,
    // PostgreSQL ne peut ni modifier ni supprimer une ligne qu'il ne « voit » pas.
    addCashier: async (name: string, pin: string) => {
      const { error } = await supabase.rpc('cafe_add_cashier', { p_name: name, p_pin: pin })
      if (error) throw error
      await reload()
    },

    setCashierPin: async (id: string, pin: string) => {
      const { error } = await supabase.rpc('cafe_set_cashier_pin', { p_cashier_id: id, p_pin: pin })
      if (error) throw error
      await reload()
    },

    removeCashier: async (id: string) => {
      const { error } = await supabase.rpc('cafe_delete_cashier', { p_cashier_id: id })
      if (error) throw error
      await reload()
    },
  }
}

/** Les erreurs Supabase ne sont pas des Error : sans cela on affiche « [object Object] ». */
export function errorText(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object') {
    const o = e as { message?: unknown; hint?: unknown; details?: unknown; code?: unknown }
    const parts = [o.message, o.details, o.hint].filter((v) => typeof v === 'string' && v)
    if (parts.length) return parts.join(' — ')
    if (o.code) return `Erreur ${String(o.code)}`
  }
  return String(e)
}

export type Actions = ReturnType<typeof useActions>

// Les montants restent lus de gauche à droite, même quand l'interface est en RTL.
export const money = (n: number, currency = 'DH') =>
  `\u2066${n.toFixed(2).replace('.', ',')} ${currency}\u2069`

export const dateFR = (iso: string) =>
  '\u2066' + new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }) + '\u2069'

export const timeFR = (iso: string) =>
  '\u2066' + new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + '\u2069'
