import { useState } from 'react'
import type { Shop } from '../lib/types'
import { testBytes } from '../lib/escpos'
import { mixedContentBlocked, pingPrinter, printerConfig, sendToPrinter } from '../lib/printer'
import { useI18n } from '../lib/i18n'
import { errorText } from '../lib/store'

type Props = {
  shop: Shop
  updateShop: (patch: Partial<Shop>) => Promise<void>
}

/**
 * Réglage de l'imprimante réduit à l'essentiel : le ticket part sur l'imprimante
 * partagée par Windows. Les autres branchements (réseau, USB direct, CUPS) restent
 * gérés par l'agent, mais n'encombrent plus l'écran.
 */
export default function PrinterSettings({ shop, updateShop }: Props) {
  const { t } = useI18n()
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [shares, setShares] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const cfg = printerConfig(shop)

  // « Failed to fetch » ne dit pas pourquoi : on nomme la cause quand on la connaît.
  const diagnose = (e: unknown) => {
    if (e instanceof Error && e.name === 'AgentError') return t('printer_refused', { detail: e.message })
    if (mixedContentBlocked(cfg)) return t('printer_mixed_content', { url: cfg.agentUrl })
    return t('printer_no_agent', { detail: errorText(e), url: `${cfg.agentUrl}/health` })
  }

  const check = async () => {
    setBusy(true)
    setStatus(null)
    try {
      const r = await pingPrinter(cfg)
      setShares(r.windowsPrinters ?? [])
      setStatus(
        r.printer
          ? { ok: true, text: t('printer_ok', { target: r.target ?? '' }) }
          : { ok: false, text: t('printer_unreachable', { detail: r.detail ?? '' }) },
      )
    } catch (e) {
      setStatus({ ok: false, text: diagnose(e) })
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
      setStatus({ ok: false, text: diagnose(e) })
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
      <p className="sub">{t('printer_sub_share')}</p>

      <div className="list pad" style={{ marginBottom: 16 }}>
        <div className="stats" style={{ margin: 0 }}>
          <div className="field" style={{ margin: 0 }}>
            <label>{t('printer_direct')}</label>
            {toggle('printerEnabled')}
          </div>

          <div className="field" style={{ margin: 0, gridColumn: 'span 2' }}>
            <label>{t('printer_share')}</label>
            <input
              className="input"
              dir="ltr"
              key={`target-${shop.printerTarget}`}
              defaultValue={shop.printerTarget}
              placeholder="\\DESKTOP-XXXX\POS80"
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v !== shop.printerTarget) void updateShop({ printerTarget: v, printerTransport: 'windows' })
              }}
            />
            {shares.length > 0 && (
              <p className="sub" style={{ margin: '6px 0 0' }}>
                {t('printer_windows_list', { list: shares.join(', ') })}
              </p>
            )}
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

        {status && <p className={status.ok ? 'ok-msg' : 'error'} style={{ marginBottom: 0 }}>{status.text}</p>}
      </div>
    </>
  )
}
