import type { Order, Session, Shop } from './types'
import { dateFR, isActive, money } from './store'
import { getLang, translate } from './i18n'
import { ticketBytes, zReportBytes } from './escpos'
import { printerConfig, sendToPrinter } from './printer'

const CSS = `
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { font-family: "Courier New", monospace; font-size: 12px; color: #000; margin: 0; width: 72mm; }
  body.rtl { font-family: "Noto Naskh Arabic", "Amiri", "Segoe UI", sans-serif; font-size: 13px; }
  h1 { font-size: 15px; text-align: center; margin: 0 0 2px; letter-spacing: 1px; }
  .center { text-align: center; }
  .muted { font-size: 11px; }
  .sep { border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 0; vertical-align: top; }
  td.qty { width: 26px; }
  td.amt { text-align: end; white-space: nowrap; }
  .total { font-size: 15px; font-weight: bold; }
  .row { display: flex; justify-content: space-between; }
`

function send(title: string, body: string) {
  const rtl = getLang() === 'ma'
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  document.body.appendChild(frame)

  const doc = frame.contentDocument
  if (!doc) return
  doc.open()
  doc.write(
    `<!doctype html><html lang="${rtl ? 'ar' : 'fr'}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${title}</title><style>${CSS}</style></head><body class="${rtl ? 'rtl' : ''}">${body}</body></html>`,
  )
  doc.close()

  const go = () => {
    frame.contentWindow?.focus()
    frame.contentWindow?.print()
    setTimeout(() => frame.remove(), 1000)
  }
  if (doc.readyState === 'complete') setTimeout(go, 50)
  else frame.onload = () => setTimeout(go, 50)
}

const tp = (key: string, params?: Record<string, string | number>) => translate(getLang(), key, params)

const head = (shop: Shop) => `
  <h1>${shop.name}</h1>
  <div class="center muted">${shop.address}</div>
  <div class="center muted">${tp('tk_phone')} : <bdi>${shop.phone}</bdi></div>
  <div class="sep"></div>`

export type PrintResult = { direct: boolean; error?: string }

/**
 * Impression directe sur l'imprimante ticket via l'agent local. En cas d'échec
 * (agent éteint, imprimante débranchée), on retombe sur le dialogue du navigateur
 * pour que le client reparte quand même avec son ticket.
 */
async function direct(makeBytes: () => Uint8Array, shop: Shop, fallback: () => void): Promise<PrintResult> {
  const cfg = printerConfig(shop)
  if (!cfg.enabled) {
    fallback()
    return { direct: false }
  }
  try {
    await sendToPrinter(makeBytes(), cfg)
    return { direct: true }
  } catch (e) {
    fallback()
    return { direct: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export function printTicket(order: Order, shop: Shop): Promise<PrintResult> {
  return direct(
    () => ticketBytes(order, shop, { cut: shop.printerCut, beep: shop.printerBeep }),
    shop,
    () => browserTicket(order, shop),
  )
}

export function printZReport(
  session: Session,
  orders: Order[],
  shop: Shop,
  perCashier: { name: string; count: number; total: number }[],
): Promise<PrintResult> {
  return direct(
    () => zReportBytes(session, orders, shop, perCashier, { cut: shop.printerCut, beep: false }),
    shop,
    () => browserZReport(session, orders, shop, perCashier),
  )
}

function browserTicket(order: Order, shop: Shop) {
  const lines = order.lines
    .map(
      (l) => `<tr>
        <td class="qty">${l.qty}x</td>
        <td>${l.name}</td>
        <td class="amt">${money(l.price * l.qty, shop.currency)}</td>
      </tr>`,
    )
    .join('')

  send(
    `${tp('tk_ticket_no')}${order.number}`,
    `${head(shop)}
     <div class="row muted"><span>${tp('tk_ticket_no')} <bdi>${String(order.number).padStart(4, '0')}</bdi></span><span>${dateFR(order.createdAt)}</span></div>
     <div class="muted">${tp('tk_cashier')} : ${order.cashierName}</div>
     <div class="sep"></div>
     <table>${lines}</table>
     <div class="sep"></div>
     <div class="row total"><span>${tp('tk_total')}</span><span>${money(order.total, shop.currency)}</span></div>
     <div class="row muted"><span>${tp('tk_payment')}</span><span>${tp('tk_cash')}</span></div>
     <div class="sep"></div>
     <div class="center muted">${shop.footer}</div>`,
  )
}

function browserZReport(
  session: Session,
  orders: Order[],
  shop: Shop,
  perCashier: { name: string; count: number; total: number }[],
) {
  const active = orders.filter(isActive)
  const cancelled = orders.filter((o) => !isActive(o))
  const total = active.reduce((s, o) => s + o.total, 0)
  const expected = session.openingFloat + total
  const counted = session.countedCash ?? expected
  const diff = counted - expected

  const rows = perCashier
    .map((c) => `<div class="row"><span>${c.name} (${c.count})</span><span>${money(c.total, shop.currency)}</span></div>`)
    .join('')

  send(
    tp('tk_z_title'),
    `${head(shop)}
     <div class="center"><b>${tp('tk_z_title')}</b></div>
     <div class="sep"></div>
     <div class="row muted"><span>${tp('tk_opened')}</span><span>${dateFR(session.openedAt)}</span></div>
     <div class="row muted"><span>${tp('tk_closed')}</span><span>${dateFR(session.closedAt ?? new Date().toISOString())}</span></div>
     <div class="row muted"><span>${tp('tk_opened_by')}</span><span>${session.openedBy}</span></div>
     <div class="row muted"><span>${tp('tk_closed_by')}</span><span>${session.closedBy ?? '-'}</span></div>
     <div class="sep"></div>
     <div class="row"><span>${tp('tk_count')}</span><span>${active.length}</span></div>
     ${cancelled.length ? `<div class="row"><span>${tp('tk_cancelled')}</span><span>${cancelled.length} · ${money(cancelled.reduce((s2, o) => s2 + o.total, 0), shop.currency)}</span></div>` : ''}
     <div class="row"><span>${tp('tk_float')}</span><span>${money(session.openingFloat, shop.currency)}</span></div>
     <div class="row"><span>${tp('tk_sales')}</span><span>${money(total, shop.currency)}</span></div>
     <div class="sep"></div>
     ${rows}
     <div class="sep"></div>
     <div class="row"><span>${tp('tk_expected')}</span><span>${money(expected, shop.currency)}</span></div>
     <div class="row"><span>${tp('tk_counted')}</span><span>${money(counted, shop.currency)}</span></div>
     <div class="row total"><span>${tp('tk_diff')}</span><span>${money(diff, shop.currency)}</span></div>
     <div class="sep"></div>
     <div class="center muted">${shop.footer}</div>`,
  )
}
