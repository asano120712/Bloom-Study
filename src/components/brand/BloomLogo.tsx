import { LOGO_SOURCES, type LogoVariant } from '@/assets/logos'

/**
 * ロゴアセットをそのまま表示する。
 * アニメーション版はSVG内のSMILで完結している(1回再生して完成形で止まる)ため <img> で読み込む。
 * ヘッダーのように常時出ている場所では、遷移のたびに再生されないよう静止版を使う。
 */
export function BloomLogo({
  variant = 'vertical',
  animated = false,
  className,
}: {
  variant?: LogoVariant
  animated?: boolean
  className?: string
}) {
  const src = animated ? LOGO_SOURCES[variant].animated : LOGO_SOURCES[variant].static

  return <img src={src} alt="Bloomstudy" className={className} />
}
