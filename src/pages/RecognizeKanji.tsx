import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  autoAccepts,
  compareKanji,
  fitted,
  kanjiDistance,
  kanjiShapes,
  modelStrokes,
  type KanjiCandidate,
} from '@/features/recognize/kanji'
import type { Point, Stroke } from '@/features/recognize/word'
import { useNoTouchGesture } from '@/hooks/useNoTouchGesture'

/**
 * 漢字を書いて、答えの漢字の形になっているかを測る(試し場の中の1画面。開発時だけ)。
 *
 * 出題の画面へ自動判定を入れる前に、次の2つを数字で見るためのもの。
 * - 正しく書いた字が、答えの漢字にいちばん近くなるか(似た漢字より近いか)
 * - **似た漢字をわざと書いたとき**(お題は末、書くのは未)、答えの漢字にいちばん近くならないか
 *   (間違って「せいかい」にしてしまわないか)
 *
 * お題の漢字は見せたまま書いてもらう(覚えているかではなく、形が合っているかを測るため)。
 * 書き順と画数は問わない。
 */

/** 描画バッファ。正方形 */
const SIZE = 360
const LINE_WIDTH = 8

const LOG_KEY = 'bloomstudy:dev:kanji:v1'
interface Attempt {
  /** 比べた相手(出題の答え) */
  answer: string
  /** 実際に書いた字。ふつうは answer、似た字テストでは似た漢字 */
  wrote: string
  /** 近い順(線と絵を合わせた値で)に並べた候補の先頭 */
  nearest: string | null
  candidates: KanjiCandidate[]
  strokes: Stroke[]
  at: string
  writer?: string
}

function readLog(): Attempt[] {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]') as Attempt[]
  } catch {
    return []
  }
}

function writeLog(log: Attempt[]) {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(log))
  } catch {
    // 入りきらなければ記録しないだけ
  }
}

/** 並べるための離れ具合(出題の画面の判定と同じもの) */
const combined = kanjiDistance

const rate = (hits: number, total: number) => (total ? `${Math.round((hits / total) * 100)}%` : '—')

export function RecognizeKanji({ writer }: { writer: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useNoTouchGesture(canvasRef)
  const strokesRef = useRef<Stroke[]>([])
  const drawingRef = useRef(false)
  const [answers, setAnswers] = useState<string[]>([])
  const [similarOf, setSimilarOf] = useState<Record<string, string[]>>({})
  /** 似た字テスト: お題とは別の、似た漢字をわざと書く */
  const [decoy, setDecoy] = useState(false)
  const [target, setTarget] = useState<{ answer: string; wrote: string } | null>(null)
  const [result, setResult] = useState<{ candidates: KanjiCandidate[]; overlay: { model: Point[][]; mine: Point[][] } } | null>(null)
  const [log, setLog] = useState<Attempt[]>(readLog)
  const [sent, setSent] = useState<string | null>(null)

  const pickTarget = (pool: string[], similar: Record<string, string[]>, asDecoy: boolean) => {
    const candidates = asDecoy ? pool.filter((char) => similar[char]?.length) : pool
    const answer = candidates[Math.floor(Math.random() * candidates.length)]
    const others = similar[answer] ?? []
    const wrote = asDecoy && others.length ? others[Math.floor(Math.random() * others.length)] : answer
    return { answer, wrote }
  }

  useEffect(() => {
    let active = true
    void Promise.all([import('@/data/questions.kanji.generated.json'), kanjiShapes()]).then(([module, shapes]) => {
      if (!active) return
      const all = [...new Set((module.default.questions as { answer: string }[]).map((question) => question.answer))]
      setAnswers(all)
      setSimilarOf(shapes.similar)
      setTarget(pickTarget(all, shapes.similar, false))
    })
    return () => {
      active = false
    }
  }, [])

  const contextOf = () => {
    const canvas = canvasRef.current
    if (!canvas) return null
    if (canvas.width !== SIZE) {
      canvas.width = SIZE
      canvas.height = SIZE
    }
    const context = canvas.getContext('2d')
    if (!context) return null
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.lineWidth = LINE_WIDTH
    context.strokeStyle = '#23292B'
    return context
  }

  const positionOf = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * SIZE,
      y: ((event.clientY - rect.top) / rect.height) * SIZE,
    }
  }

  const clear = () => {
    contextOf()?.clearRect(0, 0, SIZE, SIZE)
    strokesRef.current = []
    setResult(null)
  }

  const next = (asDecoy = decoy) => {
    clear()
    setTarget(pickTarget(answers, similarOf, asDecoy))
  }

  const read = async () => {
    if (!target || strokesRef.current.length === 0 || result) return
    const strokes = strokesRef.current.filter((stroke) => stroke.length > 1).map((stroke) => [...stroke])
    if (!strokes.length) return
    const candidates = (await compareKanji(strokes, target.answer)).sort((a, b) => combined(a) - combined(b))
    setResult({ candidates, overlay: { model: (await modelStrokes(target.answer)) ?? [], mine: fitted(strokes) } })
    const entry: Attempt = {
      answer: target.answer,
      wrote: target.wrote,
      nearest: candidates[0]?.char ?? null,
      candidates,
      strokes,
      at: new Date().toISOString(),
      writer: writer || undefined,
    }
    const nextLog = [...log, entry]
    setLog(nextLog)
    writeLog(nextLog)
  }

  // 成功率は、いま書いている人の分だけで出す
  const mine = log.filter((attempt) => (attempt.writer ?? '') === writer)
  const honest = mine.filter((attempt) => attempt.wrote === attempt.answer)
  const decoys = mine.filter((attempt) => attempt.wrote !== attempt.answer)

  return (
    <section className="mt-4">
      <div className="flex gap-2">
        {([false, true] as const).map((mode) => (
          <button
            key={String(mode)}
            type="button"
            onClick={() => {
              setDecoy(mode)
              next(mode)
            }}
            className={`min-h-11 flex-1 rounded-full border-2 px-4 text-sm font-bold ${
              decoy === mode ? 'border-bloom-700 bg-bloom-700 text-white' : 'border-bloom-200 text-ink-600'
            }`}
          >
            {mode ? '似た字テスト' : 'ふつう'}
          </button>
        ))}
      </div>

      {target && (
        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="text-sm text-ink-600">この漢字を書いてください</p>
            {/*
              お題(比べる相手)は読み終わるまで見せない。先に出していると、お題のほうを書いてしまう
              (酷に造を書くはずが、酷を書いていた)
            */}
            {target.wrote !== target.answer && (
              <p className="text-xs text-warm-600">
                {result ? `お題は「${target.answer}」でした。` : 'この字をそのまま書いてください。'}
                似た字を間違えて答えと読まないかを見ます
              </p>
            )}
          </div>
          <p className="text-6xl font-bold leading-none">{target.wrote}</p>
        </div>
      )}

      <canvas
        ref={canvasRef}
        onPointerDown={(event) => {
          if (result) return
          const context = contextOf()
          if (!context) return
          event.preventDefault()
          event.currentTarget.setPointerCapture(event.pointerId)
          drawingRef.current = true
          const point = positionOf(event)
          strokesRef.current.push([point])
          context.beginPath()
          context.moveTo(point.x, point.y)
        }}
        onPointerMove={(event) => {
          if (!drawingRef.current) return
          const context = contextOf()
          if (!context) return
          const point = positionOf(event)
          strokesRef.current.at(-1)?.push(point)
          context.lineTo(point.x, point.y)
          context.stroke()
        }}
        onPointerUp={() => {
          drawingRef.current = false
        }}
        onPointerCancel={() => {
          drawingRef.current = false
        }}
        aria-label="漢字を書くところ"
        className="mt-3 aspect-square w-full touch-none select-none rounded-2xl border-2 border-dashed border-bloom-200 bg-white"
      />

      {result && target && (
        <div className="mt-3 flex gap-3 rounded-2xl bg-base-100 p-3">
          {/* お手本(薄い緑)と書いた字(黒)を、同じ大きさにそろえて重ねる */}
          <canvas
            ref={(element) => {
              if (!element) return
              element.width = 160
              element.height = 160
              const context = element.getContext('2d')
              if (!context) return
              context.clearRect(0, 0, 160, 160)
              context.lineCap = 'round'
              context.lineJoin = 'round'
              const draw = (strokes: Point[][], color: string, width: number) => {
                context.strokeStyle = color
                context.lineWidth = width
                for (const stroke of strokes) {
                  context.beginPath()
                  stroke.forEach((p, index) =>
                    index ? context.lineTo(10 + p.x * 140, 10 + p.y * 140) : context.moveTo(10 + p.x * 140, 10 + p.y * 140),
                  )
                  context.stroke()
                }
              }
              draw(result.overlay.model, 'rgba(15,110,86,0.35)', 10)
              draw(result.overlay.mine, '#23292B', 3)
            }}
            className="size-28 shrink-0 rounded border border-bloom-100 bg-white"
          />
          <ol className="flex-1 text-sm">
            {result.candidates.slice(0, 5).map((candidate, index) => (
              <li
                key={candidate.char}
                className={`flex items-center justify-between ${candidate.char === target.answer ? 'font-bold text-bloom-700' : ''}`}
              >
                <span className="text-lg">
                  {index + 1}. {candidate.char}
                </span>
                <span className="text-xs text-ink-600">
                  線 {candidate.strokes.toFixed(3)} / 部品 {candidate.parts.toFixed(3)} / 絵 {candidate.image.toFixed(2)}
                  {candidate.char === target.answer &&
                    ` / 本数の差 ${candidate.strokeCountDiff} / 余り ${candidate.covered.toFixed(2)}`}
                </span>
              </li>
            ))}
            <li className="mt-1 text-xs text-ink-400">
              {autoAccepts(result.candidates, target.answer)
                ? '自動でせいかいになる'
                : result.candidates[0]?.char === target.answer
                  ? '答えがいちばん近いが、自動にはならない(近さか2番めとの差が足りない)'
                  : '答えより近い字がある'}
              (距離 {combined(result.candidates[0]).toFixed(2)})
            </li>
          </ol>
        </div>
      )}

      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={clear}
          className="min-h-14 flex-1 rounded-full border-2 border-bloom-200 font-bold text-ink-600"
        >
          消す
        </button>
        {result ? (
          <button
            type="button"
            onClick={() => next()}
            className="min-h-14 flex-2 rounded-full bg-bloom-700 font-bold text-white"
          >
            次の漢字
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void read()}
            className="min-h-14 flex-2 rounded-full bg-bloom-700 font-bold text-white"
          >
            読む
          </button>
        )}
      </div>

      <div className="mt-6 rounded-2xl bg-base-100 p-4 text-sm">
        <h2 className="font-bold">
          {writer ? `${writer} さんの` : ''}これまで {mine.length}字
          {mine.length !== log.length && (
            <span className="ml-2 text-xs font-normal text-ink-400">(この端末で全部 {log.length}字)</span>
          )}
        </h2>
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-y-1">
          <dt className="text-ink-600">正しく書いて、自動でせいかいになった</dt>
          <dd>
            {rate(honest.filter((attempt) => autoAccepts(attempt.candidates, attempt.answer)).length, honest.length)}
            <span className="ml-1 text-xs text-ink-400">({honest.length}字)</span>
          </dd>
          <dt className="text-ink-600">似た字を書いて、自動でせいかいになった(少ないほどよい)</dt>
          <dd>
            {rate(decoys.filter((attempt) => autoAccepts(attempt.candidates, attempt.answer)).length, decoys.length)}
            <span className="ml-1 text-xs text-ink-400">({decoys.length}字)</span>
          </dd>
        </dl>

        <div className="mt-3 flex gap-3">
          <button
            type="button"
            onClick={() => {
              void fetch('/dev/kanji', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(log),
              })
                .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
                .then((saved: { saved: number }) => setSent(`送った(手元に ${saved.saved}字)`))
                .catch((error) => setSent(`送れなかった: ${String(error)}`))
            }}
            className="min-h-11 flex-1 rounded-full border-2 border-bloom-700 text-xs font-bold text-bloom-700"
          >
            送る
          </button>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm('漢字の記録を全部消します')) return
              writeLog([])
              setLog([])
              setSent(null)
            }}
            className="min-h-11 flex-1 rounded-full border-2 border-bloom-200 text-xs font-bold text-ink-400"
          >
            記録を消す
          </button>
        </div>
        {sent && <p className="mt-2 text-xs text-ink-600">{sent}</p>}
      </div>
    </section>
  )
}
