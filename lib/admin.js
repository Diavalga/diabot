import { load, update } from './storage.js'
import { loadSettings } from './settings.js'

const S = loadSettings()
export const ABSOLUTE_ADMIN_NUM = S.adminNum
export const ABSOLUTE_ADMIN_LID = S.adminLid
export const ADMIN_EMAIL = S.adminEmail
export const ADMIN_PASS = S.adminPass

// nilai kosong diabaikan, supaya '' tidak pernah dianggap cocok
export const OWNER_IDS = [ABSOLUTE_ADMIN_NUM, ABSOLUTE_ADMIN_LID].filter(Boolean)

export const getNomor = (jid) => (jid || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '')

export async function isAdmin(sender, m = null) {
  if (m?.key?.fromMe) return true

  const senderNum = getNomor(sender)
  const participantNum = getNomor(m?.key?.participant)
  const remoteNum = getNomor(m?.key?.remoteJid)

  const isOwner = [senderNum, participantNum, remoteNum].some((id) => id && OWNER_IDS.includes(id))
  if (isOwner) return true

  const data = await load('admins', [])
  return data.some((a) => {
    const cleanA = getNomor(a)
    return cleanA && (cleanA === senderNum || cleanA === participantNum || cleanA === remoteNum)
  })
}

export async function addAdmin(target) {
  return update('admins', [], (data) => {
    if (!data.includes(target)) data.push(target)
    return data
  })
}

export async function delAdmin(target) {
  return update('admins', [], (data) => {
    const targetNum = getNomor(target)
    const sisa = data.filter((a) => getNomor(a) !== targetNum)
    data.splice(0, data.length, ...sisa) // ubah array aslinya, karena update() menyimpan `data`
    return data
  })
}

export async function getAdminList() {
  const data = await load('admins', [])
  return [`+${ABSOLUTE_ADMIN_NUM}`, ...data.filter((a) => !OWNER_IDS.includes(getNomor(a)))]
}
