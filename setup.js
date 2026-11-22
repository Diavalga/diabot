// Panel setup lokal: node setup.js  ->  buka alamat yang tampil di terminal
// Dari panel ini kamu bisa mengatur bot, menautkan WhatsApp, dan menjalankan/mematikan bot.
import http from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys'
import { logger } from './lib/helpers.js'
import { loadSettings, saveSettings } from './lib/settings.js'
import { load, update } from './lib/storage.js'

const PORT = Number(process.env.SETUP_PORT) || 3000
const KEY = crypto.randomBytes(16).toString('hex') // berubah setiap setup.js dijalankan
const HOSTS = [`127.0.0.1:${PORT}`, `localhost:${PORT}`]
const RAIZ = path.dirname(fileURLToPath(import.meta.url))
const AUTH = path.join(RAIZ, 'auth_bot1') // harus sama dengan yang dipakai index.js

const kuncikah = (s) => {
  const a = Buffer.from(String(s ?? ''))
  const b = Buffer.from(KEY)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

const angka = (s, min, max) => {
  const d = String(s ?? '').replace(/\D/g, '')
  return d.length >= min && d.length <= max ? d : null
}

const kirim = (res, kode, data, tipe = 'application/json') => {
  res.writeHead(kode, {
    'Content-Type': `${tipe}; charset=utf-8`,
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy':
      "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  })
  res.end(typeof data === 'string' ? data : JSON.stringify(data))
}

const baca = (req) =>
  new Promise((ok, gagal) => {
    let b = ''
    req.on('data', (c) => {
      b += c
      if (b.length > 10000) {
        req.destroy()
        gagal(new Error('terlalu besar'))
      }
    })
    req.on('end', () => {
      try {
        ok(JSON.parse(b || '{}'))
      } catch {
        gagal(new Error('JSON salah'))
      }
    })
  })

// ---------- pengendali bot (index.js sebagai proses anak) ----------
const bot = { proc: null, log: [] }

const tambahLog = (data) => {
  for (const baris of data.toString().split('\n')) {
    if (baris.trim()) bot.log.push(baris)
  }
  if (bot.log.length > 100) bot.log.splice(0, bot.log.length - 100)
}

function jalankanBot() {
  if (bot.proc) return
  tutup() // putuskan penautan dulu, satu sesi tidak boleh dipakai dua koneksi
  bot.log = []
  const p = spawn(process.execPath, ['index.js'], {
    cwd: RAIZ,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  bot.proc = p
  p.stdout.on('data', tambahLog)
  p.stderr.on('data', tambahLog)
  p.on('exit', (kode) => {
    if (bot.proc === p) bot.proc = null
    tambahLog(`Bot berhenti (kode ${kode})`)
  })
}

function matikanBot() {
  const p = bot.proc
  if (!p) return Promise.resolve()
  return new Promise((ok) => {
    const paksa = setTimeout(() => p.kill('SIGKILL'), 5000)
    p.once('exit', () => {
      clearTimeout(paksa)
      ok()
    })
    p.kill('SIGTERM')
  })
}

// ---------- penautan WhatsApp ----------
const tautan = { gen: 0, sock: null, status: 'idle', kode: null, lid: null, pesan: '', coba: 0 }

const adaSesi = async () => {
  try {
    return JSON.parse(await fs.readFile(path.join(AUTH, 'creds.json'), 'utf8')).registered === true
  } catch {
    return false
  }
}

function tutup() {
  tautan.gen++ // membatalkan semua timer dan event lama
  try {
    tautan.sock?.end(undefined)
  } catch {}
  tautan.sock = null
}

async function sambung(nomor) {
  const gen = tautan.gen
  const { state, saveCreds } = await useMultiFileAuthState(AUTH)
  const { version } = await fetchLatestBaileysVersion()
  if (gen !== tautan.gen) return
  const sock = makeWASocket({ version, auth: state, logger })
  tautan.sock = sock
  sock.ev.on('creds.update', saveCreds)

  if (!sock.authState.creds.registered) {
    setTimeout(async () => {
      if (gen !== tautan.gen) return
      try {
        const k = await sock.requestPairingCode(nomor)
        if (gen !== tautan.gen) return
        tautan.kode = `${k.slice(0, 4)}-${k.slice(4)}`
        tautan.status = 'menunggu'
      } catch (e) {
        tautan.status = 'error'
        tautan.pesan = 'Gagal membuat kode: ' + e.message
      }
    }, 3000)
  }

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (gen !== tautan.gen) return
    if (connection === 'open') {
      tautan.status = 'tertaut'
      tautan.kode = null
      tautan.coba = 0
      tautan.lid = (sock.user?.lid || '').replace(/[:@].*$/, '') || null
      // bot dan owner satu akun: LID akun ini = LID owner, isi otomatis
      const s = loadSettings()
      if (tautan.lid && !s.adminLid && s.botNumber === s.adminNum) saveSettings({ ...s, adminLid: tautan.lid })
      setTimeout(() => {
        if (gen === tautan.gen) tutup()
      }, 2500) // beri waktu menyimpan sesi
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
      if (code === DisconnectReason.loggedOut) {
        tautan.status = 'error'
        tautan.pesan = 'Sesi ditolak atau sudah dikeluarkan. Tekan "Tautkan ulang".'
        return
      }
      if (++tautan.coba > 10) {
        tautan.status = 'error'
        tautan.pesan = 'Koneksi gagal berulang kali. Cek internet lalu coba lagi.'
        return
      }
      // setelah pairing berhasil WhatsApp meminta sambung ulang, ini normal
      setTimeout(() => {
        if (gen === tautan.gen) sambung(nomor).catch(console.error)
      }, 2000)
    }
  })
}

async function mulaiTautan(reset) {
  await matikanBot() // bot harus mati sebelum menautkan
  const nomor = loadSettings().botNumber
  tutup()
  Object.assign(tautan, { status: 'menyambung', kode: null, lid: null, pesan: '', coba: 0 })
  if (reset) await fs.rm(AUTH, { recursive: true, force: true })
  await sambung(nomor)
}

const berhenti = () => {
  bot.proc?.kill('SIGTERM')
  tutup()
  process.exit(0)
}
process.on('SIGINT', berhenti)
process.on('SIGTERM', berhenti)
process.on('SIGHUP', berhenti)

// ---------- halaman ----------
const HTML = `<!doctype html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Setup Wabot</title>
<style>
:root{--bg:#05030a;--glass:#120b22cc;--line:#3a2a5f;--text:#ece6fa;--mute:#a79cc6;--acc:#a855f7;--acc2:#7c3aed;--ok:#34d399;--warn:#fbbf24;--bad:#f87171}
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;color:var(--text);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;background:var(--bg);overflow:hidden}

/* ---------- background ---------- */
#stars{position:fixed;inset:0;z-index:0;opacity:.8;animation:twinkle 6s ease-in-out infinite;
background-image:
radial-gradient(1px 1px at 12% 18%,#fff,transparent),radial-gradient(1px 1px at 28% 72%,#e9d5ff,transparent),
radial-gradient(1.5px 1.5px at 45% 12%,#fff,transparent),radial-gradient(1px 1px at 63% 85%,#fff,transparent),
radial-gradient(1px 1px at 78% 30%,#e9d5ff,transparent),radial-gradient(1.5px 1.5px at 90% 62%,#fff,transparent),
radial-gradient(1px 1px at 8% 90%,#fff,transparent),radial-gradient(1px 1px at 55% 50%,#c4b5fd,transparent),
radial-gradient(1px 1px at 36% 40%,#fff,transparent),radial-gradient(1px 1px at 95% 8%,#fff,transparent);
background-size:420px 420px}
@keyframes twinkle{50%{opacity:.4}}
#bh{position:fixed;z-index:0;right:-12vmin;top:50%;width:105vmin;height:105vmin;transform:translateY(-50%);pointer-events:none}
@media (max-width:760px){#bh{right:50%;transform:translate(50%,-50%);width:130vmin;height:130vmin;opacity:.7}}
.halo{transform-origin:0 0;animation:pulse 5s ease-in-out infinite}
@keyframes pulse{50%{opacity:.65}}
.flow1{stroke-dasharray:70 40;animation:flow 14s linear infinite}
.flow2{stroke-dasharray:30 60;animation:flow 9s linear infinite reverse}
.flow3{stroke-dasharray:12 22;animation:flow 6s linear infinite}
@keyframes flow{to{stroke-dashoffset:-1000}}
.swirl{transform-origin:0 0;animation:spin 60s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){#stars,.halo,.flow1,.flow2,.flow3,.swirl{animation:none}}

/* ---------- layout ---------- */
.app{position:relative;z-index:1;max-width:1040px;height:100%;margin:0 auto;padding:14px;display:flex;flex-direction:column;gap:12px}
.top{display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--glass);border:1px solid var(--line);border-radius:16px;backdrop-filter:blur(10px)}
.logo{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;font-size:20px;background:linear-gradient(135deg,var(--acc),var(--acc2));box-shadow:0 0 20px #a855f788;flex:none}
.brand{flex:1;min-width:0}
.brand b{display:block;font-size:16px}
.brand span{color:var(--mute);font-size:12px}
.stat{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.main{flex:1;min-height:0;display:grid;grid-template-columns:190px 1fr;gap:12px}
@media (max-width:760px){.main{grid-template-columns:1fr;grid-template-rows:auto 1fr}.brand span{display:none}}
nav{display:flex;flex-direction:column;gap:6px;padding:10px;background:var(--glass);border:1px solid var(--line);border-radius:16px;backdrop-filter:blur(10px);align-self:start}
@media (max-width:760px){nav{flex-direction:row;overflow-x:auto;align-self:stretch}}
.tab{display:flex;align-items:center;gap:10px;font:inherit;text-align:left;cursor:pointer;color:var(--mute);background:transparent;border:1px solid transparent;border-radius:11px;padding:10px 12px;white-space:nowrap;transition:background .15s,color .15s}
.tab:hover{color:var(--text);background:#ffffff0d}
.tab.on{color:#fff;background:linear-gradient(135deg,#a855f733,#7c3aed33);border-color:var(--acc)}
.tab i{font-style:normal;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:700;background:linear-gradient(135deg,var(--acc),var(--acc2));color:#fff;flex:none}
.panel{min-height:0;overflow:auto;padding:18px;background:var(--glass);border:1px solid var(--line);border-radius:16px;backdrop-filter:blur(10px)}
.sec{display:none}.sec.on{display:block;animation:in .25s ease}
@keyframes in{from{opacity:0;transform:translateY(6px)}}
h2{font-size:18px;margin:0 0 4px;display:flex;align-items:center}
h3{font-size:12px;margin:16px 0 0;color:var(--acc);text-transform:uppercase;letter-spacing:.08em;display:flex;align-items:center}
.g{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}
@media (max-width:520px){.g{grid-template-columns:1fr}}
label{display:flex;align-items:center;font-size:12px;color:var(--mute);margin:10px 0 4px}
input{width:100%;padding:9px 12px;border:1px solid var(--line);border-radius:10px;background:#0a0615;color:var(--text);font:inherit;outline:none;transition:border .15s,box-shadow .15s}
input:focus{border-color:var(--acc);box-shadow:0 0 0 3px #a855f733}
.b{font:inherit;cursor:pointer;border:0;border-radius:10px;padding:9px 16px;background:linear-gradient(135deg,var(--acc),var(--acc2));color:#fff;font-weight:600;margin:14px 8px 0 0;transition:transform .1s,filter .15s}
.b:hover{filter:brightness(1.12)}.b:active{transform:scale(.97)}
.b.o{background:transparent;color:var(--text);border:1px solid var(--line)}
.b.o:hover{border-color:var(--acc);filter:none}
.s{font:inherit;cursor:pointer;background:transparent;color:var(--bad);border:1px solid var(--line);border-radius:10px;padding:4px 12px;font-size:13px}
.r{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--line)}
.r:last-child{border-bottom:0}
.m{color:var(--mute);font-size:13px;margin:8px 0 0}
.pill{display:inline-flex;align-items:center;gap:7px;padding:4px 11px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid var(--line);background:#0a0615}
.pill::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--mute)}
.pill.ok{color:var(--ok);border-color:#34d39966}.pill.ok::before{background:var(--ok);box-shadow:0 0 8px var(--ok)}
.pill.wait{color:var(--warn);border-color:#fbbf2466}.pill.wait::before{background:var(--warn);animation:k 1s infinite}
.pill.bad{color:var(--bad);border-color:#f8717166}.pill.bad::before{background:var(--bad)}
@keyframes k{50%{opacity:.3}}
.big{margin:10px 0}
#kode{display:none;font:700 32px/1.2 ui-monospace,monospace;letter-spacing:.18em;text-align:center;color:#fff;background:#0a0615;border:1px dashed var(--acc);border-radius:14px;padding:16px;margin:12px 0;user-select:all;text-shadow:0 0 18px var(--acc)}
#blog{height:min(38vh,280px);overflow:auto;font:12px/1.5 ui-monospace,monospace;background:#030207;color:#c4f1d4;padding:12px;border-radius:10px;border:1px solid var(--line);white-space:pre-wrap;margin:10px 0 0}
#t{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:60;background:var(--acc2);color:#fff;padding:10px 18px;border-radius:10px;opacity:0;transition:opacity .2s;box-shadow:0 6px 24px #000a;pointer-events:none}#t.on{opacity:1}
.q{display:inline-grid;place-items:center;width:18px;height:18px;margin-left:8px;border-radius:50%;border:1px solid var(--acc);color:var(--acc);font:700 11px/1 system-ui,sans-serif;text-transform:none;letter-spacing:0;cursor:help;user-select:none;flex:none;transition:background .15s,color .15s}
.q:hover,.q:focus{background:var(--acc);color:#fff;outline:none}
#tip{display:none;position:fixed;z-index:50;max-width:290px;background:#1d1433;border:1px solid var(--acc);color:var(--text);padding:10px 12px;border-radius:10px;font:13px/1.5 system-ui,sans-serif;box-shadow:0 10px 30px #000c,0 0 18px #a855f733;pointer-events:none}
</style></head><body>

<div id="stars"></div>
<svg id="bh" viewBox="-300 -300 600 600" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<defs>
<radialGradient id="hg"><stop offset="0.28" stop-color="#000" stop-opacity="0"/><stop offset="0.36" stop-color="#d8b4fe" stop-opacity=".55"/><stop offset="0.5" stop-color="#7c3aed" stop-opacity=".3"/><stop offset="0.8" stop-color="#3b0764" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<linearGradient id="dg" x1="0" x2="1"><stop offset="0" stop-color="#f0abfc"/><stop offset="0.5" stop-color="#a855f7"/><stop offset="1" stop-color="#6d28d9"/></linearGradient>
<filter id="gl" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4"/></filter>
<clipPath id="front"><rect x="-300" y="0" width="600" height="300"/></clipPath>
<g id="disk" transform="rotate(-18)">
<ellipse class="flow1" rx="250" ry="62" fill="none" stroke="url(#dg)" stroke-width="10" opacity=".55"/>
<ellipse class="flow2" rx="205" ry="50" fill="none" stroke="url(#dg)" stroke-width="7" opacity=".75"/>
<ellipse class="flow3" rx="165" ry="40" fill="none" stroke="#f5d0fe" stroke-width="4" opacity=".9"/>
<ellipse rx="135" ry="33" fill="none" stroke="#fff" stroke-width="2" opacity=".8"/>
</g>
</defs>
<circle class="halo" r="295" fill="url(#hg)"/>
<g class="swirl" opacity=".5" fill="none" stroke="#a855f7" stroke-width="1.5" stroke-linecap="round">
<path d="M-280 0 A280 280 0 0 1 0 -280" opacity=".5"/><path d="M280 0 A280 280 0 0 1 0 280" opacity=".5"/>
<path d="M-230 0 A230 230 0 0 1 0 -230" opacity=".4" stroke="#e9d5ff"/><path d="M230 0 A230 230 0 0 1 0 230" opacity=".4" stroke="#e9d5ff"/>
</g>
<use href="#disk"/>
<circle r="96" fill="#000"/>
<circle r="98" fill="none" stroke="#f5d0fe" stroke-width="3" filter="url(#gl)" opacity=".9"/>
<circle r="97" fill="none" stroke="#fff" stroke-width="1.2" opacity=".85"/>
<use href="#disk" clip-path="url(#front)"/>
</svg>

<div class="app">
<header class="top">
<div class="logo">🤖</div>
<div class="brand"><b>Setup Wabot</b><span>Panel lokal untuk mengatur dan menjalankan bot WhatsApp</span></div>
<div class="stat"><span id="htaut" class="pill">WA</span><span id="hbot" class="pill">Bot</span></div>
</header>

<div class="main">
<nav>
<button class="tab on" data-s="s1"><i>1</i>Pengaturan</button>
<button class="tab" data-s="s2"><i>2</i>Tautkan WA</button>
<button class="tab" data-s="s3"><i>3</i>Jalankan bot</button>
<button class="tab" data-s="s4"><i>4</i>Admin</button>
</nav>

<div class="panel">

<section class="sec on" id="s1">
<h2 data-h="Isi data dasar bot di sini. Kalau sudah, klik Simpan dan tautkan WhatsApp untuk lanjut ke langkah 2. Kalau cuma mau menyimpan tanpa menautkan, klik Simpan saja.">Pengaturan bot</h2>
<div class="g">
<div><label data-h="Nomor WhatsApp yang akan menjadi bot, yaitu akun yang membalas pesan. Awali dengan 62, tanpa tanda + dan tanpa angka 0 di depan. Contoh: nomor 0812 3456 7890 ditulis 6281234567890.">Nomor bot (62812...)</label><input id="botNumber" inputmode="numeric"></div>
<div><label data-h="Nama bot yang tampil di menu (.menu) dan jadi nama pack stiker bawaan. Bebas, maksimal 40 karakter.">Nama bot</label><input id="namaBot" maxlength="40"></div>
</div>
<label data-h="Nama kamu. Dipakai sebagai author bawaan pada stiker yang dibuat lewat bot.">Nama pemilik (author stiker bawaan)</label><input id="namaPemilik" maxlength="40">
<h3 data-h="Owner punya akses penuh: bisa menambah dan mencopot admin, serta memakai menu rahasia .sysadmin. Isi dengan nomor pribadimu.">Owner / admin utama</h3>
<div class="g">
<div><label data-h="Nomor WhatsApp pemilik bot, formatnya sama: 62812xxxx. Gunakan nomor pribadi yang berbeda dari nomor bot agar perintah .sysadmin bisa digunakan.">Nomor owner (62812...)</label><input id="adminNum" inputmode="numeric"></div>
<div><label data-h="LID adalah ID tersembunyi WhatsApp. Pesan sering datang memakai LID, bukan nomor. Kirim .poin dari akun owner, buka data/poin.json, lalu salin angka di depan @lid.">LID owner (manual/otomatis)</label><input id="adminLid" inputmode="numeric"></div>
<div><label data-h="Opsional. Dipakai orang lain untuk login jadi admin lewat perintah .sysadmin login email password. Kosongkan kalau tidak mau ada login admin.">Email login .sysadmin</label><input id="adminEmail"></div>
<div><label data-h="Opsional, minimal 8 karakter. Pasangan dari email di sebelah. Kosongkan kalau tidak ingin mengubah password yang sudah tersimpan.">Password .sysadmin</label><input id="adminPass" type="password" autocomplete="new-password"></div>
</div>
<p class="m" id="passInfo"></p>
<button id="simpan" class="b o">Simpan</button><button id="simtaut" class="b">Simpan &amp; tautkan WhatsApp</button>
<p class="m">Nama, owner, dan password berlaku setelah bot di-restart.</p>
</section>

<section class="sec" id="s2">
<h2 data-h="Menghubungkan bot ke WhatsApp lewat kode pairing. Klik Buat kode pairing, lalu masukkan kodenya di HP bot: WhatsApp → Perangkat tertaut → Tautkan perangkat → Tautkan dengan nomor telepon. Cukup dilakukan sekali. Tombol Tautkan ulang menghapus sesi lama, pakai kalau bot sudah logout atau mau ganti nomor.">Tautkan WhatsApp</h2>
<p class="m">Bot akan dimatikan otomatis saat kamu mulai menautkan.</p>
<div class="big"><span id="tstatus" class="pill"></span></div>
<div id="kode"></div>
<div id="steps" class="m" style="display:none">Di HP dengan nomor bot: buka WhatsApp, pilih <b>Perangkat tertaut</b>, <b>Tautkan perangkat</b>, <b>Tautkan dengan nomor telepon</b>, lalu masukkan kode di atas. Kode hanya berlaku sekitar satu menit.</div>
<p id="tinfo" class="m"></p>
<button id="mulai" class="b">Buat kode pairing</button><button id="ulang" class="b o">Tautkan ulang (hapus sesi lama)</button>
</section>

<section class="sec" id="s3">
<h2 data-h="Menyalakan bot dari sini. Jalankan: menyalakan bot (WhatsApp harus sudah tertaut). Restart: mematikan lalu menyalakan lagi, pakai setelah mengubah pengaturan. Matikan: menghentikan bot. Kotak hitam menampilkan log bot. Bot hanya hidup selama terminal setup.js masih terbuka.">Jalankan bot</h2>
<div class="big"><span id="bstatus" class="pill"></span></div>
<button id="bmulai" class="b" style="margin-top:0">▶ Jalankan</button><button id="bulang" class="b o" style="margin-top:0">↻ Restart</button><button id="bmati" class="b o" style="margin-top:0">■ Matikan</button>
<pre id="blog"></pre>
</section>

<section class="sec" id="s4">
<h2 data-h="Admin tambahan bisa memakai menu .sysadmin untuk cek, tambah, dan kurangi poin. Mereka tidak bisa menambah atau mencopot admin lain, itu khusus owner. Perubahan berlaku langsung tanpa restart.">Admin tambahan</h2>
<div id="list"></div>
<label data-h="Isi nomor (62812xxxx) atau LID orang yang mau dijadikan admin, hanya angka. Lalu klik Tambah admin.">Nomor atau LID admin baru</label><input id="nb" inputmode="numeric">
<button id="tambah" class="b">Tambah admin</button>
<p class="m">Daftar admin berlaku langsung, tanpa restart.</p>
</section>

</div></div></div>
<div id="t"></div><div id="tip"></div>

<script>
var KEY=new URLSearchParams(location.search).get('key')
function $(s){return document.querySelector(s)}
function toast(x,bad){var e=$('#t');e.textContent=x;e.style.background=bad?'var(--bad)':'';e.className='on';clearTimeout(toast.i);toast.i=setTimeout(function(){e.className=''},3000)}
async function api(p,b){var o={headers:{'x-key':KEY}};if(b){o.method='POST';o.body=JSON.stringify(b)}
var r=await fetch('/api/'+p,o);var d=await r.json().catch(function(){return{}});if(!r.ok)throw new Error(d.error||'Error '+r.status);return d}

// ---------- menu / tab ----------
function buka(id){document.querySelectorAll('.sec').forEach(function(s){s.classList.toggle('on',s.id===id)})
document.querySelectorAll('.tab').forEach(function(t){t.classList.toggle('on',t.getAttribute('data-s')===id)});tutupTip()}
document.querySelectorAll('.tab').forEach(function(t){t.onclick=function(){buka(t.getAttribute('data-s'))}})

// ---------- pengaturan & admin ----------
var F=['botNumber','namaBot','namaPemilik','adminNum','adminLid','adminEmail']
async function muat(){try{var c=await api('config');F.forEach(function(k){$('#'+k).value=c[k]||''})
$('#passInfo').textContent=c.passSet?'Password sudah diatur.':'Password belum diatur (login .sysadmin nonaktif).'
var L=$('#list');L.replaceChildren();if(!c.admins.length){var p=document.createElement('p');p.className='m';p.textContent='Belum ada admin tambahan.';L.append(p)}
c.admins.forEach(function(a){var r=document.createElement('div');r.className='r';var s=document.createElement('span');s.textContent=a.split('@')[0];
var b=document.createElement('button');b.className='s';b.textContent='Hapus';b.onclick=async function(){try{await api('admin/del',{nomor:a});muat()}catch(e){toast(e.message,true)}};r.append(s,b);L.append(r)})
}catch(e){toast(e.message,true)}}
async function simpan(){var b={};F.concat('adminPass').forEach(function(k){b[k]=$('#'+k).value});await api('config',b);$('#adminPass').value='';muat()}
async function mulai(reset){await api('tautan/mulai',{reset:reset});cek()}
$('#simpan').onclick=async function(){try{await simpan();toast('Tersimpan.')}catch(e){toast(e.message,true)}}
$('#simtaut').onclick=async function(){try{await simpan();await mulai(false);buka('s2');toast('Tersimpan. Menyiapkan kode...')}catch(e){toast(e.message,true)}}
$('#mulai').onclick=async function(){try{await mulai(false)}catch(e){toast(e.message,true)}}
$('#ulang').onclick=async function(){if(!confirm('Hapus sesi WhatsApp lama dan buat kode baru?'))return;try{await mulai(true)}catch(e){toast(e.message,true)}}
$('#tambah').onclick=async function(){try{await api('admin/add',{nomor:$('#nb').value});$('#nb').value='';muat()}catch(e){toast(e.message,true)}}

// ---------- status penautan ----------
var ST={idle:'Belum dimulai',menyambung:'Menyambung ke WhatsApp...',menunggu:'Menunggu kode dimasukkan di HP...',tertaut:'Berhasil tertaut',error:'Gagal'}
var WARNA={idle:'',menyambung:'wait',menunggu:'wait',tertaut:'ok',error:'bad'}
async function cek(){try{var t=await api('tautan')
var teks=(ST[t.status]||t.status)+(t.status==='idle'&&t.adaSesi?' (sesi lama tersimpan)':'')
$('#tstatus').textContent=teks;$('#tstatus').className='pill '+(WARNA[t.status]||'')
var hw=t.status==='idle'&&t.adaSesi?'ok':(WARNA[t.status]||'')
$('#htaut').textContent=hw==='ok'?'WA tertaut':(t.status==='idle'?'WA belum tertaut':'WA '+t.status);$('#htaut').className='pill '+hw
$('#kode').textContent=t.kode||'';$('#kode').style.display=t.kode?'block':'none';$('#steps').style.display=t.kode?'block':'none'
$('#tinfo').textContent=t.status==='error'?t.pesan:t.status==='tertaut'?(t.lid?'LID akun ini: '+t.lid+'. ':'')+'Sekarang buka menu Jalankan bot.':''
if(t.status==='tertaut'&&!cek.done){cek.done=1;muat()}}catch(e){}}

// ---------- status bot ----------
async function cekBot(){try{var b=await api('bot')
var teks=b.jalan?(b.online?'Bot online':'Bot menyala, menyambung...'):'Bot mati'
var kls='pill '+(b.jalan?(b.online?'ok':'wait'):'')
$('#bstatus').textContent=teks;$('#bstatus').className=kls
$('#hbot').textContent=teks;$('#hbot').className=kls
var l=$('#blog');l.textContent=b.log.length?b.log.join('\\n'):'(log kosong)';l.scrollTop=l.scrollHeight}catch(e){}}
function kontrol(id,p){$(id).onclick=async function(){try{await api('bot/'+p,{});cekBot()}catch(e){toast(e.message,true)}}}
kontrol('#bmulai','mulai');kontrol('#bulang','ulang');kontrol('#bmati','mati')

// ---------- hint (?) ----------
var tip=$('#tip'),aktif=null
function pasangHint(){document.querySelectorAll('[data-h]').forEach(function(el){
var q=document.createElement('span');q.className='q';q.tabIndex=0;q.textContent='?'
q.setAttribute('data-t',el.getAttribute('data-h'));el.appendChild(q)})}
function bukaTip(q){aktif=q;tip.textContent=q.getAttribute('data-t');tip.style.display='block'
var r=q.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight
var x=Math.min(Math.max(8,r.left+r.width/2-w/2),window.innerWidth-w-8)
var y=r.bottom+8;if(y+h>window.innerHeight-8)y=r.top-h-8
tip.style.left=x+'px';tip.style.top=y+'px'}
function tutupTip(){aktif=null;tip.style.display='none'}
function cariQ(e){return e.target.closest?e.target.closest('.q'):null}
document.addEventListener('mouseover',function(e){var q=cariQ(e);if(q)bukaTip(q)})
document.addEventListener('mouseout',function(e){var q=cariQ(e);if(q&&aktif===q)tutupTip()})
document.addEventListener('focusin',function(e){var q=cariQ(e);if(q)bukaTip(q)})
document.addEventListener('focusout',function(e){var q=cariQ(e);if(q)tutupTip()})
document.addEventListener('click',function(e){var q=cariQ(e);if(q)bukaTip(q);else tutupTip()})
window.addEventListener('scroll',tutupTip,true)
pasangHint()

cekBot();setInterval(cekBot,2000)
muat();cek();setInterval(cek,2000)
</script></body></html>`

// ---------- server ----------
const server = http.createServer(async (req, res) => {
  try {
    // tolak host lain (melawan DNS rebinding) dan semua akses tanpa kunci
    if (!HOSTS.includes(req.headers.host)) return kirim(res, 403, { error: 'Host ditolak' })
    const url = new URL(req.url, 'http://x')

    if (req.method === 'GET' && url.pathname === '/') {
      if (!kuncikah(url.searchParams.get('key')))
        return kirim(res, 403, 'Buka alamat lengkap (dengan ?key=...) yang tampil di terminal.', 'text/plain')
      return kirim(res, 200, HTML, 'text/html')
    }
    if (!url.pathname.startsWith('/api/') || !kuncikah(req.headers['x-key']))
      return kirim(res, 403, { error: 'Ditolak' })

    if (req.method === 'GET' && url.pathname === '/api/config') {
      const s = loadSettings()
      return kirim(res, 200, {
        botNumber: s.botNumber,
        adminNum: s.adminNum,
        adminLid: s.adminLid,
        adminEmail: s.adminEmail,
        passSet: Boolean(s.adminPass),
        namaBot: s.namaBot,
        namaPemilik: s.namaPemilik,
        admins: await load('admins', []),
      })
    }

    if (req.method === 'POST' && url.pathname === '/api/config') {
      const b = await baca(req)
      const s = loadSettings()
      const botNumber = angka(b.botNumber, 8, 15)
      const adminNum = angka(b.adminNum, 8, 15)
      if (!botNumber || !adminNum)
        return kirim(res, 400, { error: 'Nomor bot dan nomor owner harus 8–15 digit angka (format 62...)' })
      const lidRaw = String(b.adminLid || '').trim()
      const adminLid = lidRaw ? angka(lidRaw, 8, 30) : ''
      if (lidRaw && !adminLid) return kirim(res, 400, { error: 'LID harus berupa angka' })
      const adminEmail = String(b.adminEmail || '').trim()
      if (adminEmail && !/^\S+@\S+\.\S+$/.test(adminEmail)) return kirim(res, 400, { error: 'Format email salah' })
      const pass = String(b.adminPass || '')
      if (pass && pass.length < 8) return kirim(res, 400, { error: 'Password minimal 8 karakter' })
      saveSettings({
        ...s,
        botNumber,
        adminNum,
        adminLid,
        adminEmail,
        adminPass: pass || s.adminPass,
        namaBot: String(b.namaBot || '').trim().slice(0, 40) || 'WaBot',
        namaPemilik: String(b.namaPemilik || '').trim().slice(0, 40),
      })
      return kirim(res, 200, { ok: true })
    }

    if (req.method === 'GET' && url.pathname === '/api/tautan') {
      const { status, kode, lid, pesan } = tautan
      return kirim(res, 200, { status, kode, lid, pesan, adaSesi: await adaSesi() })
    }

    if (req.method === 'POST' && url.pathname === '/api/tautan/mulai') {
      const b = await baca(req)
      if (!loadSettings().botNumber) return kirim(res, 400, { error: 'Simpan nomor bot dulu' })
      await mulaiTautan(Boolean(b.reset))
      return kirim(res, 200, { ok: true })
    }

    if (req.method === 'POST' && url.pathname === '/api/admin/add') {
      const b = await baca(req)
      const nomor = angka(b.nomor, 8, 30)
      if (!nomor) return kirim(res, 400, { error: 'Nomor/LID harus berupa angka' })
      await update('admins', [], (d) => {
        if (!d.some((a) => a.split('@')[0] === nomor)) d.push(`${nomor}@s.whatsapp.net`)
      })
      return kirim(res, 200, { ok: true })
    }

    if (req.method === 'POST' && url.pathname === '/api/admin/del') {
      const b = await baca(req)
      const nomor = String(b.nomor || '').split('@')[0]
      await update('admins', [], (d) => {
        const sisa = d.filter((a) => a.split('@')[0] !== nomor)
        d.splice(0, d.length, ...sisa)
      })
      return kirim(res, 200, { ok: true })
    }

    // ---------- kontrol bot ----------
    if (req.method === 'GET' && url.pathname === '/api/bot') {
      return kirim(res, 200, {
        jalan: Boolean(bot.proc),
        online: bot.log.some((l) => l.includes('Bot online')),
        log: bot.log.slice(-40),
      })
    }

    if (req.method === 'POST' && url.pathname === '/api/bot/mulai') {
      await baca(req)
      if (!(await adaSesi())) return kirim(res, 400, { error: 'Tautkan WhatsApp dulu' })
      jalankanBot()
      return kirim(res, 200, { ok: true })
    }

    if (req.method === 'POST' && url.pathname === '/api/bot/mati') {
      await baca(req)
      await matikanBot()
      return kirim(res, 200, { ok: true })
    }

    if (req.method === 'POST' && url.pathname === '/api/bot/ulang') {
      await baca(req)
      if (!(await adaSesi())) return kirim(res, 400, { error: 'Tautkan WhatsApp dulu' })
      await matikanBot()
      jalankanBot()
      return kirim(res, 200, { ok: true })
    }

    kirim(res, 404, { error: 'Tidak ditemukan' })
  } catch (err) {
    console.error(err)
    kirim(res, 500, { error: 'Kesalahan server' })
  }
})

// hanya 127.0.0.1: tidak bisa diakses dari perangkat lain
server.listen(PORT, '127.0.0.1', () => {
  console.log(
    `\nBuka di browser:\nhttp://127.0.0.1:${PORT}/?key=${KEY}\n\nBiarkan terminal ini tetap terbuka selama bot berjalan. Tekan Ctrl+C untuk menutup panel (bot ikut mati).`
  )
})
