import { useState } from 'react'
import type { DB, Cashier, Product } from '../lib/types'
import { money, uid } from '../lib/store'

type Props = {
  db: DB
  update: (fn: (draft: DB) => DB) => void
}

export default function Settings({ db, update }: Props) {
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
    if (!confirm(`Supprimer le caissier ${c.name} ?`)) return
    update((d) => ({ ...d, cashiers: d.cashiers.filter((x) => x.id !== c.id) }))
  }

  return (
    <div className="page">
      <h1>Réglages</h1>
      <p className="sub">Carte, caissiers et informations imprimées sur le ticket.</p>

      <h2 style={{ fontSize: 16, margin: '0 0 12px' }}>Établissement</h2>
      <div className="list" style={{ marginBottom: 28, padding: 18 }}>
        <div className="stats" style={{ margin: 0 }}>
          {([
            ['name', 'Nom'],
            ['address', 'Adresse'],
            ['phone', 'Téléphone'],
            ['currency', 'Devise'],
            ['footer', 'Message de bas de ticket'],
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

      <h2 style={{ fontSize: 16, margin: '0 0 12px' }}>Carte ({db.products.length} produits)</h2>
      <div className="list" style={{ marginBottom: 16 }}>
        <table className="simple">
          <thead>
            <tr><th></th><th>Produit</th><th>Catégorie</th><th>Prix</th><th>Visible</th></tr>
          </thead>
          <tbody>
            {db.products.map((p) => (
              <tr key={p.id}>
                <td style={{ fontSize: 20 }}>{p.emoji}</td>
                <td>{p.name}</td>
                <td style={{ color: 'var(--muted)' }}>{p.category}</td>
                <td>
                  <input
                    className="input"
                    style={{ width: 100, padding: '6px 10px' }}
                    value={String(p.price)}
                    onChange={(e) => patchProduct(p.id, { price: Number(e.target.value.replace(',', '.')) || 0 })}
                  />
                </td>
                <td>
                  <button className="btn ghost" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => patchProduct(p.id, { active: !p.active })}>
                    {p.active ? 'Oui' : 'Non'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="list" style={{ marginBottom: 28, padding: 18, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ margin: 0, width: 70 }}>
          <label>Icône</label>
          <input className="input" value={newProduct.emoji} onChange={(e) => setNewProduct({ ...newProduct, emoji: e.target.value })} />
        </div>
        <div className="field" style={{ margin: 0, flex: 2, minWidth: 160 }}>
          <label>Nom du produit</label>
          <input className="input" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} />
        </div>
        <div className="field" style={{ margin: 0, flex: 1, minWidth: 140 }}>
          <label>Catégorie</label>
          <input className="input" list="cats" value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })} />
          <datalist id="cats">
            {Array.from(new Set(db.products.map((p) => p.category))).map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div className="field" style={{ margin: 0, width: 110 }}>
          <label>Prix</label>
          <input className="input" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value.replace(/[^0-9.,]/g, '') })} />
        </div>
        <button className="btn primary" onClick={addProduct}>Ajouter</button>
      </div>

      <h2 style={{ fontSize: 16, margin: '0 0 12px' }}>Caissiers</h2>
      <div className="list" style={{ marginBottom: 16 }}>
        <table className="simple">
          <thead><tr><th>Nom</th><th>Code</th><th>Rôle</th><th></th></tr></thead>
          <tbody>
            {db.cashiers.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>
                  <input
                    className="input"
                    style={{ width: 90, padding: '6px 10px', letterSpacing: 3 }}
                    value={c.pin}
                    maxLength={4}
                    onChange={(e) => {
                      const pin = e.target.value.replace(/\D/g, '').slice(0, 4)
                      update((d) => ({ ...d, cashiers: d.cashiers.map((x) => (x.id === c.id ? { ...x, pin } : x)) }))
                    }}
                  />
                </td>
                <td style={{ color: 'var(--muted)' }}>{c.admin ? 'Responsable' : 'Caissier'}</td>
                <td>
                  <button className="btn danger" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => removeCashier(c)}>
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="list" style={{ padding: 18, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ margin: 0, flex: 1, minWidth: 180 }}>
          <label>Nom du caissier</label>
          <input className="input" value={newCashier.name} onChange={(e) => setNewCashier({ ...newCashier, name: e.target.value })} />
        </div>
        <div className="field" style={{ margin: 0, width: 130 }}>
          <label>Code à 4 chiffres</label>
          <input
            className="input"
            value={newCashier.pin}
            onChange={(e) => setNewCashier({ ...newCashier, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
          />
        </div>
        <button className="btn primary" onClick={addCashier}>Ajouter</button>
      </div>

      <p className="sub" style={{ marginTop: 24 }}>
        Chiffre d’affaires total enregistré : {money(db.orders.reduce((s, o) => s + o.total, 0), db.shop.currency)} sur {db.orders.length} commandes.
      </p>
    </div>
  )
}
