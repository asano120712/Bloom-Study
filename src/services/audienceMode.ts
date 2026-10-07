import type { AudienceMode } from '@/types'

/**
 * おとな向け / こども向けのどちらで使っているか。
 *
 * トップはモードごとに別ページ(`/` と `/kids`)にしてあり、
 * どちらを開いたかをここに覚えておく。次にアプリを開いたときは
 * 前に使っていた側から始まる(こどもに毎回切り替えさせないため)。
 *
 * 保存は localStorage。タブを閉じても残す(セッションではなく端末の設定に近い)。
 * ジャンルをモードで出し分けるときも、この値を見て決める。
 */
const STORAGE_KEY = 'bloomstudy:audience:v1'

export function readAudienceMode(): AudienceMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'kids' ? 'kids' : 'adult'
  } catch {
    // プライベートモードなど localStorage が使えない環境では、おとな向けで続行する
    return 'adult'
  }
}

export function writeAudienceMode(mode: AudienceMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // 覚えられなくても、その場の切り替えは効いている
  }
}
