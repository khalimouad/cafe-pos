import { useState } from 'react'
import type { Cashier } from '../lib/types'
import { useI18n } from '../lib/i18n'
import LangSwitch from './LangSwitch'

type Props = {
  cashiers: Cashier[]
  shopName: string
  verifyPin: (cashierId: string, pin: string) => Promise<boolean>
  onLogin: (c: Cashier) => void
}

export default function Login({ cashiers, shopName, verifyPin, onLogin }: Props) {
  const { t } = useI18n()
  const [selected, setSelected] = useState<Cashier | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  const press = async (d: string) => {
    if (pin.length >= 4 || checking) return
    const next = pin + d
    setPin(next)
    setError('')
    if (next.length < 4 || !selected) return

    setChecking(true)
    try {
      if (await verifyPin(selected.id, next)) {
        onLogin(selected)
        return
      }
      setError(t('login_wrong'))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setChecking(false)
      setTimeout(() => setPin(''), 300)
    }
  }

  return (
    <div className="screen">
      <div className="panel">
        <div className="panel-top">
          <h1>{shopName}</h1>
          <LangSwitch />
        </div>
        <p className="sub">{selected ? t('login_pin', { name: selected.name }) : t('login_pick')}</p>

        {!selected ? (
          <div className="users">
            {cashiers.map((c) => (
              <button key={c.id} className="user" onClick={() => setSelected(c)}>
                <span className="avatar">{c.name.slice(0, 2).toUpperCase()}</span>
                <span className="nm">{c.name}</span>
                <span className="rl">{c.admin ? t('role_manager') : t('role_cashier')}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <input className="input big" dir="ltr" value={pin.replace(/./g, '•')} readOnly placeholder="••••" />
            {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
            <div className="keypad">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button key={d} onClick={() => void press(d)}>{d}</button>
              ))}
              <button onClick={() => setPin('')}>C</button>
              <button onClick={() => void press('0')}>0</button>
              <button onClick={() => setPin(pin.slice(0, -1))}>⌫</button>
            </div>
            <button className="btn ghost block" onClick={() => { setSelected(null); setPin(''); setError('') }}>
              {t('login_back')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
