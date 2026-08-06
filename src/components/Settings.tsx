import { useState } from 'react'
import type { DB, Cashier, Product } from '../lib/types'
import { errorText, money, type Actions } from '../lib/store'
import { useI18n } from '../lib/i18n'
import PrinterSettings from './PrinterSettings'

type Props = {
  db: DB
  store: Actions & { reload: () => Promise<void> }
}

export default function Settings({ db, store }: Props) {
  const { t } = useI18n()
  const [newProduct, setNewProduct] = useState({ name: '', price: '', category: '', emoji: '☕' })
  const [newCashier, setNewCashier] = useState({ name: '', pin: '' })
  const [pins, setPins] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  const run = async (fn: () => Promise<void>) => {
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(errorText(e))
    }
  }

  const addProduct = () =>
    run(async () => {
      const price = Number(newProduct.price.replace(',', '.'))
      if (!newProduct.name.trim() || !price) return
      await store.addProduct({
        name: newProduct.name.trim(),
        price,
        category: newProduct.category.trim() || 'Divers',
        emoji: newProduct.emoji || '🍽️',
      })
      setNewProduct({ name: '', price: '', category: '', emoji: '☕' })
    })

  const patchProduct = (id: string, patch: Partial<Product>) => run(() => store.updateProduct(id, patch))

  const removeProduct = (p: Product) =>
    run(async () => {
      if (!confirm(t('set_confirm_delete_product', { name: p.name }))) return
      await store.removeProduct(p.id)
    })

  const addCashier = () =>
    run(async () => {
      if (!newCashier.name.trim() || newCashier.pin.length !== 4) return
      await store.addCashier(newCashier.name.trim(), newCashier.pin)
      setNewCashier({ name: '', pin: '' })
    })

  const savePin = (c: Cashier) =>
    run(async () => {
      const pin = pins[c.id] ?? ''
      if (pin.length !== 4) return
      await store.setCashierPin(c.id, pin)
      setPins({ ...pins, [c.id]: '' })
    })

  const removeCashier = (c: Cashier) =>
    run(async () => {
      if (db.cashiers.length <= 1) return
      if (!confirm(t('set_confirm_delete', { name: c.name }))) return
      await store.removeCashier(c.id)
    })

  return (
    <div className="page">
      <h1>{t('set_title')}</h1>
      <p className="sub">{t('set_sub')}</p>
      {error && <p className="error">{error}</p>}

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
                key={`${key}-${db.shop[key]}`}
                defaultValue={db.shop[key]}
                onBlur={(e) => {
                  if (e.target.value !== db.shop[key]) void run(() => store.updateShop({ [key]: e.target.value }))
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <h2 className="section">{t('set_menu', { n: db.products.length })}</h2>
      <p className="sub">{t('set_delete_hint')}</p>
      <div className="list scroll-x" style={{ marginBottom: 16 }}>
        <table className="simple">
          <thead>
            <tr><th></th><th>{t('set_product')}</th><th>{t('set_category')}</th><th>{t('set_price')}</th><th>{t('set_visible')}</th><th></th></tr>
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
                    key={`price-${p.id}-${p.price}`}
                    defaultValue={String(p.price)}
                    onBlur={(e) => {
                      const price = Number(e.target.value.replace(',', '.'))
                      if (Number.isFinite(price) && price !== p.price) void patchProduct(p.id, { price })
                    }}
                  />
                </td>
                <td>
                  <button className="btn ghost small" onClick={() => void patchProduct(p.id, { active: !p.active })}>
                    {p.active ? t('yes') : t('no')}
                  </button>
                </td>
                <td>
                  <button className="btn danger small" onClick={() => void removeProduct(p)}>{t('delete')}</button>
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
        <button className="btn primary" onClick={() => void addProduct()}>{t('add')}</button>
      </div>

      <PrinterSettings shop={db.shop} updateShop={(patch) => run(() => store.updateShop(patch))} />

      <h2 className="section">{t('set_cashiers')}</h2>
      <p className="sub">{t('set_pin_hidden')}</p>
      <div className="list scroll-x" style={{ marginBottom: 16 }}>
        <table className="simple">
          <thead><tr><th>{t('set_name')}</th><th>{t('set_new_pin')}</th><th>{t('set_role')}</th><th></th></tr></thead>
          <tbody>
            {db.cashiers.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      className="input tiny"
                      dir="ltr"
                      style={{ letterSpacing: 3 }}
                      inputMode="numeric"
                      placeholder="••••"
                      value={pins[c.id] ?? ''}
                      maxLength={4}
                      onChange={(e) => setPins({ ...pins, [c.id]: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    />
                    <button
                      className="btn ghost small"
                      disabled={(pins[c.id] ?? '').length !== 4}
                      onClick={() => void savePin(c)}
                    >
                      {t('save')}
                    </button>
                  </div>
                </td>
                <td style={{ color: 'var(--muted)' }}>{c.admin ? t('role_manager') : t('role_cashier')}</td>
                <td>
                  <button className="btn danger small" onClick={() => void removeCashier(c)}>{t('delete')}</button>
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
        <button className="btn primary" onClick={() => void addCashier()}>{t('add')}</button>
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
