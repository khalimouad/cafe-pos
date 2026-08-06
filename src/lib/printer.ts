import type { PrinterTransport, Shop } from './types'

/**
 * Envoi des octets ESC/POS à l'agent d'impression installé sur le poste du café
 * (dossier printer-agent/). L'agent ouvre la socket TCP ou écrit sur le port USB :
 * un navigateur ne peut faire ni l'un ni l'autre.
 */

export type PrinterConfig = {
  enabled: boolean
  agentUrl: string
  transport: PrinterTransport
  target: string
  ip: string
  port: number
  cut: boolean
  beep: boolean
}

export const printerConfig = (shop: Shop): PrinterConfig => ({
  enabled: shop.printerEnabled,
  agentUrl: shop.printerAgentUrl.replace(/\/+$/, ''),
  transport: shop.printerTransport,
  target: shop.printerTarget,
  ip: shop.printerIp,
  port: shop.printerPort,
  cut: shop.printerCut,
  beep: shop.printerBeep,
})

/** Décrit à l'agent où envoyer le ticket, selon le branchement choisi. */
function query(cfg: PrinterConfig) {
  const p = new URLSearchParams({ transport: cfg.transport })
  if (cfg.transport === 'tcp') {
    p.set('ip', cfg.ip)
    p.set('port', String(cfg.port))
  } else {
    p.set('target', cfg.target)
  }
  return p.toString()
}

export async function sendToPrinter(bytes: Uint8Array, cfg: PrinterConfig, timeoutMs = 8000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${cfg.agentUrl}/print?${query(cfg)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: bytes.slice().buffer as ArrayBuffer,
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`)
  } finally {
    clearTimeout(timer)
  }
}

export type PrinterHealth = {
  agent: boolean
  printer: boolean
  detail?: string
  transport?: string
  target?: string
  usbDevices?: string[]
  windowsPrinters?: string[]
  platform?: string
}

export async function pingPrinter(cfg: PrinterConfig, timeoutMs = 6000): Promise<PrinterHealth> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${cfg.agentUrl}/health?${query(cfg)}`, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`${res.status}`)
    return (await res.json()) as PrinterHealth
  } finally {
    clearTimeout(timer)
  }
}
