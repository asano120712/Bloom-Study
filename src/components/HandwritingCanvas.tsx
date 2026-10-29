import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useCopy } from '@/hooks/useAudienceMode'
import { useNoTouchGesture } from '@/hooks/useNoTouchGesture'
import { EraserArt, HandwritingTools } from '@/components/HandwritingTools'
import type { Point, Stroke } from '@/features/recognize/word'

interface HandwritingCanvasProps {
  /**
   * 「かけた」を押したとき。
   * 書いた字を結果画面で見せるため、キャンバスを PNG(dataURL)にして渡す。
   * メモ(memo)では使わない。*/
  onSubmit?: (imageDataUrl: string) => void
  /**
   * 計算のメモとして使う。答えではないので「かけた」の代わりに「全部消す」を出し、
   * 地を透明にする(紙の色と透け具合はメモの枠のほうで付ける)。
   * */
  memo?: boolean
  disabled?: boolean
}

const LINE_WIDTH = 8
const STROKE_COLOR = '#23292B'
/**
 * 消しゴムの太さ(書く線の何倍か)。指でこすって消すので、書く線よりかなり太くする。
 * 細いと、1画を消すのに何度もなぞることになる。
 */
const ERASER_SCALE = 4
/** 指先に出す消しゴムの絵の大きさ(px) */
const ERASER_ART = 44
/** 点 p から、線分 a-b までの距離 */
function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = dx * dx + dy * dy
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** LINE_WIDTH を決めたときの root font-size。index.css の clamp 下限と同じ値 */
const BASE_ROOT_FONT_SIZE = 16

/**
 * 画面の拡大率(root font-size)に合わせた線の太さ。
 *
 * キャンバスは rem 指定の枠いっぱいに広がるので、太さを 8px のままにすると
 * 大きなウィンドウでは字に対して線だけが細く見える。枠と同じ倍率で太くする。
 */
function scaledLineWidth(): number {
  const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
  if (!rootFontSize) return LINE_WIDTH
  return LINE_WIDTH * (rootFontSize / BASE_ROOT_FONT_SIZE)
}

/**
 * 手書き入力キャンバス。外部ライブラリを使わず Canvas API のみで実装する。
 * OCR による自動判定は行わない(機能要件書 2.4 の通り自己申告方式)。
 */
export function HandwritingCanvas({ onSubmit, memo = false, disabled = false }: HandwritingCanvasProps) {
  const copy = useCopy()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useNoTouchGesture(canvasRef)
  const drawingRef = useRef(false)
  const [hasStroke, setHasStroke] = useState(false)
  /**
   * 消しゴムのモード。このあいだは、指でこすったところだけが消える。
   *
   * 全部まとめて消すと、合っていた画まで書き直しになる。紙と同じく消しゴムで
   * 間違えたところだけ消せるようにする。書くのと同じ指の動きで消すので、モードを分けた。
   */
  const [erasing, setErasing] = useState(false)
  /**
   * 消しているあいだ指先についていく消しゴム。
   * 動くたびに描き直さないよう、state ではなく要素の位置を直接動かす。
   */
  const eraserRef = useRef<HTMLDivElement>(null)
  /**
   * 書いた線(キャンバスの CSS ピクセル)。英単語の自動判定で読む。
   * 消しゴムでこすったところは点を取り除き、そこで線を切る。絵だけ消して線を残すと、
   * 消したはずの字まで読んでしまう。
   */
  const strokesRef = useRef<Stroke[]>([])
  /** 消しゴムが前にいた場所。動いたあいだの道のりをまとめて消すため */
  const lastEraseRef = useRef<Point | null>(null)

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
    context.lineWidth = scaledLineWidth()
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

  /** 消しゴムを置く場所(キャンバスの中の座標)。消える丸の真ん中がここに来る */
  const placeEraser = (x: number, y: number) => {
    const eraser = eraserRef.current
    if (eraser) eraser.style.transform = `translate(${x}px, ${y}px)`
  }

  /**
   * 指先の消しゴムを動かす。
   * どこが消えるのかを、指を動かす前から見せるため。消える丸の大きさも消しゴムの太さと同じにしてある。
   */
  const moveEraser = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = positionOf(event)
    placeEraser(x, y)
  }

  /**
   * 「けす」を押したら、まず消しゴムをキャンバスの左下に置いて見せる。
   * 指を当てるまで何も出ないと、消しゴムに持ち替わったことに気づきにくいため。
   * 左下なのは、字の書かれやすい真ん中を隠さないため。
   * 指を離しても消しゴムはしまわず、紙の上と同じくその場に残す。
   */
  useLayoutEffect(() => {
    if (!erasing) return
    const height = canvasRef.current?.getBoundingClientRect().height
    if (!height) return
    // 丸の真ん中を、丸の半径と少しの余白ぶん内側に。消しゴムの絵は丸の右上に出るので、はみ出さない
    const inset = (scaledLineWidth() * ERASER_SCALE) / 2 + 16
    placeEraser(inset, height - inset)
  }, [erasing])

  /** 消しゴムが from から to へ動いたあいだに触れた線の点を取り除く */
  const eraseAlong = (to: Point) => {
    const from = lastEraseRef.current ?? to
    lastEraseRef.current = to
    // 消える丸の半径に、書いた線の太さの半分を足す(線の縁にかかっただけで絵からは消えるため)
    const reach = (scaledLineWidth() * ERASER_SCALE) / 2 + scaledLineWidth() / 2
    strokesRef.current = strokesRef.current.flatMap((stroke) => {
      const pieces: Stroke[] = [[]]
      for (const point of stroke) {
        if (distanceToSegment(point, from, to) <= reach) {
          if (pieces.at(-1)?.length) pieces.push([])
        } else {
          pieces.at(-1)?.push(point)
        }
      }
      return pieces.filter((piece) => piece.length > 0)
    })
  }

  const startStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return
    if (erasing) moveEraser(event)
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    // タッチの互換マウスイベントを止める
    event.preventDefault()
    // 書き始める前に残っている選択を消す。画面のどこかで反転したままだと、
    // 書いている字と重なって見えなくなる
    window.getSelection()?.removeAllRanges()
    event.currentTarget.setPointerCapture(event.pointerId)
    drawingRef.current = true
    // 消しゴムは「描いたところを透明に戻す」線として引く
    context.globalCompositeOperation = erasing ? 'destination-out' : 'source-over'
    context.lineWidth = scaledLineWidth() * (erasing ? ERASER_SCALE : 1)
    const { x, y } = positionOf(event)
    context.beginPath()
    context.moveTo(x, y)
    if (erasing) {
      // 触れただけでも、その場所は消す(長さ0の線は丸い先端だけが描かれる)
      context.lineTo(x, y)
      context.stroke()
      lastEraseRef.current = null
      eraseAlong({ x, y })
    } else {
      strokesRef.current.push([{ x, y }])
    }
  }

  const extendStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    // マウスは押していなくても、乗せているあいだは消しゴムがついてくる
    if (erasing && !disabled) moveEraser(event)
    if (!drawingRef.current) return
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    event.preventDefault()
    const { x, y } = positionOf(event)
    context.lineTo(x, y)
    context.stroke()
    if (erasing) {
      eraseAlong({ x, y })
    } else {
      strokesRef.current.at(-1)?.push({ x, y })
      // 書いたと数えるのは線を引いたとき。触れただけ(タップ)では何も残らないので数えない
      setHasStroke(true)
    }
  }

  const endStroke = () => {
    if (!drawingRef.current) return
    drawingRef.current = false
    // 消しゴムで全部消えたら、書くモードへ戻す(消すものが無いので)
    if (erasing && isBlank()) {
      setHasStroke(false)
      setErasing(false)
      strokesRef.current = []
    }
  }

  /** 何も書かれていないか。消しゴムで消し切ったかを見るため */
  const isBlank = (): boolean => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || !canvas.width || !canvas.height) return true
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] !== 0) return false
    return true
  }

  /**
   * マウスでなぞったときの範囲選択を止める。
   *
   * pointerdown の preventDefault では止まらない。マウス入力では互換マウスイベントが
   * 抑止されず、mousedown の既定動作(選択の開始)がそのまま走るため。
   * キャンバス上から始まった選択は、上のヒントや残り秒数まで伸びて青く反転する。
   */
  const preventSelection = (event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault()
  }

  /**
   * 書いた字を PNG にして返す。キャンバスの背景は透明なので、
   * 結果画面のどこに置いても読めるよう、白地に合成してから書き出す。
   */
  /** 全部消す(メモだけ)。答えのキャンバスでは消しゴムで部分ごとに消す */
  const clearAll = () => {
    const canvas = canvasRef.current
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    setHasStroke(false)
    setErasing(false)
  }

  const exportImage = (): string => {
    const canvas = canvasRef.current
    if (!canvas) return ''
    const flattened = document.createElement('canvas')
    flattened.width = canvas.width
    flattened.height = canvas.height
    const context = flattened.getContext('2d')
    if (!context) return canvas.toDataURL('image/png')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, flattened.width, flattened.height)
    context.drawImage(canvas, 0, 0)
    return flattened.toDataURL('image/png')
  }

  /** 消える丸の直径。消しゴムで引く線の太さと同じ */
  const eraserWidth = scaledLineWidth() * ERASER_SCALE

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 select-none">
      {/*
        min-h-0 が要る。canvas は width/height 属性(デバイスピクセル値)が固有サイズになり、
        flex の min-height:auto がそれを下限にするため、付けないとボタンを画面外へ押し出す。
        高さの余りはこのキャンバスで吸収し、ボタンは shrink-0 で必ず残す。
      */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <canvas
          ref={canvasRef}
          onPointerDown={startStroke}
          onPointerMove={extendStroke}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onMouseDown={preventSelection}
          draggable={false}
          aria-label={memo ? copy.quiz.memo : '手書き入力エリア'}
          // select-none: なぞったときに周りが範囲選択される(青い枠)のを防ぐ
          className={`w-full min-h-0 flex-1 touch-none select-none rounded-2xl border-2 ${
            memo ? 'bg-transparent' : 'bg-white'
          } ${
            // 消しゴムのあいだは枠を赤くする。マウスの矢印は、指先の消しゴムと重なるので消す
            erasing ? 'cursor-none border-warm-500' : 'border-bloom-200'
          }`}
        />
        {/* 指の当たったところが原点。消える丸を中心に置き、消しゴムはその右上に持たせる */}
        {erasing && (
          <div ref={eraserRef} aria-hidden="true" className="pointer-events-none absolute top-0 left-0">
            <span
              className="absolute -translate-1/2 rounded-full border-2 border-dashed border-warm-500 bg-warm-100/50"
              style={{ width: eraserWidth, height: eraserWidth }}
            />
            <EraserArt
              className="absolute"
              // 絵の左下の角(消しゴムの先)を、丸のふちの右上に当てる
              style={{
                width: ERASER_ART,
                height: ERASER_ART,
                left: eraserWidth * 0.35 - ERASER_ART * 0.2,
                top: -eraserWidth * 0.35 - ERASER_ART * 0.78,
              }}
            />
          </div>
        )}
      </div>
      <div className="flex shrink-0 gap-3">
        <HandwritingTools erasing={erasing} onChange={setErasing} canErase={hasStroke} disabled={disabled} />
        {memo ? (
          <button
            type="button"
            onClick={clearAll}
            disabled={disabled || !hasStroke}
            className="min-h-14 flex-1 rounded-full border-2 border-bloom-200 px-6 text-lg font-bold text-ink-600 disabled:text-ink-400"
          >
            {copy.quiz.memoClear}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onSubmit?.(exportImage())}
            // 消している途中で出すと、消し残しに気づかないまま答えになる
            disabled={disabled || !hasStroke || erasing}
            className="min-h-14 flex-1 rounded-full bg-bloom-700 px-6 text-lg font-bold text-white disabled:bg-bloom-200"
          >
            {copy.handwriting.done}
          </button>
        )}
      </div>
    </div>
  )
}
