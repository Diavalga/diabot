import { downloadMediaMessage } from '@whiskeysockets/baileys'
import pino from 'pino'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export const logger = pino({ level: 'silent' })

export const unwrap = (message) =>
  message?.documentWithCaptionMessage?.message || message

// cari media (di pesan itu sendiri atau di pesan yang di-reply)
export function findMedia(m, kind) {
  const msg = unwrap(m.message)
  if (msg?.[kind]) {
    return { target: { key: m.key, message: msg }, node: msg[kind] }
  }
  const ctx = msg?.extendedTextMessage?.contextInfo
  const quoted = unwrap(ctx?.quotedMessage)
  if (quoted?.[kind]) {
    return {
      target: {
        key: {
          remoteJid: m.key.remoteJid,
          id: ctx.stanzaId,
          participant: ctx.participant,
        },
        message: quoted,
      },
      node: quoted[kind],
    }
  }
  return null
}

export const download = (sock, target) =>
  downloadMediaMessage(target, 'buffer', {}, {
    logger,
    reuploadRequest: sock.updateMediaMessage,
  })

export async function withTemp(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wabot-'))
  try {
    return await fn(dir)
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

// antrean: LibreOffice tidak bisa jalan paralel
let queue = Promise.resolve()
export const antre = (fn) => {
  const p = queue.then(fn)
  queue = p.catch(() => {})
  return p
}