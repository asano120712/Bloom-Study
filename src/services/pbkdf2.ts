/**
 * PBKDF2-HMAC-SHA256 を、ブラウザの暗号の機能(crypto.subtle)を使わずに計算する。
 *
 * crypto.subtle は https か localhost のページでしか使えない。開発中に iPad から
 * http://(Mac の IP):5173 で開くと使えず、隠しページのパスワードを確かめられなかった。
 * そのときだけこちらで同じ値を計算する(本番の https では crypto.subtle を使う)。
 *
 * HMAC の鍵(パスワード)は回数を重ねても変わらないので、鍵を混ぜた最初の1ブロックぶんの状態を先に作っておき、
 * 1回ごとの計算を SHA-256 の圧縮2回に減らしている(100万回でも数秒で終わるように)。
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
])
const INITIAL = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]

const w = new Uint32Array(64)

/** SHA-256 の圧縮1回。state を、64バイトのブロック(16語)で進める */
function compress(state: Uint32Array, block: Uint32Array): void {
  for (let i = 0; i < 16; i += 1) w[i] = block[i]
  for (let i = 16; i < 64; i += 1) {
    const a = w[i - 15]
    const b = w[i - 2]
    const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3)
    const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10)
    w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0
  }
  let [a, b, c, d, e, f, g, h] = state
  for (let i = 0; i < 64; i += 1) {
    const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))
    const t1 = (h + s1 + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0
    const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))
    const t2 = (s0 + ((a & b) ^ (a & c) ^ (b & c))) | 0
    h = g
    g = f
    f = e
    e = (d + t1) | 0
    d = c
    c = b
    b = a
    a = (t1 + t2) | 0
  }
  state[0] = (state[0] + a) | 0
  state[1] = (state[1] + b) | 0
  state[2] = (state[2] + c) | 0
  state[3] = (state[3] + d) | 0
  state[4] = (state[4] + e) | 0
  state[5] = (state[5] + f) | 0
  state[6] = (state[6] + g) | 0
  state[7] = (state[7] + h) | 0
}

/** バイト列の SHA-256(鍵が長いときに縮めるのと、最初の1回に使う) */
function sha256(bytes: Uint8Array, prefix?: Uint32Array): Uint32Array {
  const state = new Uint32Array(prefix ?? INITIAL)
  const already = prefix ? 64 : 0
  const length = bytes.length + already
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64)
  padded.set(bytes)
  padded[bytes.length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(padded.length - 4, (length * 8) >>> 0)
  view.setUint32(padded.length - 8, Math.floor((length * 8) / 2 ** 32))
  const block = new Uint32Array(16)
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) block[i] = view.getUint32(offset + i * 4)
    compress(state, block)
  }
  return state
}

/** PBKDF2-HMAC-SHA256。出力は 32 バイト(1ブロック)だけ */
export function pbkdf2Sha256(password: Uint8Array, salt: Uint8Array, iterations: number): Uint8Array {
  let key = password
  if (key.length > 64) {
    const digest = sha256(key)
    key = new Uint8Array(32)
    const view = new DataView(key.buffer)
    digest.forEach((word, i) => view.setUint32(i * 4, word))
  }
  const pad = (byte: number) => {
    const block = new Uint8Array(64).fill(byte)
    key.forEach((value, i) => (block[i] ^= value))
    const words = new Uint32Array(16)
    const view = new DataView(block.buffer)
    for (let i = 0; i < 16; i += 1) words[i] = view.getUint32(i * 4)
    const state = new Uint32Array(INITIAL)
    compress(state, words)
    return state
  }
  // 鍵を混ぜた最初のブロックまで進めた状態(内側・外側)
  const inner = pad(0x36)
  const outer = pad(0x5c)

  // 1回め: U1 = HMAC(鍵, salt || 0x00000001)
  const first = new Uint8Array(salt.length + 4)
  first.set(salt)
  first[first.length - 1] = 1
  const innerFirst = sha256(first, inner)
  const u = new Uint32Array(8)
  const block = new Uint32Array(16)
  const finish = (digest: Uint32Array) => {
    // 32 バイトのダイジェストを、前の状態の続きとして1ブロックで締める(長さは 64 + 32 バイト)
    block.set(digest, 0)
    block[8] = 0x80000000
    block.fill(0, 9, 15)
    block[15] = (64 + 32) * 8
  }
  finish(innerFirst)
  const state = new Uint32Array(outer)
  compress(state, block)
  u.set(state)
  const result = new Uint32Array(u)

  // 2回め以降: U(n) = HMAC(鍵, U(n-1))。どちらも圧縮1回ずつで済む
  for (let n = 1; n < iterations; n += 1) {
    finish(u)
    state.set(inner)
    compress(state, block)
    finish(state)
    state.set(outer)
    compress(state, block)
    u.set(state)
    for (let i = 0; i < 8; i += 1) result[i] ^= u[i]
  }

  const out = new Uint8Array(32)
  const view = new DataView(out.buffer)
  result.forEach((word, i) => view.setUint32(i * 4, word))
  return out
}
