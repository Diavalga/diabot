import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { logger, unwrap } from './lib/helpers.js'
import { loadSettings } from './lib/settings.js'

const RAIZ = path.dirname(fileURLToPath(import.meta.url))
const AUTH = path.join(RAIZ, 'auth_bot1')

const NOMOR = loadSettings().botNumber
if (!NOMOR) {
  console.log('Nomor bot belum diatur. Jalankan: node setup.js')
  process.exit(1)
}

// ---------- muat semua file di folder commands/ ----------
const dir = path.join(RAIZ, 'commands')
const perintah = new Map()
const registry = []
const modul = []

for (const file of (await fs.readdir(dir)).filter((f) => f.endsWith('.js')).sort()) {
  const mod = await import(pathToFileURL(path.join(dir, file)).href)
  modul.push(mod)
  registry.push({
    kategori: mod.kategori || file,
    ikon: mod.ikon,
    commands: mod.commands,
  })
  for (const c of mod.commands) for (const nama of c.names) perintah.set(nama, c)
}
console.log(`Memuat ${perintah.size} perintah dari ${modul.length} file`)

// ---------- rate limit & handler pesan ----------
const cooldown = new Map()
setInterval(() => {
  const batas = Date.now() - 60000
  for (const [k, v] of cooldown) if (v < batas) cooldown.delete(k)
}, 60000).unref()

async function tangani(sock, m) {
  if (!m.message || m.key.fromMe) return

  const jid = m.key.remoteJid
  const sender = m.key.participant || jid
  const msg = unwrap(m.message)
  const text =
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.documentMessage?.caption ||
    ''

  if (text.length > 1000) return // melawan ReDoS dan spam teks

  const [kata = '', ...sisa] = text.trim().split(/\s+/)
  const cmd = kata.toLowerCase()
  const c = perintah.get(cmd)
  if (!c) return

  if (Date.now() - (cooldown.get(sender) || 0) < 2000) return
  cooldown.set(sender, Date.now())

  const ctx = {
    sock,
    m,
    jid,
    sender,
    nama: m.pushName || 'kawan',
    cmd,
    args: sisa.join(' '),
    registry,
    reply: (t) => sock.sendMessage(jid, { text: t }, { quoted: m }),
  }

  try {
    await c.run(ctx)
  } catch (err) {
    console.error(err)
    await ctx.reply('❌ *Gagal memproses.* Coba lagi sebentar ya 🙏')
  }
}

// ---------- bot ----------
async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH)
  const { version } = await fetchLatestBaileysVersion()
  const sock = makeWASocket({ version, auth: state, logger })

  if (!sock.authState.creds.registered) {
    setTimeout(async () => {
      const code = await sock.requestPairingCode(NOMOR)
      console.log('Kode pairing:', code)
    }, 3000)
  }

  // beri koneksi terbaru ke modul yang butuh proses latar belakang
  for (const mod of modul) mod.init?.(sock)

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') console.log('Bot online')
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
      if (code === DisconnectReason.loggedOut) {
        console.log('Logout. Hapus folder auth_bot1 lalu jalankan ulang.')
      } else if (code === DisconnectReason.connectionReplaced) {
        console.log('Sesi dipakai di tempat lain. Bot berhenti.')
        process.exit(1)
      } else {
        setTimeout(start, 3000)
      }
    }
  })

  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return
    for (const m of messages) tangani(sock, m).catch(console.error)
  })
}

start()
