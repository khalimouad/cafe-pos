import { useMemo, useState } from 'react'
import type { Cashier, Order, Session, Shop } from '../lib/types'
import { dateFR, isActive, money, timeFR } from '../lib/store'
import { printTicket } from '../lib/print'
import { useI18n } from '../lib/i18n'
import CancelOrder from './CancelOrder'

type Props = {
  orders: Order[]
  sessions: Session[]
  cashiers: Cashier[]
  shop: Shop
  currentSessionId: string | null
  onCancelOrder?: (order: Order, pin: string) => Promise<void>
}

type Range = 'session' | 'jour' | 'tout'

export default function History({ orders, sessions, cashiers, shop, currentSessionId, onCancelOrder }: Props) {
  const { t } = useI18n()
  const [range, setRange] = useState<Range>(currentSessionId ? 'session' : 'jour')
  const [cashierId, setCashierId] = useState('tous')
  const [openId, setOpenId] = useState<string | null>(null)
  const [toCancel, setToCancel] = useState<Order | null>(null)

  const filtered = useMemo(() => {
    const today = new Date().toDateString()
    return orders
      .filter((o) => {
        if (range === 'session') return o.sessionId === currentSessionId
        if (range === 'jour') return new Date(o.createdAt).toDateString() === today
        return true
      })
      .filter((o) => cashierId === 'tous' || o.cashierId === cashierId)
      .sort((a, b) => b.number - a.number)
  }, [orders, range, cashierId, currentSessionId])

  // Une commande annulée reste affichée mais ne compte dans aucun total.
  const active = filtered.filter(isActive)
  const cancelled = filtered.filter((o) => !isActive(o))
  const total = active.reduce((s, o) => s + o.total, 0)
  const avg = active.length ? total / active.length : 0

  const perCashier = useMemo(() => {
    const map = new Map<string, { name: string; count: number; total: number }>()
    active.forEach((o) => {
      const key = o.cashierId ?? o.cashierName
      const e = map.get(key) ?? { name: o.cashierName, count: 0, total: 0 }
      e.count += 1
      e.total += o.total
      map.set(key, e)
    })
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [active])

  const sessionOf = (id: string) => sessions.find((s) => s.id === id)

  // Le gérant consulte souvent cet écran depuis son téléphone : on rappelle l'état
  // de la caisse du poste, partagée par tous les appareils.
  const current = sessions.find((s) => s.id === currentSessionId && !s.closedAt)

  return (
    <div className="page">
      <h1>{t('hist_title')}</h1>
      <p className="sub">{t('hist_sub')}</p>
      <p className="sub">
        <span className={`dot${current ? '' : ' off'}`} style={{ display: 'inline-block', marginInlineEnd: 8 }} />
        {current
          ? t('register_opened_by', { name: current.openedBy, time: timeFR(current.openedAt) })
          : t('register_closed')}
      </p>

      <div className="filters">
        {([['session', t('filter_session')], ['jour', t('filter_today')], ['tout', t('filter_all')]] as [Range, string][]).map(
          ([k, label]) => (
            <button
              key={k}
              className={`cat${range === k ? ' active' : ''}`}
              disabled={k === 'session' && !currentSessionId}
              onClick={() => setRange(k)}
            >
              {label}
            </button>
          ),
        )}
        <select className="input" style={{ width: 'auto' }} value={cashierId} onChange={(e) => setCashierId(e.target.value)}>
          <option value="tous">{t('filter_cashiers')}</option>
          {cashiers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="k">{t('stat_orders')}</div>
          <div className="v">{active.length}</div>
        </div>
        <div className="stat">
          <div className="k">{t('stat_total')}</div>
          <div className="v green">{money(total, shop.currency)}</div>
        </div>
        <div className="stat">
          <div className="k">{t('stat_avg')}</div>
          <div className="v">{money(avg, shop.currency)}</div>
        </div>
        {cancelled.length > 0 && (
          <div className="stat">
            <div className="k">{t('stat_cancelled')}</div>
            <div className="v red">{cancelled.length}</div>
          </div>
        )}
        {perCashier.slice(0, 1).map((c) => (
          <div className="stat" key={c.name}>
            <div className="k">{t('stat_best')}</div>
            <div className="v" style={{ fontSize: 20 }}>{c.name}</div>
          </div>
        ))}
      </div>

      {perCashier.length > 1 && (
        <div className="list scroll-x" style={{ marginBottom: 24 }}>
          <table className="simple">
            <thead>
              <tr><th>{t('th_cashier')}</th><th>{t('th_orders')}</th><th>{t('th_total')}</th></tr>
            </thead>
            <tbody>
              {perCashier.map((c) => (
                <tr key={c.name}>
                  <td>{c.name}</td>
                  <td>{c.count}</td>
                  <td>{money(c.total, shop.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="list">
          <div className="item" style={{ color: 'var(--muted)' }}>{t('hist_empty')}</div>
        </div>
      ) : (
        <div className="list">
          {filtered.map((o) => {
            const s = sessionOf(o.sessionId)
            return (
              <div key={o.id}>
                <div className={`item${isActive(o) ? '' : ' cancelled'}`} onClick={() => setOpenId(openId === o.id ? null : o.id)}>
                  <div className="num">#{String(o.number).padStart(4, '0')}</div>
                  <div className="who">
                    <div className="n">
                      {o.cashierName} — {t('hist_items', { n: o.lines.reduce((s2, l) => s2 + l.qty, 0) })}
                      {!isActive(o) && <span className="badge">{t('cancelled_badge')}</span>}
                    </div>
                    <div className="d">
                      {isActive(o)
                        ? `${dateFR(o.createdAt)}${s ? ` · ${t('hist_register_of', { date: new Date(s.openedAt).toLocaleDateString('fr-FR') })}` : ''}`
                        : t('cancelled_by', { name: o.cancelledBy ?? '' })}
                    </div>
                  </div>
                  <div className="tot">{money(o.total, shop.currency)}</div>
                  {onCancelOrder && isActive(o) && o.sessionId === currentSessionId && (
                    <button
                      className="btn danger small"
                      onClick={(e) => { e.stopPropagation(); setToCancel(o) }}
                    >
                      {t('cancel_order')}
                    </button>
                  )}
                  <button
                    className="btn ghost small"
                    onClick={(e) => { e.stopPropagation(); void printTicket(o, shop) }}
                  >
                    {t('hist_reprint')}
                  </button>
                </div>
                {openId === o.id && (
                  <div className="detail">
                    {o.lines.map((l) => (
                      <div className="dl" key={l.productId}>
                        <span>{l.qty} × {l.name}</span>
                        <span>{money(l.price * l.qty, shop.currency)}</span>
                      </div>
                    ))}
                    <div className="dl strong">
                      <span>{t('hist_total_at', { time: timeFR(o.createdAt) })}</span>
                      <span>{money(o.total, shop.currency)}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {toCancel && onCancelOrder && (
        <CancelOrder
          order={toCancel}
          shop={shop}
          onCancel={() => setToCancel(null)}
          onConfirm={async (pin) => {
            await onCancelOrder(toCancel, pin)
            setToCancel(null)
          }}
        />
      )}
    </div>
  )
}
