import stickerPkg from 'wa-sticker-formatter'
import sharp from 'sharp'
import { findMedia, download } from '../lib/helpers.js'
import { NAMA_BOT, NAMA_PEMILIK } from '../lib/config.js'
import { getPoinData } from '../lib/poin.js'

const { Sticker, StickerTypes } = stickerPkg

export const kategori = 'Stiker'
export const ikon = '🎨'

// ================= BANTU UMUM =================

const escapeXml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&apos;')

const bersihKutip = (s) => s.trim().replace(/^["“”‘'']+|["“”‘'']+$/g, '').trim()

const kualitasStiker = (res) =>
  !res ? 70 : res >= 512 ? 80 : res >= 360 ? 60 : res >= 240 ? 40 : 25

async function kirimStiker(sock, jid, m, buf, quality = 70, sender, customPack, customAuthor) {
  const user = await getPoinData(sender)
  const pack = customPack || user.pack || `By ${NAMA_BOT}`
  const author = customAuthor || user.author || NAMA_PEMILIK

  const sticker = new Sticker(buf, {
    pack,
    author,
    type: StickerTypes.FULL,
    quality,
  })
  await sock.sendMessage(jid, { sticker: await sticker.toBuffer() }, { quoted: m })
}

// ================= DAFTAR FONT =================

const FONT = {
  sans:     { fam: 'Liberation Sans, Arial, Noto Sans', tebal: true, ket: 'standar, tebal & rapi' },
  serif:    { fam: 'Liberation Serif, Times New Roman, Noto Serif', ket: 'huruf berkaki, kesan formal' },
  brat:     { fam: 'Liberation Sans Narrow, Arial Narrow, Arial, Noto Sans', ket: 'ramping, khas stiker brat' },
  impact:   { fam: 'Impact, Anton', ket: 'meme klasik' },
  anton:    { fam: 'Anton', ket: 'tebal & tinggi, mirip impact' },
  bebas:    { fam: 'Bebas Neue', ket: 'kapital ramping, modern' },
  bangers:  { fam: 'Bangers', ket: 'gaya komik / efek suara' },
  comic:    { fam: 'Comic Neue, Comic Sans MS', ket: 'santai, meme cringe' },
  marker:   { fam: 'Permanent Marker', ket: 'coretan spidol' },
  luckiest: { fam: 'Luckiest Guy', ket: 'kartun tebal' },
  pixel:    { fam: 'Press Start 2P', ket: 'gaya game 8-bit' },
  lobster:  { fam: 'Lobster', ket: 'tulisan tangan miring' },
}
const DAFTAR_FONT = Object.keys(FONT).join(', ')

const WARNA_BRAT = '#8ACE00'

const NAMA_WARNA = {
  merah: 'red', biru: 'blue', hijau: 'green', kuning: 'yellow',
  hitam: 'black', putih: 'white', ungu: 'purple', oranye: 'orange',
  jingga: 'orange', pink: 'pink', merahmuda: 'pink', abu: 'gray',
  abuabu: 'gray', coklat: 'saddlebrown', cokelat: 'saddlebrown',
  emas: 'gold', perak: 'silver', birumuda: 'lightblue', birutua: 'navy',
  hijaumuda: 'lightgreen', hijautua: 'darkgreen', limau: '#8ACE00',
  white: 'white', red: 'red', blue: 'blue', green: 'green',
  yellow: 'yellow', black: 'black', purple: 'purple', gray: 'gray',
}

const BRAT_WARNA_COMMANDS = Object.keys(NAMA_WARNA).map((w) => `.brat${w}`)

async function bacaWarna(teks) {
  const nama = teks.trim().toLowerCase().replace(/\s+/g, '')
  let css = NAMA_WARNA[nama] || nama
  if (/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/.test(css)) css = '#' + css
  try {
    const { data } = await sharp({
      create: { width: 1, height: 1, channels: 4, background: css },
    })
      .raw()
      .toBuffer({ resolveWithObject: true })
    const [r, g, b, a] = data
    const terang = 0.299 * r + 0.587 * g + 0.114 * b
    return { css, gelap: a >= 128 && terang < 140 }
  } catch {
    return null
  }
}

const RES_MIN = 20
const RES_MAX = 2160
const RES_CONTOH = '144p, 240p, 360p, 480p, 720p, 1080p'

const cssFont = (fam) =>
  fam.split(',').map((f) => `'${f.trim()}'`).join(', ')

function ambilOpsi(args) {
  let font = null
  let bg = null
  let pack = null
  let author = null

  args = args
    .replace(/(?:^|\s)pack\[([^\]]+)\]/i, (_, p) => {
      pack = p.trim()
      return ' '
    })
    .replace(/(?:^|\s)author\[([^\]]+)\]/i, (_, a) => {
      author = a.trim()
      return ' '
    })
    .replace(/(?:^|\s)font\s*=\s*(?:["“”]([^"“”]+)["“”]|(\S+))/i, (_, a, b) => {
      font = (a || b).trim().toLowerCase().replace(/\s+/g, '')
      return ' '
    })
    .replace(/(?:^|\s)bg\s*=\s*(?:["“”]([^"“”]+)["“”]|(\S+))/i, (_, a, b) => {
      bg = (a || b).trim()
      return ' '
    })
    .replace(/[\s,]+$/, '')

  const PENANDA_TEKS = /(?:^|\s)-(?:m|brat|b)(?:\s|$)/i
  const idx = args.search(PENANDA_TEKS)
  let depan = idx === -1 ? args : args.slice(0, idx)
  const belakang = idx === -1 ? '' : args.slice(idx)

  const posisi = /(?:^|\s)\/(?:up|atas)(?=\s|$)/i.test(depan) ? 'atas'
    : /(?:^|\s)\/(?:down|bawah)(?=\s|$)/i.test(depan) ? 'bawah'
    : /(?:^|\s)\/(?:center|tengah)(?=\s|$)/i.test(depan) ? 'tengah'
    : null
  depan = depan.replace(/(?:^|\s)\/(?:up|atas|down|bawah|center|tengah)(?=\s|$)/gi, ' ')

  let res = null
  depan = depan.replace(/(?:^|\s)(\d{2,4})p(?=\s|$)/i, (_, n) => {
    res = Number(n)
    return ' '
  })

  const pixel = /(?:^|\s)-pixel(?=\s|$)/i.test(depan)
  depan = depan.replace(/(?:^|\s)-pixel(?=\s|$)/gi, ' ')

  return { args: (depan + belakang).trim(), posisi, font, bg, res, pixel, pack, author }
}

async function burikkan(buf, res, pixel) {
  if (!res || res >= 512) return buf
  const q = res <= 144 ? 15 : res <= 240 ? 25 : res <= 360 ? 40 : 55

  const kecil = await sharp(buf)
    .rotate()
    .resize(res, res, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: q })
    .toBuffer()

  return sharp(kecil)
    .resize(512, 512, { fit: 'inside', kernel: pixel ? 'nearest' : 'cubic' })
    .png()
    .toBuffer()
}

function bacaBrat(args) {
  const cocok = args.match(/^\s*-(?:brat|b)(?:\s+(.*))?$/is)
  if (!cocok) return null
  return bersihKutip(cocok[1] || '')
}

async function buatStikerBrat(teks, fontKey, posisi, warna = { css: WARNA_BRAT, gelap: false }) {
  const f = FONT[fontKey] || FONT.brat
  const warnaTulisan = warna.gelap ? '#ffffff' : '#000000'

  let teksPng = await sharp({
    text: {
      text: `<span foreground="${warnaTulisan}">${escapeXml(teks.toLowerCase())}</span>`,
      font: f.fam,
      width: 452,
      height: 452,
      align: 'left',
      justify: true,
      rgba: true,
    },
  })
    .png()
    .toBuffer()

  const { height } = await sharp(teksPng).metadata()
  teksPng = await sharp(teksPng).blur(1.4).png().toBuffer()

  const atas =
    posisi === 'bawah'
      ? Math.max(30, 512 - 30 - height)
      : posisi === 'tengah'
      ? Math.round((512 - height) / 2)
      : 30

  return sharp({
    create: { width: 512, height: 512, channels: 4, background: warna.css },
  })
    .composite([{ input: teksPng, left: 30, top: atas }])
    .png()
    .toBuffer()
}

function bacaTeks(args) {
  const cocok = args.match(/(?:^|\s)-m(?:\s+(.*))?$/s)
  if (!cocok) return null
  return bersihKutip(cocok[1] || '')
}

function pisahTeks(teks, posisi = 'bawah') {
  const bagian = teks.split('|').map((s) => s.trim())
  if (bagian.length === 1)
    return posisi === 'atas' ? [bagian[0], ''] : ['', bagian[0]]
  return [bagian[0], bagian.slice(1).join(' ').trim()]
}

function bungkusTeks(teks, maxChar) {
  const baris = []
  let sekarang = ''
  for (const kata of teks.split(/\s+/)) {
    const coba = sekarang ? `${sekarang} ${kata}` : kata
    if (coba.length > maxChar && sekarang) {
      baris.push(sekarang)
      sekarang = kata
    } else {
      sekarang = coba
    }
  }
  if (sekarang) baris.push(sekarang)
  return baris
}

function aturBaris(teks) {
  let ukuran = 64
  let baris = []
  for (; ukuran >= 28; ukuran -= 4) {
    const maxChar = Math.floor(480 / (ukuran * 0.58))
    baris = bungkusTeks(teks, maxChar)
    if (baris.length <= 3 && baris.every((b) => b.length <= maxChar)) break
  }
  return { baris, ukuran }
}

function blokTeks(teks, posisi) {
  if (!teks) return { garis: '', isi: '' }

  const { baris, ukuran } = aturBaris(teks.toUpperCase())
  const tinggi = ukuran * 1.15
  const awal =
    posisi === 'atas'
      ? ukuran + 8
      : 512 - 18 - (baris.length - 1) * tinggi

  const buat = (atribut) =>
    baris
      .map(
        (b, i) =>
          `<text x="256" y="${awal + i * tinggi}" font-size="${ukuran}" text-anchor="middle" ${atribut}>${escapeXml(b)}</text>`
      )
      .join('')

  return {
    garis: buat(`fill="#000" stroke="#000" stroke-width="${ukuran / 5}" stroke-linejoin="round"`),
    isi: buat('fill="#fff"'),
  }
}

async function tambahTeks(buf, atas, bawah, fontKey) {
  const f = FONT[fontKey] || FONT.impact

  const dasar = await sharp(buf)
    .rotate()
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

  const a = blokTeks(atas, 'atas')
  const b = blokTeks(bawah, 'bawah')

  const svg = `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <g font-family="${cssFont(f.fam)}, 'Noto Sans', 'DejaVu Sans', sans-serif" font-weight="${f.tebal ? 800 : 400}">
        ${a.garis}${b.garis}${a.isi}${b.isi}
      </g>
    </svg>`

  return sharp(dasar)
    .composite([{ input: Buffer.from(svg) }])
    .png()
    .toBuffer()
}

// ================= PERINTAH =================

export const commands = [
  {
    names: ['.stiker', '.sticker', '.brat', ...BRAT_WARNA_COMMANDS],
    desc: 'stiker foto/brat (.stiker pack[nama pack] -m teks)',
    async run({ sock, m, jid, sender, cmd, args, reply }) {
      const cleanCmd = (cmd || '').replace(/^[^\w]/, '').toLowerCase()

      if (cleanCmd.startsWith('brat')) {
        const warnaShorthand = cleanCmd.slice(4)
        if (!/^\s*-(?:brat|b)(?:\s|$)/i.test(args)) {
          args = `-brat ${args}`
        }
        if (warnaShorthand && !/bg=/i.test(args)) {
          args = `bg=${warnaShorthand} ${args}`
        }
      }

      const opsi = ambilOpsi(args)
      args = opsi.args

      if (opsi.font && !FONT[opsi.font])
        return reply(`⚠️ Font *${opsi.font}* tidak ada.\nPilihan: ${DAFTAR_FONT}`)

      if (opsi.res !== null && (opsi.res < RES_MIN || opsi.res > RES_MAX))
        return reply(
          `⚠️ Resolusi *${opsi.res}p* tidak valid.\nPakai angka ${RES_MIN}–${RES_MAX}, contoh: ${RES_CONTOH}`
        )
      const kualitas = kualitasStiker(opsi.res)

      // 1) Stiker Brat
      const brat = bacaBrat(args)
      if (brat !== null) {
        if (!brat)
          return reply('💡 Tulisannya masih kosong. Contoh: *.bratpink "omong dewe lur"*')
        if (brat.length > 150)
          return reply('⚠️ Tulisan maksimal 150 karakter.')
        let warna
        if (opsi.bg) {
          warna = await bacaWarna(opsi.bg)
          if (!warna)
            return reply(
              `⚠️ Warna *${opsi.bg}* tidak dikenal.\nContoh: *.bratpink*, *.bratwhite*, *bg=#ff69b4*`
            )
        }
        const png = await buatStikerBrat(brat, opsi.font || 'brat', opsi.posisi || 'atas', warna)
        return kirimStiker(sock, jid, m, await burikkan(png, opsi.res, opsi.pixel), kualitas, sender, opsi.pack, opsi.author)
      }

      // 2) Stiker Foto
      const media = findMedia(m, 'imageMessage')
      if (!media) return reply('💡 Kirim/reply foto dengan *.stiker*')

      const teks = bacaTeks(args)
      if (teks === '')
        return reply('💡 Tulisannya masih kosong. Contoh: *.stiker pack[MyPack] -m "halo semua"*')
      if (teks && teks.length > 100)
        return reply('⚠️ Tulisan maksimal 100 karakter.')

      let buf = await download(sock, media.target)
      if (teks) {
        const [atas, bawah] = pisahTeks(teks, opsi.posisi || 'bawah')
        buf = await tambahTeks(buf, atas, bawah, opsi.font || 'impact')
      }
      buf = await burikkan(buf, opsi.res, opsi.pixel)
      await kirimStiker(sock, jid, m, buf, kualitas, sender, opsi.pack, opsi.author)
    },
  },
  {
    names: ['.toimg'],
    desc: 'stiker jadi foto',
    async run({ sock, m, jid, reply }) {
      const media = findMedia(m, 'stickerMessage')
      if (!media) return reply('💡 Reply stiker dengan *.toimg*')
      const buf = await download(sock, media.target)
      const png = await sharp(buf).png().toBuffer()
      await sock.sendMessage(
        jid,
        { image: png, caption: '✅ Selesai! Ini fotonya.' },
        { quoted: m }
      )
    },
  },
]