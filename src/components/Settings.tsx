import { useState } from 'react'
import type { DB, Cashier, Product } from '../lib/types'
import { money, uid } from '../lib/store'
import { useI18n } from '../lib/i18n'

type Props = {
  db: DB
  update: (fn: (draft: DB) => DB) => void
}

export default function Settings({ db, update }: Props) {
  const { t } = useI18n()
  const [newProduct, setNewProduct] = useState({ name: '', price: '', category: '', emoji: '☕' })
  const [newCashier, setNewCashier] = useState({ name: '', pin: '' })

  const addProduct = () => {
    const price = Number(newProduct.price.replace(',', '.'))
    if (!newProduct.name.trim() || !price) return
    update((d) => ({
      ...d,
      products: [
        ...d.products,
        {
          id: uid(),
          name: newProduct.name.trim(),
          price,
          category: newProduct.category.trim() || 'Divers',
          emoji: newProduct.emoji || '🍽️',
          active: true,
        },
      ],
    }))
    setNewProduct({ name: '', price: '', category: '', emoji: '☕' })
  }

  const patchProduct = (id: string, patch: Partial<Product>) =>
    update((d) => ({ ...d, products: d.products.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))

  const addCashier = () => {
    if (!newCashier.name.trim() || newCashier.pin.length !== 4) return
    update((d) => ({
      ...d,
      cashiers: [...d.cashiers, { id: uid(), name: newCashier.name.trim(), pin: newCashier.pin, admin: false }],
    }))
    setNewCashier({ name: '', pin: '' })
  }

  const removeCashier = (c: Cashier) => {
    if (db.cashiers.length <= 1) return
    if (!confirm(t('set_confirm_delete', { name: c.name }))) return
    update((d) => ({ ...d, cashiers: d.cashiers.filter((x) => x.id !== c.id) }))
  }

  return (
    <div className="page">
      <h1>{t('set_title')}</h1>
      <p className="sub">{t('set_sub')}</p>

      <h2 className="section">{t('set_shop')}</h2>
      <div className="list pad" style={{ marginBottom: 28 }}>
        <div className="stats" style={{ margin: 0 }}>
          {([
            ['name', t('set_name')],
            ['address', t('set_address')],
            ['phone', t('set_phone')],
            ['currency', t('set_currency')],
            ['footer', t('set_footer')],
          ] as const).map(([key, label]) => (
            <div className="field" key={key} style={{ margin: 0 }}>
              <label>{label}</label>
              <input
                className="input"
                value={db.shop[key]}
                onChange={(e) => update((d) => ({ ...d, shop: { ...d.shop, [key]: e.target.value } }))}
              />
            </div>
          ))}
        </div>
      </div>

      <h2 className="section">{t('set_menu', { n: db.products.length })}</h2>
      <div className="list scroll-x" style={{ marginBottom: 16 }}>
        <table className="simple">
          <thead>
            <tr><th></th><th>{t('set_product')}</th><th>{t('set_category')}</th><th>{t('set_price')}</th><th>{t('set_visible')}</th></tr>
          </thead>
          <tbody>
            {db.products.map((p) => (
              <tr key={p.id}>
                <td style={{ fontSize: 20 }}>{p.emoji}</td>
                <td>{p.name}</td>
                <td style={{ color: 'var(--muted)' }}>{p.category}</td>
                <td>
                  <input
                    className="input tiny"
                    dir="ltr"
                    inputMode="decimal"
                    value={String(p.price)}
                    onChange={(e) => patchProduct(p.id, { price: Number(e.target.value.replace(',', '.')) || 0 })}
                  />
                </td>
                <td>
                  <button className="btn ghost small" onClick={() => patchProduct(p.id, { active: !p.active })}>
                    {p.active ? t('yes') : t('no')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="list pad form-row" style={{ marginBottom: 28 }}>
        <div className="field" style={{ margin: 0, width: 76 }}>
          <label>{t('set_icon')}</label>
          <input className="input" value={newProduct.emoji} onChange={(e) => setNewProduct({ ...newProduct, emoji: e.target.value })} />
        </div>
        <div className="field" style={{ margin: 0, flex: 2, minWidth: 150 }}>
          <label>{t('set_product_name')}</label>
          <input className="input" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} />
        </div>
        <div className="field" style={{ margin: 0, flex: 1, minWidth: 130 }}>
          <label>{t('set_category')}</label>
          <input className="input" list="cats" value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })} />
          <datalist id="cats">
            {Array.from(new Set(db.products.map((p) => p.category))).map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div className="field" style={{ margin: 0, width: 110 }}>
          <label>{t('set_price')}</label>
          <input className="input" dir="ltr" inputMode="decimal" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value.replace(/[^0-9.,]/g, '') })} />
        </div>
        <button className="btn primary" onClick={addProduct}>{t('add')}</button>
      </div>

      <h2 className="section">{t('set_cashiers')}</h2>
      <div className="list scroll-x" style={{ marginBottom: 16 }}>
        <table className="simple">
          <thead><tr><th>{t('set_name')}</th><th>{t('set_code')}</th><th>{t('set_role')}</th><th></th></tr></thead>
          <tbody>
            {db.cashiers.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>
                  <input
                    className="input tiny"
                    dir="ltr"
                    style={{ letterSpacing: 3 }}
                    inputMode="numeric"
                    value={c.pin}
                    maxLength={4}
                    onChange={(e) => {
                      const pin = e.target.value.replace(/\D/g, '').slice(0, 4)
                      update((d) => ({ ...d, cashiers: d.cashiers.map((x) => (x.id === c.id ? { ...x, pin } : x)) }))
                    }}
                  />
                </td>
                <td style={{ color: 'var(--muted)' }}>{c.admin ? t('role_manager') : t('role_cashier')}</td>
                <td>
                  <button className="btn danger small" onClick={() => removeCashier(c)}>{t('delete')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="list pad form-row">
        <div className="field" style={{ margin: 0, flex: 1, minWidth: 170 }}>
          <label>{t('set_cashier_name')}</label>
          <input className="input" value={newCashier.name} onChange={(e) => setNewCashier({ ...newCashier, name: e.target.value })} />
        </div>
        <div className="field" style={{ margin: 0, width: 140 }}>
          <label>{t('set_pin')}</label>
          <input
            className="input"
            dir="ltr"
            inputMode="numeric"
            value={newCashier.pin}
            onChange={(e) => setNewCashier({ ...newCashier, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
          />
        </div>
        <button className="btn primary" onClick={addCashier}>{t('add')}</button>
      </div>

      <p className="sub" style={{ marginTop: 24 }}>
        {t('set_revenue', {
          amount: money(db.orders.reduce((s, o) => s + o.total, 0), db.shop.currency),
          n: db.orders.length,
        })}
      </p>
    </div>
  )
}
