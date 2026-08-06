import type { Shop } from './types'

/**
 * Envoi des octets ESC/POS à l'agent d'impression installé sur le poste du café
 * (dossier printer-agent/). L'agent ouvre la socket TCP vers l'imprimante : un
 * navigateur ne peut pas le faire lui-même.
 */

export type PrinterConfig = {
  enabled: boolean
  agentUrl: string
  ip: string
  port: number
  cut: boolean
  beep: boolean
}

export const printerConfig = (shop: Shop): PrinterConfig => ({
  enabled: shop.printerEnabled,
  agentUrl: shop.printerAgentUrl.replace(/\/+$/, ''),
  ip: shop.printerIp,
  port: shop.printerPort,
  cut: shop.printerCut,
  beep: shop.printerBeep,
})

export async function sendToPrinter(bytes: Uint8Array, cfg: PrinterConfig, timeoutMs = 6000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${cfg.agentUrl}/print?ip=${encodeURIComponent(cfg.ip)}&port=${cfg.port}`, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: bytes.slice().buffer as ArrayBuffer,
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 120)}`)
  } finally {
    clearTimeout(timer)
  }
}

export async function pingPrinter(cfg: PrinterConfig, timeoutMs = 5000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${cfg.agentUrl}/health?ip=${encodeURIComponent(cfg.ip)}&port=${cfg.port}`, {
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`${res.status}`)
    return (await res.json()) as { agent: boolean; printer: boolean; detail?: string }
  } finally {
    clearTimeout(timer)
  }
}
