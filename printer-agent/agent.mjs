#!/usr/bin/env node
/**
 * Agent d'impression du POS Café.
 *
 * Le navigateur ne peut pas ouvrir de socket TCP ni écrire sur un port USB : il envoie
 * les octets ESC/POS ici, et cet agent les pousse vers l'imprimante ticket.
 *
 * Quatre branchements possibles (paramètre `transport`) :
 *   tcp     — imprimante réseau, port brut 9100          ?transport=tcp&ip=192.168.123.100&port=9100
 *   usb     — port USB vu comme un fichier (Linux/macOS) ?transport=usb&target=/dev/usb/lp0
 *   cups    — file d'impression CUPS en mode brut        ?transport=cups&target=POS80
 *   windows — imprimante partagée sous Windows           ?transport=windows&target=\\localhost\POS80
 *
 *   node agent.mjs                     # écoute sur 0.0.0.0:7777
 *   PORT=7777 PRINTER_IP=192.168.123.100 node agent.mjs
 *
 * Aucune dépendance : Node 18+ suffit.
 */
import http from 'node:http'
import net from 'node:net'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const PORT = Number(process.env.PORT ?? 7777)
const HOST = process.env.HOST ?? '0.0.0.0'
const DEFAULT_IP = process.env.PRINTER_IP ?? '192.168.123.100'
const DEFAULT_PORT = Number(process.env.PRINTER_PORT ?? 9100)
const CONNECT_TIMEOUT = Number(process.env.PRINTER_TIMEOUT ?? 5000)
const MAX_BODY = 4 * 1024 * 1024

const log = (...a) => console.log(new Date().toLocaleTimeString('fr-FR'), ...a)

/* ---------------------------------------------------------------- réseau */

function sendTcp(ip, port, payload) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: ip, port })
    let done = false
    const finish = (err) => {
      if (done) return
      done = true
      socket.destroy()
      err ? reject(err) : resolve()
    }

    socket.setTimeout(CONNECT_TIMEOUT)
    socket.on('timeout', () => finish(new Error(`Imprimante ${ip}:${port} ne répond pas`)))
    socket.on('error', (e) => finish(new Error(`${ip}:${port} — ${e.message}`)))
    socket.on('connect', () => {
      // Laisse le tampon de l'imprimante se vider avant de couper.
      socket.write(payload, () => setTimeout(() => finish(null), 250))
    })
  })
}

function probeTcp(ip, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: ip, port })
    socket.setTimeout(CONNECT_TIMEOUT)
    socket.on('connect', () => { socket.destroy(); resolve({ ok: true }) })
    socket.on('timeout', () => { socket.destroy(); resolve({ ok: false, detail: 'délai dépassé' }) })
    socket.on('error', (e) => { socket.destroy(); resolve({ ok: false, detail: e.message }) })
  })
}

/* ------------------------------------------------------------------- USB */

/** Le port USB d'une imprimante ESC/POS s'écrit comme un fichier. */
function sendDevice(device, payload) {
  return new Promise((resolve, reject) => {
    fs.open(device, 'w', (err, fd) => {
      if (err) return reject(new Error(`${device} — ${err.message}`))
      fs.write(fd, payload, (err2) => {
        fs.close(fd, () => (err2 ? reject(new Error(`${device} — ${err2.message}`)) : resolve()))
      })
    })
  })
}

function probeDevice(device) {
  return new Promise((resolve) => {
    fs.access(device, fs.constants.W_OK, (err) =>
      resolve(err ? { ok: false, detail: err.code === 'EACCES' ? `droits insuffisants sur ${device}` : err.message } : { ok: true }),
    )
  })
}

/** Imprimantes USB visibles sur ce poste, pour aider au réglage. */
function listDevices() {
  const found = []
  for (const dir of ['/dev/usb', '/dev']) {
    try {
      for (const f of fs.readdirSync(dir)) {
        if (/^(lp\d+|usblp\d+)$/.test(f)) found.push(path.join(dir, f))
      }
    } catch {
      // dossier absent (Windows, macOS) : rien à signaler
    }
  }
  return found
}

/* ------------------------------------------------- CUPS / partage Windows */

function run(cmd, args, payload) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true })
    let err = ''
    child.stderr.on('data', (d) => (err += d))
    child.on('error', (e) => reject(new Error(`${cmd} — ${e.message}`)))
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} a échoué (code ${code}) ${err.trim()}`)),
    )
    if (payload) child.stdin.end(payload)
  })
}

const sendCups = (queue, payload) => run('lp', ['-d', queue, '-o', 'raw'], payload)

/** Windows : passe par un fichier temporaire et une copie brute vers le partage. */
async function sendWindows(share, payload) {
  const tmp = path.join(os.tmpdir(), `cafe-ticket-${Date.now()}.bin`)
  await fs.promises.writeFile(tmp, payload)
  try {
    await run('cmd', ['/c', 'copy', '/b', tmp, share])
  } finally {
    fs.promises.unlink(tmp).catch(() => {})
  }
}

/* ------------------------------------------------------------ aiguillage */

function target(url) {
  const transport = (url.searchParams.get('transport') || 'tcp').toLowerCase()
  const value = url.searchParams.get('target') || ''
  const ip = url.searchParams.get('ip') || DEFAULT_IP
  const port = Number(url.searchParams.get('port') || DEFAULT_PORT)
  return { transport, value, ip, port }
}

async function send(t, payload) {
  switch (t.transport) {
    case 'usb': return sendDevice(t.value, payload)
    case 'cups': return sendCups(t.value, payload)
    case 'windows': return sendWindows(t.value, payload)
    case 'tcp': return sendTcp(t.ip, t.port, payload)
    default: throw new Error(`Branchement inconnu : ${t.transport}`)
  }
}

async function probe(t) {
  switch (t.transport) {
    case 'usb': return probeDevice(t.value)
    // Une file CUPS ou un partage Windows ne se teste qu'à l'impression.
    case 'cups':
    case 'windows': return t.value ? { ok: true, detail: 'vérifié à l’impression' } : { ok: false, detail: 'nom manquant' }
    case 'tcp': return probeTcp(t.ip, t.port)
    default: return { ok: false, detail: `branchement inconnu : ${t.transport}` }
  }
}

const describe = (t) =>
  t.transport === 'tcp' ? `${t.ip}:${t.port}` : `${t.transport} ${t.value}`

/* ---------------------------------------------------------------- serveur */

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
}

const json = (res, code, body) => {
  res.writeHead(code, { ...cors, 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost')
    const t = target(url)

    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors)
      return res.end()
    }

    if (url.pathname === '/health') {
      const p = await probe(t)
      return json(res, 200, {
        agent: true,
        printer: p.ok,
        detail: p.detail,
        transport: t.transport,
        target: describe(t),
        usbDevices: listDevices(),
        platform: process.platform,
      })
    }

    if (url.pathname === '/print' && req.method === 'POST') {
      const chunks = []
      let size = 0
      for await (const c of req) {
        size += c.length
        if (size > MAX_BODY) {
          req.destroy()
          return json(res, 413, { error: 'Ticket trop volumineux' })
        }
        chunks.push(c)
      }
      const payload = Buffer.concat(chunks)
      if (!payload.length) return json(res, 400, { error: 'Aucune donnée à imprimer' })

      try {
        await send(t, payload)
        log(`ticket imprimé — ${payload.length} octets vers ${describe(t)}`)
        return json(res, 200, { ok: true, bytes: payload.length })
      } catch (e) {
        log(`échec impression : ${e.message}`)
        return json(res, 502, { error: e.message })
      }
    }

    json(res, 404, { error: 'Route inconnue' })
  })
  .listen(PORT, HOST, () => {
    log(`agent d'impression prêt sur http://${HOST}:${PORT}`)
    log(`réseau par défaut : ${DEFAULT_IP}:${DEFAULT_PORT}`)
    const usb = listDevices()
    if (usb.length) log(`imprimantes USB détectées : ${usb.join(', ')}`)
  })
