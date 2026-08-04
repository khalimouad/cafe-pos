import { useEffect, useMemo, useState } from 'react'
import Login from './components/Login'
import OpenRegister from './components/OpenRegister'
import Pos from './components/Pos'
import History from './components/History'
import CloseRegister from './components/CloseRegister'
import Settings from './components/Settings'
import LangSwitch from './components/LangSwitch'
import { money, timeFR, uid, useDB } from './lib/store'
import { printTicket, printZReport } from './lib/print'
import { useI18n, type T } from './lib/i18n'
import type { Cashier, Order, OrderLine } from './lib/types'

type Tab = 'caisse' | 'historique' | 'reglages'

export default function App() {
  const { db, update } = useDB()
  const { t } = useI18n()
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
    const t2 = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t2)
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
    setToast(t('toast_opened'))
  }

  const chrome = (content: JSX.Element, sessionOpen: boolean, sessionTotal = 0) => (
    <div className="app">
      <Topbar
        t={t}
        cashier={cashier}
        tab={tab}
        setTab={setTab}
        onLogout={() => setCashier(null)}
        sessionOpen={sessionOpen}
        sessionTotal={sessionTotal}
        currency={db.shop.currency}
        onCloseRegister={() => setClosing(true)}
        openedAt={openSession?.openedAt}
      />
      <div className="main">{content}</div>
      <BottomNav
        t={t}
        tab={tab}
        setTab={setTab}
        admin={cashier.admin}
        sessionOpen={sessionOpen}
        onCloseRegister={() => setClosing(true)}
      />
      {toast && <div className="toast">{toast}</div>}
    </div>
  )

  if (!openSession) {
    return chrome(
      tab === 'historique' ? (
        <History orders={db.orders} sessions={db.sessions} cashiers={db.cashiers} shop={db.shop} currentSessionId={null} />
      ) : tab === 'reglages' && cashier.admin ? (
        <Settings db={db} update={update} />
      ) : (
        <OpenRegister cashierName={cashier.name} currency={db.shop.currency} onOpen={handleOpen} />
      ),
      false,
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
    setToast(t('toast_paid', { amount: money(total, db.shop.currency), n: order.number }))
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

    update((d) => ({ ...d, sessions: d.sessions.map((s) => (s.id === closed.id ? closed : s)) }))
    printZReport(closed, sessionOrders, db.shop, Array.from(map.values()))
    setClosing(false)
    setTab('caisse')
    setToast(t('toast_closed'))
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

  return chrome(
    <>
      {tab === 'caisse' && <Pos products={db.products} currency={db.shop.currency} onCheckout={checkout} />}
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
    </>,
    true,
    sessionTotal,
  )
}

function Topbar({
  t,
  cashier,
  tab,
  setTab,
  onLogout,
  sessionOpen,
  sessionTotal,
  currency,
  onCloseRegister,
  openedAt,
}: {
  t: T
  cashier: Cashier
  tab: Tab
  setTab: (t: Tab) => void
  onLogout: () => void
  sessionOpen: boolean
  sessionTotal: number
  currency: string
  onCloseRegister: () => void
  openedAt?: string
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo">☕</span>
        <span className="brand-name">{t('app_name')}</span>
      </div>

      <nav className="tabs only-desktop">
        <button className={`tab${tab === 'caisse' ? ' active' : ''}`} onClick={() => setTab('caisse')}>{t('tab_pos')}</button>
        <button className={`tab${tab === 'historique' ? ' active' : ''}`} onClick={() => setTab('historique')}>{t('tab_history')}</button>
        {cashier.admin && (
          <button className={`tab${tab === 'reglages' ? ' active' : ''}`} onClick={() => setTab('reglages')}>{t('tab_settings')}</button>
        )}
      </nav>

      <div className="spacer" />

      <span className="chip">
        <span className={`dot${sessionOpen ? '' : ' off'}`} />
        {sessionOpen ? (
          <>
            <span className="only-desktop">{t('register_open')} {openedAt ? timeFR(openedAt) : ''} ·&nbsp;</span>
            <b>{money(sessionTotal, currency)}</b>
          </>
        ) : (
          <>{t('register_closed')}</>
        )}
      </span>

      <span className="chip only-desktop">
        <b>{cashier.name}</b>{cashier.admin ? ` · ${t('manager_short')}` : ''}
      </span>

      <LangSwitch />

      {sessionOpen && (
        <button className="btn danger only-desktop" onClick={onCloseRegister}>{t('close_register')}</button>
      )}
      <button className="btn ghost small" onClick={onLogout}>{t('switch_user')}</button>
    </header>
  )
}

function BottomNav({
  t,
  tab,
  setTab,
  admin,
  sessionOpen,
  onCloseRegister,
}: {
  t: T
  tab: Tab
  setTab: (t: Tab) => void
  admin: boolean
  sessionOpen: boolean
  onCloseRegister: () => void
}) {
  return (
    <nav className="bottom-nav">
      <button className={tab === 'caisse' ? 'on' : ''} onClick={() => setTab('caisse')}>
        <span className="ic">🧾</span>{t('tab_pos')}
      </button>
      <button className={tab === 'historique' ? 'on' : ''} onClick={() => setTab('historique')}>
        <span className="ic">🕓</span>{t('tab_history')}
      </button>
      {admin && (
        <button className={tab === 'reglages' ? 'on' : ''} onClick={() => setTab('reglages')}>
          <span className="ic">⚙️</span>{t('tab_settings')}
        </button>
      )}
      {sessionOpen && (
        <button className="danger" onClick={onCloseRegister}>
          <span className="ic">🔒</span>{t('nav_close')}
        </button>
      )}
    </nav>
  )
}
