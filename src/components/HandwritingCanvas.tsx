import { useCallback, useEffect, useRef, useState } from 'react'

interface HandwritingCanvasProps {
  /** 「かけた」を押したとき。自動判定は行わず、正解提示に進む */
  onSubmit: () => void
  disabled?: boolean
}

const LINE_WIDTH = 8
const STROKE_COLOR = '#23292B'

/**
 * 手書き入力キャンバス。外部ライブラリを使わず Canvas API のみで実装する。
 * OCR による自動判定は行わない(機能要件書 2.4 の通り自己申告方式)。
 */
export function HandwritingCanvas({ onSubmit, disabled = false }: HandwritingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const [hasStroke, setHasStroke] = useState(false)

  /** 表示サイズに合わせて描画バッファを取り直す(高解像度ディスプレイ対応) */
  const resize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    const ratio = window.devicePixelRatio || 1
    const { width, height } = canvas.getBoundingClientRect()
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    context.scale(ratio, ratio)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.lineWidth = LINE_WIDTH
    context.strokeStyle = STROKE_COLOR
  }, [])

  useEffect(() => {
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [resize])

  const positionOf = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const startStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drawingRef.current = true
    const { x, y } = positionOf(event)
    context.beginPath()
    context.moveTo(x, y)
    setHasStroke(true)
  }

  const extendStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    const { x, y } = positionOf(event)
    context.lineTo(x, y)
    context.stroke()
  }

  const endStroke = () => {
    drawingRef.current = false
  }

  const clear = () => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    setHasStroke(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <canvas
        ref={canvasRef}
        onPointerDown={startStroke}
        onPointerMove={extendStroke}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        aria-label="手書き入力エリア"
        className="h-64 w-full touch-none rounded-2xl border-2 border-bloom-200 bg-white"
      />
      <div className="flex gap-3">
        <button
          type="button"
          onClick={clear}
          disabled={disabled || !hasStroke}
          className="min-h-14 flex-1 rounded-full border-2 border-bloom-200 px-6 text-lg font-bold text-ink-600 disabled:text-ink-400"
        >
          けす
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || !hasStroke}
          className="min-h-14 flex-2 rounded-full bg-bloom-700 px-6 text-lg font-bold text-white disabled:bg-bloom-200"
        >
          かけた
        </button>
      </div>
    </div>
  )
}
