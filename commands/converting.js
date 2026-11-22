import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs/promises'
import path from 'node:path'
import { findMedia, download, withTemp, antre } from '../lib/helpers.js'
import { kotak } from '../lib/ui.js'
import { unduh, ambilUrl, bersihNama, URL_YT, URL_TT, UnduhError } from '../lib/download.js'

const run = promisify(execFile)

export const kategori = 'Converting File'
export const ikon = '🔄'

const OFFICE_EXT = /\.(docx?|odt|rtf|txt|xlsx?|ods|csv|pptx?|odp|html?)$/i
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp)$/i

// ================= KONVERSI DOKUMEN =================

// Word / Excel / PowerPoint / TXT / dll -> PDF
function officeToPdf(buffer, fileName) {
  return antre(() =>
    withTemp(async (dir) => {
      const inPath = path.join(dir, `input${path.extname(fileName)}`)
      await fs.writeFile(inPath, buffer)
      await run('soffice', [
        '--headless',
        '-env:UserInstallation=file:///tmp/wabot-lo',
        '--convert-to', 'pdf',
        '--outdir', dir,
        inPath,
      ], { timeout: 120000 })
      return fs.readFile(path.join(dir, 'input.pdf'))
    })
  )
}

// Gambar -> PDF (1 halaman, ukuran mengikuti gambar)
async function imageToPdf(buffer) {
  const jpg = await sharp(buffer)
    .rotate()
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 85 })
    .toBuffer()
  const pdf = await PDFDocument.create()
  const img = await pdf.embedJpg(jpg)
  const page = pdf.addPage([img.width, img.height])
  page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height })
  return Buffer.from(await pdf.save())
}

// PDF -> docx / txt / png (hasil: array buffer)
function pdfTo(buffer, mode) {
  return withTemp(async (dir) => {
    const inPath = path.join(dir, 'input.pdf')
    await fs.writeFile(inPath, buffer)

    if (mode === 'docx') {
      const out = path.join(dir, 'output.docx')
      await run('./venv/bin/pdf2docx', ['convert', inPath, out], { timeout: 120000 })
      return [await fs.readFile(out)]
    }
    if (mode === 'txt') {
      const out = path.join(dir, 'output.txt')
      await run('pdftotext', ['-layout', inPath, out], { timeout: 60000 })
      return [await fs.readFile(out)]
    }
    // png: maksimal 10 halaman pertama
    await run('pdftoppm', ['-png', '-r', '110', '-l', '10', inPath, path.join(dir, 'page')], { timeout: 120000 })
    const files = (await fs.readdir(dir))
      .filter((f) => f.startsWith('page') && f.endsWith('.png'))
      .sort()
    return Promise.all(files.map((f) => fs.readFile(path.join(dir, f))))
  })
}

// ambil file PDF dari pesan / reply
async function ambilPdf({ sock, m, reply }) {
  const media = findMedia(m, 'documentMessage')
  if (!media) {
    await reply('💡 Kirim file PDF dengan caption perintah ini, atau reply file PDF dengan perintahnya.')
    return null
  }
  const name = media.node.fileName || 'dokumen.pdf'
  if (!/\.pdf$/i.test(name)) {
    await reply('⚠️ File harus berformat *PDF*.')
    return null
  }
  return {
    buf: await download(sock, media.target),
    baseName: path.parse(name).name,
  }
}

// ================= DOWNLOADER =================

const TINGGI = [144, 240, 360, 480, 720, 1080]

const kirimVideo = async ({ sock, m, jid }, h) => {
  const mb = h.ukuran / 1048576
  const caption = kotak('✅ *SELESAI*', [
    `🎬 ${h.judul}`,
    h.pengunggah && `👤 ${h.pengunggah}`,
    `📦 ${mb.toFixed(1)} MB`,
  ].filter(Boolean))

  if (mb <= 30) {
    await sock.sendMessage(jid, { video: { url: h.file }, mimetype: 'video/mp4', caption }, { quoted: m })
  } else {
    // file besar lebih aman dikirim sebagai dokumen
    await sock.sendMessage(jid, {
      document: { url: h.file },
      mimetype: 'video/mp4',
      fileName: `${bersihNama(h.judul)}.mp4`,
      caption,
    }, { quoted: m })
  }
}

const kirimAudio = async ({ sock, m, jid }, h) => {
  const mb = h.ukuran / 1048576
  await sock.sendMessage(jid, {
    text: kotak('✅ *SELESAI*', [`🎵 ${h.judul}`, `📦 ${mb.toFixed(1)} MB`]),
  }, { quoted: m })
  await sock.sendMessage(jid, {
    audio: { url: h.file },
    mimetype: 'audio/mpeg',
    fileName: `${bersihNama(h.judul)}.mp3`,
  }, { quoted: m })
}

async function proses(ctx, url, opsi, kirim) {
  try {
    await unduh(url, opsi, (h) => kirim(ctx, h))
  } catch (err) {
    console.error(err.stderr || err)
    if (err.code === 'ENOENT') {
      return ctx.reply('⚙️ *yt-dlp belum terpasang* di server bot. Pasang dulu lewat terminal ya.')
    }
    if (err instanceof UnduhError) {
      return ctx.reply('⚠️ Video terlalu panjang atau terlalu besar. Coba kualitas lebih rendah, atau pilih video yang lebih pendek.')
    }
    return ctx.reply('❌ *Gagal mengunduh.* Pastikan linknya benar dan videonya publik. Kalau terus gagal, mungkin yt-dlp perlu diupdate.')
  }
}

// ================= DAFTAR PERINTAH =================

export const commands = [
  {
    names: ['.topdf'],
    desc: 'Word, Excel, PPT, TXT, gambar jadi PDF',
    async run({ sock, m, jid, reply }) {
      const doc = findMedia(m, 'documentMessage')
      const foto = findMedia(m, 'imageMessage')
      const media = doc || foto
      if (!media)
        return reply('💡 Kirim file/foto dengan caption *.topdf*, atau reply file/foto dengan *.topdf*')

      const name = doc ? doc.node.fileName || 'dokumen' : 'foto.jpg'
      const baseName = path.parse(name).name

      if (/\.pdf$/i.test(name)) return reply('📄 File ini sudah berformat PDF 😄')
      const isImage = (!!foto && !doc) || IMAGE_EXT.test(name)
      if (!isImage && !OFFICE_EXT.test(name))
        return reply('⚠️ Format belum didukung. Bisa: Word, Excel, PowerPoint, TXT, CSV, HTML, dan gambar.')

      await reply('⏳ *Sebentar ya*, lagi mengubah ke PDF...')
      const buf = await download(sock, media.target)
      const data = isImage ? await imageToPdf(buf) : await officeToPdf(buf, name)
      await sock.sendMessage(jid, {
        document: data,
        mimetype: 'application/pdf',
        fileName: `${baseName}.pdf`,
        caption: '✅ Selesai! Ini PDF-nya.',
      }, { quoted: m })
    },
  },
  {
    names: ['.todocx'],
    desc: 'PDF jadi Word',
    async run(ctx) {
      const pdf = await ambilPdf(ctx)
      if (!pdf) return
      await ctx.reply('⏳ *Sebentar ya*, lagi mengubah ke Word...')
      const [data] = await pdfTo(pdf.buf, 'docx')
      await ctx.sock.sendMessage(ctx.jid, {
        document: data,
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileName: `${pdf.baseName}.docx`,
        caption: '✅ Selesai! Ini file Word-nya.',
      }, { quoted: ctx.m })
    },
  },
  {
    names: ['.topng'],
    desc: 'PDF jadi gambar (maks. 10 halaman)',
    async run(ctx) {
      const pdf = await ambilPdf(ctx)
      if (!pdf) return
      await ctx.reply('⏳ *Sebentar ya*, lagi mengubah ke gambar...')
      const pages = await pdfTo(pdf.buf, 'png')
      for (const [i, img] of pages.entries()) {
        await ctx.sock.sendMessage(
          ctx.jid,
          { image: img, caption: `📃 Halaman ${i + 1}` },
          { quoted: ctx.m }
        )
      }
    },
  },
  {
    names: ['.totxt'],
    desc: 'PDF jadi teks',
    async run(ctx) {
      const pdf = await ambilPdf(ctx)
      if (!pdf) return
      await ctx.reply('⏳ *Sebentar ya*, lagi mengambil teks...')
      const [data] = await pdfTo(pdf.buf, 'txt')
      await ctx.sock.sendMessage(ctx.jid, {
        document: data,
        mimetype: 'text/plain',
        fileName: `${pdf.baseName}.txt`,
        caption: '✅ Selesai! Ini teksnya.',
      }, { quoted: ctx.m })
    },
  },
  {
    names: ['.ytmp4'],
    desc: 'video YouTube jadi MP4 (.ytmp4 <link> 360)',
    async run(ctx) {
      const url = ambilUrl(ctx.args)
      if (!url || !URL_YT.test(url))
        return ctx.reply(
          '💡 Format: *.ytmp4 <link YouTube>*\nContoh: .ytmp4 https://youtu.be/xxxx 360\n\n_Kualitas opsional: 144, 240, 360, 480, 720, 1080 (default 480). Maks. 20 menit._'
        )
      const tinggi =
        TINGGI.find((t) => ctx.args.split(/\s+/).includes(String(t))) ?? 480

      await ctx.reply(`⏳ *Sebentar ya*, lagi mengunduh video (${tinggi}p)...`)
      await proses(ctx, url, {
        youtube: true,
        format: 'bv*+ba/b',
        urutan: `res:${tinggi},vcodec:h264,acodec:m4a`,
        maxDurasi: 1200,
        maxUkuran: '60M',
      }, kirimVideo)
    },
  },
  {
    names: ['.ytmp3'],
    desc: 'video YouTube jadi MP3',
    async run(ctx) {
      const url = ambilUrl(ctx.args)
      if (!url || !URL_YT.test(url))
        return ctx.reply('💡 Format: *.ytmp3 <link YouTube>*\nContoh: .ytmp3 https://youtu.be/xxxx\n\n_Maks. 45 menit._')

      await ctx.reply('⏳ *Sebentar ya*, lagi mengunduh audio...')
      await proses(ctx, url, {
        youtube: true,
        audio: true,
        format: 'ba/b',
        maxDurasi: 2700,
        maxUkuran: '80M',
      }, kirimAudio)
    },
  },
  {
    names: ['.tiktok', '.tt'],
    desc: 'video TikTok tanpa watermark',
    async run(ctx) {
      const url = ambilUrl(ctx.args)
      if (!url || !URL_TT.test(url))
        return ctx.reply('💡 Format: *.tiktok <link TikTok>*\nContoh: .tiktok https://vt.tiktok.com/xxxx')

      await ctx.reply('⏳ *Sebentar ya*, lagi mengunduh video TikTok...')
      await proses(ctx, url, {
        // hindari format "download" yang berwatermark
        format: 'best[format_id!*=download]/best',
        maxDurasi: 600,
        maxUkuran: '60M',
      }, kirimVideo)
    },
  },
]