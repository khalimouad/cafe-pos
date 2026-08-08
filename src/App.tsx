import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Login from './components/Login'
import OpenRegister from './components/OpenRegister'
import Pos from './components/Pos'
import History from './components/History'
import CloseRegister from './components/CloseRegister'
import Settings from './components/Settings'
import LangSwitch from './components/LangSwitch'
import { errorText, isActive, money, timeFR, useDB } from './lib/store'
import { printTicket, printZReport } from './lib/print'
import { useI18n, type T } from './lib/i18n'
import type { Cashier, Order, OrderLine } from './lib/types'

type Tab = 'caisse' | 'historique' | 'reglages'

const DEVICE_CASHIER = 'cafe-pos-cashier'

export default function App() {
  const store = useDB()
  const { db, ready, error, reload } = store
  const { t } = useI18n()
  const [cashier, setCashier] = useState<Cashier | null>(null)
  const [restored, setRestored] = useState(false)
  const [tab, setTab] = useState<Tab>('caisse')
  const [closing, setClosing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')

  const openSession = useMemo(() => db.sessions.find((s) => !s.closedAt) ?? null, [db.sessions])
  const sessionOrders = useMemo(
    () => (openSession ? db.orders.filter((o) => o.sessionId === openSession.id) : []),
    [db.orders, openSession],
  )

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(timer)
  }, [toast])

  // L'appareil reste connecté d'une visite à l'autre : le téléphone du gérant ne
  // redemande pas le code à chaque ouverture. Le caissier retenu doit toujours exister.
  useEffect(() => {
    if (!ready || restored) return
    setRestored(true)
    const id = localStorage.getItem(DEVICE_CASHIER)
    const known = id ? db.cashiers.find((c) => c.id === id) : undefined
    if (known) setCashier(known)
  }, [ready, restored, db.cashiers])

  // Le caissier connecté a pu être supprimé depuis un autre appareil.
  useEffect(() => {
    if (ready && cashier && !db.cashiers.some((c) => c.id === cashier.id)) signIn(null)
  }, [db.cashiers, cashier, ready])

  const signIn = (c: Cashier | null) => {
    if (c) localStorage.setItem(DEVICE_CASHIER, c.id)
    else localStorage.removeItem(DEVICE_CASHIER)
    setCashier(c)
  }

  const fail = (e: unknown) => setToast(`⚠️ ${errorText(e)}`)

  if (!ready) {
    return (
      <div className="screen">
        <div className="panel" style={{ textAlign: 'center' }}>
          <h1>☕</h1>
          <p className="sub" style={{ margin: 0 }}>{t('loading')}</p>
        </div>
      </div>
    )
  }

  if (error && !db.products.length) {
    return (
      <div className="screen">
        <div className="panel">
          <h1>{t('offline_title')}</h1>
          <p className="sub">{t('offline_sub')}</p>
          <p className="error">{error}</p>
          <button className="btn primary block" onClick={() => void reload()}>{t('retry')}</button>
        </div>
      </div>
    )
  }

  if (!cashier) {
    return (
      <Login
        cashiers={db.cashiers}
        shopName={db.shop.name}
        verifyPin={store.verifyPin}
        onLogin={signIn}
      />
    )
  }

  const handleOpen = async (openingFloat: number) => {
    setBusy(true)
    try {
      await store.openSession(cashier.name, openingFloat)
      setToast(t('toast_opened'))
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const chrome = (content: ReactNode, sessionOpen: boolean, sessionTotal = 0) => (
    <div className="app">
      <Topbar
        t={t}
        cashier={cashier}
        tab={tab}
        setTab={setTab}
        onLogout={() => signIn(null)}
        sessionOpen={sessionOpen}
        sessionTotal={sessionTotal}
        currency={db.shop.currency}
        onCloseRegister={() => setClosing(true)}
        openedAt={openSession?.openedAt}
        openedBy={openSession?.openedBy}
        offline={Boolean(error)}
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
      {toast && <div className={`toast${toast.startsWith('⚠️') ? ' bad' : ''}`}>{toast}</div>}
    </div>
  )

  if (!openSession) {
    return chrome(
      tab === 'historique' ? (
        <History orders={db.orders} sessions={db.sessions} cashiers={db.cashiers} shop={db.shop} currentSessionId={null} />
      ) : tab === 'reglages' && cashier.admin ? (
        <Settings db={db} store={store} />
      ) : (
        <OpenRegister cashierName={cashier.name} currency={db.shop.currency} busy={busy} onOpen={handleOpen} />
      ),
      false,
    )
  }

  const checkout = async (lines: OrderLine[]) => {
    const total = lines.reduce((s, l) => s + l.price * l.qty, 0)
    try {
      const order = await store.createOrder({ sessionId: openSession.id, cashier, lines, total })
      const printed = await printTicket(order, db.shop)
      setToast(
        printed.error
          ? t('toast_printer_fallback', { detail: printed.error })
          : t('toast_paid', { amount: money(total, db.shop.currency), n: order.number }),
      )
    } catch (e) {
      fail(e)
      throw e
    }
  }

  const cancelOrder = async (order: Order, pin: string) => {
    const by = await store.cancelOrder(order.id, pin)
    setToast(t('toast_cancelled', { n: order.number, name: by }))
  }

  const closeRegister = async (countedCash: number) => {
    setBusy(true)
    try {
      await store.closeSession(openSession.id, cashier.name, countedCash)

      const map = new Map<string, { name: string; count: number; total: number }>()
      sessionOrders.filter(isActive).forEach((o) => {
        const key = o.cashierId ?? o.cashierName
        const e = map.get(key) ?? { name: o.cashierName, count: 0, total: 0 }
        e.count += 1
        e.total += o.total
        map.set(key, e)
      })

      await printZReport(
        { ...openSession, closedAt: new Date().toISOString(), closedBy: cashier.name, countedCash },
        sessionOrders,
        db.shop,
        Array.from(map.values()),
      )
      setClosing(false)
      setTab('caisse')
      setToast(t('toast_closed'))
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
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
            busy={busy}
            onCancel={() => setClosing(false)}
            onClose={closeRegister}
          />
        </div>
        {toast && <div className={`toast${toast.startsWith('⚠️') ? ' bad' : ''}`}>{toast}</div>}
      </div>
    )
  }

  const sessionTotal = sessionOrders.filter(isActive).reduce((s, o) => s + o.total, 0)

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
          onCancelOrder={cancelOrder}
        />
      )}
      {tab === 'reglages' && cashier.admin && <Settings db={db} store={store} />}
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
  openedBy,
  offline,
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
  openedBy?: string
  offline: boolean
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

      {offline && <span className="chip warn">{t('offline_chip')}</span>}

      <span className="chip">
        <span className={`dot${sessionOpen ? '' : ' off'}`} />
        {sessionOpen ? (
          <>
            <span className="only-desktop">
              {openedBy && openedAt ? t('register_opened_by', { name: openedBy, time: timeFR(openedAt) }) : t('register_open')} ·&nbsp;
            </span>
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
