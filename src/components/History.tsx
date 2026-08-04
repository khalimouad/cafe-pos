import { useMemo, useState } from 'react'
import type { Cashier, Order, Session, Shop } from '../lib/types'
import { dateFR, money, timeFR } from '../lib/store'
import { printTicket } from '../lib/print'

type Props = {
  orders: Order[]
  sessions: Session[]
  cashiers: Cashier[]
  shop: Shop
  currentSessionId: string | null
}

type Range = 'session' | 'jour' | 'tout'

export default function History({ orders, sessions, cashiers, shop, currentSessionId }: Props) {
  const [range, setRange] = useState<Range>(currentSessionId ? 'session' : 'jour')
  const [cashierId, setCashierId] = useState('tous')
  const [openId, setOpenId] = useState<string | null>(null)

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

  const total = filtered.reduce((s, o) => s + o.total, 0)
  const avg = filtered.length ? total / filtered.length : 0

  const perCashier = useMemo(() => {
    const map = new Map<string, { name: string; count: number; total: number }>()
    filtered.forEach((o) => {
      const e = map.get(o.cashierId) ?? { name: o.cashierName, count: 0, total: 0 }
      e.count += 1
      e.total += o.total
      map.set(o.cashierId, e)
    })
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [filtered])

  const sessionOf = (id: string) => sessions.find((s) => s.id === id)

  return (
    <div className="page">
      <h1>Historique des commandes</h1>
      <p className="sub">Toutes les commandes sont réglées en espèces au moment de la validation.</p>

      <div className="filters">
        {([['session', 'Session en cours'], ['jour', "Aujourd'hui"], ['tout', 'Tout']] as [Range, string][]).map(
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
          <option value="tous">Tous les caissiers</option>
          {cashiers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="k">Commandes</div>
          <div className="v">{filtered.length}</div>
        </div>
        <div className="stat">
          <div className="k">Total encaissé</div>
          <div className="v green">{money(total, shop.currency)}</div>
        </div>
        <div className="stat">
          <div className="k">Ticket moyen</div>
          <div className="v">{money(avg, shop.currency)}</div>
        </div>
        {perCashier.slice(0, 1).map((c) => (
          <div className="stat" key={c.name}>
            <div className="k">Meilleur caissier</div>
            <div className="v" style={{ fontSize: 20 }}>{c.name}</div>
          </div>
        ))}
      </div>

      {perCashier.length > 1 && (
        <div className="list" style={{ marginBottom: 24 }}>
          <table className="simple">
            <thead>
              <tr><th>Caissier</th><th>Commandes</th><th>Total</th></tr>
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
          <div className="item" style={{ color: 'var(--muted)' }}>Aucune commande pour ce filtre.</div>
        </div>
      ) : (
        <div className="list">
          {filtered.map((o) => {
            const s = sessionOf(o.sessionId)
            return (
              <div key={o.id}>
                <div className="item" onClick={() => setOpenId(openId === o.id ? null : o.id)} style={{ cursor: 'pointer' }}>
                  <div className="num">#{String(o.number).padStart(4, '0')}</div>
                  <div className="who">
                    <div className="n">{o.cashierName} — {o.lines.reduce((s2, l) => s2 + l.qty, 0)} article(s)</div>
                    <div className="d">
                      {dateFR(o.createdAt)}
                      {s ? ` · caisse du ${new Date(s.openedAt).toLocaleDateString('fr-FR')}` : ''}
                    </div>
                  </div>
                  <div className="tot">{money(o.total, shop.currency)}</div>
                  <button
                    className="btn ghost"
                    style={{ padding: '8px 12px', fontSize: 13 }}
                    onClick={(e) => { e.stopPropagation(); printTicket(o, shop) }}
                  >
                    Réimprimer
                  </button>
                </div>
                {openId === o.id && (
                  <div className="detail" style={{ margin: '0 18px 14px' }}>
                    {o.lines.map((l) => (
                      <div className="dl" key={l.productId}>
                        <span>{l.qty} × {l.name}</span>
                        <span>{money(l.price * l.qty, shop.currency)}</span>
                      </div>
                    ))}
                    <div className="dl" style={{ color: 'var(--text)', fontWeight: 700, marginTop: 6 }}>
                      <span>Total espèces — {timeFR(o.createdAt)}</span>
                      <span>{money(o.total, shop.currency)}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
