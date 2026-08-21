import { useEffect, useRef } from 'react'

/**
 * ロゴの花びらモチーフ(暫定アセット)。
 * 5枚の花びらが順に開く演出を Web Animations API で制御する。
 * 確定版の bloomstudy_logo_*.svg が用意でき次第、差し替える。
 */
export function BloomMark({ size = 96 }: { size?: number }) {
  const rootRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const petals = rootRef.current?.querySelectorAll('[data-petal]')
    petals?.forEach((petal, index) => {
      petal.animate(
        [
          { opacity: 0, transform: 'scale(0.2)' },
          { opacity: 1, transform: 'scale(1)' },
        ],
        {
          duration: 600,
          delay: index * 120,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'both',
        },
      )
    })
  }, [])

  return (
    <svg
      ref={rootRef}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Bloomstudy"
    >
      <g style={{ transformOrigin: '50px 50px' }}>
        {[0, 1, 2, 3, 4].map((index) => (
          <ellipse
            key={index}
            data-petal
            cx="50"
            cy="26"
            rx="14"
            ry="22"
            fill="var(--color-petal-300)"
            style={{
              transformOrigin: '50px 50px',
              rotate: `${index * 72}deg`,
            }}
          />
        ))}
      </g>
      <circle cx="50" cy="50" r="9" fill="var(--color-petal-500)" />
    </svg>
  )
}
