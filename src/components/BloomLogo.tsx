/**
 * ロゴアセット(縦組み / 横組み)をそのまま表示する。
 * SVG内でSMILアニメーションが完結しているため <img> で読み込む。
 */
export function BloomLogo({
  variant = 'vertical',
  className,
}: {
  variant?: 'vertical' | 'horizontal'
  className?: string
}) {
  const src = variant === 'vertical' ? '/bloomstudy_icon.svg' : '/bloomstudy_logo.svg'

  return <img src={src} alt="Bloomstudy" className={className} />
}
