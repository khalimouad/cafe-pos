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
 *   windows — imprimante installée sous Windows          ?transport=windows&target=printer WD8260
 *             (ou un partage \\poste\POS80)
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
import { fileURLToPath } from 'node:url'

const PORT = Number(process.env.PORT ?? 7777)
const HOST = process.env.HOST ?? '0.0.0.0'
const DEFAULT_IP = process.env.PRINTER_IP ?? '192.168.123.100'
const DEFAULT_PORT = Number(process.env.PRINTER_PORT ?? 9100)
const CONNECT_TIMEOUT = Number(process.env.PRINTER_TIMEOUT ?? 5000)
const MAX_BODY = 4 * 1024 * 1024
// Le POS lui-même peut être servi par l'agent : même origine, donc aucun souci de
// navigateur (HTTPS vers HTTP, CORS) et une seule chose à lancer sur le poste.
const WEB_DIR = process.env.WEB_DIR ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')

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

const WINDOWS_USB_HINT =
  'Sous Windows, un port USB (USB001…) ne s’écrit pas directement : choisissez le ' +
  'branchement « Windows (imprimante installée) » et donnez le nom de l’imprimante.'

/** Le port USB d'une imprimante ESC/POS s'écrit comme un fichier (Linux, macOS). */
function sendDevice(device, payload) {
  if (process.platform === 'win32') return Promise.reject(new Error(WINDOWS_USB_HINT))
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
  if (process.platform === 'win32') return Promise.resolve({ ok: false, detail: WINDOWS_USB_HINT })
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

function run(cmd, args, payload, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true, env: env ?? process.env })
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

/**
 * Envoie les octets au spouleur Windows en mode RAW, en nommant l'imprimante telle
 * qu'elle apparaît dans Windows (ex. « printer WD8260 »). RAW veut dire que le pilote
 * ne redessine rien : l'imprimante reçoit l'ESC/POS tel quel.
 */
const RAW_PRINT_PS = `
$ErrorActionPreference = 'Stop'
$name = $env:CAFE_PRINTER
$file = $env:CAFE_PAYLOAD
Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Runtime.InteropServices;
public class CafeRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFO { [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType; }
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFO di);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

  public static void Send(string printer, string file) {
    byte[] bytes = File.ReadAllBytes(file);
    IntPtr h;
    if (!OpenPrinter(printer, out h, IntPtr.Zero))
      throw new Exception("Imprimante introuvable : " + printer);
    try {
      DOCINFO di = new DOCINFO();
      di.pDocName = "Ticket POS Cafe";
      di.pDataType = "RAW";
      if (!StartDocPrinter(h, 1, di)) throw new Exception("StartDocPrinter a echoue");
      try {
        if (!StartPagePrinter(h)) throw new Exception("StartPagePrinter a echoue");
        IntPtr buf = Marshal.AllocCoTaskMem(bytes.Length);
        try {
          Marshal.Copy(bytes, 0, buf, bytes.Length);
          int written;
          if (!WritePrinter(h, buf, bytes.Length, out written) || written != bytes.Length)
            throw new Exception("Ecriture incomplete vers le spouleur");
        } finally { Marshal.FreeCoTaskMem(buf); }
        EndPagePrinter(h);
      } finally { EndDocPrinter(h); }
    } finally { ClosePrinter(h); }
  }
}
"@
[CafeRawPrinter]::Send($name, $file)
`

/**
 * Windows : nom d'imprimante installée (« printer WD8260 ») via le spouleur en RAW,
 * ou chemin de partage (« \\\\poste\\POS80 ») par copie brute.
 */
async function sendWindows(name, payload) {
  const tmp = path.join(os.tmpdir(), `cafe-ticket-${Date.now()}.bin`)
  await fs.promises.writeFile(tmp, payload)
  try {
    if (name.startsWith('\\\\')) {
      await run('cmd', ['/c', 'copy', '/b', tmp, name])
    } else {
      await run(
        'powershell',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', RAW_PRINT_PS],
        null,
        { ...process.env, CAFE_PRINTER: name, CAFE_PAYLOAD: tmp },
      )
    }
  } finally {
    fs.promises.unlink(tmp).catch(() => {})
  }
}

/** Noms exacts des imprimantes installées, pour éviter de les recopier à la main. */
function listWindowsPrinters() {
  if (process.platform !== 'win32') return Promise.resolve([])
  return new Promise((resolve) => {
    const child = spawn(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', '(Get-Printer).Name'],
      { windowsHide: true },
    )
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.on('error', () => resolve([]))
    child.on('close', () => resolve(out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)))
  })
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
    case 'windows': {
      if (!t.value) return { ok: false, detail: 'nom manquant' }
      if (t.value.startsWith('\\\\') || process.platform !== 'win32') {
        return { ok: true, detail: 'vérifié à l’impression' }
      }
      const printers = await listWindowsPrinters()
      return printers.includes(t.value)
        ? { ok: true }
        : { ok: false, detail: `imprimante « ${t.value} » absente de Windows` }
    }
    // Une file CUPS ne se teste qu'à l'impression.
    case 'cups': return t.value ? { ok: true, detail: 'vérifié à l’impression' } : { ok: false, detail: 'nom manquant' }
    case 'tcp': return probeTcp(t.ip, t.port)
    default: return { ok: false, detail: `branchement inconnu : ${t.transport}` }
  }
}

const describe = (t) =>
  t.transport === 'tcp' ? `${t.ip}:${t.port}` : `${t.transport} ${t.value}`

/* ---------------------------------------------------------------- serveur */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
}

/** Sert le POS construit (dossier dist/), avec repli sur index.html. */
async function serveWeb(req, res, pathname) {
  if (!fs.existsSync(WEB_DIR)) return false
  const clean = path.normalize(pathname).replace(/^([/\\.]+)/, '')
  let file = path.join(WEB_DIR, clean)
  if (!file.startsWith(WEB_DIR)) return false
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(WEB_DIR, 'index.html')
  if (!fs.existsSync(file)) return false
  const body = await fs.promises.readFile(file)
  res.writeHead(200, {
    'content-type': MIME[path.extname(file)] ?? 'application/octet-stream',
    'cache-control': path.extname(file) === '.html' ? 'no-cache' : 'max-age=3600',
  })
  res.end(body)
  return true
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
        windowsPrinters: await listWindowsPrinters(),
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

    if (req.method === 'GET' && (await serveWeb(req, res, url.pathname))) return

    json(res, 404, { error: 'Route inconnue' })
  })
  .listen(PORT, HOST, () => {
    log(`agent d'impression prêt sur http://${HOST}:${PORT}`)
    if (fs.existsSync(WEB_DIR)) log(`POS servi depuis ${WEB_DIR} — ouvrez http://<ip-du-poste>:${PORT}`)
    else log(`aucun POS à servir (dossier ${WEB_DIR} absent) : l'agent ne fait que l'impression`)
    log(`réseau par défaut : ${DEFAULT_IP}:${DEFAULT_PORT}`)
    const usb = listDevices()
    if (usb.length) log(`ports USB détectés : ${usb.join(', ')}`)
    listWindowsPrinters().then((p) => p.length && log(`imprimantes Windows : ${p.join(', ')}`))
  })
