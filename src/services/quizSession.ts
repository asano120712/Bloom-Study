import type { GenreId } from '@/types'

/**
 * ジャンルごとの出題位置。結果画面をはさんで出題画面に戻ってきても
 * 同じ問題を繰り返さないよう、タブ単位で保持する。
 */
const KEY_PREFIX = 'bloomstudy:cursor:'

export function readCursor(genreId: GenreId): number {
  const raw = sessionStorage.getItem(KEY_PREFIX + genreId)
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0
}

export function writeCursor(genreId: GenreId, index: number): void {
  sessionStorage.setItem(KEY_PREFIX + genreId, String(index))
}
