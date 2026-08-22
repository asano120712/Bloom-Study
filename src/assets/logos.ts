/** public/ に置いたロゴアセットのパス。参照はここ1か所に集約する。 */
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
