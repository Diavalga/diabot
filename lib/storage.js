import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data')

export async function load(name, fallback) {
  const file = path.join(DIR, `${name}.json`)
  let teks
  try {
    teks = await fs.readFile(file, 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT') return structuredClone(fallback)
    throw e
  }
  try {
    return JSON.parse(teks)
  } catch {
    await fs.copyFile(file, `${file}.rusak-${Date.now()}`)
    return structuredClone(fallback)
  }
}

async function save(name, data) {
  await fs.mkdir(DIR, { recursive: true })
  const file = path.join(DIR, `${name}.json`)
  const tmp = `${file}.${process.pid}.tmp`
  await fs.writeFile(tmp, JSON.stringify(data, null, 2))
  await fs.rename(tmp, file)
}

// baca -> ubah -> simpan, dijalankan berurutan supaya data tidak bentrok
let chain = Promise.resolve()
export function update(name, fallback, fn) {
  const p = chain.then(async () => {
    const data = await load(name, fallback)
    const hasil = await fn(data)
    await save(name, data)
    return hasil
  })
  chain = p.catch(() => {})
  return p
}
