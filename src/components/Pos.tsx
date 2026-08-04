import { useMemo, useState } from 'react'
import type { OrderLine, Product } from '../lib/types'
import { money } from '../lib/store'

type Props = {
  products: Product[]
  currency: string
  onCheckout: (lines: OrderLine[]) => void
}

export default function Pos({ products, currency, onCheckout }: Props) {
  const actives = useMemo(() => products.filter((p) => p.active), [products])
  const categories = useMemo(() => ['Tout', ...Array.from(new Set(actives.map((p) => p.category)))], [actives])
  const [cat, setCat] = useState('Tout')
  const [lines, setLines] = useState<OrderLine[]>([])

  const shown = cat === 'Tout' ? actives : actives.filter((p) => p.category === cat)
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0)
  const count = lines.reduce((s, l) => s + l.qty, 0)

  const add = (p: Product) =>
    setLines((cur) => {
      const found = cur.find((l) => l.productId === p.id)
      if (found) return cur.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + 1 } : l))
      return [...cur, { productId: p.id, name: p.name, price: p.price, qty: 1 }]
    })

  const bump = (productId: string, delta: number) =>
    setLines((cur) =>
      cur
        .map((l) => (l.productId === productId ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0),
    )

  const validate = () => {
    if (!lines.length) return
    onCheckout(lines)
    setLines([])
  }

  return (
    <>
      <div className="catalog">
        <div className="cats">
          {categories.map((c) => (
            <button key={c} className={`cat${cat === c ? ' active' : ''}`} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>

        <div className="grid">
          {shown.map((p) => (
            <button key={p.id} className="card" onClick={() => add(p)}>
              <span className="emoji">{p.emoji}</span>
              <span className="name">{p.name}</span>
              <span className="price">{money(p.price, currency)}</span>
            </button>
          ))}
        </div>
      </div>

      <aside className="cart">
        <div className="cart-head">
          <h2>Commande</h2>
          {lines.length > 0 && (
            <button className="btn ghost" style={{ padding: '7px 12px', fontSize: 13 }} onClick={() => setLines([])}>
              Vider
            </button>
          )}
        </div>

        <div className="cart-lines">
          {lines.length === 0 ? (
            <div className="empty">
              <span className="big">🧾</span>
              <span>Touchez un produit pour l’ajouter</span>
            </div>
          ) : (
            lines.map((l) => (
              <div className="line" key={l.productId}>
                <div className="info">
                  <div className="n">{l.name}</div>
                  <div className="p">{money(l.price, currency)}</div>
                </div>
                <div className="qty">
                  <button onClick={() => bump(l.productId, -1)}>−</button>
                  <span>{l.qty}</span>
                  <button onClick={() => bump(l.productId, 1)}>+</button>
                </div>
                <div className="amt">{money(l.price * l.qty, currency)}</div>
              </div>
            ))
          )}
        </div>

        <div className="cart-foot">
          <div className="total-row">
            <span className="lbl">{count} article{count > 1 ? 's' : ''} — espèces</span>
            <span className="val">{money(total, currency)}</span>
          </div>
          <button className="btn primary block pay" disabled={!lines.length} onClick={validate}>
            Valider &amp; imprimer
          </button>
        </div>
      </aside>
    </>
  )
}
