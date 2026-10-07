import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { useCopy } from '@/hooks/useAudienceMode'

interface BoxHandwritingProps {
  /** 並べるマスの数。答えが入りうる最大の桁数 */
  boxes: number
  /**
   * マスの置き場所。渡すと、筆算の線の下など好きな場所へ置ける。
   * 書くところと式を離すと、どこに書くのか分からなくなる。
   */
  form?: (cells: ReactNode) => ReactNode
  /** 「かけた」を押したとき。書いた字をつなげた1枚の画像を渡す */
  onSubmit: (imageDataUrl: string) => void
  disabled?: boolean
}

const LINE_WIDTH = 6
const STROKE_COLOR = '#23292B'
/** 1マスの描画バッファ。実寸より大きめに取って、拡大しても粗くならないようにする */
const CELL = 120

/**
 * マスに1字ずつ書く手書き入力。
 *
 * 大きなキャンバス1枚ではなく、筆算の答えを書く場所と同じ形のマスに書く。
 * 紙の筆算と同じで、位をそろえて1桁ずつ書く練習になる。
 *
 * マスの数は**答えが入りうる最大の桁数**で、答えの桁数ではない
 * (95 × 8 なら3マス。60 のような2桁の答えなら、右に寄せて2マス使う)。
 * 紙のマス目と同じで、上限が見えても答えは分からない。
 *
 * 判定は手書きと同じく自己申告。字の読み取りはしない。
 */
export function BoxHandwriting({ boxes, form, onSubmit, disabled = false }: BoxHandwritingProps) {
  const copy = useCopy()
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const drawingRef = useRef(false)
  const [hasStroke, setHasStroke] = useState(false)

  // 書いたものを保ったまま高解像度にする。マスは大きさが変わらないので1度だけでよい
  useEffect(() => {
    for (const canvas of canvasRefs.current) {
      if (!canvas || canvas.width === CELL) continue
      canvas.width = CELL
      canvas.height = CELL
      const context = canvas.getContext('2d')
      if (!context) continue
      context.lineCap = 'round'
      context.lineJoin = 'round'
      context.lineWidth = LINE_WIDTH
      context.strokeStyle = STROKE_COLOR
    }
  }, [boxes])

  /** 画面の座標を、そのマスの描画バッファの座標へ */
  const positionOf = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * CELL,
      y: ((event.clientY - rect.top) / rect.height) * CELL,
    }
  }

  const startStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (disabled) return
    const context = event.currentTarget.getContext('2d')
    if (!context) return
    event.preventDefault()
    window.getSelection()?.removeAllRanges()
    event.currentTarget.setPointerCapture(event.pointerId)
    drawingRef.current = true
    const { x, y } = positionOf(event)
    context.beginPath()
    context.moveTo(x, y)
    setHasStroke(true)
  }

  const extendStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return
    const context = event.currentTarget.getContext('2d')
    if (!context) return
    event.preventDefault()
    const { x, y } = positionOf(event)
    context.lineTo(x, y)
    context.stroke()
  }

  const endStroke = () => {
    drawingRef.current = false
  }

  const clear = () => {
    for (const canvas of canvasRefs.current) {
      canvas?.getContext('2d')?.clearRect(0, 0, CELL, CELL)
    }
    setHasStroke(false)
  }

  /** 書いた字を横につなげて1枚にする。結果画面で見せるのは全体の1枚でよい */
  const exportImage = (): string => {
    const sheet = document.createElement('canvas')
    sheet.width = CELL * boxes
    sheet.height = CELL
    const context = sheet.getContext('2d')
    if (!context) return ''
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, sheet.width, sheet.height)
    canvasRefs.current.forEach((canvas, index) => {
      if (canvas) context.drawImage(canvas, index * CELL, 0)
    })
    return sheet.toDataURL('image/png')
  }

  const cells = Array.from({ length: boxes }, (_, index) => (
    <canvas
      key={index}
      ref={(element) => {
        canvasRefs.current[index] = element
      }}
      onPointerDown={startStroke}
      onPointerMove={extendStroke}
      onPointerUp={endStroke}
      onPointerCancel={endStroke}
      onMouseDown={(event) => event.preventDefault()}
      draggable={false}
      aria-label={copy.handwriting.boxLabel(index + 1)}
      // 指で1字書ける大きさにする。数字のマス(1.15em)のままだと小さすぎて書けない
      className="size-[2em] touch-none rounded-md border-2 border-dashed border-bloom-200 bg-white select-none"
    />
  ))

  return (
    <div className="flex flex-col gap-3">
      {form ? form(cells) : <div className="flex justify-end gap-1">{cells}</div>}

      <div className="flex shrink-0 gap-3 text-base">
        <button
          type="button"
          onClick={clear}
          disabled={disabled || !hasStroke}
          className="min-h-14 flex-1 rounded-full border-2 border-bloom-200 px-6 font-bold text-ink-600 disabled:text-ink-400"
        >
          {copy.handwriting.clear}
        </button>
        <button
          type="button"
          onClick={() => onSubmit(exportImage())}
          disabled={disabled || !hasStroke}
          className="min-h-14 flex-2 rounded-full bg-bloom-700 px-6 font-bold text-white disabled:bg-bloom-200"
        >
          {copy.handwriting.done}
        </button>
      </div>
    </div>
  )
}
