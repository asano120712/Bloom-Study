import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { useCopy } from '@/hooks/useAudienceMode'

/** 書く場所1行ぶん。筆算の段・位・商にそのまま対応する */
export interface WriteRow {
  /** 行を見分ける名前。打ち終わった行の字を残すために使う */
  key: string
  /** その行のマスの数 */
  boxes: number
}

interface BoxHandwritingProps {
  /** 上から順に。最後の要素がいま書く行 */
  rows: WriteRow[]
  /** いま書く行が最後かどうか。最後なら「かけた」、途中なら「つぎの段へ」 */
  isLast: boolean
  /** 途中の行で押したときの文字 */
  nextLabel: string
  /** マスの置き場所。行の名前を渡すと、その行のマスが返る */
  form: (cellsOf: (key: string) => ReactNode) => ReactNode
  /** 途中の行を書き終えたとき */
  onNext: () => void
  /** 最後の行を書き終えたとき。書いたもの全体を1枚の画像で渡す */
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
 * **段のある筆算は、段ごとに書く。** 答えだけ書かせると、かけ算の部分積や
 * わり算の引く段を紙に書く手順が抜ける。書き終えた段はそのまま残るので、
 * 下の段を書くときに見ながら足せる(数字で打つときと同じ進み方)。
 *
 * マスの数は**答えが入りうる最大の桁数**で、答えの桁数ではない
 * (95 × 8 なら3マス。60 のような2桁の答えなら、右に寄せて2マス使う)。
 *
 * 判定は手書きと同じく自己申告。字の読み取りはしない。
 */
export function BoxHandwriting({
  rows,
  isLast,
  nextLabel,
  form,
  onNext,
  onSubmit,
  disabled = false,
}: BoxHandwritingProps) {
  const copy = useCopy()
  /** 行の名前 → その行のマス。打ち終わった行の字も、ここに残って見えている */
  const canvases = useRef(new Map<string, (HTMLCanvasElement | null)[]>())
  const drawingRef = useRef(false)
  /** 何か書いた行。書く前に次へ進ませない */
  const [drawnKey, setDrawnKey] = useState<string | null>(null)

  const activeKey = rows[rows.length - 1]?.key ?? ''
  const hasStroke = drawnKey === activeKey

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
    setDrawnKey(activeKey)
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

  /** 消すのは、いま書いている行だけ。打ち終わった段は紙と同じで残す */
  const clear = () => {
    for (const canvas of canvases.current.get(activeKey) ?? []) {
      canvas?.getContext('2d')?.clearRect(0, 0, CELL, CELL)
    }
    setDrawnKey(null)
  }

  /** 書いた字を1枚にまとめる。結果画面で見せるのは全体の1枚でよい */
  const exportImage = (): string => {
    const width = Math.max(...rows.map((row) => row.boxes)) * CELL
    const sheet = document.createElement('canvas')
    sheet.width = width
    sheet.height = CELL * rows.length
    const context = sheet.getContext('2d')
    if (!context) return ''
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, sheet.width, sheet.height)

    rows.forEach((row, line) => {
      const cells = canvases.current.get(row.key) ?? []
      // 右づめ。筆算は位をそろえて読むので、まとめた絵でもそろえておく
      const offset = width - row.boxes * CELL
      cells.forEach((canvas, index) => {
        if (canvas) context.drawImage(canvas, offset + index * CELL, line * CELL)
      })
    })
    return sheet.toDataURL('image/png')
  }

  const cellsOf = (key: string): ReactNode => {
    const row = rows.find((entry) => entry.key === key)
    if (!row) return null
    const isActive = key === activeKey

    return Array.from({ length: row.boxes }, (_, index) => (
      <canvas
        key={index}
        ref={(element) => {
          const list = canvases.current.get(key) ?? []
          list[index] = element
          canvases.current.set(key, list)
          if (element && element.width !== CELL) {
            element.width = CELL
            element.height = CELL
            const context = element.getContext('2d')
            if (context) {
              context.lineCap = 'round'
              context.lineJoin = 'round'
              context.lineWidth = LINE_WIDTH
              context.strokeStyle = STROKE_COLOR
            }
          }
        }}
        onPointerDown={isActive ? startStroke : undefined}
        onPointerMove={isActive ? extendStroke : undefined}
        onPointerUp={isActive ? endStroke : undefined}
        onPointerCancel={isActive ? endStroke : undefined}
        onMouseDown={(event) => event.preventDefault()}
        draggable={false}
        aria-label={copy.handwriting.boxLabel(index + 1)}
        /*
          指で1字書ける大きさにする。数字のマス(1.15em)のままだと小さすぎて書けない。
          書き終えた行は枠も下地も消して、書いた字だけが残るようにする
          (紙と同じで、マス目は書くときの目印でしかない)。
        */
        className={`size-[2em] touch-none rounded-md border-2 select-none ${
          isActive ? 'border-dashed border-bloom-200 bg-white' : 'border-transparent'
        }`}
      />
    ))
  }

  return (
    <div className="flex flex-col gap-3">
      {form(cellsOf)}

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
          onClick={() => {
            if (!isLast) {
              onNext()
              setDrawnKey(null)
              return
            }
            onSubmit(exportImage())
          }}
          disabled={disabled || !hasStroke}
          className="min-h-14 flex-2 rounded-full bg-bloom-700 px-6 font-bold text-white disabled:bg-bloom-200"
        >
          {isLast ? copy.handwriting.done : nextLabel}
        </button>
      </div>
    </div>
  )
}
