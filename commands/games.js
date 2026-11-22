import { unwrap } from '../lib/helpers.js'
import { getPoinData, tambahPoin, kurangiPoin } from '../lib/poin.js'
import { DATA_TEBAK_KATA } from '../lib/soal/tebakkata.js'
import { DATA_TEBAK_GAMBAR } from '../lib/soal/tebakgambar.js'

export const kategori = 'Games'
export const ikon = '🎮'

const BIAYA_GAME = 10
const sesiGame = new Map()

const DATA_SUSUN_KATA = [
  { kata: 'INDONESIA', petunjuk: 'Nama negara tercinta' },
  { kata: 'KOMPUTER', petunjuk: 'Alat pengolah data elektronik' },
  { kata: 'KEYBOARD', petunjuk: 'Papan ketik komputer' },
  { kata: 'INTERNET', petunjuk: 'Jaringan komunikasi global' },
  { kata: 'PROGRAMMER', petunjuk: 'Profesi pembuat kode perangkat lunak' },
  { kata: 'SEMARANG', petunjuk: 'Ibu kota Provinsi Jawa Tengah' },
  { kata: 'ALGORITMA', petunjuk: 'Urutan langkah logis penyelesaian masalah' },
  { kata: 'WHATSAPP', petunjuk: 'Aplikasi pesan instan populer' },
  { kata: 'MARTABAK', petunjuk: 'Makanan malam lezat manis atau telur' },
  { kata: 'ANTARIKSA', petunjuk: 'Ruang luar angkasa' }
]

const DATA_TEBAK_LIRIK = [
  { lirik: 'Aku yang dulu bukanlah yang ..., dulu ditendang sekarang ku dibelai', jawaban: 'sekarang', petunjuk: 'S _ K A R A N G' },
  { lirik: 'Harta yang paling berharga adalah ..., istana yang paling indah adalah keluarga', jawaban: 'keluarga', petunjuk: 'K _ L U A R G A' },
  { lirik: 'Balonku ada lima, rupa-rupa warnanya. Meletus balon ... DOR!', jawaban: 'hijau', petunjuk: 'H _ J A U' },
  { lirik: 'Pelangi-pelangi alangkah indahmu, merah kuning ... di langit yang biru', jawaban: 'hijau', petunjuk: 'H _ J A U' },
  { lirik: 'Buka dikit ..., jos!', jawaban: 'joss', petunjuk: 'J _ S S' },
  { lirik: 'Ku menangis... membayangkan betapa kejamnya dirimu atas ...', jawaban: 'diriku', petunjuk: 'D _ R I K U' }
]

const SOAL_MATH = (level = 'mid') => {
  // ---------------- LEVEL EASY (REWARD 5 POIN) ----------------
  if (level === 'easy') {
    const jenis = Math.floor(Math.random() * 5)
    if (jenis === 0) {
      const a = Math.floor(Math.random() * 50) + 1
      const b = Math.floor(Math.random() * 50) + 1
      return { soal: `${a} + ${b}`, jawaban: String(a + b), poin: 5, level: 'EASY' }
    } else if (jenis === 1) {
      const a = Math.floor(Math.random() * 50) + 20
      const b = Math.floor(Math.random() * a) + 1
      return { soal: `${a} - ${b}`, jawaban: String(a - b), poin: 5, level: 'EASY' }
    } else if (jenis === 2) {
      const a = Math.floor(Math.random() * 10) + 1
      const b = Math.floor(Math.random() * 10) + 1
      return { soal: `${a} × ${b}`, jawaban: String(a * b), poin: 5, level: 'EASY' }
    } else if (jenis === 3) {
      const b = Math.floor(Math.random() * 9) + 2
      const ans = Math.floor(Math.random() * 10) + 1
      const a = b * ans
      return { soal: `${a} ÷ ${b}`, jawaban: String(ans), poin: 5, level: 'EASY' }
    } else {
      const a = Math.floor(Math.random() * 20) + 1
      const ans = Math.floor(Math.random() * 20) + 1
      const b = a + ans
      return { soal: `Berapakah nilai x jika: x + ${a} = ${b}?`, jawaban: String(ans), poin: 5, level: 'EASY' }
    }
  }

  // ---------------- LEVEL HARD (REWARD 35 POIN) ----------------
  if (level === 'hard') {
    const jenis = Math.floor(Math.random() * 6)
    if (jenis === 0) {
      // Integral Tentu: ∫ (0 to b) c*x dx = (c * b^2) / 2
      const c = (Math.floor(Math.random() * 4) + 1) * 2
      const b = Math.floor(Math.random() * 5) + 1
      const hasil = (c * Math.pow(b, 2)) / 2
      return {
        soal: `Hitung nilai integral tentu:\n∫ (dari 0 sampai ${b}) ${c}x dx`,
        jawaban: String(hasil),
        poin: 35,
        level: 'HARD'
      }
    } else if (jenis === 1) {
      // Regresi Linier Y = a + bX
      const a = Math.floor(Math.random() * 15) + 1
      const b = Math.floor(Math.random() * 6) + 1
      const x = Math.floor(Math.random() * 10) + 1
      const hasil = a + b * x
      return {
        soal: `Persamaan Regresi Linier: Y = ${a} + ${b}X\nBerapakah nilai Y jika X = ${x}?`,
        jawaban: String(hasil),
        poin: 35,
        level: 'HARD'
      }
    } else if (jenis === 2) {
      // Determinan Matriks 2x2
      const a = Math.floor(Math.random() * 6) + 1
      const b = Math.floor(Math.random() * 6) + 1
      const c = Math.floor(Math.random() * 6) + 1
      const d = Math.floor(Math.random() * 6) + 1
      const hasil = a * d - b * c
      return {
        soal: `Hitung determinan matriks 2x2 berikut:\n| ${a}   ${b} |\n| ${c}   ${d} |`,
        jawaban: String(hasil),
        poin: 35,
        level: 'HARD'
      }
    } else if (jenis === 3) {
      // Turunan Pertama (Turunan Fungsi Kuadrat) f(x) = ax^2 + bx
      const a = Math.floor(Math.random() * 4) + 1
      const b = Math.floor(Math.random() * 10) + 1
      const xVal = Math.floor(Math.random() * 5) + 1
      const hasil = 2 * a * xVal + b
      return {
        soal: `Jika f(x) = ${a}x² + ${b}x, berapakah nilai turunan pertama f'(${xVal})?`,
        jawaban: String(hasil),
        poin: 35,
        level: 'HARD'
      }
    } else if (jenis === 4) {
      // Limit Fungsi Rasional Bentuk Tak Tentu: lim x->a (x^2 - a^2)/(x - a)
      const a = Math.floor(Math.random() * 9) + 2
      const aKuadrat = a * a
      const hasil = 2 * a
      return {
        soal: `Hitung nilai limit berikut:\nlim (x → ${a}) [ (x² - ${aKuadrat}) / (x - ${a}) ]`,
        jawaban: String(hasil),
        poin: 35,
        level: 'HARD'
      }
    } else {
      // Hasil Kali Akar Persamaan Kuadrat x^2 + bx + c = 0 -> x1 * x2 = c
      const r1 = Math.floor(Math.random() * 8) + 1
      const r2 = Math.floor(Math.random() * 8) + 1
      const b = -(r1 + r2)
      const c = r1 * r2
      const tandaB = b >= 0 ? `+ ${b}` : `- ${Math.abs(b)}`
      return {
        soal: `Berapakah hasil kali akar-akar (x₁ × x₂) dari persamaan kuadrat:\nx² ${tandaB}x + ${c} = 0?`,
        jawaban: String(c),
        poin: 35,
        level: 'HARD'
      }
    }
  }

  // ---------------- LEVEL MID (REWARD 15 POIN) ----------------
  const jenis = Math.floor(Math.random() * 5)
  if (jenis === 0) {
    const a = Math.floor(Math.random() * 20) + 1
    const b = Math.floor(Math.random() * 15) + 1
    const c = Math.floor(Math.random() * 10) + 1
    const op1 = ['+', '-'][Math.floor(Math.random() * 2)]
    const temp = op1 === '+' ? a + b : a - b
    const hasil = temp * c
    return {
      soal: `(${a} ${op1} ${b}) × ${c}`,
      jawaban: String(hasil),
      poin: 15,
      level: 'MID'
    }
  } else if (jenis === 1) {
    const base = Math.floor(Math.random() * 12) + 2
    const p = Math.random() < 0.7 ? 2 : 3
    const hasil = Math.pow(base, p)
    return {
      soal: `Berapakah hasil dari ${base} pangkat ${p} (${base}^${p})?`,
      jawaban: String(hasil),
      poin: 15,
      level: 'MID'
    }
  } else if (jenis === 2) {
    const ans = Math.floor(Math.random() * 20) + 2
    const sq = ans * ans
    return {
      soal: `Berapakah √${sq}?`,
      jawaban: String(ans),
      poin: 15,
      level: 'MID'
    }
  } else if (jenis === 3) {
    const persen = [10, 20, 25, 50, 75][Math.floor(Math.random() * 5)]
    const total = (Math.floor(Math.random() * 20) + 1) * 20
    const hasil = (persen / 100) * total
    return {
      soal: `Berapakah ${persen}% dari ${total}?`,
      jawaban: String(hasil),
      poin: 15,
      level: 'MID'
    }
  } else {
    const b = Math.floor(Math.random() * 8) + 3
    const q = Math.floor(Math.random() * 10) + 1
    const r = Math.floor(Math.random() * (b - 1)) + 1
    const a = b * q + r
    return {
      soal: `Berapakah sisa bagi dari ${a} mod ${b} (${a} % ${b})?`,
      jawaban: String(r),
      poin: 15,
      level: 'MID'
    }
  }
}

function acakKata(kata) {
  const arr = kata.split('')
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.join(' ')
}

async function ambilSoalTebakGambar() {
  try {
    const res = await fetch('https://raw.githubusercontent.com/BagasPrasetia/Kumpulan-Gambar/main/tebakgambar.json')
    const list = await res.json()
    if (Array.isArray(list) && list.length > 0) {
      const acak = list[Math.floor(Math.random() * list.length)]
      return {
        image: acak.img || acak.image,
        jawaban: (acak.jawaban || acak.title).toLowerCase().trim(),
        petunjuk: (acak.jawaban || acak.title).replace(/[a-zA-Z]/g, '_ ')
      }
    }
  } catch {}
  return DATA_TEBAK_GAMBAR[Math.floor(Math.random() * DATA_TEBAK_GAMBAR.length)]
}

async function mainDadu(sender, jumlah, reply) {
  if (isNaN(jumlah) || jumlah <= 0) {
    return reply('⚠️ Masukkan jumlah taruhan poin yang valid!\nContoh: *.dadu 20* atau *.game -dadu 20*')
  }

  const user = await getPoinData(sender)
  if ((user.poin || 0) < jumlah) {
    return reply(`❌ Poin tidak cukup! Poinmu saat ini: *${user.poin || 0}*`)
  }

  const daduUser = Math.floor(Math.random() * 6) + 1
  const daduBot = Math.floor(Math.random() * 6) + 1

  let hasilTeks = `🎲 *GAME DADU TARUHAN*\n\n👤 Dadu Kamu: *${daduUser}*\n🤖 Dadu Bot: *${daduBot}*\n\n`

  if (daduUser > daduBot) {
    const total = await tambahPoin(sender, jumlah)
    hasilTeks += `🎉 *KAMU MENANG!*\n🪙 +${jumlah} Poin (Total: ${total})`
  } else if (daduUser < daduBot) {
    const total = await tambahPoin(sender, -jumlah)
    hasilTeks += `❌ *KAMU KALAH!*\n🪙 -${jumlah} Poin (Total: ${total})`
  } else {
    hasilTeks += `🤝 *SERI!* Poinmu tidak berubah.`
  }

  return reply(hasilTeks)
}

async function tanganiJawaban(sock, messages) {
  const m = messages[0]
  if (!m.message || m.key.fromMe) return

  const jid = m.key.remoteJid
  const game = sesiGame.get(jid)
  if (!game) return

  const msg = unwrap(m.message)
  const text = (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    ''
  ).trim()

  if (text.startsWith('.')) return

  const quotedId = msg.extendedTextMessage?.contextInfo?.stanzaId
  if (!quotedId || !game.msgIds?.has(quotedId)) return

  const sender = m.key.participant || jid

  const reply = async (t) => {
    const res = await sock.sendMessage(jid, { text: t }, { quoted: m })
    if (res?.key?.id && game.msgIds) {
      game.msgIds.add(res.key.id)
    }
    return res
  }

  // 1. Tebak Angka
  if (game.type === 'tebakangka') {
    const tebakan = parseInt(text)
    if (isNaN(tebakan)) return await reply('⚠️ Masukkan angka yang valid!')

    game.percobaan++
    if (tebakan === game.angka) {
      sesiGame.delete(jid)
      const totalPoin = await tambahPoin(sender, 20)
      return await reply(`🎉 *BENAR!* Angkanya adalah *${game.angka}*.\nKamu berhasil menebak dalam *${game.percobaan}* kali percobaan!\n\n🪙 +20 Poin (Total: ${totalPoin})`)
    } else if (tebakan < game.angka) {
      return await reply(`📉 Tebakanmu (*${tebakan}*) terlalu *KECIL*! Coba lagi.`)
    } else {
      return await reply(`📈 Tebakanmu (*${tebakan}*) terlalu *BESAR*! Coba lagi.`)
    }
  }

  // 2. Tebak Kata
  if (game.type === 'tebakkata') {
    if (text.toLowerCase() === game.jawaban) {
      sesiGame.delete(jid)
      const totalPoin = await tambahPoin(sender, 20)
      return await reply(`🎉 *BENAR!* Jawabannya adalah *${game.jawaban.toUpperCase()}*.\n\n🪙 +20 Poin (Total: ${totalPoin})`)
    } else {
      return await reply('❌ *SALAH!* Coba tebak lagi.')
    }
  }

  // 3. Tebak Gambar
  if (game.type === 'tebakgambar') {
    if (text.toLowerCase() === game.jawaban) {
      sesiGame.delete(jid)
      const totalPoin = await tambahPoin(sender, 25)
      return await reply(`🎉 *BENAR!* Jawabannya adalah *${game.jawaban.toUpperCase()}*.\n\n🪙 +25 Poin (Total: ${totalPoin})`)
    } else {
      return await reply('❌ *SALAH!* Coba tebak lagi.')
    }
  }

  // 4. Susun Kata
  if (game.type === 'susunkata') {
    if (text.toLowerCase() === game.jawaban) {
      sesiGame.delete(jid)
      const totalPoin = await tambahPoin(sender, 20)
      return await reply(`🎉 *TEPAT BANGEET!* Kata yang disusun adalah *${game.jawaban.toUpperCase()}*.\n\n🪙 +20 Poin (Total: ${totalPoin})`)
    } else {
      return await reply('❌ *SALAH!* Susunan katamu belum tepat.')
    }
  }

  // 5. Tebak Lirik
  if (game.type === 'tebaklirik') {
    if (text.toLowerCase() === game.jawaban) {
      sesiGame.delete(jid)
      const totalPoin = await tambahPoin(sender, 20)
      return await reply(`🎉 *BENAR!* Kata liriknya adalah *${game.jawaban.toUpperCase()}*.\n\n🪙 +20 Poin (Total: ${totalPoin})`)
    } else {
      return await reply('❌ *SALAH!* Liriknya kurang tepat, coba ingat-ingat lagi!')
    }
  }

  // 6. Matematika
  if (game.type === 'math') {
    if (text === game.jawaban) {
      sesiGame.delete(jid)
      const totalPoin = await tambahPoin(sender, game.poin)
      return await reply(`🎉 *BENAR!* Jawabannya adalah *${game.jawaban}*.\n\n🪙 +${game.poin} Poin (Total: ${totalPoin})`)
    } else {
      return await reply('❌ *SALAH!* Hitung lagi dengan teliti.')
    }
  }
}

export function init(sock) {
  sock.ev.on('messages.upsert', ({ messages }) => {
    tanganiJawaban(sock, messages).catch((err) => console.error('Game error:', err))
  })
}

export const commands = [
  {
    names: ['.game', '.g'],
    desc: 'Pusat game (.game -math [easy/mid/hard], -ta, -tk, -tg, -sk, -tl, -bom, -dadu, -suit, -slot, -nyerah)',
    async run({ sock, m, jid, sender, args, reply }) {
      const splitArgs = args.trim().toLowerCase().split(/\s+/)
      const sub = splitArgs[0]

      if (sub === '-nyerah') {
        const game = sesiGame.get(jid)
        if (!game) return reply('❌ Tidak ada game yang sedang berjalan di chat ini.')
        sesiGame.delete(jid)
        let info = 'Game telah dihentikan.'
        if (game.type === 'tebakangka') info = `Angka rahasianya adalah *${game.angka}*.`
        if (game.type === 'tebakkata' || game.type === 'tebakgambar' || game.type === 'susunkata' || game.type === 'tebaklirik') info = `Jawabannya adalah *${game.jawaban.toUpperCase()}*.`
        if (game.type === 'math') info = `Jawabannya adalah *${game.jawaban}*.`
        return reply(`🏳️ *KAMU MENYERAH!*\n\n${info}`)
      }

      if (sub === '-dadu') {
        const sisa = splitArgs.slice(1).join(' ')
        return await mainDadu(sender, parseInt(sisa), reply)
      }

      if (['-math', '-matematika', '-ta', '-tebakangka', '-tk', '-tebakkata', '-tg', '-tebakgambar', '-sk', '-susunkata', '-tl', '-tebaklirik', '-suit', '-slot'].includes(sub)) {
        if (sesiGame.has(jid) && !['-suit', '-slot'].includes(sub)) {
          return reply('⚠️ Masih ada game berjalan di chat ini! Ketik *.game -nyerah* untuk menyerah.')
        }

        const potong = await kurangiPoin(sender, BIAYA_GAME)
        if (!potong.success) {
          return reply(`❌ Poin kamu tidak cukup untuk bermain!\nBiaya bermain: *${BIAYA_GAME} Poin*\nPoinmu saat ini: *${potong.sisa}*\n\n💡 Ketik *.daily* untuk klaim poin harian gratis.`)
        }

        if (sub === '-math' || sub === '-matematika') {
          const lvl = splitArgs[1] || 'mid'
          const levelValid = ['easy', 'mid', 'hard'].includes(lvl) ? lvl : 'mid'
          const item = SOAL_MATH(levelValid)

          const res = await reply(
            `🧮 *KUIS MATEMATIKA (${item.level})*\n` +
            `💸 Biaya: -${BIAYA_GAME} Poin | 🎁 Reward: +${item.poin} Poin\n\n` +
            `*Soal:*\n${item.soal}\n\n` +
            `👉 *Reply pesan ini* untuk menjawab!`
          )
          sesiGame.set(jid, { type: 'math', ...item, msgIds: new Set([res.key.id]) })
          return
        }

        if (sub === '-ta' || sub === '-tebakangka') {
          const angka = Math.floor(Math.random() * 100) + 1
          const res = await reply(`🎮 *GAME TEBAK ANGKA*\n💸 Biaya: -${BIAYA_GAME} Poin (Sisa: ${potong.sisa})\n\nAku sudah memilih angka dari *1 - 100*.\n👉 *Reply pesan ini* dengan angka tebakanmu!`)
          sesiGame.set(jid, { type: 'tebakangka', angka, percobaan: 0, msgIds: new Set([res.key.id]) })
          return
        }

        if (sub === '-tk' || sub === '-tebakkata') {
          const item = DATA_TEBAK_KATA[Math.floor(Math.random() * DATA_TEBAK_KATA.length)]
          const res = await reply(`🧩 *TEBAK KATA*\n💸 Biaya: -${BIAYA_GAME} Poin (Sisa: ${potong.sisa})\n\n*Soal:* ${item.soal}\n*Petunjuk:* ${item.petunjuk}\n\n👉 *Reply pesan ini* untuk menjawab!`)
          sesiGame.set(jid, { type: 'tebakkata', ...item, msgIds: new Set([res.key.id]) })
          return
        }

        if (sub === '-tg' || sub === '-tebakgambar') {
          const item = await ambilSoalTebakGambar()
          const res = await sock.sendMessage(
            jid,
            {
              image: { url: item.image },
              caption: `🖼️ *TEBAK GAMBAR*\n💸 Biaya: -${BIAYA_GAME} Poin (Sisa: ${potong.sisa})\n\n*Petunjuk:* ${item.petunjuk}\n\n👉 *Reply foto ini* untuk menjawab!`
            },
            { quoted: m }
          )
          sesiGame.set(jid, { type: 'tebakgambar', ...item, msgIds: new Set([res.key.id]) })
          return
        }

        if (sub === '-sk' || sub === '-susunkata') {
          const item = DATA_SUSUN_KATA[Math.floor(Math.random() * DATA_SUSUN_KATA.length)]
          const kataAcak = acakKata(item.kata)
          const res = await reply(`🔤 *SUSUN KATA*\n💸 Biaya: -${BIAYA_GAME} Poin (Sisa: ${potong.sisa})\n\nSusun kata berikut menjadi benar:\n👉 *${kataAcak}*\n\n*Petunjuk:* ${item.petunjuk}\n👉 *Reply pesan ini* untuk menjawab!`)
          sesiGame.set(jid, { type: 'susunkata', jawaban: item.kata.toLowerCase(), msgIds: new Set([res.key.id]) })
          return
        }

        if (sub === '-tl' || sub === '-tebaklirik') {
          const item = DATA_TEBAK_LIRIK[Math.floor(Math.random() * DATA_TEBAK_LIRIK.length)]
          const res = await reply(`🎵 *TEBAK LIRIK*\n💸 Biaya: -${BIAYA_GAME} Poin (Sisa: ${potong.sisa})\n\nLengkapi titik-titik lirik berikut:\n_"${item.lirik}"_\n\n*Petunjuk:* ${item.petunjuk}\n👉 *Reply pesan ini* untuk menjawab!`)
          sesiGame.set(jid, { type: 'tebaklirik', jawaban: item.jawaban.toLowerCase(), msgIds: new Set([res.key.id]) })
          return
        }

        if (sub === '-suit') {
          const sisaArgs = splitArgs.slice(1).join(' ').toLowerCase()
          const pilihanValid = ['batu', 'gunting', 'kertas']
          if (!pilihanValid.includes(sisaArgs)) {
            await tambahPoin(sender, BIAYA_GAME)
            return reply('✌️ *SUIT BOT*\n\nContoh:\n◦ *.game -suit batu*\n◦ *.game -suit gunting*\n◦ *.game -suit kertas*')
          }
          const pilihanBot = pilihanValid[Math.floor(Math.random() * pilihanValid.length)]
          let hasil = ''
          if (sisaArgs === pilihanBot) {
            await tambahPoin(sender, BIAYA_GAME)
            hasil = '🤝 *SERI!* (Poin dikembalikan)'
          } else if (
            (sisaArgs === 'batu' && pilihanBot === 'gunting') ||
            (sisaArgs === 'gunting' && pilihanBot === 'kertas') ||
            (sisaArgs === 'kertas' && pilihanBot === 'batu')
          ) {
            const totalPoin = await tambahPoin(sender, 20)
            hasil = `🎉 *KAMU MENANG!*\n🪙 +10 Net Poin (Total: ${totalPoin})`
          } else {
            hasil = `🤖 *BOT MENANG!*\n💸 -${BIAYA_GAME} Poin`
          }

          return reply(`✌️ *HASIL SUIT*\n\n👤 Kamu: *${sisaArgs.toUpperCase()}*\n🤖 Bot: *${pilihanBot.toUpperCase()}*\n\nHasil:\n${hasil}`)
        }

        if (sub === '-slot') {
          const simbol = ['🍊', '🍇', '🍉', '7️⃣', '💎', '🔔']
          const a = simbol[Math.floor(Math.random() * simbol.length)]
          const b = simbol[Math.floor(Math.random() * simbol.length)]
          const c = simbol[Math.floor(Math.random() * simbol.length)]
          let pesan = `🎰 *SLOT MACHINE* 🎰\n\n[ ${a} | ${b} | ${c} ]\n\n`
          if (a === b && b === c) {
            const totalPoin = await tambahPoin(sender, 50)
            pesan += `🎉 *JACKPOT!*\n🪙 +50 Poin (Total: ${totalPoin})`
          } else if (a === b || b === c || a === c) {
            const totalPoin = await tambahPoin(sender, 15)
            pesan += `🌟 *BAGUS!* 2 simbol sama!\n🪙 +15 Poin (Total: ${totalPoin})`
          } else {
            pesan += `❌ *ZONK!* Belum beruntung.\n💸 -${BIAYA_GAME} Poin`
          }
          return reply(pesan)
        }
      }

      if (sub === '-bom') {
        const sisaArgs = splitArgs.slice(1).join(' ')
        const pilih = parseInt(sisaArgs)

        if (isNaN(pilih) || pilih < 1 || pilih > 9) {
          return reply(
            `💣 *GAME TEBAK BOM (1 - 9)*\n\n` +
            `Ada 1 bom rahasia tersembunyi di antara kotak [1] sampai [9].\n` +
            `Biaya main: *${BIAYA_GAME} Poin*\n\n` +
            `Contoh:\n◦ *.game -bom 5*`
          )
        }

        const potong = await kurangiPoin(sender, BIAYA_GAME)
        if (!potong.success) {
          return reply(`❌ Poin kamu tidak cukup!\nBiaya bermain: *${BIAYA_GAME} Poin*\nPoinmu saat ini: *${potong.sisa}*`)
        }

        const bomLoc = Math.floor(Math.random() * 9) + 1
        let papan = ''
        for (let i = 1; i <= 9; i++) {
          if (i === pilih) {
            papan += i === bomLoc ? ' 💥 ' : ' ✅ '
          } else {
            papan += ` [${i}] `
          }
          if (i % 3 === 0) papan += '\n'
        }

        if (pilih === bomLoc) {
          const totalPoin = await tambahPoin(sender, -10)
          return reply(`💣 *BOOOM! KAMU KENA BOM!*\n\n${papan}\nNomor *${pilih}* berisi bom!\n💸 Total Rungkad: -20 Poin (Total: ${totalPoin})`)
        } else {
          const totalPoin = await tambahPoin(sender, 25)
          return reply(`🎉 *SELAMAT! KAMU AMAN!*\n\n${papan}\nBom sebenarnya ada di nomor *${bomLoc}*.\n🪙 +15 Net Poin (Total: ${totalPoin})`)
        }
      }

      return reply(
        `🎮 *PILIHAN GAME*\n\n` +
        `◦ *.game -math easy/mid/hard*\n` +
        `◦ *.game -ta*\n` +
        `◦ *.game -tk*\n` +
        `◦ *.game -tg*\n` +
        `◦ *.game -sk*\n` +
        `◦ *.game -tl*\n` +
        `◦ *.game -bom [1-9]*\n` +
        `◦ *.game -dadu [jumlah]*\n` +
        `◦ *.game -suit batu/gunting/kertas*\n` +
        `◦ *.game -slot*\n` +
        `◦ *.game -nyerah*`
      )
    }
  },
  {
    names: ['.dadu', '.judi'],
    desc: 'Taruhan dadu poin melawan bot (.dadu [jumlah])',
    async run({ sender, args, reply }) {
      return await mainDadu(sender, parseInt(args.trim()), reply)
    }
  }
]