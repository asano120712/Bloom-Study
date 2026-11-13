import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '@/utils/motion'

/** ロゴ(public/bloomstudy_logo.svg)と同じ花びらの配色 */
const PETAL_COLORS = ['#5DCAA5', '#3FBE93', '#5DCAA5', '#3FBE93', '#5DCAA5']
const CENTER_COLOR = '#0F6E56'

/**
 * bloom: 1回だけ開く / loop: 開閉を繰り返す(ローディング用) /
 * idle: 開いた形のまま、ゆっくり揺れる(顔つき用) / none: 静止
 *
 * 顔つき(face あり)の bloom は、**開き終わったあと自動で idle に入る**。
 * 開くところから見せたい画面は bloom、ずっと出ている場所(ヘッダー)は idle を渡す。
 */
export type BloomMotion = 'bloom' | 'loop' | 'idle' | 'none'

/**
 * 顔つき(こども向け)の表情。
 *
 * smile  ふつう・待っているとき
 * joy    できたとき(目を閉じて笑う。ほおも染まる)
 * sleepy よみこみ中(目を閉じている。motion="loop" と組ませる)
 *
 * 渡さなければ花びらだけの元の形。おとな向けの画面では渡さない。
 */
export type BloomFace = 'smile' | 'joy' | 'sleepy'

/**
 * 顔を描く土台の円の大きさ。
 *
 * 元の中心(r=4.5)のままでは顔が入らないので、こちらは大きくする。
 * 花びらの位置と外形は変えず、内側を円で覆う形にしてある
 * (花びらが顔の後ろから出ているように見え、マークの大きさはおとな向けと揃う)。
 */
const FACE_RADIUS = 8

/** 顔の線。細いと小さいサイズで消えるので、目・口・輪郭で太さを揃えている */
const FACE_STROKE = 1.3

/** 目の高さ。まばたきで縦に潰す軸でもあるので、定数にして両方から引く */
const EYE_Y = -1.6

/**
 * 常時の動き(顔つき)。花ごと左右にゆっくり傾ける。
 *
 * 大きく振ると、ヒントや問題より先に目が行ってしまう。
 * 「生きている」と分かる最小限として、5度・3.6秒の往復に留めてある。
 */
const SWAY_DEGREES = 5
const SWAY_MS = 3600

/** まばたきの周期。実際に目を閉じているのは、このうち 0.2 秒ほど */
const BLINK_CYCLE_MS = 5200

/**
 * ロゴの花びらモチーフ(文字なし)。face を渡すと顔つきになる。
 * UI内の演出のため、SVGファイル側のSMILではなく Web Animations API で制御する。
 * 形状・配色はロゴアセットと揃えてあるので、片方を変えたらもう片方も合わせること
 * (顔つきは画面の中だけの見た目で、ロゴアセットには対応するものがない)。
 */
export function BloomMark({
  size = 96,
  motion = 'bloom',
  face,
  className,
}: {
  size?: number
  motion?: BloomMotion
  face?: BloomFace
  /** 枠に合わせて伸縮させたいとき(ロゴの置き場所など)。size より CSS が優先される */
  className?: string
}) {
  const rootRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (motion === 'none' || prefersReducedMotion()) return

    const root = rootRef.current
    if (!root) return

    let cancelled = false
    const animations: Animation[] = []

    /** ずっと続く動き。揺れと、ひらいた目のまばたき */
    const startIdle = () => {
      const sway = root.querySelector<SVGElement>('[data-bloom-sway]')
      if (sway) {
        animations.push(
          sway.animate(
            [
              { transform: `rotate(-${SWAY_DEGREES}deg)` },
              { transform: `rotate(${SWAY_DEGREES}deg)` },
              { transform: `rotate(-${SWAY_DEGREES}deg)` },
            ],
            {
              duration: SWAY_MS,
              iterations: Number.POSITIVE_INFINITY,
              easing: 'ease-in-out',
            },
          ),
        )
      }

      // まばたきはひらいた目(smile)だけ。閉じている目(joy / sleepy)は揺れだけで動かす。
      // ほとんどの時間はひらいたままで、周期の終わりに一瞬だけ潰す。
      const eyes = root.querySelector<SVGElement>('[data-bloom-eyes]')
      if (eyes) {
        animations.push(
          eyes.animate(
            [
              { transform: 'scaleY(1)', offset: 0 },
              { transform: 'scaleY(1)', offset: 0.93 },
              { transform: 'scaleY(0.12)', offset: 0.96 },
              { transform: 'scaleY(1)', offset: 0.99 },
              { transform: 'scaleY(1)', offset: 1 },
            ],
            { duration: BLINK_CYCLE_MS, iterations: Number.POSITIVE_INFINITY },
          ),
        )
      }
    }

    /** 画面から消えたら、開始待ちのものも含めて全部止める */
    const stopAll = () => {
      cancelled = true
      animations.forEach((animation) => animation.cancel())
    }

    if (motion === 'idle') {
      startIdle()
      return stopAll
    }

    const parts = root.querySelectorAll<SVGElement>('[data-bloom-part]')

    const opening = [...parts].map((part, index) => {
      const isCenter = part.dataset.bloomPart === 'center'

      if (motion === 'loop') {
        return part.animate(
          [
            { opacity: 0.2, transform: 'scale(0.8)' },
            { opacity: 1, transform: 'scale(1)' },
            { opacity: 0.2, transform: 'scale(0.8)' },
          ],
          {
            duration: 1600,
            delay: index * 130,
            iterations: Number.POSITIVE_INFINITY,
            easing: 'ease-in-out',
          },
        )
      }

      return part.animate(
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

    animations.push(...opening)

    // 顔つきは、開ききってから動き出す。開いている最中に揺らすと、
    // どこで完成したのか分からなくなる(オープニングは完成形を見せてから次へ進む)。
    if (motion === 'bloom' && face) {
      void Promise.all(opening.map((each) => each.finished))
        .then(() => {
          if (!cancelled) startIdle()
        })
        // 途中で画面を離れると finished は reject する。ここでは何もしない
        .catch(() => undefined)
    }

    return stopAll
  }, [motion, face])

  return (
    <svg
      ref={rootRef}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Bloomstudy"
      className={className}
    >
      <g transform="translate(32,32) scale(1.5)">
        {/* 揺れはここを回す。花びらは自分の回転を持っているので、まとめる入れ物を1枚はさむ */}
        <g data-bloom-sway style={{ transformOrigin: '0 0' }}>
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
          {face ? (
            <FaceCenter face={face} />
          ) : (
            <circle
              data-bloom-part="center"
              cx="0"
              cy="0"
              r="4.5"
              fill={CENTER_COLOR}
              style={{ transformOrigin: '0 0' }}
            />
          )}
        </g>
      </g>
    </svg>
  )
}

/**
 * 顔。花びらと同じ [data-bloom-part="center"] にまとめ、中心と同じ間で開くようにする。
 *
 * 色は CSS 変数(src/index.css のトークン)を引く。顔を出すのはこども向けだけで、
 * こども向けでは地がクリームに入れ替わるため、ハードコードすると地から浮く。
 */
function FaceCenter({ face }: { face: BloomFace }) {
  return (
    <g data-bloom-part="center" style={{ transformOrigin: '0 0' }}>
      {/* 顔の土台。白地でも輪郭が消えないよう、細い緑の線で締める */}
      <circle
        cx="0"
        cy="0"
        r={FACE_RADIUS}
        fill="var(--color-base-50)"
        stroke="var(--color-bloom-700)"
        strokeWidth="1"
      />
      <g
        fill="none"
        stroke="var(--color-bloom-700)"
        strokeWidth={FACE_STROKE}
        strokeLinecap="round"
      >
        <Eyes face={face} />
        <Mouth face={face} />
      </g>
      {face === 'joy' && (
        <g fill="var(--color-warm-500)" opacity="0.55">
          <ellipse cx="-5.9" cy="1.9" rx="1.45" ry="1" />
          <ellipse cx="5.9" cy="1.9" rx="1.45" ry="1" />
        </g>
      )}
    </g>
  )
}

/** 目。ひらいた丸(smile)か、閉じた線(joy は上向き / sleepy は下向き) */
function Eyes({ face }: { face: BloomFace }) {
  if (face === 'smile') {
    // ひらいた目だけ、まばたきで縦に潰す(目の高さを軸にする)
    return (
      <g data-bloom-eyes style={{ transformOrigin: `0px ${EYE_Y}px` }}>
        <circle cx="-3" cy={EYE_Y} r="1.55" fill="var(--color-bloom-700)" stroke="none" />
        <circle cx="3" cy={EYE_Y} r="1.55" fill="var(--color-bloom-700)" stroke="none" />
      </g>
    )
  }

  if (face === 'joy') {
    return (
      <>
        <path d="M -4.5 -1.2 Q -3 -3.3 -1.5 -1.2" />
        <path d="M 1.5 -1.2 Q 3 -3.3 4.5 -1.2" />
      </>
    )
  }

  return (
    <>
      <path d="M -4.5 -2.2 Q -3 -0.5 -1.5 -2.2" />
      <path d="M 1.5 -2.2 Q 3 -0.5 4.5 -2.2" />
    </>
  )
}

/** 口。joy だけは塗りで大きく開ける(線だけだと「できた!」の強さが出ない) */
function Mouth({ face }: { face: BloomFace }) {
  if (face === 'joy') {
    return (
      <path
        d="M -3.1 2 Q 0 6.1 3.1 2 Z"
        fill="var(--color-bloom-700)"
        stroke="var(--color-bloom-700)"
        strokeWidth="0.6"
      />
    )
  }

  if (face === 'sleepy') return <path d="M -1.4 2.6 Q 0 3.9 1.4 2.6" />

  return <path d="M -2.4 2.3 Q 0 4.6 2.4 2.3" />
}
