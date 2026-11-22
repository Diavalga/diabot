import { 
  getPoinData, 
  tukarWatermark, 
  klaimDaily, 
  transferPoin, 
  getLeaderboard, 
  beliTitle 
} from '../lib/poin.js'
import { NAMA_BOT, NAMA_PEMILIK } from '../lib/config.js'
import { unwrap } from '../lib/helpers.js'

export const kategori = 'Fitur Poin'
export const ikon = '🪙'

const LIST_TOKO = [
  { id: '1', title: '🗿 Sigma', harga: 150 },
  { id: '2', title: '⚔️ Jawara', harga: 300 },
  { id: '3', title: '👑 Sultan', harga: 500 },
  { id: '4', title: '🔥 Legend', harga: 1000 }
]

export const commands = [
  // 1. CEK POIN
  {
    names: ['.poin', '.cekpoin', '.point'],
    desc: 'Cek poin, gelar/title, dan watermark stiker',
    async run({ sender, reply }) {
      const user = await getPoinData(sender)
      const pack = user.pack || `By ${NAMA_BOT}`
      const author = user.author || NAMA_PEMILIK
      const title = user.title || 'Pemula'

      return reply(
        `🪙 *INFORMASI POIN*\n\n` +
        `◦ Gelar: *${title}*\n` +
        `◦ Total Poin: *${user.poin || 0}*\n` +
        `◦ Packname Stiker: *${pack}*\n` +
        `◦ Author Stiker: *${author}*\n\n` +
        `💡 *Menu Poin:*\n` +
        `◦ *.daily* — Klaim poin harian\n` +
        `◦ *.top* — Papan peringkat poin\n` +
        `◦ *.tf @user [jumlah]* — Transfer poin\n` +
        `◦ *.shop* — Toko gelar/title\n` +
        `◦ *.setstiker Pack | Author* — Tukar 250 poin`
      )
    },
  },

  // 2. KLAIM HARIAN
  {
    names: ['.daily', '.klaim'],
    desc: 'Klaim 50 poin gratis setiap 24 jam',
    async run({ sender, reply }) {
      const res = await klaimDaily(sender)
      if (!res.success) {
        return reply(`⏳ Kamu sudah klaim hari ini! Coba lagi dalam *${res.jam} jam ${res.menit} menit*.`)
      }
      return reply(`🎁 *KLAIM HARIAN BERHASIL!*\n\nKamu mendapatkan *+${res.bonus} Poin*.\nTotal Poin: *${res.total}*`)
    },
  },

  // 3. LEADERBOARD / PAPAN PERINGKAT
  {
    names: ['.top', '.leaderboard'],
    desc: 'Lihat 10 pengguna dengan poin tertinggi',
    async run({ reply }) {
      const top = await getLeaderboard(10)
      if (top.length === 0) return reply('❌ Belum ada data poin.')

      let teks = `🏆 *PAPAN PERINGKAT POIN*\n\n`
      top.forEach((u, i) => {
        const idUser = u.jid.split('@')[0]
        teks += `${i + 1}. *@${idUser}* [${u.title}]\n   🪙 *${u.poin} Poin*\n`
      })

      return reply(teks)
    },
  },

  // 4. TRANSFER POIN
  {
    names: ['.tf', '.transfer', '.tfpoin'],
    desc: 'Transfer poin ke pengguna lain (.tf @user 50 atau reply chatnya)',
    async run({ m, sender, args, reply }) {
      const msg = unwrap(m.message)
      const ctx = msg?.extendedTextMessage?.contextInfo
      let target = ctx?.mentionedJid?.[0] || ctx?.participant

      const splitArgs = args.trim().split(/\s+/)
      let jumlah = parseInt(splitArgs[splitArgs.length - 1])

      if (!target && splitArgs[0]?.length > 5) {
        const num = splitArgs[0].replace(/[^0-9]/g, '')
        if (num) target = `${num}@s.whatsapp.net`
      }

      if (!target || isNaN(jumlah) || jumlah <= 0) {
        return reply('⚠️ *Format salah!*\n\nContoh:\n◦ Tag user: *.tf @user 50*\n◦ Reply pesan: *.tf 50*')
      }

      if (target === sender) return reply('❌ Tidak bisa transfer poin ke diri sendiri.')

      const res = await transferPoin(sender, target, jumlah)
      if (!res.success) {
        return reply(`❌ Poin tidak cukup! Poinmu saat ini: *${res.sisa}*`)
      }

      const idTarget = target.split('@')[0]
      return reply(`✅ *TRANSFER BERHASIL!*\n\nDikirim ke: *@${idTarget}*\nJumlah: *${jumlah} Poin*\nSisa Poinmu: *${res.sisaSender}*`)
    },
  },

  // 5. TOKO GELAR / SHOP
  {
    names: ['.shop', '.toko', '.buy'],
    desc: 'Toko gelar/title kustom (.shop atau .buy [nomor])',
    async run({ sender, args, reply }) {
      const pilihan = args.trim()

      if (!pilihan) {
        let teks = `🏪 *TOKO GELAR KUSTOM*\n\n`
        LIST_TOKO.forEach((item) => {
          teks += `*[${item.id}]* ${item.title}\n   Harga: 🪙 *${item.harga} Poin*\n`
        })
        teks += `\n💡 Ketik *.buy [nomor]* untuk membeli.\nContoh: *.buy 1*`
        return reply(teks)
      }

      const itemBeli = LIST_TOKO.find((i) => i.id === pilihan)
      if (!itemBeli) return reply('⚠️ Nomor pilihan toko tidak valid! Ketik *.shop* untuk melihat daftar.')

      const res = await beliTitle(sender, itemBeli.title, itemBeli.harga)
      if (!res.success) {
        return reply(`❌ Poin tidak cukup! Dibutuhkan *${itemBeli.harga} Poin*, poinmu saat ini *${res.sisa}*.`)
      }

      return reply(`🎉 *PEMBELIAN BERHASIL!*\n\nGelar baru kamu: *${res.title}*\nSisa Poin: *${res.sisa}*`)
    },
  },

  // 6. SET WATERMARK STIKER
  {
    names: ['.setstiker', '.setwm'],
    desc: 'Tukar 250 poin untuk ubah watermark stiker (format: .setstiker Pack | Author)',
    async run({ sender, args, reply }) {
      if (!args.includes('|')) {
        return reply(`⚠️ Format salah!\nGunakan pemisah tanda *|*\nContoh: *.setstiker MyPack | Zero*`)
      }

      const [pack, author] = args.split('|').map((s) => s.trim())
      if (!pack || !author) return reply('⚠️ Packname dan Author tidak boleh kosong.')

      const res = await tukarWatermark(sender, pack, author)
      if (!res.success) {
        return reply(`❌ *Poin Tidak Cukup!*\nPoin kamu saat ini: *${res.sisa}*\nDibutuhkan *250 poin* untuk mengubah watermark.`)
      }

      return reply(
        `🎉 *BERHASIL MENUKAR POIN!*\n\n` +
        `Watermark stiker kamu berhasil diubah:\n` +
        `◦ Packname: *${res.pack}*\n` +
        `◦ Author: *${res.author}*\n` +
        `◦ Sisa Poin: *${res.sisa}*`
      )
    },
  },
]