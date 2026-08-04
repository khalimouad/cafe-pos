import { useCallback, useEffect, useState } from 'react'
import type { DB } from './types'

const KEY = 'cafe-pos-db-v1'

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

export const defaultDB = (): DB => ({
  shop: {
    name: 'Café Central',
    address: 'Av. Mohammed V, Casablanca',
    phone: '06 00 00 00 00',
    currency: 'DH',
    footer: 'Merci de votre visite !',
  },
  cashiers: [
    { id: uid(), name: 'Youssef', pin: '1111', admin: true },
    { id: uid(), name: 'Salma', pin: '2222', admin: false },
    { id: uid(), name: 'Karim', pin: '3333', admin: false },
  ],
  products: [
    { id: uid(), name: 'Café noir', price: 10, category: 'Boissons chaudes', emoji: '☕', active: true },
    { id: uid(), name: 'Café cassé', price: 12, category: 'Boissons chaudes', emoji: '☕', active: true },
    { id: uid(), name: 'Nous-nous', price: 13, category: 'Boissons chaudes', emoji: '🥛', active: true },
    { id: uid(), name: 'Thé à la menthe', price: 12, category: 'Boissons chaudes', emoji: '🫖', active: true },
    { id: uid(), name: 'Chocolat chaud', price: 18, category: 'Boissons chaudes', emoji: '🍫', active: true },
    { id: uid(), name: 'Jus d’orange', price: 18, category: 'Boissons fraîches', emoji: '🍊', active: true },
    { id: uid(), name: 'Jus d’avocat', price: 22, category: 'Boissons fraîches', emoji: '🥑', active: true },
    { id: uid(), name: 'Eau minérale', price: 8, category: 'Boissons fraîches', emoji: '💧', active: true },
    { id: uid(), name: 'Soda', price: 12, category: 'Boissons fraîches', emoji: '🥤', active: true },
    { id: uid(), name: 'Croissant', price: 6, category: 'Snacks', emoji: '🥐', active: true },
    { id: uid(), name: 'Msemen', price: 6, category: 'Snacks', emoji: '🫓', active: true },
    { id: uid(), name: 'Sandwich thon', price: 25, category: 'Snacks', emoji: '🥪', active: true },
    { id: uid(), name: 'Part de gâteau', price: 15, category: 'Snacks', emoji: '🍰', active: true },
  ],
  sessions: [],
  orders: [],
  orderCounter: 0,
})

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultDB()
    const parsed = JSON.parse(raw) as DB
    // garde-fou simple contre un stockage corrompu
    if (!parsed.products || !parsed.cashiers) return defaultDB()
    return parsed
  } catch {
    return defaultDB()
  }
}

let memory: DB = load()
const listeners = new Set<(db: DB) => void>()

function persist() {
  localStorage.setItem(KEY, JSON.stringify(memory))
  listeners.forEach((l) => l(memory))
}

export function useDB() {
  const [db, setLocal] = useState<DB>(memory)

  useEffect(() => {
    const l = (next: DB) => setLocal(next)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])

  const update = useCallback((fn: (draft: DB) => DB) => {
    memory = fn(memory)
    persist()
  }, [])

  return { db, update }
}

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
