/** オープニング演出をこのタブで再生済みかどうかを覚えておく */
const SESSION_KEY = 'bloomstudy:opening-shown'

/** 再生すべきか。1セッションにつき1回だけ、かつ動きを減らす設定なら出さない */
export function shouldPlayOpening(): boolean {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  try {
    return sessionStorage.getItem(SESSION_KEY) !== '1'
  } catch {
    // sessionStorage が使えない環境では毎回再生されるだけなので、演出は出す
    return true
  }
}

export function markOpeningShown(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    // 記録できなくても致命的ではない
  }
}
