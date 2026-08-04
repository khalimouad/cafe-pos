import { useState } from 'react'
import type { Cashier } from '../lib/types'

type Props = {
  cashiers: Cashier[]
  shopName: string
  onLogin: (c: Cashier) => void
}

export default function Login({ cashiers, shopName, onLogin }: Props) {
  const [selected, setSelected] = useState<Cashier | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const press = (d: string) => {
    if (pin.length >= 4) return
    const next = pin + d
    setPin(next)
    setError('')
    if (next.length === 4 && selected) {
      if (next === selected.pin) {
        onLogin(selected)
      } else {
        setError('Code incorrect')
        setTimeout(() => setPin(''), 350)
      }
    }
  }

  return (
    <div className="screen">
      <div className="panel">
        <h1>{shopName}</h1>
        <p className="sub">
          {selected ? `Bonjour ${selected.name}, saisissez votre code` : 'Choisissez votre profil caissier'}
        </p>

        {!selected ? (
          <div className="users">
            {cashiers.map((c) => (
              <button key={c.id} className="user" onClick={() => setSelected(c)}>
                <span className="avatar">{c.name.slice(0, 2).toUpperCase()}</span>
                <span className="nm">{c.name}</span>
                <span className="rl">{c.admin ? 'Responsable' : 'Caissier'}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <input className="input big" value={pin.replace(/./g, '•')} readOnly placeholder="••••" />
            {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
            <div className="keypad">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button key={d} onClick={() => press(d)}>{d}</button>
              ))}
              <button onClick={() => setPin('')}>C</button>
              <button onClick={() => press('0')}>0</button>
              <button onClick={() => setPin(pin.slice(0, -1))}>←</button>
            </div>
            <button className="btn ghost block" onClick={() => { setSelected(null); setPin(''); setError('') }}>
              Changer de caissier
            </button>
          </>
        )}
      </div>
    </div>
  )
}
