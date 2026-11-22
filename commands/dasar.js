import os from 'node:os'
import fs from 'node:fs/promises'
import { NAMA_BOT } from '../lib/config.js'
import { kotak, sapaan, tanggalWIB, durasi, footer } from '../lib/ui.js'

export const kategori = 'Umum'
export const ikon = '⚙️'

// banner opsional: taruh gambar di assets/banner.jpg
const banner = await fs.readFile('./assets/banner.jpg').catch(() => null)

export const commands = [
  {
    names: ['.ping'],
    desc: 'cek bot aktif',
    run: ({ reply }) => reply('🏓 *Pong!* Bot aktif dan siap membantu.'),
  },
  {
    names: ['.menu', '.info'],
    desc: 'tampilkan menu ini',
    async run({ sock, m, jid, nama, registry }) {
      const kepala = kotak(`🤖 *${NAMA_BOT}*`, [
        `Halo, *${nama}*! 👋`,
        sapaan(),
        '',
        `🗓️ ${tanggalWIB()}`,
        `⏱️ Aktif ${durasi(process.uptime())}`,
      ])

      const bagian = registry.map(({ kategori, ikon = '📌', commands }) =>
        kotak(
          `${ikon} *${kategori.toUpperCase()}*`,
          commands.map((c) => `◦ *${c.names[0]}* — ${c.desc}`)
        )
      )

      const teks = [
        kepala,
        ...bagian,
        '💡 _Kirim file dengan caption perintah, atau reply file dengan perintahnya._',
        footer,
      ].join('\n\n')

      // caption gambar ada batasnya, jadi banner hanya dipakai kalau teks tidak terlalu panjang
      const pesan =
        banner && teks.length < 1000
          ? { image: banner, caption: teks }
          : { text: teks }
      await sock.sendMessage(jid, pesan, { quoted: m })
    },
  },
  {
    names: ['.status'],
    desc: 'uptime dan pemakaian RAM bot',
    run: ({ reply }) => {
      const rssMB = (process.memoryUsage().rss / 1048576).toFixed(0)
      const bebas = (os.freemem() / 1073741824).toFixed(1)
      const total = (os.totalmem() / 1073741824).toFixed(1)
      return reply(
        kotak('🟢 *STATUS BOT*', [
          `⏱️ Uptime : ${durasi(process.uptime())}`,
          `🧠 RAM bot : ${rssMB} MB`,
          `💻 RAM PC : ${bebas} GB bebas dari ${total} GB`,
        ])
      )
    },
  },
]