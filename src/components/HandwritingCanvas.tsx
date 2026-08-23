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

  /**
   * 表示サイズに合わせて描画バッファを取り直す(高解像度ディスプレイ対応)。
   *
   * canvas は width/height を代入した時点で中身が消えるため、
   * サイズが実際に変わったときだけ作り直し、書きかけの字は退避して描き戻す。
   * (画面回転やアドレスバーの開閉でも発火するので、素直に作り直すと字が消える)
   */
  const resize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ratio = window.devicePixelRatio || 1
    const { width, height } = canvas.getBoundingClientRect()
    if (!width || !height) return

    const nextWidth = Math.round(width * ratio)
    const nextHeight = Math.round(height * ratio)
    if (canvas.width === nextWidth && canvas.height === nextHeight) return

    const previous = canvas.width && canvas.height ? document.createElement('canvas') : null
    if (previous) {
      previous.width = canvas.width
      previous.height = canvas.height
      previous.getContext('2d')?.drawImage(canvas, 0, 0)
    }

    canvas.width = nextWidth
    canvas.height = nextHeight

    const context = canvas.getContext('2d')
    if (!context) return
    context.scale(ratio, ratio)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.lineWidth = LINE_WIDTH
    context.strokeStyle = STROKE_COLOR
    // scale 済みなので CSS ピクセルの座標系で描き戻す
    if (previous) context.drawImage(previous, 0, 0, width, height)
  }, [])

  useEffect(() => {
    resize()
    // window の resize はサイズが変わらない場面でも飛ぶため、要素の実寸を見る
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    return () => observer.disconnect()
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
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/*
        min-h-0 が要る。canvas は width/height 属性(デバイスピクセル値)が固有サイズになり、
        flex の min-height:auto がそれを下限にするため、付けないとボタンを画面外へ押し出す。
        高さの余りはこのキャンバスで吸収し、ボタンは shrink-0 で必ず残す。
      */}
      <canvas
        ref={canvasRef}
        onPointerDown={startStroke}
        onPointerMove={extendStroke}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        aria-label="手書き入力エリア"
        className="w-full min-h-0 flex-1 touch-none rounded-2xl border-2 border-bloom-200 bg-white"
      />
      <div className="flex shrink-0 gap-3">
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
