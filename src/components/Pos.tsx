import { useEffect, useMemo, useState } from 'react'
import type { OrderLine, Product } from '../lib/types'
import { money } from '../lib/store'
import { useI18n } from '../lib/i18n'

type Props = {
  products: Product[]
  currency: string
  onCheckout: (lines: OrderLine[]) => void
}

export default function Pos({ products, currency, onCheckout }: Props) {
  const { t } = useI18n()
  const actives = useMemo(() => products.filter((p) => p.active), [products])
  const categories = useMemo(() => Array.from(new Set(actives.map((p) => p.category))), [actives])
  // null = toutes les catégories (le libellé change avec la langue, pas la valeur)
  const [cat, setCat] = useState<string | null>(null)
  const [lines, setLines] = useState<OrderLine[]>([])
  const [sheet, setSheet] = useState(false)

  const shown = cat === null ? actives : actives.filter((p) => p.category === cat)
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0)
  const count = lines.reduce((s, l) => s + l.qty, 0)

  // Le panier vide n'a rien à montrer dans la feuille mobile.
  useEffect(() => {
    if (!lines.length) setSheet(false)
  }, [lines.length])

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
    setSheet(false)
  }

  return (
    <>
      <div className="catalog">
        <div className="cats">
          <button className={`cat${cat === null ? ' active' : ''}`} onClick={() => setCat(null)}>
            {t('cat_all')}
          </button>
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

      {sheet && <div className="sheet-bg" onClick={() => setSheet(false)} />}

      <aside className={`cart${sheet ? ' open' : ''}`}>
        <div className="cart-head">
          <h2>{t('cart_title')}{count > 0 ? ` · ${count}` : ''}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {lines.length > 0 && (
              <button className="btn ghost small" onClick={() => setLines([])}>{t('cart_clear')}</button>
            )}
            <button className="btn ghost small only-mobile" onClick={() => setSheet(false)}>✕</button>
          </div>
        </div>

        <div className="cart-lines">
          {lines.length === 0 ? (
            <div className="empty">
              <span className="big">🧾</span>
              <span>{t('cart_empty')}</span>
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
            <span className="lbl">{t('cart_items', { n: count })}</span>
            <span className="val">{money(total, currency)}</span>
          </div>
          <button className="btn primary block pay" disabled={!lines.length} onClick={validate}>
            {t('pay_btn')}
          </button>
        </div>
      </aside>

      {/* Barre d'encaissement mobile : total, accès au panier, paiement */}
      <div className={`cartbar${lines.length ? '' : ' empty'}`}>
        <button className="cartbar-info" onClick={() => setSheet(true)} disabled={!lines.length}>
          <span className="c">{count}</span>
          <span className="v">{money(total, currency)}</span>
          <span className="m">{t('cart_view')}</span>
        </button>
        <button className="btn primary pay" disabled={!lines.length} onClick={validate}>
          {t('pay_btn')}
        </button>
      </div>
    </>
  )
}
