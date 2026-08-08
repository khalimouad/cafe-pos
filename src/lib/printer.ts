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

/**
 * « auto » (ou vide) : l'agent est celui qui sert cette page. C'est le cas quand le POS
 * est ouvert depuis http://ip-du-poste:7777, et cela évite de saisir — puis de tenir à
 * jour — l'adresse IP du poste.
 */
export const LOCAL_AGENT = 'http://127.0.0.1:7777'

export function resolveAgentUrl(value: string) {
  const v = value.trim().replace(/\/+$/, '')
  if (v && v.toLowerCase() !== 'auto') return v
  if (typeof location === 'undefined') return LOCAL_AGENT
  // Page servie par l'agent (http) : c'est lui. Page hébergée en https : elle ne peut
  // joindre que l'agent local du poste, seule adresse http tolérée depuis du https.
  return location.protocol === 'http:' ? location.origin : LOCAL_AGENT
}

export const printerConfig = (shop: Shop): PrinterConfig => ({
  enabled: shop.printerEnabled,
  agentUrl: resolveAgentUrl(shop.printerAgentUrl),
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

/**
 * Une page servie en HTTPS ne peut pas appeler une adresse en HTTP : le navigateur
 * bloque avant même d'essayer, et l'erreur ressemble à un agent éteint.
 */
export function mixedContentBlocked(cfg: PrinterConfig) {
  if (typeof location === 'undefined' || location.protocol !== 'https:') return false
  if (!cfg.agentUrl.startsWith('http://')) return false
  // 127.0.0.1 et localhost restent autorisés depuis une page https : le navigateur les
  // considère comme sûrs. Une autre adresse locale (192.168.x.y) est bloquée.
  return !/^http:\/\/(127\.0\.0\.1|localhost)(:|$|\/)/.test(cfg.agentUrl)
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
    if (!res.ok) {
      // L'agent a répondu : l'erreur vient de l'imprimante, pas de la liaison.
      let detail = (await res.text()).slice(0, 200)
      try {
        detail = String(JSON.parse(detail).error ?? detail)
      } catch {
        // réponse non JSON : on garde le texte brut
      }
      const err = new Error(detail)
      err.name = 'AgentError'
      throw err
    }
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
