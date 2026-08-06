export type Cashier = {
  id: string
  name: string
  admin: boolean
}

export type Product = {
  id: string
  name: string
  price: number
  category: string
  emoji: string
  active: boolean
}

export type OrderLine = {
  productId: string
  name: string
  price: number
  qty: number
}

export type Order = {
  id: string
  number: number
  sessionId: string
  cashierId: string | null
  cashierName: string
  createdAt: string
  lines: OrderLine[]
  total: number
}

export type Session = {
  id: string
  openedAt: string
  openedBy: string
  openingFloat: number
  closedAt: string | null
  closedBy: string | null
  countedCash: number | null
}

export type Shop = {
  name: string
  address: string
  phone: string
  currency: string
  footer: string
  printerEnabled: boolean
  printerAgentUrl: string
  printerIp: string
  printerPort: number
  printerCut: boolean
  printerBeep: boolean
}

export type DB = {
  shop: Shop
  cashiers: Cashier[]
  products: Product[]
  sessions: Session[]
  orders: Order[]
}
