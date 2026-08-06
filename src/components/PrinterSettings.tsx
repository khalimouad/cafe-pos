import { useState } from 'react'
import type { PrinterTransport, Shop } from '../lib/types'
import { testBytes } from '../lib/escpos'
import { pingPrinter, printerConfig, sendToPrinter } from '../lib/printer'
import { useI18n } from '../lib/i18n'

type Props = {
  shop: Shop
  updateShop: (patch: Partial<Shop>) => Promise<void>
}

const TRANSPORTS: PrinterTransport[] = ['tcp', 'usb', 'cups', 'windows']

export default function PrinterSettings({ shop, updateShop }: Props) {
  const { t } = useI18n()
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [devices, setDevices] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const cfg = printerConfig(shop)
  const network = shop.printerTransport === 'tcp'

  const check = async () => {
    setBusy(true)
    setStatus(null)
    try {
      const r = await pingPrinter(cfg)
      setDevices(r.usbDevices ?? [])
      setStatus(
        r.printer
          ? { ok: true, text: t('printer_ok', { target: r.target ?? '' }) }
          : { ok: false, text: t('printer_unreachable', { detail: r.detail ?? '' }) },
      )
    } catch (e) {
      setStatus({ ok: false, text: t('printer_no_agent', { detail: e instanceof Error ? e.message : String(e) }) })
    } finally {
      setBusy(false)
    }
  }

  const testPrint = async () => {
    setBusy(true)
    setStatus(null)
    try {
      await sendToPrinter(testBytes(shop, { cut: shop.printerCut, beep: shop.printerBeep }), cfg)
      setStatus({ ok: true, text: t('printer_test_sent') })
    } catch (e) {
      setStatus({ ok: false, text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  const toggle = (key: 'printerEnabled' | 'printerCut' | 'printerBeep') => (
    <button className="btn ghost small" onClick={() => void updateShop({ [key]: !shop[key] })}>
      {shop[key] ? t('yes') : t('no')}
    </button>
  )

  const text = (key: 'printerAgentUrl' | 'printerIp' | 'printerTarget', numeric = false) => (
    <input
      className="input"
      dir="ltr"
      inputMode={numeric ? 'numeric' : 'text'}
      defaultValue={String(shop[key])}
      key={`${key}-${shop[key]}`}
      onBlur={(e) => {
        const v = e.target.value.trim()
        if (v !== shop[key]) void updateShop({ [key]: v })
      }}
    />
  )

  return (
    <>
      <h2 className="section">{t('printer_title')}</h2>
      <p className="sub">{t('printer_sub')}</p>

      <div className="list pad" style={{ marginBottom: 16 }}>
        <div className="stats" style={{ margin: 0 }}>
          <div className="field" style={{ margin: 0 }}>
            <label>{t('printer_direct')}</label>
            {toggle('printerEnabled')}
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label>{t('printer_transport')}</label>
            <select
              className="input"
              value={shop.printerTransport}
              onChange={(e) => void updateShop({ printerTransport: e.target.value as PrinterTransport })}
            >
              {TRANSPORTS.map((tr) => (
                <option key={tr} value={tr}>{t(`printer_transport_${tr}`)}</option>
              ))}
            </select>
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label>{t('printer_agent_url')}</label>
            {text('printerAgentUrl')}
          </div>

          {network ? (
            <>
              <div className="field" style={{ margin: 0 }}>
                <label>{t('printer_ip')}</label>
                {text('printerIp')}
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>{t('printer_port')}</label>
                <input
                  className="input"
                  dir="ltr"
                  inputMode="numeric"
                  defaultValue={String(shop.printerPort)}
                  onBlur={(e) => {
                    const port = Number(e.target.value)
                    if (port > 0 && port !== shop.printerPort) void updateShop({ printerPort: port })
                  }}
                />
              </div>
            </>
          ) : (
            <div className="field" style={{ margin: 0 }}>
              <label>{t(`printer_target_${shop.printerTransport}`)}</label>
              {text('printerTarget')}
              {devices.length > 0 && (
                <p className="sub" style={{ margin: '6px 0 0' }}>
                  {t('printer_devices', { list: devices.join(', ') })}
                </p>
              )}
            </div>
          )}

          <div className="field" style={{ margin: 0 }}>
            <label>{t('printer_cut')}</label>
            {toggle('printerCut')}
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>{t('printer_beep')}</label>
            {toggle('printerBeep')}
          </div>
        </div>

        <div className="form-row" style={{ marginTop: 18 }}>
          <button className="btn" disabled={busy} onClick={() => void check()}>{t('printer_check')}</button>
          <button className="btn primary" disabled={busy} onClick={() => void testPrint()}>{t('printer_test')}</button>
        </div>

        {status && <p className={status.ok ? 'ok-msg' : 'error'} style={{ marginBottom: 0 }}>{status.text}</p>}
      </div>
    </>
  )
}
