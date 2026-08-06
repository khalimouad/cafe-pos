#!/usr/bin/env node
/**
 * Agent d'impression du POS Café.
 *
 * Le navigateur ne peut pas ouvrir de socket TCP : il envoie les octets ESC/POS ici,
 * et cet agent les pousse vers l'imprimante ticket (port brut 9100).
 *
 *   node agent.mjs                     # écoute sur 0.0.0.0:7777
 *   PORT=7777 PRINTER_IP=192.168.123.100 node agent.mjs
 *
 * Aucune dépendance : Node 18+ suffit.
 */
import http from 'node:http'
import net from 'node:net'

const PORT = Number(process.env.PORT ?? 7777)
const HOST = process.env.HOST ?? '0.0.0.0'
const DEFAULT_IP = process.env.PRINTER_IP ?? '192.168.123.100'
const DEFAULT_PORT = Number(process.env.PRINTER_PORT ?? 9100)
const CONNECT_TIMEOUT = Number(process.env.PRINTER_TIMEOUT ?? 5000)
const MAX_BODY = 4 * 1024 * 1024

const log = (...a) => console.log(new Date().toLocaleTimeString('fr-FR'), ...a)

/** Ouvre la socket, envoie les octets, attend la fin d'écriture. */
function sendToPrinter(ip, port, payload) {
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
      socket.write(payload, () => {
        // Laisse le tampon de l'imprimante se vider avant de couper.
        setTimeout(() => finish(null), 250)
      })
    })
  })
}

function probe(ip, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: ip, port })
    socket.setTimeout(CONNECT_TIMEOUT)
    socket.on('connect', () => { socket.destroy(); resolve({ ok: true }) })
    socket.on('timeout', () => { socket.destroy(); resolve({ ok: false, detail: 'délai dépassé' }) })
    socket.on('error', (e) => { socket.destroy(); resolve({ ok: false, detail: e.message }) })
  })
}

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
    const ip = url.searchParams.get('ip') || DEFAULT_IP
    const port = Number(url.searchParams.get('port') || DEFAULT_PORT)

    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors)
      return res.end()
    }

    if (url.pathname === '/health') {
      const p = await probe(ip, port)
      return json(res, 200, { agent: true, printer: p.ok, detail: p.detail, ip, port })
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
        await sendToPrinter(ip, port, payload)
        log(`ticket imprimé — ${payload.length} octets vers ${ip}:${port}`)
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
    log(`imprimante par défaut : ${DEFAULT_IP}:${DEFAULT_PORT}`)
  })
