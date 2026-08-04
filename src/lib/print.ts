import type { Order, Session, Shop } from './types'
import { dateFR, money } from './store'

const CSS = `
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { font-family: "Courier New", monospace; font-size: 12px; color: #000; margin: 0; width: 72mm; }
  h1 { font-size: 15px; text-align: center; margin: 0 0 2px; letter-spacing: 1px; }
  .center { text-align: center; }
  .muted { font-size: 11px; }
  .sep { border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 0; vertical-align: top; }
  td.qty { width: 26px; }
  td.amt { text-align: right; white-space: nowrap; }
  .total { font-size: 15px; font-weight: bold; }
  .row { display: flex; justify-content: space-between; }
`

function send(title: string, body: string) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  document.body.appendChild(frame)

  const doc = frame.contentDocument
  if (!doc) return
  doc.open()
  doc.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${title}</title><style>${CSS}</style></head><body>${body}</body></html>`)
  doc.close()

  const go = () => {
    frame.contentWindow?.focus()
    frame.contentWindow?.print()
    setTimeout(() => frame.remove(), 1000)
  }
  if (doc.readyState === 'complete') setTimeout(go, 50)
  else frame.onload = () => setTimeout(go, 50)
}

const head = (shop: Shop) => `
  <h1>${shop.name}</h1>
  <div class="center muted">${shop.address}</div>
  <div class="center muted">Tél : ${shop.phone}</div>
  <div class="sep"></div>`

export function printTicket(order: Order, shop: Shop) {
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
    `Ticket n°${order.number}`,
    `${head(shop)}
     <div class="row muted"><span>Ticket n° ${String(order.number).padStart(4, '0')}</span><span>${dateFR(order.createdAt)}</span></div>
     <div class="muted">Caissier : ${order.cashierName}</div>
     <div class="sep"></div>
     <table>${lines}</table>
     <div class="sep"></div>
     <div class="row total"><span>TOTAL</span><span>${money(order.total, shop.currency)}</span></div>
     <div class="row muted"><span>Règlement</span><span>ESPÈCES</span></div>
     <div class="sep"></div>
     <div class="center muted">${shop.footer}</div>`,
  )
}

export function printZReport(
  session: Session,
  orders: Order[],
  shop: Shop,
  perCashier: { name: string; count: number; total: number }[],
) {
  const total = orders.reduce((s, o) => s + o.total, 0)
  const expected = session.openingFloat + total
  const counted = session.countedCash ?? expected
  const diff = counted - expected

  const rows = perCashier
    .map((c) => `<div class="row"><span>${c.name} (${c.count})</span><span>${money(c.total, shop.currency)}</span></div>`)
    .join('')

  send(
    'Rapport de caisse',
    `${head(shop)}
     <div class="center"><b>RAPPORT DE CAISSE (Z)</b></div>
     <div class="sep"></div>
     <div class="row muted"><span>Ouverture</span><span>${dateFR(session.openedAt)}</span></div>
     <div class="row muted"><span>Fermeture</span><span>${dateFR(session.closedAt ?? new Date().toISOString())}</span></div>
     <div class="row muted"><span>Ouverte par</span><span>${session.openedBy}</span></div>
     <div class="row muted"><span>Fermée par</span><span>${session.closedBy ?? '-'}</span></div>
     <div class="sep"></div>
     <div class="row"><span>Nombre de tickets</span><span>${orders.length}</span></div>
     <div class="row"><span>Fond de caisse</span><span>${money(session.openingFloat, shop.currency)}</span></div>
     <div class="row"><span>Ventes espèces</span><span>${money(total, shop.currency)}</span></div>
     <div class="sep"></div>
     ${rows}
     <div class="sep"></div>
     <div class="row"><span>Attendu en caisse</span><span>${money(expected, shop.currency)}</span></div>
     <div class="row"><span>Compté</span><span>${money(counted, shop.currency)}</span></div>
     <div class="row total"><span>Écart</span><span>${money(diff, shop.currency)}</span></div>
     <div class="sep"></div>
     <div class="center muted">${shop.footer}</div>`,
  )
}
