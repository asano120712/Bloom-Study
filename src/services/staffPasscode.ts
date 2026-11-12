/**
 * 隠しページ(スタッフ用)のパスワードを確かめる。
 *
 * このアプリはサーバーを持たず、プログラムは全部ブラウザに配られる。パスワードをそのまま書くと、
 * 開発者ツールで読めてしまうので、**PBKDF2 で 100万回かけた値だけ**を持ち、入力も同じ手順で変換して比べる。
 * 元のパスワードには戻せず、総当たりで探すにも1回ごとに時間がかかる。
 *
 * ただし、確かめるのはブラウザの中なので、開発者ツールで確認そのものを飛ばすことはできる。
 * 隠しページでできるのは「その端末の記録を消す」ことだけなので、飛ばされても困ることはない。
 * みんなで共有するデータを変える機能を足すなら、サーバー側で確かめる作りにすること。
 *
 * パスワードを変えるときは、新しいパスワードで値を作り直して、下の3つを書き換える:
 *   node -e "const c=require('node:crypto');const s=c.randomBytes(16);
 *     console.log(s.toString('hex'), c.pbkdf2Sync('新しいパスワード', s, 1000000, 32, 'sha256').toString('hex'))"
 */
import { pbkdf2Sha256 } from './pbkdf2'

const SALT = 'd3cefdcb20f7aa8a5566da67c1f61b08'
const ITERATIONS = 1_000_000
const HASH = '3ee6417e5981f332ee4888637389aad09e0a70842ebba1303dd8928a1b6922d3'

const fromHex = (hex: string) => new Uint8Array(hex.match(/../g)!.map((byte) => Number.parseInt(byte, 16)))
const toHex = (bytes: ArrayBuffer | Uint8Array) =>
  [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')

export async function checkStaffPasscode(input: string): Promise<boolean> {
  const password = new TextEncoder().encode(input)
  // crypto.subtle は https か localhost でしか使えない。開発中に iPad から http で開いたときは、
  // 同じ計算を自前で行う(数秒かかるので、確かめている表示が出てから始める)
  if (!globalThis.crypto?.subtle) {
    await new Promise((resolve) => setTimeout(resolve, 50))
    return toHex(pbkdf2Sha256(password, fromHex(SALT), ITERATIONS)) === HASH
  }
  const key = await crypto.subtle.importKey('raw', password, 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(SALT), iterations: ITERATIONS },
    key,
    256,
  )
  return toHex(bits) === HASH
}
