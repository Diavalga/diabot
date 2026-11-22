import { NAMA_BOT } from './config.js'

export const garis = '────────────'

// kotak berbingkai: kotak('Judul', ['baris 1', 'baris 2'])
export function kotak(judul, baris = []) {
  return [
    `╭─「 ${judul} 」`,
    ...baris.map((b) => (b ? `│ ${b}` : '│')),
    `╰${garis}`,
  ].join('\n')
}

export const footer = `_${NAMA_BOT} • ketik *.menu* untuk daftar perintah_`

export function sapaan() {
  const jam = Number(
    new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Jakarta',
      hour: 'numeric',
      hourCycle: 'h23',
    })
  )
  if (jam < 11) return 'Selamat pagi 🌤️'
  if (jam < 15) return 'Selamat siang ☀️'
  if (jam < 18) return 'Selamat sore 🌇'
  return 'Selamat malam 🌙'
}

export const tanggalWIB = () =>
  new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }) + ' WIB'

export function durasi(detik) {
  const hari = Math.floor(detik / 86400)
  const jam = Math.floor((detik % 86400) / 3600)
  const menit = Math.floor((detik % 3600) / 60)
  return `${hari} hari ${jam} jam ${menit} menit`
}