import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { useFitCell } from '@/hooks/useFitCell'
import { useCopy } from '@/hooks/useAudienceMode'
import { useNoTouchGesture } from '@/hooks/useNoTouchGesture'
import { EraserIcon, HandwritingTools } from '@/components/HandwritingTools'

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
  /**
   * 途中の計算(かけ算の段)。書く場所は出すが、まとめた画像には入れない。
   * 確認や結果の画面で見比べたいのは答えだけで、段まで並ぶと答えが小さく埋もれる。
   */
  scratch?: boolean
  /**
   * まとめた画像の中で置く位置(マス単位)。指定があると、行の右づめではなくここに置く。
   * 分数のように、整数を左・分子を上・分母を下に置く形は、行だけでは表せないため。
   * line は半分の位置(0.5)も取れる(帯分数の整数を、分子と分母の間の高さに置く)。
   */
  at?: { column: number; line: number }
  /** まとめた画像で、このマスの上に線を引く(分数の線) */
  ruleAbove?: boolean
  /**
   * 小数点を打てるようにする(小数の答えのマス)。マスとマスの間の右下をタップすると点が入る。
   * 小さな点は字の読み取りでは拾えないので、書くのではなく場所を選んでもらう。
   */
  decimalPoint?: boolean
  /**
   * 1つの書く場所を、何マスぶんの横幅にするか(既定は 1 = 正方形のマス)。
   * 文章題の式のように、記号まで含めて自由に書く場所に使う(読み取らないので、マスに分けなくてよい)。
   */
  span?: number
}

/** 書き終えたときに渡す、書く場所ごとのマスの絵 */
export interface WrittenRow {
  key: string
  cells: ImageData[]
  /** 小数点を打った場所。何マスめ(0始まり)の右か。打っていなければ null */
  point: number | null
}

interface BoxHandwritingProps {
  /** 書く場所。筆算のその並び順(左から、上から)で */
  rows: WriteRow[]
  /** マスの置き場所。書く場所の名前を渡すと、そこのマスが返る */
  form: (cellsOf: (key: string) => ReactNode) => ReactNode
  /**
   * 書き終えたとき。
   * 全体を1枚にした画像(結果画面で見せる)と、行ごとのマスの絵(読み取りに使う)を渡す。
   */
  onSubmit: (imageDataUrl: string, rows: WrittenRow[]) => void
  disabled?: boolean
}

const LINE_WIDTH = 6
const STROKE_COLOR = '#23292B'
/** 1マスの描画バッファ。実寸より大きめに取って、拡大しても粗くならないようにする */
const CELL = 120

/**
 * マスの大きさの下限と上限(px)。
 * 下限は指で1字書ける最小。上限は、タブレットのような広い画面でマスだけ大きくなりすぎないため。
 */
const FIT = { min: 32, max: 128 }

/**
 * マスに1字ずつ書く手書き入力。
 *
 * 大きなキャンバス1枚ではなく、筆算の答えを書く場所と同じ形のマスに書く。
 * 紙の筆算と同じで、位をそろえて1桁ずつ書く練習になる。
 *
 * どこにマスを出すか(答えだけか、途中の計算もか)は呼ぶ側が決める。
 * 途中の計算のマスは `scratch` を付けて渡すと、まとめた画像に入らない。
 *
 * マスの数は**答えが入りうる最大の桁数**で、答えの桁数ではない
 * (95 × 8 なら3マス。60 のような2桁の答えなら、右に寄せて2マス使う)。
 *
 * 読み取りと判定は呼ぶ側(QuizPage の judgeWritten)が、渡したマスの絵で行う。
 */
export function BoxHandwriting({ rows, form, onSubmit, disabled = false }: BoxHandwritingProps) {
  const copy = useCopy()
  /** 行の名前 → その行のマス。打ち終わった行の字も、ここに残って見えている */
  const canvases = useRef(new Map<string, (HTMLCanvasElement | null)[]>())
  const drawingRef = useRef(false)
  /**
   * 何か書いてあるマス(`行の名前:何マスめ`)。1マスずつ消せるので、どこが空になったかまで持つ。
   * 消しゴムを持ったとき、消せるマスにだけ印を出すので state にしてある。
   */
  const [written, setWritten] = useState<ReadonlySet<string>>(new Set())
  /** 何か書いたか。書く前に「かけた」を押させない */
  const hasStroke = written.size > 0
  /**
   * 消すモード。このあいだはマスをタップすると、そのマスだけが空になる。
   *
   * 全部まとめて消すと、合っていた桁まで書き直しになる。紙で消しゴムを当てるのと同じく
   * 消したいマスだけを選ばせる。書くのと同じ指の動きで消すと、書き始めと区別できないので
   * モードを分けた。
   */
  const [erasing, setErasing] = useState(false)
  /** 書く場所ごとの、小数点を打った場所(何マスめの右か) */
  const [points, setPoints] = useState<Record<string, number | null>>({})
  /** 筆算を置く場所。ここに入る最大の大きさにマスを広げる */
  const area = useRef<HTMLDivElement>(null)
  useFitCell(area, FIT)
  // マスは筆算の形の中に散らばるので、まとめて外の枠で止める
  useNoTouchGesture(area, 'canvas')

  /** 画面の座標を、そのマスの描画バッファの座標へ(横長の書く場所は、横の描画バッファも長い) */
  const positionOf = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  const startStroke = (event: ReactPointerEvent<HTMLCanvasElement>, cell: string) => {
    if (disabled) return
    const context = event.currentTarget.getContext('2d')
    if (!context) return
    event.preventDefault()
    window.getSelection()?.removeAllRanges()
    if (erasing) {
      eraseCell(event.currentTarget, cell)
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    drawingRef.current = true
    const { x, y } = positionOf(event)
    context.beginPath()
    context.moveTo(x, y)
  }

  const extendStroke = (event: ReactPointerEvent<HTMLCanvasElement>, cell: string) => {
    if (!drawingRef.current) return
    const context = event.currentTarget.getContext('2d')
    if (!context) return
    event.preventDefault()
    const { x, y } = positionOf(event)
    context.lineTo(x, y)
    context.stroke()
    // 書いたと数えるのは線を引いたとき。触れただけ(タップ)では何も残らないので数えない
    if (!written.has(cell)) setWritten((current) => new Set(current).add(cell))
  }

  const endStroke = () => {
    drawingRef.current = false
  }

  /** タップしたマスだけを空にする。消すものが無くなったら書くモードへ戻す */
  const eraseCell = (canvas: HTMLCanvasElement, cell: string) => {
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    const rest = new Set(written)
    rest.delete(cell)
    setWritten(rest)
    if (rest.size === 0) setErasing(false)
  }

  /** 行ごとのマスの絵。読み取りに渡す(1マス1字なので、切り出しが要らない) */
  const cellImages = (): WrittenRow[] =>
    rows.map((row) => ({
      key: row.key,
      cells: (canvases.current.get(row.key) ?? []).flatMap((canvas) => {
        const context = canvas?.getContext('2d')
        return context && canvas ? [context.getImageData(0, 0, canvas.width, canvas.height)] : []
      }),
      point: points[row.key] ?? null,
    }))

  /** 書いた字を1枚にまとめる。結果画面で見せるのは全体の1枚でよい */
  const exportImage = (): string =>
    rows.some((row) => row.at) ? exportPlaced() : exportLines()

  /** 位置の指定(at)どおりに置く。分数の答え */
  const exportPlaced = (): string => {
    const placed = rows.flatMap((row) => (row.at && !row.scratch ? [{ row, at: row.at }] : []))
    const sheet = document.createElement('canvas')
    sheet.width = Math.max(...placed.map(({ row, at }) => at.column + row.boxes)) * CELL
    sheet.height = Math.ceil(Math.max(...placed.map(({ at }) => at.line + 1))) * CELL
    const context = sheet.getContext('2d')
    if (!context) return ''
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, sheet.width, sheet.height)

    for (const { row, at } of placed) {
      const cells = canvases.current.get(row.key) ?? []
      cells.slice(0, row.boxes).forEach((canvas, index) => {
        if (canvas) context.drawImage(canvas, (at.column + index) * CELL, at.line * CELL)
      })
      if (row.ruleAbove) {
        context.fillStyle = STROKE_COLOR
        context.fillRect(at.column * CELL, at.line * CELL - LINE_WIDTH / 2, row.boxes * CELL, LINE_WIDTH)
      }
    }
    return sheet.toDataURL('image/png')
  }

  /** 行ごとに右づめで積む。筆算の答え */
  const exportLines = (): string => {
    // 同じ行のものは横に並べる(たし算の位、わり算の商は1行に並ぶ)
    // 途中の計算(かけ算の段)は入れない。見せるのは答えだけ
    const lineOf = (row: WriteRow, index: number) => row.line ?? index
    const shown = rows.flatMap((row, index) => (row.scratch ? [] : [{ row, line: lineOf(row, index) }]))
    const lines = [...new Set(shown.map((entry) => entry.line))].sort((a, b) => a - b)
    const rowsIn = (line: number) => shown.filter((entry) => entry.line === line).map((entry) => entry.row)
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
        // 打った小数点も、マスの間の右下に描く
        const point = points[row.key]
        if (row.decimalPoint && point !== null && point !== undefined) {
          context.fillStyle = STROKE_COLOR
          context.beginPath()
          context.arc(left + (point + 1) * CELL, (top + 0.85) * CELL, LINE_WIDTH * 1.3, 0, Math.PI * 2)
          context.fill()
        }
        left += row.boxes * CELL
      }
    })
    return sheet.toDataURL('image/png')
  }

  const cellsOf = (key: string): ReactNode => {
    const row = rows.find((entry) => entry.key === key)
    if (!row) return null

    const span = row.span ?? 1
    const canvasAt = (index: number) => {
      const cell = `${key}:${index}`
      const erasable = erasing && written.has(cell)
      return (
        <span key={index} className="relative flex">
          <canvas
            ref={(element) => {
              const list = canvases.current.get(key) ?? []
              list[index] = element
              canvases.current.set(key, list)
              if (element && element.width !== CELL * span) {
                element.width = CELL * span
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
            onPointerDown={(event) => startStroke(event, cell)}
            onPointerMove={(event) => extendStroke(event, cell)}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            onMouseDown={(event) => event.preventDefault()}
            draggable={false}
            aria-label={copy.handwriting.boxLabel(index + 1)}
            /*
              大きさは筆算側(ColumnForm)が決める --cell に合わせる。
              指で1字書ける大きさが要るが、画面からはみ出さないよう上限もそこで掛けている。
            */
            // 横長の書く場所は、高さは1マス、横は span マスぶん
            style={span > 1 ? { width: `calc(var(--cell) * ${span})` } : undefined}
            className={`h-[var(--cell)] w-[var(--cell)] touch-none rounded-md border-2 select-none ${
              // 消しゴムのあいだは枠を赤くする。書いてあるマスは色も付けて、タップすると消えることを見せる
              erasing ? 'border-warm-500' : 'border-dashed border-bloom-200'
            } ${erasable ? 'cursor-pointer bg-warm-100' : 'bg-white'}`}
          />
          {erasable && (
            <EraserIcon className="pointer-events-none absolute top-[calc(var(--cell)*0.06)] right-[calc(var(--cell)*0.06)] size-[calc(var(--cell)*0.34)] text-warm-600" />
          )}
        </span>
      )
    }

    if (!row.decimalPoint) return Array.from({ length: row.boxes }, (_, index) => canvasAt(index))

    // 小数点を打つ場所は、マスとマスの間の右下(紙で小数点を打つ場所)。いちばん右のマスの後ろには打たない
    const point = points[key] ?? null
    return Array.from({ length: row.boxes }, (_, index) => (
      <span key={index} className="relative flex">
        {canvasAt(index)}
        {index < row.boxes - 1 && (
          <button
            type="button"
            aria-label={copy.number.decimalPoint}
            aria-pressed={point === index}
            disabled={disabled}
            onClick={() =>
              setPoints((current) => ({ ...current, [key]: current[key] === index ? null : index }))
            }
            /*
              マスとマスの間の下の角(紙で小数点を打つ場所)に重ねる。マスの高さの内側に収める。
              下へはみ出すと、書く場所の外として切れて見えなくなるうえ、マスの大きさを測るときにも数えられない。
            */
            className="absolute -right-[calc(var(--cell)*0.2)] bottom-0 z-10 flex size-[calc(var(--cell)*0.4)] items-end justify-center pb-[calc(var(--cell)*0.04)]"
          >
            <span
              aria-hidden="true"
              className={`rounded-full ${
                point === index
                  ? 'size-[calc(var(--cell)*0.16)] bg-ink-900'
                  : 'size-[calc(var(--cell)*0.16)] border-2 border-bloom-400 bg-white'
              }`}
            />
          </button>
        )}
      </span>
    ))
  }

  return (
    /*
      ボタンの字も含めて、文字として選ばせない。書いている指がマスからはみ出して
      「けす」「かけた」に乗ると、iPhone がその字を選び始め(長押しの選択・拡大鏡)、
      書いている途中の線が止まってしまう。
    */
    <div className="flex h-full min-h-0 flex-col gap-3 select-none [-webkit-touch-callout:none]">
      {/* 残りの高さを全部使う。中の筆算は、ここに入る最大の大きさまで広がる */}
      <div ref={area} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        {form(cellsOf)}
      </div>

      <div className="flex shrink-0 gap-3 text-base">
        <HandwritingTools erasing={erasing} onChange={setErasing} canErase={hasStroke} disabled={disabled} />
        <button
          type="button"
          onClick={() => onSubmit(exportImage(), cellImages())}
          // 消している途中で出すと、消し残しに気づかないまま答えになる
          disabled={disabled || !hasStroke || erasing}
          className="min-h-14 flex-1 rounded-full bg-bloom-700 px-6 font-bold text-white disabled:bg-bloom-200"
        >
          {copy.handwriting.done}
        </button>
      </div>
    </div>
  )
}
