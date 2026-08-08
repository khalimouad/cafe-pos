// Génère les icônes PNG de l'application (aucune dépendance : PNG écrit à la main).
// node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const t = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}

/** Icône : carré arrondi orange, tasse blanche et sa soucoupe. */
function draw(size) {
  const px = (x, y) => {
    const s = size
    const r = s * 0.22 // rayon des coins
    const inCorner = (cx, cy) => (x - cx) ** 2 + (y - cy) ** 2 > r ** 2
    if (x < r && y < r && inCorner(r, r)) return null
    if (x > s - r && y < r && inCorner(s - r, r)) return null
    if (x < r && y > s - r && inCorner(r, s - r)) return null
    if (x > s - r && y > s - r && inCorner(s - r, s - r)) return null

    // fond dégradé orange
    const t = (x + y) / (2 * s)
    const bg = [
      Math.round(255 - 20 * t),
      Math.round(138 - 30 * t),
      Math.round(61 + 10 * t),
    ]

    const cx = s / 2
    const bodyTop = s * 0.34
    const bodyBottom = s * 0.66
    const bodyHalf = s * 0.17
    const white = [255, 255, 255]

    // anse
    const dh = Math.hypot(x - (cx + bodyHalf + s * 0.06), y - s * 0.47)
    if (dh < s * 0.085 && dh > s * 0.045) return white

    // corps de la tasse
    if (y >= bodyTop && y <= bodyBottom && Math.abs(x - cx) <= bodyHalf) {
      const rr = s * 0.05
      const bx = Math.abs(x - cx)
      if (y > bodyBottom - rr && bx > bodyHalf - rr) {
        if ((bx - (bodyHalf - rr)) ** 2 + (y - (bodyBottom - rr)) ** 2 > rr ** 2) return bg
      }
      return white
    }

    // soucoupe
    if (y > s * 0.7 && y < s * 0.76 && Math.abs(x - cx) < s * 0.26) return white

    return bg
  }

  const raw = []
  for (let y = 0; y < size; y++) {
    raw.push(0)
    for (let x = 0; x < size; x++) {
      const c = px(x, y)
      raw.push(...(c ?? [0, 0, 0]), c ? 255 : 0)
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // profondeur
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.from(raw), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(OUT, { recursive: true })
for (const size of [192, 512]) {
  const file = join(OUT, `icon-${size}.png`)
  writeFileSync(file, draw(size))
  console.log('écrit', file)
}
