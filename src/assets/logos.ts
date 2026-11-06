/** public/ に置いたロゴ・挿絵アセットのパス。参照はここ1か所に集約する。 */
export const LOGO_SOURCES = {
  vertical: {
    animated: '/bloomstudy_icon.svg',
    static: '/bloomstudy_icon_static.svg',
  },
  horizontal: {
    animated: '/bloomstudy_logo.svg',
    static: '/bloomstudy_logo_static.svg',
  },
} as const

export type LogoVariant = keyof typeof LOGO_SOURCES

/** トップに置く挿絵(ペンが Bloomstudy を書き上げるループ) */
export const HERO_SOURCES = {
  animated: '/bloomstudy_hero.svg',
  static: '/bloomstudy_hero_static.svg',
} as const

/**
 * ボタンに使うアイコン。形だけを使い、色はボタンの文字色で塗る(型抜き。MemoPad の MemoIcon)。
 * ファイルの線の色が決め打ちでも、押したとき(白)と押していないとき(灰)で色を変えられる。
 */
export const ICON_SOURCES = {
  memo: '/images/memo.svg',
} as const
