import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { VIEW_BOX } from '@/features/trace/box'
import { LINE_WIDTH, distance, lineWidthOf, sampleOf, type Point, type StrokeSample } from '@/features/trace/geometry'
import { judgeTrace, type TraceJudgement } from '@/features/trace/judge'
import { useCopy } from '@/hooks/useAudienceMode'
import { useNoTouchGesture } from '@/hooks/useNoTouchGesture'

interface FreeTraceCanvasProps {
  /** お手本の字(読み上げに使う) */
  label: string
  /** お手本の線(SVG のパス)。書き順どおりに並んでいる */
  strokes: string[]
  /** 「書けた」を押したとき。判定と、結果画面で見せる絵を渡す */
  onSubmit: (judgement: TraceJudgement, imageDataUrl: string) => void
}

/** 書いた線の太さ(お手本の座標系)。お手本より細くして、お手本の上をたどれているかが見えるようにする */
const INK_WIDTH = 3.5
/** 指の動きを点として拾う間隔。細かすぎると点が増えるだけで形は変わらない */
const MIN_STEP = 0.8

/** 結果画面の絵の色。絵は画面の外(画像)になるので、色の名前ではなく値で持つ */
const COLORS = { paper: '#ffffff', guide: '#8a9391', ink: '#23292b', off: '#c25a3e' }

/** 書き順の表示を覚えておく場所。端末ごとの好みなので、この端末にだけ残す */
const SHOW_ORDER_KEY = 'bloomstudy:trace-show-order:v1'

function readShowOrder(): boolean {
  try {
    return localStorage.getItem(SHOW_ORDER_KEY) !== 'off'
  } catch {
    return true
  }
}

function writeShowOrder(show: boolean): void {
  try {
    localStorage.setItem(SHOW_ORDER_KEY, show ? 'on' : 'off')
  } catch {
    // 覚えられなくても、その場の切り替えは効いている
  }
}

const pathOf = (points: Point[]) =>
  points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join('')

/**
 * 結果画面で見せる絵。お手本を薄く敷き、ずれた画(と書けていない画)のお手本を赤で示し、
 * その上に自分の書いた線を重ねる。どの画を直せばよいかが、文を読まなくても分かる。
 */
function resultImageOf(strokes: string[], written: Point[][], judgement: TraceJudgement, width: number) {
  const guide = strokes
    .map((d, index) => {
      const off = judgement.checks[index]?.shape === 'off'
      return `<path d="${d}" stroke="${off ? COLORS.off : COLORS.guide}" stroke-opacity="${off ? 0.55 : 0.28}" stroke-width="${width}"/>`
    })
    .join('')
  const ink = written.map((points) => `<path d="${pathOf(points)}" stroke="${COLORS.ink}" stroke-width="${INK_WIDTH}"/>`).join('')
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_BOX} ${VIEW_BOX}">` +
    `<rect width="${VIEW_BOX}" height="${VIEW_BOX}" fill="${COLORS.paper}"/>` +
    `<g fill="none" stroke-linecap="round" stroke-linejoin="round">${guide}${ink}</g></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/**
 * 薄いお手本の上に、自分の手で書く入力(一般モードの漢字のなぞり書き)。
 *
 * こども向けのなぞり書き(TraceCanvas)と違い、書き始めの目印も「線に乗っている間だけ進む」
 * 仕組みも無い。紙の練習帳の薄い字の上に書くのと同じで、書き終えたら「書けた」で
 * お手本と1画ずつ比べ、形・向き・書き順を見る(features/trace/judge)。
 *
 * 書き順を表示しているあいだは、次に書く画だけを少し濃くし、書き始めに点を付ける。
 * 1画書くと次の画へ移る。答えを教えすぎる面もあるので、表示は切り替えられる(既定は表示)。
 */
export function FreeTraceCanvas({ label, strokes, onSubmit }: FreeTraceCanvasProps) {
  const copy = useCopy()
  const svgRef = useRef<SVGSVGElement>(null)
  useNoTouchGesture(svgRef)
  const guideRefs = useRef<(SVGPathElement | null)[]>([])
  const [samples, setSamples] = useState<StrokeSample[]>([])
  const [lineWidth, setLineWidth] = useState(LINE_WIDTH.max)
  /** 書き終えた線 */
  const [written, setWritten] = useState<Point[][]>([])
  /** いま書いている線 */
  const [drawing, setDrawing] = useState<Point[] | null>(null)
  /** 次に書く画を示すか */
  const [showOrder, setShowOrder] = useState(readShowOrder)
  /** 次に書く画。書き終えた線の数で決める(1画戻すと、その画に戻る) */
  const next = written.length
  const nextStart = showOrder && next < strokes.length ? samples[next]?.points[0] : undefined

  // お手本の線の長さと形は、描かれた要素からしか取れない。太さも決まるので描く前に測る
  useLayoutEffect(() => {
    const measured = strokes.map((_, index) => sampleOf(guideRefs.current[index]))
    setSamples(measured)
    setLineWidth(lineWidthOf(measured))
  }, [strokes])

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
    const point = pointOf(event)
    if (!point) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrawing([point])
  }

  const onPointerMove = (event: ReactPointerEvent) => {
    if (!drawing) return
    const point = pointOf(event)
    if (!point || distance(point, drawing[drawing.length - 1]) < MIN_STEP) return
    setDrawing([...drawing, point])
  }

  const endStroke = () => {
    if (!drawing) return
    setWritten((current) => [...current, drawing])
    setDrawing(null)
  }

  const submit = () => {
    const judgement = judgeTrace(
      samples.map((sample) => sample.points),
      written,
    )
    onSubmit(judgement, resultImageOf(strokes, written, judgement, lineWidth))
  }

  const buttonClass =
    'flex min-h-12 flex-1 items-center justify-center rounded-full border-2 border-bloom-200 text-sm font-bold text-ink-600 disabled:opacity-40'

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <p className="text-sm whitespace-pre-line text-ink-600">{copy.traceWrite.guide}</p>
        <label className="flex shrink-0 items-center gap-1 text-xs text-ink-600">
          <input
            type="checkbox"
            checked={showOrder}
            onChange={(event) => {
              setShowOrder(event.target.checked)
              writeShowOrder(event.target.checked)
            }}
            className="size-4 accent-bloom-700"
          />
          {copy.traceWrite.showOrder}
        </label>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_BOX} ${VIEW_BOX}`}
          role="img"
          aria-label={copy.traceWrite.canvas(label)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          // 正方形のまま、置き場所の高さにも幅にも収まる大きさにする
          className="aspect-square max-h-full w-full max-w-full touch-none rounded-3xl border-2 border-bloom-200 bg-white select-none"
        >
          {/* 中心のめやす。字の大きさと位置をつかむための薄い十字 */}
          <line x1={VIEW_BOX / 2} y1="8" x2={VIEW_BOX / 2} y2={VIEW_BOX - 8} className="stroke-bloom-100" strokeWidth="0.8" strokeDasharray="4 4" />
          <line x1="8" y1={VIEW_BOX / 2} x2={VIEW_BOX - 8} y2={VIEW_BOX / 2} className="stroke-bloom-100" strokeWidth="0.8" strokeDasharray="4 4" />

          {/* お手本。まとめて薄くする(線ごとに薄くすると、交わるところが濃い点になる) */}
          <g opacity="0.22">
            {strokes.map((d, index) => (
              <path
                key={`${label}-${index}`}
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

          {/* 次に書く画。お手本より濃く、緑で示す。書き始めの点で、どちらから書くかも分かる */}
          {nextStart && (
            <g>
              <path
                d={strokes[next]}
                fill="none"
                strokeWidth={lineWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="stroke-bloom-500"
                strokeOpacity="0.45"
              />
              <circle cx={nextStart.x} cy={nextStart.y} r={Math.max(3, lineWidth * 0.45)} className="fill-warm-500" />
            </g>
          )}

          {/* 自分の書いた線 */}
          <g fill="none" strokeWidth={INK_WIDTH} strokeLinecap="round" strokeLinejoin="round" className="stroke-ink-900">
            {[...written, ...(drawing ? [drawing] : [])].map((points, index) => (
              <path key={index} d={pathOf(points)} />
            ))}
          </g>
        </svg>
      </div>

      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => setWritten((current) => current.slice(0, -1))}
          disabled={written.length === 0}
          className={buttonClass}
        >
          {copy.traceWrite.undo}
        </button>
        <button type="button" onClick={() => setWritten([])} disabled={written.length === 0} className={buttonClass}>
          {copy.traceWrite.clear}
        </button>
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={written.length === 0 || samples.length === 0}
        className="flex min-h-14 shrink-0 items-center justify-center rounded-full bg-bloom-700 text-lg font-bold text-white disabled:bg-bloom-200"
      >
        {copy.handwriting.done}
      </button>
    </div>
  )
}
