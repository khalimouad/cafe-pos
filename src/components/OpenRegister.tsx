import { useState } from 'react'
import { money } from '../lib/store'

type Props = {
  cashierName: string
  currency: string
  onOpen: (openingFloat: number) => void
}

const PRESETS = [0, 100, 200, 500]

export default function OpenRegister({ cashierName, currency, onOpen }: Props) {
  const [value, setValue] = useState('200')
  const amount = Number(value.replace(',', '.')) || 0

  return (
    <div className="screen">
      <div className="panel">
        <h1>Ouverture de caisse</h1>
        <p className="sub">
          La caisse est fermée. {cashierName}, indiquez le fond de caisse en espèces pour démarrer la journée.
        </p>

        <div className="field">
          <label>Fond de caisse ({currency})</label>
          <input
            className="input big"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^0-9.,]/g, ''))}
            autoFocus
          />
        </div>

        <div className="filters">
          {PRESETS.map((p) => (
            <button key={p} className="btn" onClick={() => setValue(String(p))}>
              {money(p, currency)}
            </button>
          ))}
        </div>

        <button className="btn primary block pay" onClick={() => onOpen(amount)}>
          Ouvrir la caisse
        </button>
      </div>
    </div>
  )
}
