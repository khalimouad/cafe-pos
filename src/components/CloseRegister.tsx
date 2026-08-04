import { useMemo, useState } from 'react'
import type { Order, Session, Shop } from '../lib/types'
import { dateFR, money } from '../lib/store'

type Props = {
  session: Session
  orders: Order[]
  shop: Shop
  cashierName: string
  onCancel: () => void
  onClose: (countedCash: number) => void
}

export default function CloseRegister({ session, orders, shop, cashierName, onCancel, onClose }: Props) {
  const sales = orders.reduce((s, o) => s + o.total, 0)
  const expected = session.openingFloat + sales
  const [counted, setCounted] = useState(String(expected))
  const countedNum = Number(counted.replace(',', '.')) || 0
  const diff = countedNum - expected

  const perCashier = useMemo(() => {
    const map = new Map<string, { name: string; count: number; total: number }>()
    orders.forEach((o) => {
      const e = map.get(o.cashierId) ?? { name: o.cashierName, count: 0, total: 0 }
      e.count += 1
      e.total += o.total
      map.set(o.cashierId, e)
    })
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [orders])

  return (
    <div className="screen">
      <div className="panel" style={{ maxWidth: 560 }}>
        <h1>Fermeture de caisse</h1>
        <p className="sub">
          Ouverte le {dateFR(session.openedAt)} par {session.openedBy} · fermeture par {cashierName}
        </p>

        <div className="stats" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <div className="stat">
            <div className="k">Tickets</div>
            <div className="v">{orders.length}</div>
          </div>
          <div className="stat">
            <div className="k">Ventes espèces</div>
            <div className="v green">{money(sales, shop.currency)}</div>
          </div>
          <div className="stat">
            <div className="k">Fond de caisse</div>
            <div className="v" style={{ fontSize: 20 }}>{money(session.openingFloat, shop.currency)}</div>
          </div>
          <div className="stat">
            <div className="k">Attendu en caisse</div>
            <div className="v" style={{ fontSize: 20 }}>{money(expected, shop.currency)}</div>
          </div>
        </div>

        {perCashier.length > 0 && (
          <div className="list" style={{ marginBottom: 20 }}>
            <table className="simple">
              <thead><tr><th>Caissier</th><th>Tickets</th><th>Total</th></tr></thead>
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

        <div className="field">
          <label>Espèces comptées dans le tiroir ({shop.currency})</label>
          <input
            className="input big"
            inputMode="decimal"
            value={counted}
            onChange={(e) => setCounted(e.target.value.replace(/[^0-9.,]/g, ''))}
          />
        </div>

        <div className="stat" style={{ marginBottom: 20 }}>
          <div className="k">Écart</div>
          <div className={`v ${diff === 0 ? '' : diff > 0 ? 'green' : 'red'}`}>
            {diff > 0 ? '+' : ''}{money(diff, shop.currency)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn ghost" style={{ flex: 1 }} onClick={onCancel}>Annuler</button>
          <button className="btn danger" style={{ flex: 2 }} onClick={() => onClose(countedNum)}>
            Fermer la caisse &amp; imprimer le Z
          </button>
        </div>
      </div>
    </div>
  )
}
