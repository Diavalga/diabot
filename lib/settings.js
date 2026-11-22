import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const CONFIG_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'config.json')

export const DEFAULTS = {
  botNumber: '',     // nomor bot (62...)
  adminNum: '',      // nomor owner
  adminLid: '',      // LID owner
  adminEmail: '',    // login .sysadmin (opsional)
  adminPass: '',     // login .sysadmin (opsional)
  namaBot: 'WaBot',
  namaPemilik: '',
}

export function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(data) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), { mode: 0o600 })
}
