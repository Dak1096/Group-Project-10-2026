// ============================================================================
// Quản lý Device ID gắn với phiên JWT (Quy tắc BR-05 & TC-07)
// ============================================================================

const STORAGE_KEY = 'englishstep_device_id'

function generateRandomDeviceId() {
  const rand = Math.random().toString(36).substring(2, 10)
  const time = Date.now().toString(36)
  return `dev_${rand}_${time}`
}

let inMemoryDeviceId = null

export function getDeviceId() {
  if (inMemoryDeviceId) return inMemoryDeviceId
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        inMemoryDeviceId = stored
        return stored
      }
    } catch {}
  }
  inMemoryDeviceId = generateRandomDeviceId()
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, inMemoryDeviceId)
    } catch {}
  }
  return inMemoryDeviceId
}

export function setDeviceId(newId) {
  inMemoryDeviceId = newId
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, newId)
    } catch {}
  }
  return inMemoryDeviceId
}

export function resetDeviceId() {
  inMemoryDeviceId = generateRandomDeviceId()
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, inMemoryDeviceId)
    } catch {}
  }
  return inMemoryDeviceId
}
