import { useMemo, useState } from 'react'
import type { Order, Session, Shop } from '../lib/types'
import { dateFR, isActive, money } from '../lib/store'
import { useI18n } from '../lib/i18n'

type Props = {
  session: Session
  orders: Order[]
  shop: Shop
  cashierName: string
  busy: boolean
  onCancel: () => void
  onClose: (countedCash: number) => void
}

export default function CloseRegister({ session, orders, shop, cashierName, busy, onCancel, onClose }: Props) {
  const { t } = useI18n()
  // Une commande annulée n'a pas laissé d'argent dans le tiroir.
  const active = orders.filter(isActive)
  const cancelled = orders.filter((o) => !isActive(o))
  const sales = active.reduce((s, o) => s + o.total, 0)
  const expected = session.openingFloat + sales
  const [counted, setCounted] = useState(String(expected))
  const countedNum = Number(counted.replace(',', '.')) || 0
  const diff = countedNum - expected

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

  return (
    <div className="screen">
      <div className="panel wide">
        <h1>{t('close_title')}</h1>
        <p className="sub">
          {t('close_sub', { date: dateFR(session.openedAt), opener: session.openedBy, closer: cashierName })}
        </p>

        <div className="stats two">
          <div className="stat">
            <div className="k">{t('close_tickets')}</div>
            <div className="v">{active.length}</div>
          </div>
          <div className="stat">
            <div className="k">{t('close_sales')}</div>
            <div className="v green">{money(sales, shop.currency)}</div>
          </div>
          <div className="stat">
            <div className="k">{t('close_float')}</div>
            <div className="v" style={{ fontSize: 20 }}>{money(session.openingFloat, shop.currency)}</div>
          </div>
          <div className="stat">
            <div className="k">{t('close_expected')}</div>
            <div className="v" style={{ fontSize: 20 }}>{money(expected, shop.currency)}</div>
          </div>
        </div>

        {cancelled.length > 0 && (
          <div className="stat" style={{ marginBottom: 20 }}>
            <div className="k">{t('stat_cancelled')}</div>
            <div className="v red">
              {cancelled.length} · {money(cancelled.reduce((s2, o) => s2 + o.total, 0), shop.currency)}
            </div>
          </div>
        )}

        {perCashier.length > 0 && (
          <div className="list scroll-x" style={{ marginBottom: 20 }}>
            <table className="simple">
              <thead><tr><th>{t('th_cashier')}</th><th>{t('close_tickets')}</th><th>{t('th_total')}</th></tr></thead>
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
          <label>{t('close_counted', { currency: shop.currency })}</label>
          <input
            className="input big"
            dir="ltr"
            inputMode="decimal"
            value={counted}
            onChange={(e) => setCounted(e.target.value.replace(/[^0-9.,-]/g, ''))}
          />
        </div>

        <div className="stat" style={{ marginBottom: 20 }}>
          <div className="k">{t('close_diff')}</div>
          <div className={`v ${diff === 0 ? '' : diff > 0 ? 'green' : 'red'}`}>
            {diff > 0 ? '+' : ''}{money(diff, shop.currency)}
          </div>
        </div>

        <div className="actions">
          <button className="btn ghost" onClick={onCancel}>{t('cancel')}</button>
          <button className="btn danger grow" disabled={busy} onClick={() => onClose(countedNum)}>
            {t('close_btn')}
          </button>
        </div>
      </div>
    </div>
  )
}
