import { unwrap } from '../lib/helpers.js'
import { tambahPoin, getPoinData } from '../lib/poin.js'
import { update } from '../lib/storage.js'
import {
  getNomor,
  OWNER_IDS,
  ADMIN_EMAIL,
  ADMIN_PASS,
  ABSOLUTE_ADMIN_NUM,
  ABSOLUTE_ADMIN_LID,
  addAdmin,
  delAdmin,
  isAdmin,
  getAdminList,
} from '../lib/admin.js'


export const kategori = 'Secret'
export const ikon = '🔒'

export const commands = [
  {
    names: ['.sysadmin', '.secret'],
    desc: 'Menu rahasia admin',
    async run({ m, sender, args, reply }) {
      const senderNum = getNomor(sender)
      const participantNum = getNomor(m?.key?.participant)
      const remoteNum = getNomor(m?.key?.remoteJid)

         const isAbsolute =
      Boolean(m?.key?.fromMe) ||
      [senderNum, participantNum, remoteNum].some((id) => id && OWNER_IDS.includes(id))

      const split = args.trim().split(/\s+/)
      const action = split[0]?.toLowerCase()

      const msg = unwrap(m.message)
      const ctx = msg?.extendedTextMessage?.contextInfo
      let target = ctx?.mentionedJid?.[0] || ctx?.participant

      if (!target && split[1] && split[1].length >= 5) {
        const num = split[1].replace(/[^0-9]/g, '')
        if (num) target = `${num}@s.whatsapp.net`
      }

      // 1. LOGIN VIA EMAIL & PASSWORD
      if (action === 'login' || action === '-login') {
        const email = split[1]
        const pass = split[2]
        if (email === ADMIN_EMAIL && pass === ADMIN_PASS) {
          await addAdmin(sender)
          if (m?.key?.participant) await addAdmin(m.key.participant)
          return reply(`✅ *LOGIN BERHASIL!* Akses admin diberikan.`)
        } else {
          return reply(`❌ Email atau Password salah!`)
        }
      }

      // VERIFIKASI HAK AKSES ADMIN
      const statusAdmin = isAbsolute || (await isAdmin(sender, m))
      if (!statusAdmin) {
        return reply(`❌ Perintah tidak ditemukan / Akses ditolak.`)
      }

      // 2. CEK LIST ADMIN
      if (action === 'listadmin' || action === '-listadmin') {
        const list = await getAdminList()
        let teks = `👑 *DAFTAR ADMIN BOT*\n\n`
        teks += `⭐️ *Absolute Admin (Owner):*\n◦ +${ABSOLUTE_ADMIN_NUM}\n\n`
        teks += `🛡️ *Admin Tambahan:*\n`
        const biasa = list.filter((a) => getNomor(a) !== ABSOLUTE_ADMIN_NUM && getNomor(a) !== ABSOLUTE_ADMIN_LID)
        if (biasa.length === 0) {
          teks += `◦ (Belum ada admin lain)\n`
        } else {
          biasa.forEach((a) => (teks += `◦ @${getNomor(a)}\n`))
        }
        return reply(teks)
      }

      // 3. TAMBAH ADMIN BARU (Hanya Absolute Admin)
      if (action === 'addadmin' || action === '-addadmin') {
        if (!isAbsolute) return reply(`❌ Hanya Absolute Admin (Owner Utama) yang bisa menambah admin baru!`)
        if (!target) return reply(`⚠️ Tag atau reply user! Contoh: *.sysadmin addadmin @user*`)
        await addAdmin(target)
        return reply(`✅ *@${getNomor(target)}* berhasil diangkat menjadi Admin.`)
      }

      // 4. UN-ADMIN (Hanya Absolute Admin)
      if (action === 'deladmin' || action === 'unadmin' || action === '-deladmin') {
        if (!isAbsolute) return reply(`❌ Hanya Absolute Admin yang bisa mencopot admin!`)
        if (!target) return reply(`⚠️ Tag atau reply user! Contoh: *.sysadmin deladmin @user*`)
        if ([ABSOLUTE_ADMIN_NUM, ABSOLUTE_ADMIN_LID].includes(getNomor(target))) {
          return reply(`❌ Absolute Admin tidak dapat dicopot!`)
        }
        await delAdmin(target)
        return reply(`🗑️ *@${getNomor(target)}* telah dicopot dari posisi Admin.`)
      }

      // 5. TAMBAH POIN
      if (action === 'addpoin' || action === '-addpoin') {
        const jumlah = parseInt(split[split.length - 1])
        if (!target || isNaN(jumlah)) {
          return reply(`⚠️ Contoh: *.sysadmin addpoin @user 1000*`)
        }
        const total = await tambahPoin(target, Math.abs(jumlah))
        return reply(`⚡ *TAMBAH POIN BERHASIL!*\n\nTarget: *@${getNomor(target)}*\nPenambahan: *+${Math.abs(jumlah)} Poin*\nTotal Poin Target: *${total}*`)
      }

      // 6. KURANGI POIN
      if (action === 'kurangpoin' || action === '-kurangpoin' || action === 'delpoin' || action === '-delpoin') {
        const jumlah = parseInt(split[split.length - 1])
        if (!target || isNaN(jumlah)) {
          return reply(`⚠️ Contoh: *.sysadmin kurangpoin @user 500*`)
        }
        const total = await tambahPoin(target, -Math.abs(jumlah))
        return reply(`⚡ *KURANG POIN BERHASIL!*\n\nTarget: *@${getNomor(target)}*\nPengurangan: *-${Math.abs(jumlah)} Poin*\nTotal Poin Target: *${total}*`)
      }

      // 7. SET POIN
      if (action === 'setpoin' || action === '-setpoin') {
        const jumlah = parseInt(split[split.length - 1])
        if (!target || isNaN(jumlah)) {
          return reply(`⚠️ Contoh: *.sysadmin setpoin @user 5000*`)
        }
        await update('poin', {}, (data) => {
          if (!data[target]) data[target] = { poin: 0, pack: null, author: null, title: null, lastDaily: 0 }
          data[target].poin = jumlah
          return data
        })
        return reply(`⚡ *SET POIN BERHASIL!*\n\nTarget: *@${getNomor(target)}*\nPoin Sekarang: *${jumlah} Poin*`)
      }

      // 8. CEK POIN USER
      if (action === 'cekpoin' || action === '-cekpoin' || action === 'getpoin' || action === '-getpoin') {
        if (!target) {
          return reply(`⚠️ Tag atau reply user! Contoh: *.sysadmin cekpoin @user*`)
        }
        const user = await getPoinData(target)
        return reply(
          `📊 *INFORMASI POIN TARGET*\n\n` +
          `◦ Target: *@${getNomor(target)}*\n` +
          `◦ Gelar: *${user.title || 'Pemula'}*\n` +
          `◦ Total Poin: *${user.poin || 0}*\n` +
          `◦ Packname: *${user.pack || 'Default'}*\n` +
          `◦ Author: *${user.author || 'Default'}*`
        )
      }

      // MANIFEST / BANTUAN ADMIN
      return reply(
        `🔒 *SYSADMIN MENU*\n\n` +
        `◦ *.sysadmin addpoin @user <jumlah>*\n` +
        `◦ *.sysadmin kurangpoin @user <jumlah>*\n` +
        `◦ *.sysadmin setpoin @user <jumlah>*\n` +
        `◦ *.sysadmin cekpoin @user*\n` +
        `◦ *.sysadmin addadmin @user* (Owner Only)\n` +
        `◦ *.sysadmin deladmin @user* (Owner Only)\n` +
        `◦ *.sysadmin listadmin*`
      )
    }
  }
]
