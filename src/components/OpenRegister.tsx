import { useState } from 'react'
import { money } from '../lib/store'
import { useI18n } from '../lib/i18n'

type Props = {
  cashierName: string
  currency: string
  busy: boolean
  onOpen: (openingFloat: number) => void
}

const PRESETS = [0, 100, 200, 500]

export default function OpenRegister({ cashierName, currency, busy, onOpen }: Props) {
  const { t } = useI18n()
  const [value, setValue] = useState('200')
  const amount = Number(value.replace(',', '.')) || 0

  return (
    <div className="screen">
      <div className="panel">
        <h1>{t('open_title')}</h1>
        <p className="sub">{t('open_sub', { name: cashierName })}</p>

        <div className="field">
          <label>{t('open_float', { currency })}</label>
          <input
            className="input big"
            dir="ltr"
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

        <button className="btn primary block pay" disabled={busy} onClick={() => onOpen(amount)}>
          {t('open_btn')}
        </button>
      </div>
    </div>
  )
}
