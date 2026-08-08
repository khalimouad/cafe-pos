import type { Order, Session, Shop } from './types'
import { dateFR, isActive, money } from './store'
import { getLang, translate } from './i18n'

/**
 * Ticket ESC/POS en mode raster.
 *
 * Le ticket est d'abord dessiné dans un canvas par le navigateur, puis converti en
 * bitmap 1 bit. C'est le moteur de texte du navigateur qui gère la darija (liaisons
 * des lettres arabes, sens d'écriture) : l'imprimante n'a rien à interpréter, ce qui
 * évite les jeux de caractères ESC/POS et sort exactement ce qui est à l'écran.
 */

// 72 mm imprimables à 203 dpi = 576 points, soit 72 octets par ligne.
export const DOTS = 576
const PAD = 8
const tp = (key: string, params?: Record<string, string | number>) => translate(getLang(), key, params)

const FONT_LATIN = '"DejaVu Sans", "Liberation Sans", Arial, sans-serif'
const FONT_ARABIC = '"Noto Naskh Arabic", "Amiri", "DejaVu Sans", Arial, sans-serif'

class Ticket {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private y = PAD
  readonly rtl: boolean

  constructor(rtl: boolean) {
    this.rtl = rtl
    this.canvas = document.createElement('canvas')
    this.canvas.width = DOTS
    this.canvas.height = 4000
    const ctx = this.canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas indisponible')
    this.ctx = ctx
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    ctx.fillStyle = '#000'
    ctx.textBaseline = 'top'
    ctx.direction = rtl ? 'rtl' : 'ltr'
  }

  private font(size: number, bold = false) {
    this.ctx.font = `${bold ? 'bold ' : ''}${size}px ${this.rtl ? FONT_ARABIC : FONT_LATIN}`
  }

  /** Bord d'attaque du texte : droite en darija, gauche en français. */
  private startX() {
    return this.rtl ? DOTS - PAD : PAD
  }

  private endX() {
    return this.rtl ? PAD : DOTS - PAD
  }

  center(text: string, size: number, bold = false) {
    this.font(size, bold)
    this.ctx.textAlign = 'center'
    this.ctx.fillText(text, DOTS / 2, this.y, DOTS - PAD * 2)
    this.y += size * 1.35
  }

  /** Une ligne libellé / valeur, chacun collé à son bord. */
  row(start: string, end: string, size = 22, bold = false) {
    this.font(size, bold)
    this.ctx.textAlign = this.rtl ? 'right' : 'left'
    this.ctx.fillText(start, this.startX(), this.y, DOTS - PAD * 2)
    this.ctx.textAlign = this.rtl ? 'left' : 'right'
    this.ctx.fillText(end, this.endX(), this.y)
    this.y += size * 1.35
  }

  /** Ligne d'article : quantité, désignation, montant. */
  item(qty: number, name: string, amount: string, size = 22) {
    this.font(size)
    const q = `${qty}x`
    const qw = 46
    this.ctx.textAlign = this.rtl ? 'right' : 'left'
    this.ctx.fillText(q, this.startX(), this.y)
    const nameX = this.rtl ? DOTS - PAD - qw : PAD + qw
    this.ctx.fillText(name, nameX, this.y, DOTS - PAD * 2 - qw - 130)
    this.ctx.textAlign = this.rtl ? 'left' : 'right'
    this.ctx.fillText(amount, this.endX(), this.y)
    this.y += size * 1.35
  }

  line(text: string, size = 22, bold = false) {
    this.font(size, bold)
    this.ctx.textAlign = this.rtl ? 'right' : 'left'
    this.ctx.fillText(text, this.startX(), this.y, DOTS - PAD * 2)
    this.y += size * 1.35
  }

  separator() {
    this.y += 6
    this.ctx.fillRect(PAD, this.y, DOTS - PAD * 2, 2)
    this.y += 12
  }

  space(px = 10) {
    this.y += px
  }

  /** Bitmap 1 bit, ligne par ligne, tel qu'attendu par GS v 0. */
  raster(): { width: number; height: number; data: Uint8Array } {
    const height = Math.ceil((this.y + PAD) / 8) * 8
    const img = this.ctx.getImageData(0, 0, DOTS, height)
    const bytesPerRow = DOTS / 8
    const out = new Uint8Array(bytesPerRow * height)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < DOTS; x++) {
        const i = (y * DOTS + x) * 4
        const luma = 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2]
        if (luma < 170) out[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7)
      }
    }
    return { width: bytesPerRow, height, data: out }
  }
}

function wrap(raster: { width: number; height: number; data: Uint8Array }, opts: PrintOptions) {
  const head = [
    0x1b, 0x40, // ESC @ : réinitialisation
    0x1d, 0x76, 0x30, 0x00, // GS v 0 : image raster, mode normal
    raster.width & 0xff, (raster.width >> 8) & 0xff,
    raster.height & 0xff, (raster.height >> 8) & 0xff,
  ]

  const tail: number[] = [0x0a, 0x0a, 0x0a, 0x0a] // avance avant la coupe
  if (opts.beep) tail.push(0x1b, 0x42, 0x02, 0x02) // ESC B : deux bips courts
  if (opts.cut) tail.push(0x1d, 0x56, 0x42, 0x00) // GS V 66 : coupe partielle

  const bytes = new Uint8Array(head.length + raster.data.length + tail.length)
  bytes.set(head, 0)
  bytes.set(raster.data, head.length)
  bytes.set(tail, head.length + raster.data.length)
  return bytes
}

export type PrintOptions = { cut: boolean; beep: boolean }

export function ticketBytes(order: Order, shop: Shop, opts: PrintOptions) {
  const t = new Ticket(getLang() === 'ma')

  t.center(shop.name, 34, true)
  if (shop.address) t.center(shop.address, 20)
  if (shop.phone) t.center(`${tp('tk_phone')} : ⁦${shop.phone}⁩`, 20)
  t.separator()

  t.row(`${tp('tk_ticket_no')} ${String(order.number).padStart(4, '0')}`, dateFR(order.createdAt), 20)
  t.line(`${tp('tk_cashier')} : ${order.cashierName}`, 20)
  t.separator()

  order.lines.forEach((l) => t.item(l.qty, l.name, money(l.price * l.qty, shop.currency)))
  t.separator()

  t.row(tp('tk_total'), money(order.total, shop.currency), 32, true)
  t.row(tp('tk_payment'), tp('tk_cash'), 20)
  t.separator()

  if (shop.footer) t.center(shop.footer, 20)
  t.space(20)

  return wrap(t.raster(), opts)
}

export function zReportBytes(
  session: Session,
  orders: Order[],
  shop: Shop,
  perCashier: { name: string; count: number; total: number }[],
  opts: PrintOptions,
) {
  const active = orders.filter(isActive)
  const cancelled = orders.filter((o) => !isActive(o))
  const total = active.reduce((s, o) => s + o.total, 0)
  const expected = session.openingFloat + total
  const counted = session.countedCash ?? expected

  const t = new Ticket(getLang() === 'ma')

  t.center(shop.name, 34, true)
  if (shop.address) t.center(shop.address, 20)
  t.separator()
  t.center(tp('tk_z_title'), 26, true)
  t.separator()

  t.row(tp('tk_opened'), dateFR(session.openedAt), 20)
  t.row(tp('tk_closed'), dateFR(session.closedAt ?? new Date().toISOString()), 20)
  t.row(tp('tk_opened_by'), session.openedBy, 20)
  t.row(tp('tk_closed_by'), session.closedBy ?? '-', 20)
  t.separator()

  t.row(tp('tk_count'), String(active.length), 22)
  if (cancelled.length) {
    t.row(tp('tk_cancelled'), `${cancelled.length} · ${money(cancelled.reduce((s2, o) => s2 + o.total, 0), shop.currency)}`, 22)
  }
  t.row(tp('tk_float'), money(session.openingFloat, shop.currency), 22)
  t.row(tp('tk_sales'), money(total, shop.currency), 22)
  t.separator()

  perCashier.forEach((c) => t.row(`${c.name} (${c.count})`, money(c.total, shop.currency), 22))
  if (perCashier.length) t.separator()

  t.row(tp('tk_expected'), money(expected, shop.currency), 22)
  t.row(tp('tk_counted'), money(counted, shop.currency), 22)
  t.row(tp('tk_diff'), money(counted - expected, shop.currency), 28, true)
  t.space(20)

  return wrap(t.raster(), opts)
}

/** Petit ticket de contrôle, pour vérifier le branchement depuis les réglages. */
export function testBytes(shop: Shop, opts: PrintOptions) {
  const t = new Ticket(getLang() === 'ma')
  t.center(shop.name, 30, true)
  t.separator()
  t.center(tp('printer_test_line'), 24, true)
  t.center(dateFR(new Date().toISOString()), 20)
  t.separator()
  t.line('ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789', 18)
  t.line('éèàçù — ' + money(1234.5, shop.currency), 18)
  t.space(20)
  return wrap(t.raster(), opts)
}
