import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { VIEW_BOX, type TraceItem } from '@/features/trace'
import {
  distance,
  LINE_WIDTH,
  lineWidthOf,
  sampleOf,
  type Point,
  type StrokeSample,
} from '@/features/trace/geometry'
import { useNoTouchGesture } from '@/hooks/useNoTouchGesture'

interface TraceCanvasProps {
  item: TraceItem
  /** 最後のストロークまでなぞり切ったとき */
  onComplete: () => void
  /** なぞり終わったあと(お祝いの間)は手を止める */
  frozen?: boolean
}

/**
 * 指が線から離れてよい距離(お手本の座標系)。
 * お手本の線幅(10)より広くとる。狙って線に乗せられる年齢ではないので、
 * だいたい合っていれば進む。厳しくすると「なぞれない」だけで終わってしまう。
 */
const TOLERANCE = 14

/**
 * 一度に飛べるサンプル数。
 * これを超えて先へは進めないので、終点だけを触ってごまかすことはできない。
 */
const LOOK_AHEAD = 12

/**
 * お手本をなぞる入力。
 *
 * グレーのお手本の上を指で追うと、追えたところまでが緑になる。
 * 進むのは「いま進んでいる先の少し先」までに限る(LOOK_AHEAD)ので、
 * 終点だけ触っても完成しない。逆に、線から外れても戻ってくれば続きから進める。
 * 間違いで止めたり、やり直させたりはしない。書けない子が最後まで届くことを優先する。
 */
export function TraceCanvas({ item, onComplete, frozen = false }: TraceCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  useNoTouchGesture(svgRef)
  const guideRefs = useRef<(SVGPathElement | null)[]>([])
  const [samples, setSamples] = useState<StrokeSample[]>([])
  const [lineWidth, setLineWidth] = useState(LINE_WIDTH.max)

  /** いまなぞっているストローク。ここまでは終わっている、の意味でも使う */
  const [strokeIndex, setStrokeIndex] = useState(0)
  /** そのストロークで到達したサンプル番号 */
  const [reached, setReached] = useState(0)
  const tracingRef = useRef(false)

  // お手本が変わったら測り直す。パスの長さは描かれた要素からしか取れない。
  // 線の太さもここで決まるので、描く前に測る(いつもの太さで一瞬描かれてから細くなるのを防ぐ)
  useLayoutEffect(() => {
    const measured = item.strokes.map((_, index) => sampleOf(guideRefs.current[index]))
    setSamples(measured)
    setLineWidth(lineWidthOf(measured))
    setStrokeIndex(0)
    setReached(0)
    tracingRef.current = false
  }, [item])

  const current = samples[strokeIndex]

  /** 画面の座標をお手本の座標系へ。SVG は正方形なので縦横とも同じ比率で割る */
  const pointOf = (event: ReactPointerEvent): Point | null => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect?.width) return null
    return {
      x: ((event.clientX - rect.left) / rect.width) * VIEW_BOX,
      y: ((event.clientY - rect.top) / rect.height) * VIEW_BOX,
    }
  }

  const onPointerDown = (event: ReactPointerEvent) => {
    if (frozen || !current?.points.length) return
    const point = pointOf(event)
    if (!point) return

    /*
     * 始められるのは「まだ進んでいないところ」まで。
     *
     * いま光っている丸の上だけにすると、途中で指を離した子が線の最初から
     * 引き直したときに何も起きない。指を置いたところまで戻して、そこから続ける。
     * 逆に、進んだ先(まだなぞっていない側)からは始められない。
     * そこを許すと終点だけ触ってごまかせてしまう。
     */
    let from = -1
    let nearest = TOLERANCE * 1.6
    for (let i = 0; i <= reached; i++) {
      const gap = distance(point, current.points[i])
      if (gap <= nearest) {
        nearest = gap
        from = i
      }
    }
    if (from === -1) return

    event.currentTarget.setPointerCapture(event.pointerId)
    tracingRef.current = true
    if (from !== reached) setReached(from)
  }

  const onPointerMove = (event: ReactPointerEvent) => {
    if (!tracingRef.current || frozen || !current) return
    const point = pointOf(event)
    if (!point) return

    // 先読みぶんの中から、指にいちばん近い点まで進む。
    // 「届いている中でいちばん先」まで進めると、指より先に緑が伸びて見える
    // (直線では指の 2割ほど先まで塗れてしまう)。
    let next = reached
    let nearest = TOLERANCE
    const limit = Math.min(reached + LOOK_AHEAD, current.points.length - 1)
    for (let i = reached + 1; i <= limit; i++) {
      const gap = distance(point, current.points[i])
      if (gap <= nearest) {
        nearest = gap
        next = i
      }
    }
    if (next === reached) return

    if (next >= current.points.length - 1) {
      // このストロークは終わり。次は改めて書き始めてもらう(一筆ずつ区切る)
      tracingRef.current = false
      const isLast = strokeIndex >= samples.length - 1
      if (isLast) {
        setReached(next)
        onComplete()
      } else {
        setStrokeIndex(strokeIndex + 1)
        setReached(0)
      }
      return
    }

    setReached(next)
  }

  const endStroke = () => {
    tracingRef.current = false
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VIEW_BOX} ${VIEW_BOX}`}
      role="img"
      aria-label={`${item.label}をなぞる`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endStroke}
      onPointerCancel={endStroke}
      className="aspect-square w-full touch-none rounded-3xl border-2 border-bloom-200 bg-white select-none"
    >
      {/* 中心のめやす。字の大きさと位置をつかむための薄い十字 */}
      <line
        x1={VIEW_BOX / 2}
        y1="8"
        x2={VIEW_BOX / 2}
        y2={VIEW_BOX - 8}
        className="stroke-bloom-100"
        strokeWidth="0.8"
        strokeDasharray="4 4"
      />
      <line
        x1="8"
        y1={VIEW_BOX / 2}
        x2={VIEW_BOX - 8}
        y2={VIEW_BOX / 2}
        className="stroke-bloom-100"
        strokeWidth="0.8"
        strokeDasharray="4 4"
      />

      {/*
        お手本。まだなぞっていない線はグレーで置いておく。
        薄くするのは線ごとではなくまとめて(g の opacity)。線ごとに薄くすると、
        線が交わるところだけ重なって濃い点になり、そこに何かあるように見える。
      */}
      <g opacity="0.28">
        {item.strokes.map((d, index) => (
          <path
            key={`${item.id}-${index}`}
            ref={(element) => {
              guideRefs.current[index] = element
            }}
            d={d}
            fill="none"
            strokeWidth={lineWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-ink-400"
          />
        ))}
      </g>

      {/* なぞれたぶん。dash のずらしで「途中まで」を描く */}
      {item.strokes.map(
        (d, index) =>
          samples[index] && (
            <path
              key={`${item.id}-${index}`}
              d={d}
              fill="none"
              strokeWidth={lineWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="stroke-bloom-500"
              strokeDasharray={samples[index].length}
              strokeDashoffset={
                index < strokeIndex
                  ? 0
                  : index > strokeIndex
                    ? samples[index].length
                    : samples[index].length *
                      (1 - reached / Math.max(1, samples[index].points.length - 1))
              }
            />
          ),
      )}

      {/* 書き始めの目印。ここに指を置く、が一目で分かるように光らせる */}
      {!frozen && current?.points[reached] && (
        <circle
          cx={current.points[reached].x}
          cy={current.points[reached].y}
          r="6"
          className="fill-warm-500"
        >
          <animate
            attributeName="r"
            values="5;7.5;5"
            dur="1.4s"
            repeatCount="indefinite"
          />
        </circle>
      )}
    </svg>
  )
}
