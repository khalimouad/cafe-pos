import { useEffect, useMemo, useState } from 'react'
import Login from './components/Login'
import OpenRegister from './components/OpenRegister'
import Pos from './components/Pos'
import History from './components/History'
import CloseRegister from './components/CloseRegister'
import Settings from './components/Settings'
import { money, timeFR, uid, useDB } from './lib/store'
import { printTicket, printZReport } from './lib/print'
import type { Cashier, Order, OrderLine } from './lib/types'

type Tab = 'caisse' | 'historique' | 'reglages'

export default function App() {
  const { db, update } = useDB()
  const [cashier, setCashier] = useState<Cashier | null>(null)
  const [tab, setTab] = useState<Tab>('caisse')
  const [closing, setClosing] = useState(false)
  const [toast, setToast] = useState('')

  const openSession = useMemo(() => db.sessions.find((s) => !s.closedAt) ?? null, [db.sessions])
  const sessionOrders = useMemo(
    () => (openSession ? db.orders.filter((o) => o.sessionId === openSession.id) : []),
    [db.orders, openSession],
  )

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  // Le caissier connecté a pu être supprimé depuis les réglages.
  useEffect(() => {
    if (cashier && !db.cashiers.some((c) => c.id === cashier.id)) setCashier(null)
  }, [db.cashiers, cashier])

  if (!cashier) {
    return <Login cashiers={db.cashiers} shopName={db.shop.name} onLogin={setCashier} />
  }

  const handleOpen = (openingFloat: number) => {
    update((d) => ({
      ...d,
      sessions: [
        ...d.sessions,
        {
          id: uid(),
          openedAt: new Date().toISOString(),
          openedBy: cashier.name,
          openingFloat,
          closedAt: null,
          closedBy: null,
          countedCash: null,
        },
      ],
    }))
    setToast('Caisse ouverte')
  }

  if (!openSession) {
    return (
      <div className="app">
        <Topbar
          cashier={cashier}
          tab={tab}
          setTab={setTab}
          onLogout={() => setCashier(null)}
          sessionOpen={false}
          sessionTotal={0}
          currency={db.shop.currency}
          onClose={() => setClosing(true)}
        />
        <div className="main">
          {tab === 'historique' ? (
            <History
              orders={db.orders}
              sessions={db.sessions}
              cashiers={db.cashiers}
              shop={db.shop}
              currentSessionId={null}
            />
          ) : tab === 'reglages' && cashier.admin ? (
            <Settings db={db} update={update} />
          ) : (
            <OpenRegister cashierName={cashier.name} currency={db.shop.currency} onOpen={handleOpen} />
          )}
        </div>
        {toast && <div className="toast">{toast}</div>}
      </div>
    )
  }

  const checkout = (lines: OrderLine[]) => {
    const total = lines.reduce((s, l) => s + l.price * l.qty, 0)
    const order: Order = {
      id: uid(),
      number: db.orderCounter + 1,
      sessionId: openSession.id,
      cashierId: cashier.id,
      cashierName: cashier.name,
      createdAt: new Date().toISOString(),
      lines,
      total,
    }
    update((d) => ({ ...d, orders: [...d.orders, order], orderCounter: d.orderCounter + 1 }))
    printTicket(order, db.shop)
    setToast(`Encaissé ${money(total, db.shop.currency)} — ticket n°${order.number}`)
  }

  const closeRegister = (countedCash: number) => {
    const closedAt = new Date().toISOString()
    const closed = { ...openSession, closedAt, closedBy: cashier.name, countedCash }

    const map = new Map<string, { name: string; count: number; total: number }>()
    sessionOrders.forEach((o) => {
      const e = map.get(o.cashierId) ?? { name: o.cashierName, count: 0, total: 0 }
      e.count += 1
      e.total += o.total
      map.set(o.cashierId, e)
    })

    update((d) => ({
      ...d,
      sessions: d.sessions.map((s) => (s.id === closed.id ? closed : s)),
    }))
    printZReport(closed, sessionOrders, db.shop, Array.from(map.values()))
    setClosing(false)
    setTab('caisse')
    setToast('Caisse fermée')
  }

  if (closing) {
    return (
      <div className="app">
        <div className="main">
          <CloseRegister
            session={openSession}
            orders={sessionOrders}
            shop={db.shop}
            cashierName={cashier.name}
            onCancel={() => setClosing(false)}
            onClose={closeRegister}
          />
        </div>
      </div>
    )
  }

  const sessionTotal = sessionOrders.reduce((s, o) => s + o.total, 0)

  return (
    <div className="app">
      <Topbar
        cashier={cashier}
        tab={tab}
        setTab={setTab}
        onLogout={() => setCashier(null)}
        sessionOpen
        sessionTotal={sessionTotal}
        currency={db.shop.currency}
        onClose={() => setClosing(true)}
        openedAt={openSession.openedAt}
      />
      <div className="main">
        {tab === 'caisse' && (
          <Pos products={db.products} currency={db.shop.currency} onCheckout={checkout} />
        )}
        {tab === 'historique' && (
          <History
            orders={db.orders}
            sessions={db.sessions}
            cashiers={db.cashiers}
            shop={db.shop}
            currentSessionId={openSession.id}
          />
        )}
        {tab === 'reglages' && cashier.admin && <Settings db={db} update={update} />}
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function Topbar({
  cashier,
  tab,
  setTab,
  onLogout,
  sessionOpen,
  sessionTotal,
  currency,
  onClose,
  openedAt,
}: {
  cashier: Cashier
  tab: Tab
  setTab: (t: Tab) => void
  onLogout: () => void
  sessionOpen: boolean
  sessionTotal: number
  currency: string
  onClose: () => void
  openedAt?: string
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo">☕</span>
        <span>Café POS</span>
      </div>

      <nav className="tabs">
        <button className={`tab${tab === 'caisse' ? ' active' : ''}`} onClick={() => setTab('caisse')}>Caisse</button>
        <button className={`tab${tab === 'historique' ? ' active' : ''}`} onClick={() => setTab('historique')}>Historique</button>
        {cashier.admin && (
          <button className={`tab${tab === 'reglages' ? ' active' : ''}`} onClick={() => setTab('reglages')}>Réglages</button>
        )}
      </nav>

      <div className="spacer" />

      <span className="chip">
        <span className={`dot${sessionOpen ? '' : ' off'}`} />
        {sessionOpen ? (
          <>Caisse ouverte {openedAt ? `à ${timeFR(openedAt)}` : ''} · <b>{money(sessionTotal, currency)}</b></>
        ) : (
          <>Caisse fermée</>
        )}
      </span>

      <span className="chip"><b>{cashier.name}</b>{cashier.admin ? ' · resp.' : ''}</span>

      {sessionOpen && (
        <button className="btn danger" style={{ padding: '10px 16px' }} onClick={onClose}>Fermer la caisse</button>
      )}
      <button className="btn ghost" style={{ padding: '10px 16px' }} onClick={onLogout}>Changer</button>
    </header>
  )
}
