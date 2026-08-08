import { useState } from 'react'
import type { Order, Shop } from '../lib/types'
import { errorText, money } from '../lib/store'
import { useI18n } from '../lib/i18n'

type Props = {
  order: Order
  shop: Shop
  onCancel: () => void
  onConfirm: (pin: string) => Promise<void>
}

/** Demande le code du responsable avant d'annuler une commande déjà encaissée. */
export default function CancelOrder({ order, shop, onCancel, onConfirm }: Props) {
  const { t } = useI18n()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (pin.length !== 4 || busy) return
    setBusy(true)
    setError('')
    try {
      await onConfirm(pin)
    } catch (e) {
      setError(errorText(e))
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-bg" onClick={onCancel}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <h1>{t('cancel_title', { n: order.number })}</h1>
        <p className="sub">{t('cancel_sub', { amount: money(order.total, shop.currency) })}</p>

        <input
          className="input big"
          dir="ltr"
          inputMode="numeric"
          autoFocus
          value={pin.replace(/./g, '•')}
          placeholder="••••"
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
        />
        {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}

        <div className="keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} onClick={() => setPin((p) => (p + d).slice(0, 4))}>{d}</button>
          ))}
          <button onClick={() => setPin('')}>C</button>
          <button onClick={() => setPin((p) => (p + '0').slice(0, 4))}>0</button>
          <button onClick={() => setPin((p) => p.slice(0, -1))}>⌫</button>
        </div>

        <div className="actions">
          <button className="btn ghost" onClick={onCancel}>{t('cancel')}</button>
          <button className="btn danger grow" disabled={pin.length !== 4 || busy} onClick={() => void submit()}>
            {t('cancel_confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
