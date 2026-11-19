// ============================================================================
// Module Cryptography cho JWT chuẩn RFC 7519 / RFC 7515
// Chạy tương thích 100% trong cả Browser (WebCrypto API) và Node.js (node:crypto / WebCrypto)
// ============================================================================

// Base64URL Encode & Decode chuẩn RFC 7515 Section 2
export function base64UrlEncode(str) {
  let base64 = ''
  if (typeof Buffer !== 'undefined') {
    base64 = Buffer.from(str, typeof str === 'string' ? 'utf8' : undefined).toString('base64')
  } else if (typeof btoa !== 'undefined') {
    const bytes = typeof str === 'string' ? new TextEncoder().encode(str) : new Uint8Array(str)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    base64 = btoa(binary)
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(base64, 'base64').toString('utf8')
  } else if (typeof atob !== 'undefined') {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return new TextDecoder().decode(bytes)
  }
  throw new Error('Không hỗ trợ giải mã Base64URL trong môi trường này')
}

// Giải mã không cần verify chữ ký (dùng cho Client inspect Header & Payload)
export function decodeJwt(token) {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const header = JSON.parse(base64UrlDecode(parts[0]))
    const payload = JSON.parse(base64UrlDecode(parts[1]))
    return {
      header,
      payload,
      signature: parts[2],
      raw: {
        header: parts[0],
        payload: parts[1],
        signature: parts[2]
      }
    }
  } catch {
    return null
  }
}

// Hàm băm / ký nhanh tương thích mọi môi trường (Browser WebCrypto & Node.js)
// Sử dụng HMAC-SHA256 chuẩn cho mock token và ký bảo mật
export async function signSha256(data, secretKey) {
  const enc = new TextEncoder()
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secretKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
    return base64UrlEncode(sig)
  }
  // Node.js fallback qua import động
  if (typeof process !== 'undefined') {
    try {
      const cryptoModuleName = 'node:crypto'
      const nodeCrypto = await import(/* @vite-ignore */ cryptoModuleName)
      return nodeCrypto.createHmac('sha256', secretKey).update(data).digest('base64url')
    } catch {}
  }
  throw new Error('Môi trường không có API Crypto hỗ trợ ký')
}

export async function verifySha256(data, signature, secretKey) {
  const expected = await signSha256(data, secretKey)
  return expected === signature
}

// Tạo JWT hoàn chỉnh: Header.Payload.Signature
export async function createJwt(payload, secretKey, options = {}) {
  const header = {
    alg: options.alg || 'HS256',
    typ: 'JWT',
    kid: options.kid || 'key_2026_01'
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const unsignedToken = `${encodedHeader}.${encodedPayload}`
  const signature = await signSha256(unsignedToken, secretKey)

  return `${unsignedToken}.${signature}`
}

// Xác thực JWT hoàn chỉnh: Chữ ký, TTL (exp), Issuer (iss), Audience (aud)
export async function verifyJwt(token, secretKey, expectedAudience, expectedIssuer) {
  if (!token || typeof token !== 'string') {
    return { valid: false, code: 'TOKEN_INVALID', message: 'Token rỗng hoặc không đúng định dạng' }
  }

  const parts = token.split('.')
  if (parts.length !== 3) {
    return { valid: false, code: 'TOKEN_INVALID', message: 'JWT phải gồm 3 phần tách nhau bởi dấu chấm' }
  }

  const [encodedHeader, encodedPayload, signature] = parts
  const unsignedToken = `${encodedHeader}.${encodedPayload}`

  // 1. Kiểm tra chữ ký (Signature Integrity)
  const isSignatureValid = await verifySha256(unsignedToken, signature, secretKey)
  if (!isSignatureValid) {
    return { valid: false, code: 'TOKEN_INVALID', message: 'Chữ ký JWT không hợp lệ (Signature mismatch)' }
  }

  let header, payload
  try {
    header = JSON.parse(base64UrlDecode(encodedHeader))
    payload = JSON.parse(base64UrlDecode(encodedPayload))
  } catch {
    return { valid: false, code: 'TOKEN_INVALID', message: 'Không thể giải mã header hoặc payload' }
  }

  // 2. Cấm alg: none (BR-07)
  if (header.alg === 'none') {
    return { valid: false, code: 'TOKEN_INVALID', message: 'Không chấp nhận alg: none' }
  }

  // 3. Kiểm tra thời hạn (exp)
  const now = Math.floor(Date.now() / 1000)
  if (payload.exp && payload.exp < now) {
    return { valid: false, code: 'TOKEN_EXPIRED', message: 'Access Token đã hết hạn', payload }
  }

  // 4. Kiểm tra Issuer (iss)
  if (expectedIssuer && payload.iss && payload.iss !== expectedIssuer) {
    return { valid: false, code: 'TOKEN_INVALID', message: `Issuer không khớp: mong đợi ${expectedIssuer}`, payload }
  }

  // 5. Kiểm tra Audience (aud)
  if (expectedAudience && payload.aud && payload.aud !== expectedAudience) {
    return { valid: false, code: 'TOKEN_INVALID', message: `Audience không khớp: mong đợi ${expectedAudience}`, payload }
  }

  return { valid: true, payload, header }
}
