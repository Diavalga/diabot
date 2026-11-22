import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import path from 'node:path'
import { withTemp } from './helpers.js'

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const YTDLP = path.join(RAIZ, 'venv', 'bin', 'yt-dlp')
const run = promisify(execFile)

export const URL_YT = /^https?:\/\/(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\//i
export const URL_TT = /^https?:\/\/(www\.|m\.|vm\.|vt\.)?tiktok\.com\//i

export const ambilUrl = (teks = '') => teks.match(/https?:\/\/[^\s]+/i)?.[0] ?? null

export const bersihNama = (s = '') =>
  s.replace(/[\\/:*?"<>|\n\r]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'file'

export class UnduhError extends Error {}

// satu unduhan pada satu waktu, supaya RAM dan CPU PC tidak penuh
let antrean = Promise.resolve()
const giliran = (fn) => {
  const p = antrean.then(fn)
  antrean = p.catch(() => {})
  return p
}

// opsi: { format, urutan, audio, youtube, maxDurasi (detik), maxUkuran ('60M') }
// kirim({ file, ukuran, judul, pengunggah }) dipanggil selagi file masih ada
export function unduh(url, opsi, kirim) {
  const { format, urutan, audio, youtube, maxDurasi, maxUkuran } = opsi
  return giliran(() =>
    withTemp(async (dir) => {
      const args = [
        '-q', '--no-warnings', '--no-playlist', '--write-info-json',
        '--max-filesize', maxUkuran,
        '-o', path.join(dir, 'hasil.%(ext)s'),
      ]
      if (maxDurasi) args.push('--match-filters', `duration<=${maxDurasi}`)
      if (youtube) args.push('--js-runtimes', 'node')
      if (audio) args.push('-x', '--audio-format', 'mp3', '--audio-quality', '128K')
      else args.push('--merge-output-format', 'mp4')
      if (format) args.push('-f', format)
      if (urutan) args.push('-S', urutan)
      args.push('--', url)

      await run(YTDLP, args, { timeout: 300000, maxBuffer: 10 * 1024 * 1024 })

      const hasil = (await fs.readdir(dir)).find((f) => /\.(mp4|mp3|m4a|webm|mkv)$/i.test(f))
      if (!hasil) throw new UnduhError('Melewati batas durasi atau ukuran')

      let info = {}
      try {
        info = JSON.parse(await fs.readFile(path.join(dir, 'hasil.info.json'), 'utf8'))
      } catch {}

      const file = path.join(dir, hasil)
      const { size } = await fs.stat(file)
      return kirim({
        file,
        ukuran: size,
        judul: info.title || 'Tanpa judul',
        pengunggah: info.uploader || info.channel || '',
      })
    })
  )
}