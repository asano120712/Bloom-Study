import { NOTICES } from '@/data/notices'

/**
 * お知らせを最後に開いたとき、いちばん新しかったお知らせの id。
 *
 * これより新しいお知らせがあれば、ヘッダーのアイコンの点を点滅させる。
 * 端末ごとに覚えればよいので localStorage に置く。
 */
const STORAGE_KEY = 'bloomstudy:notice-seen:v1'

/** まだ開いていない新しいお知らせがあるか */
export function hasNewNotice(): boolean {
  const latest = NOTICES[0]
  if (!latest) return false
  try {
    return localStorage.getItem(STORAGE_KEY) !== latest.id
  } catch {
    // 覚えられない環境では、毎回「新しいお知らせあり」にはせず静かにしておく
    return false
  }
}

/** お知らせを開いた。いまの一番新しいお知らせまで読んだことにする */
export function markNoticesSeen(): void {
  const latest = NOTICES[0]
  if (!latest) return
  try {
    localStorage.setItem(STORAGE_KEY, latest.id)
  } catch {
    // 覚えられなくても、その場では点滅が止まる(呼び出し側の状態で消す)
  }
}
