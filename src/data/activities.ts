import type { AudienceMode, GenreId } from '@/types'

/**
 * ジャンル選択の一覧に並べるもの。
 *
 * おとな向けは「ヒントを見ながら思い出すクイズ」(genreId を持つ)、
 * こども向けは「あそび」(行き先の path を持つ)で、中身のつくりが違う。
 * 一覧に出す・モードで出し分ける、という点だけが共通なのでここでまとめる。
 *
 * 字を読めない年齢の子に熟語の穴うめは出せないため、
 * こども向けにはクイズのジャンルを並べない。
 */
export type ActivityId =
  | GenreId
  | 'trace-shape'
  | 'trace-hiragana'
  | 'trace-kanji'
  | 'build-kanji'
  | 'match'

export interface Activity {
  id: ActivityId
  audience: AudienceMode
  /** クイズならそのジャンル。選ぶとこたえかた・なんいどのシートを開く */
  genreId?: GenreId
  /** あそびの行き先。シートを挟まず、押したらすぐ始まる */
  path?: string
}

export const ACTIVITIES: Activity[] = [
  { id: 'english', audience: 'adult', genreId: 'english' },
  { id: 'kanji', audience: 'adult', genreId: 'kanji' },
  { id: 'math', audience: 'adult', genreId: 'math' },
  // なぞりがきは図形から。線をなぞる手の動きができてから字へ進む
  { id: 'trace-shape', audience: 'kids', path: '/trace/shape' },
  { id: 'trace-hiragana', audience: 'kids', path: '/trace/hiragana' },
  { id: 'match', audience: 'kids', path: '/match' },
]

/*
 * 漢字のなぞり・くみたて(trace-kanji / build-kanji)は、ここには並べない。
 * 一般向けの漢字で「小学1・2年」を選ぶと、こたえかたとして同じ画面へ入る。
 * 一覧に出さないだけで id と文言・絵は残してあるので、こども側にも並べたくなったら
 * 上の配列に1行足せば戻る。
 */

export function activitiesFor(audience: AudienceMode): Activity[] {
  return ACTIVITIES.filter((activity) => activity.audience === audience)
}
