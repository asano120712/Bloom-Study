import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { useCopy } from '@/hooks/useAudienceMode'

/** 書く場所1つぶん。筆算の位・商・こたえにそのまま対応する */
export interface WriteRow {
  /** 書く場所を見分ける名前。書いた字を残すために使う */
  key: string
  /** そこのマスの数 */
  boxes: number
  /**
   * 画面で何行めに並ぶか(省略すると1つずつ別の行)。
   *
   * たし算の位や、わり算の商は**横に1行で**並ぶ。まとめた画像でも
   * 同じ並びにしておかないと、答えが縦に割れて読めなくなる。
   */
  line?: number
}

interface BoxHandwritingProps {
  /** 書く場所。筆算のその並び順(左から、上から)で */
  rows: WriteRow[]
  /** マスの置き場所。書く場所の名前を渡すと、そこのマスが返る */
  form: (cellsOf: (key: string) => ReactNode) => ReactNode
  /** 書き終えたとき。書いたもの全体を1枚の画像で渡す */
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
 * **出すのは答えを書くマスだけ。** かけ算の部分積やわり算の引く段までマスにすると、
 * 答えを書く場所が埋もれて分からなくなり、縦にマスが3段・4段と積もって
 * 背の低い端末では画面からはみ出す。途中の計算は紙の余白と同じで、
 * 書く場所をこちらで決めない(読み取りもしないので、見る相手もいない)。
 *
 * マスの数は**答えが入りうる最大の桁数**で、答えの桁数ではない
 * (95 × 8 なら3マス。60 のような2桁の答えなら、右に寄せて2マス使う)。
 *
 * 判定は手書きと同じく自己申告。字の読み取りはしない。
 */
export function BoxHandwriting({ rows, form, onSubmit, disabled = false }: BoxHandwritingProps) {
  const copy = useCopy()
  /** 行の名前 → その行のマス。打ち終わった行の字も、ここに残って見えている */
  const canvases = useRef(new Map<string, (HTMLCanvasElement | null)[]>())
  const drawingRef = useRef(false)
  /** 何か書いたか。書く前に「かけた」を押させない */
  const [hasStroke, setHasStroke] = useState(false)

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

  /** 書いたものを全部消す。どのマスにも書けるので、消すほうも全部まとめて */
  const clear = () => {
    for (const cells of canvases.current.values()) {
      for (const canvas of cells) canvas?.getContext('2d')?.clearRect(0, 0, CELL, CELL)
    }
    setHasStroke(false)
  }

  /** 書いた字を1枚にまとめる。結果画面で見せるのは全体の1枚でよい */
  const exportImage = (): string => {
    // 同じ行のものは横に並べる(たし算の位、わり算の商は1行に並ぶ)
    const lineOf = (row: WriteRow, index: number) => row.line ?? index
    const lines = [...new Set(rows.map(lineOf))].sort((a, b) => a - b)
    const rowsIn = (line: number) => rows.filter((row, index) => lineOf(row, index) === line)
    const boxesIn = (line: number) => rowsIn(line).reduce((count, row) => count + row.boxes, 0)

    const width = Math.max(...lines.map(boxesIn)) * CELL
    const sheet = document.createElement('canvas')
    sheet.width = width
    sheet.height = CELL * lines.length
    const context = sheet.getContext('2d')
    if (!context) return ''
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, sheet.width, sheet.height)

    lines.forEach((line, top) => {
      // 右づめ。筆算は位をそろえて読むので、まとめた絵でもそろえておく
      let left = width - boxesIn(line) * CELL
      for (const row of rowsIn(line)) {
        const cells = canvases.current.get(row.key) ?? []
        for (let index = 0; index < row.boxes; index += 1) {
          const canvas = cells[index]
          if (canvas) context.drawImage(canvas, left + index * CELL, top * CELL)
        }
        left += row.boxes * CELL
      }
    })
    return sheet.toDataURL('image/png')
  }

  const cellsOf = (key: string): ReactNode => {
    const row = rows.find((entry) => entry.key === key)
    if (!row) return null

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
        onPointerDown={startStroke}
        onPointerMove={extendStroke}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onMouseDown={(event) => event.preventDefault()}
        draggable={false}
        aria-label={copy.handwriting.boxLabel(index + 1)}
        /*
          大きさは筆算側(ColumnForm)が決める --cell に合わせる。
          指で1字書ける大きさが要るが、画面からはみ出さないよう上限もそこで掛けている。
        */
        className="size-[var(--cell)] touch-none rounded-md border-2 border-dashed border-bloom-200 bg-white select-none"
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
