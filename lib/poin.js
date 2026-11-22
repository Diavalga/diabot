import { load, update } from './storage.js'

const POIN_AWAL = 50

export async function tambahPoin(sender, jumlah) {
  return update('poin', {}, (data) => {
    if (!data[sender]) data[sender] = { poin: POIN_AWAL, pack: null, author: null, title: null, lastDaily: 0 }
    data[sender].poin = (data[sender].poin || 0) + jumlah
    return data[sender].poin
  })
}

export async function getPoinData(sender) {
  const data = await load('poin', {})
  if (!data[sender]) {
    return { poin: POIN_AWAL, pack: null, author: null, title: null, lastDaily: 0 }
  }
  return data[sender]
}

export async function kurangiPoin(sender, jumlah) {
  return update('poin', {}, (data) => {
    if (!data[sender]) data[sender] = { poin: POIN_AWAL, pack: null, author: null, title: null, lastDaily: 0 }
    const poinSekarang = data[sender].poin ?? POIN_AWAL
    if (poinSekarang < jumlah) {
      return { success: false, sisa: poinSekarang }
    }
    data[sender].poin = poinSekarang - jumlah
    return { success: true, sisa: data[sender].poin }
  })
}

export async function klaimDaily(sender) {
  return update('poin', {}, (data) => {
    if (!data[sender]) data[sender] = { poin: POIN_AWAL, pack: null, author: null, title: null, lastDaily: 0 }
    const now = Date.now()
    const cooldown = 24 * 60 * 60 * 1000
    const sisa = cooldown - (now - (data[sender].lastDaily || 0))

    if (sisa > 0) {
      const jam = Math.floor(sisa / (1000 * 60 * 60))
      const menit = Math.floor((sisa % (1000 * 60 * 60)) / (1000 * 60))
      return { success: false, jam, menit }
    }

    const bonus = 50
    data[sender].poin = (data[sender].poin || 0) + bonus
    data[sender].lastDaily = now
    return { success: true, bonus, total: data[sender].poin }
  })
}

export async function transferPoin(sender, target, jumlah) {
  return update('poin', {}, (data) => {
    if (!data[sender]) data[sender] = { poin: POIN_AWAL, pack: null, author: null, title: null, lastDaily: 0 }
    if (!data[target]) data[target] = { poin: POIN_AWAL, pack: null, author: null, title: null, lastDaily: 0 }

    if ((data[sender].poin || 0) < jumlah) {
      return { success: false, sisa: data[sender].poin || 0 }
    }

    data[sender].poin -= jumlah
    data[target].poin = (data[target].poin || 0) + jumlah
    return { success: true, sisaSender: data[sender].poin, totalTarget: data[target].poin }
  })
}

export async function getLeaderboard(limit = 10) {
  const data = await load('poin', {})
  return Object.entries(data)
    .map(([jid, val]) => ({ jid, poin: val.poin ?? POIN_AWAL, title: val.title || 'Pemula' }))
    .sort((a, b) => b.poin - a.poin)
    .slice(0, limit)
}

export async function beliTitle(sender, title, harga) {
  return update('poin', {}, (data) => {
    if (!data[sender]) data[sender] = { poin: POIN_AWAL, pack: null, author: null, title: null, lastDaily: 0 }
    if ((data[sender].poin || 0) < harga) {
      return { success: false, sisa: data[sender].poin || 0 }
    }

    data[sender].poin -= harga
    data[sender].title = title
    return { success: true, sisa: data[sender].poin, title }
  })
}

export async function tukarWatermark(sender, pack, author) {
  return update('poin', {}, (data) => {
    if (!data[sender]) data[sender] = { poin: POIN_AWAL, pack: null, author: null, title: null, lastDaily: 0 }
    const poinSekarang = data[sender].poin || 0

    if (poinSekarang < 250) {
      return { success: false, sisa: poinSekarang }
    }

    data[sender].poin -= 250
    data[sender].pack = pack
    data[sender].author = author
    return { success: true, sisa: data[sender].poin, pack, author }
  })
}