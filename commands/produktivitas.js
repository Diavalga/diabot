import { load, update } from '../lib/storage.js'
import { kotak } from '../lib/ui.js'

export const kategori = 'Produktivitas'
export const ikon = '🗓️'

// ---------- pengingat ----------
const SATUAN = { m: 60e3, j: 3600e3, d: 86400e3 } // menit, jam, hari

// "30m" / "2j" / "1d" / "15:00" -> timestamp (ms), atau null kalau format salah
function parseWaktu(str) {
  const dur = str.match(/^(\d+)([mjd])$/i)
  if (dur) return Date.now() + Number(dur[1]) * SATUAN[dur[2].toLowerCase()]

  const jam = str.match(/^(\d{1,2})[:.](\d{2})$/)
  if (jam) {
    const h = Number(jam[1])
    const mnt = Number(jam[2])
    if (h > 23 || mnt > 59) return null
    const t = new Date()
    t.setHours(h, mnt, 0, 0)
    if (t.getTime() <= Date.now()) t.setDate(t.getDate() + 1) // jam sudah lewat -> besok
    return t.getTime()
  }
  return null
}

const formatWaktu = (ms) =>
  new Date(ms).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })

// pengecek pengingat: berjalan sekali, selalu memakai koneksi terbaru
let sockAktif = null
let timer = null

export function init(sock) {
  sockAktif = sock
  if (timer) return
  timer = setInterval(async () => {
    try {
      const semua = await load('reminders', [])
      if (!semua.some((r) => r.at <= Date.now())) return

      const jatuhTempo = await update('reminders', [], (data) => {
        const now = Date.now()
        const due = data.filter((r) => r.at <= now)
        data.splice(0, data.length, ...data.filter((r) => r.at > now))
        return due
      })
      for (const r of jatuhTempo) {
        await sockAktif.sendMessage(r.jid, {
          text: kotak('⏰ *PENGINGAT*', [r.text]),
        })
      }
    } catch (err) {
      console.error('Reminder error:', err)
    }
  }, 30_000)
}

// ---------- perintah ----------
export const commands = [
  {
    names: ['.remind', '.ingatkan'],
    desc: 'pengingat, contoh: .remind 15:00 kumpul tugas',
    async run({ jid, sender, args, reply }) {
      const [kata = '', ...sisa] = args.split(/\s+/)
      const sub = kata.toLowerCase()

      // daftar pengingat
      if (!args || sub === 'list') {
        const milik = (await load('reminders', [])).filter((r) => r.sender === sender)
        const daftar = milik.length
          ? milik.map((r, i) => `${i + 1}. ${formatWaktu(r.at)} : ${r.text}`)
          : ['_Belum ada pengingat._']
        return reply(
          kotak('⏰ *PENGINGAT KAMU*', [
            ...daftar,
            '',
            '*Contoh:*',
            '.remind 15:00 kumpul tugas',
            '.remind 30m istirahat',
            '.remind 2j cek email',
            '.remind hapus 1',
            '',
            '_Satuan: m = menit, j = jam, d = hari_',
          ])
        )
      }

      // hapus pengingat
      if (sub === 'hapus') {
        const no = parseInt(sisa[0], 10)
        const dihapus = await update('reminders', [], (data) => {
          const milik = data.filter((r) => r.sender === sender)
          const target = milik[no - 1]
          if (!target) return null
          data.splice(data.indexOf(target), 1)
          return target
        })
        return reply(
          dihapus ? `🗑️ Pengingat dihapus: ${dihapus.text}` : '⚠️ Nomor tidak ditemukan.'
        )
      }

      // tambah pengingat
      const at = parseWaktu(sub)
      const teks = sisa.join(' ').trim()
      if (!at || !teks)
        return reply('💡 Format: *.remind <waktu> <pesan>*\nContoh: .remind 15:00 kumpul tugas')

      await update('reminders', [], (data) => {
        data.push({ jid, sender, at, text: teks })
      })
      return reply(
        kotak('✅ *PENGINGAT DISET*', [`🕐 ${formatWaktu(at)}`, `📝 ${teks}`])
      )
    },
  },
  {
    names: ['.todo'],
    desc: 'daftar tugas: .todo tambah / selesai / hapus',
    async run({ sender, args, reply }) {
      const [kata = '', ...sisa] = args.split(/\s+/)
      const sub = kata.toLowerCase()
      const isi = sisa.join(' ').trim()

      const tampil = (daftar) =>
        daftar.length
          ? daftar
              .map((t, i) => `${i + 1}. ${t.done ? `✅ ~${t.text}~` : `⬜ ${t.text}`}`)
              .join('\n')
          : '_Daftar kosong, santai dulu 😄_'

      if (sub === 'tambah' && isi) {
        const daftar = await update('todo', {}, (data) => {
          const list = (data[sender] ||= [])
          list.push({ text: isi, done: false })
          return list
        })
        return reply(`➕ Ditambahkan.\n\n${tampil(daftar)}`)
      }

      if (sub === 'selesai' || sub === 'hapus') {
        const no = parseInt(sisa[0], 10)
        const daftar = await update('todo', {}, (data) => {
          const list = (data[sender] ||= [])
          if (!(no >= 1 && no <= list.length)) return null
          if (sub === 'selesai') list[no - 1].done = !list[no - 1].done
          else list.splice(no - 1, 1)
          return list
        })
        if (!daftar) return reply('⚠️ Nomor tidak ditemukan.')
        return reply(
          `${sub === 'selesai' ? '✔️ Diperbarui' : '🗑️ Dihapus'}\n\n${tampil(daftar)}`
        )
      }

      const daftar = (await load('todo', {}))[sender] || []
      return reply(
        kotak('📝 *TO-DO KAMU*', [
          tampil(daftar),
          '',
          '.todo tambah <tugas>',
          '.todo selesai <no>',
          '.todo hapus <no>',
        ])
      )
    },
  },
]