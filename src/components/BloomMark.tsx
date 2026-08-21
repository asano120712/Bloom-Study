import { useEffect, useRef } from 'react'

/** ロゴ(public/bloomstudy_logo.svg)と同じ花びらの配色 */
const PETAL_COLORS = ['#5DCAA5', '#3FBE93', '#5DCAA5', '#3FBE93', '#5DCAA5']
const CENTER_COLOR = '#0F6E56'

/**
 * ロゴの花びらモチーフ(文字なし)。
 * UI内の演出のため、SVGファイル側のSMILではなく Web Animations API で制御する。
 * 形状・配色はロゴアセットと揃えてあるので、片方を変えたらもう片方も合わせること。
 */
export function BloomMark({ size = 96, animate = true }: { size?: number; animate?: boolean }) {
  const rootRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!animate) return
    const parts = rootRef.current?.querySelectorAll<SVGElement>('[data-bloom-part]')
    parts?.forEach((part, index) => {
      const isCenter = part.dataset.bloomPart === 'center'
      part.animate(
        [
          { opacity: 0, transform: isCenter ? 'scale(0)' : 'scale(0.15)', offset: 0 },
          { opacity: 1, transform: 'scale(1.1)', offset: 0.6 },
          { opacity: 1, transform: 'scale(1)', offset: 1 },
        ],
        {
          duration: 600,
          delay: index * 100,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'both',
        },
      )
    })
  }, [animate])

  return (
    <svg
      ref={rootRef}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Bloomstudy"
    >
      <g transform="translate(32,32) scale(1.5)">
        {PETAL_COLORS.map((color, index) => (
          <ellipse
            key={index}
            data-bloom-part="petal"
            cx="0"
            cy="-10"
            rx="6.5"
            ry="9.5"
            fill={color}
            style={{ transformOrigin: '0 0', rotate: `${index * 72}deg` }}
          />
        ))}
        <circle
          data-bloom-part="center"
          cx="0"
          cy="0"
          r="4.5"
          fill={CENTER_COLOR}
          style={{ transformOrigin: '0 0' }}
        />
      </g>
    </svg>
  )
}
