import { useState } from 'react'
import type { Shop } from '../lib/types'
import { testBytes } from '../lib/escpos'
import { pingPrinter, printerConfig, sendToPrinter } from '../lib/printer'
import { useI18n } from '../lib/i18n'

type Props = {
  shop: Shop
  updateShop: (patch: Partial<Shop>) => Promise<void>
}

export default function PrinterSettings({ shop, updateShop }: Props) {
  const { t } = useI18n()
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const cfg = printerConfig(shop)

  const check = async () => {
    setBusy(true)
    setStatus(null)
    try {
      const r = await pingPrinter(cfg)
      setStatus(
        r.printer
          ? { ok: true, text: t('printer_ok', { ip: cfg.ip, port: cfg.port }) }
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
            <label>{t('printer_agent_url')}</label>
            <input
              className="input"
              dir="ltr"
              defaultValue={shop.printerAgentUrl}
              onBlur={(e) => {
                if (e.target.value !== shop.printerAgentUrl) void updateShop({ printerAgentUrl: e.target.value.trim() })
              }}
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>{t('printer_ip')}</label>
            <input
              className="input"
              dir="ltr"
              defaultValue={shop.printerIp}
              onBlur={(e) => {
                if (e.target.value !== shop.printerIp) void updateShop({ printerIp: e.target.value.trim() })
              }}
            />
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

        {status && (
          <p className={status.ok ? 'ok-msg' : 'error'} style={{ marginBottom: 0 }}>{status.text}</p>
        )}
      </div>
    </>
  )
}
