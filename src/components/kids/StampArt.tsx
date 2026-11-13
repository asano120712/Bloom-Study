import type { StampKind } from '@/services/stampCard'

/**
 * はんこの絵(スタンプの種類ごと)。二重の丸の枠の中に、1色のシルエットで描く。
 * 色は currentColor(朱色)。抜きの部分は白で描く(紙に押したとき、そこだけインクが乗らない形)。
 * カレンダーのマス(36px ほど)でも何か分かるよう、細かい線は入れない。
 */
export function StampArt({ kind = 'flower', className }: { kind?: StampKind; className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={className}>
      <circle cx="20" cy="20" r="17.6" fill="none" stroke="currentColor" strokeWidth="2.6" />
      <circle cx="20" cy="20" r="14" fill="none" stroke="currentColor" strokeWidth="0.9" strokeDasharray="2.2 1.5" />
      {ART[kind]}
    </svg>
  )
}

const WHITE = 'white'

const ART: Record<StampKind, React.ReactNode> = {
  flower: (
    <>
      {[0, 1, 2, 3, 4].map((index) => (
        <ellipse
          key={index}
          cx="20"
          cy="13.4"
          rx="4.1"
          ry="6"
          fill="currentColor"
          opacity="0.88"
          transform={`rotate(${index * 72} 20 20)`}
        />
      ))}
      <circle cx="20" cy="20" r="2.7" fill={WHITE} />
    </>
  ),
  rabbit: (
    <>
      <ellipse cx="16.6" cy="12.4" rx="2.5" ry="6" transform="rotate(-12 16.6 12.4)" fill="currentColor" />
      <ellipse cx="23.4" cy="12.4" rx="2.5" ry="6" transform="rotate(12 23.4 12.4)" fill="currentColor" />
      <ellipse cx="16.6" cy="12.8" rx="1" ry="3.8" transform="rotate(-12 16.6 12.8)" fill={WHITE} opacity="0.7" />
      <ellipse cx="23.4" cy="12.8" rx="1" ry="3.8" transform="rotate(12 23.4 12.8)" fill={WHITE} opacity="0.7" />
      <ellipse cx="20" cy="23.2" rx="7.6" ry="6.8" fill="currentColor" />
      <circle cx="17.2" cy="22.2" r="1.1" fill={WHITE} />
      <circle cx="22.8" cy="22.2" r="1.1" fill={WHITE} />
      <path d="M19 25 L21 25 L20 26.2Z" fill={WHITE} />
    </>
  ),
  dress: (
    <>
      <path
        d="M15.8 8.8 L17.8 8.8 Q20 11.8 22.2 8.8 L24.2 8.8 L25 15.8 L23.6 16.8 L29 29 Q20 32.2 11 29 L16.4 16.8 L15 15.8 Z"
        fill="currentColor"
      />
      <path d="M15.6 16.9 L24.4 16.9" stroke={WHITE} strokeWidth="1.3" />
      <circle cx="20" cy="16.9" r="1.5" fill={WHITE} />
      <path d="M12.8 27.6 Q20 30.2 27.2 27.6" stroke={WHITE} strokeWidth="0.9" fill="none" strokeDasharray="1.4 1" />
    </>
  ),
  beetle: (
    <>
      <path d="M19.2 14 Q18.4 9 17 7 Q19 7.4 19.6 9.4 L20.4 9.4 Q21 7.4 23 7 Q21.6 9 20.8 14Z" fill="currentColor" />
      <ellipse cx="20" cy="15.4" rx="4.2" ry="2.8" fill="currentColor" />
      <ellipse cx="20" cy="24" rx="6.6" ry="8" fill="currentColor" />
      <path d="M20 17.6 L20 31.4" stroke={WHITE} strokeWidth="1" />
      <path
        d="M14 20 L10.4 18 M13.6 24 L9.8 24.4 M14 28 L10.8 30.4 M26 20 L29.6 18 M26.4 24 L30.2 24.4 M26 28 L29.2 30.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </>
  ),
  police: (
    <>
      {/* 屋根の上の赤色灯と、光っている線。これが無いとタクシーに見える */}
      <rect x="17.6" y="9.6" width="4.8" height="2.6" rx="1" fill="currentColor" />
      <path d="M15.8 10.2 L14.2 9 M24.2 10.2 L25.8 9" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M13.4 18.6 L15.4 12.6 L24.6 12.6 L26.6 18.6Z" fill="currentColor" />
      <path d="M15.4 17.8 L16.6 14 L19.4 14 L19.4 17.8Z M20.6 17.8 L20.6 14 L23.4 14 L24.6 17.8Z" fill={WHITE} />
      <rect x="8.4" y="18.2" width="23.2" height="7.6" rx="2.6" fill="currentColor" />
      {/* ドアの星(警察のマーク) */}
      <path
        d="M20 19.2 L20.7 21 L22.6 21 L21.1 22.1 L21.6 23.9 L20 22.8 L18.4 23.9 L18.9 22.1 L17.4 21 L19.3 21Z"
        fill={WHITE}
      />
      <circle cx="13.6" cy="26.2" r="3.2" fill="currentColor" stroke={WHITE} strokeWidth="1.1" />
      <circle cx="26.4" cy="26.2" r="3.2" fill="currentColor" stroke={WHITE} strokeWidth="1.1" />
    </>
  ),
  dinosaur: (
    <>
      <path
        d="M10 13.6 Q10 10.2 13.4 10.2 Q16.4 10.2 16.4 12.8 L16 14 Q17 19.6 21 19.6 Q28.4 19 30.4 23.4 L33.2 29.2 Q30 27 28 27.4 L27.4 30.8 L24.6 30.8 L24.4 27.8 L19.6 27.8 L19.4 30.8 L16.6 30.8 L16.6 26.4 Q13.6 22.6 12.8 15.4 Q10 15.6 10 13.6Z"
        fill="currentColor"
      />
      <circle cx="13.4" cy="12.4" r="0.9" fill={WHITE} />
      <path d="M20.6 19.4 L22 17.4 L23.2 19.2 L24.6 17.6 L25.6 19.6 L27 18.4 L27.6 20.4" fill="currentColor" />
    </>
  ),
}
