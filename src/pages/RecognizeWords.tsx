import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { WORD_AUTO_MIN, readWord, render, type Stroke, type WordReading } from '@/features/recognize/word'
import { useNoTouchGesture } from '@/hooks/useNoTouchGesture'

/**
 * 英単語を1枚のキャンバスに書いて、どれくらい読めるかを測る(試し場の中の1画面。開発時だけ)。
 *
 * 出題の画面へ自動判定を入れる前に、次の3つを数字で見るためのもの。
 * - 区切り: 線を文字ごとに分けられたか(文字の数が答えと同じになったか)
 * - そのまま読む: 答えを知らずに読んで、単語が合ったか
 * - 答えを使う: 答えの文字数に合わせて分け直し、答えの各文字に見えるか。
 *   全部の字が AUTO_MIN 以上なら「自動でせいかい」にできる
 *
 * お題の単語は見せたまま書いてもらう(覚えているかではなく、読めるかを測るため)。
 */

/** 自動で「せいかい」にしてよい下限。出題の画面と同じ値を使う */
const AUTO_MIN = WORD_AUTO_MIN

/** 区切った文字を、描き直した絵と読み取りで並べる */
function Cells({ groups, labels }: { groups: Stroke[][]; labels: { text: string; good?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {groups.map((group, index) => (
        <div key={index} className="flex flex-col items-center">
          <canvas
            ref={(element) => {
              if (!element) return
              element.width = 120
              element.height = 120
              element.getContext('2d')?.putImageData(render(group), 0, 0)
            }}
            className="size-12 rounded border border-bloom-100 bg-white"
          />
          <span
            className={`text-xs font-bold ${
              labels[index]?.good === undefined ? '' : labels[index].good ? 'text-bloom-700' : 'text-warm-600'
            }`}
          >
            {labels[index]?.text}
          </span>
        </div>
      ))}
    </div>
  )
}

/** 描画バッファ。横長(5:2)。座標もこの大きさで持つ */
const WIDTH = 600
const HEIGHT = 240
const LINE_WIDTH = 5

const LOG_KEY = 'bloomstudy:dev:words:v1'
interface Attempt {
  word: string
  text: string
  /** 区切った文字の数 */
  groups: number
  exact: boolean
  /** 答えの字のうち、いちばん低い確からしさ(文字の数が違えば null) */
  lowest: number | null
  /** 単語の候補の1位 */
  top: string | null
  strokes: Stroke[]
  at: string
  /** 書いた人(記号)。この欄を作る前のものには無い */
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

const rate = (hits: number, total: number) => (total ? `${Math.round((hits / total) * 100)}%` : '—')

export function RecognizeWords({ writer }: { writer: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useNoTouchGesture(canvasRef)
  const strokesRef = useRef<Stroke[]>([])
  const drawingRef = useRef(false)
  const [lexicon, setLexicon] = useState<string[]>([])
  const [answers, setAnswers] = useState<string[]>([])
  const [word, setWord] = useState<string | null>(null)
  const [reading, setReading] = useState<WordReading | null>(null)
  const [log, setLog] = useState<Attempt[]>(readLog)
  const [sent, setSent] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void import('@/data/questions.english.generated.json').then((module) => {
      if (!active) return
      const questions = module.default.questions as { answer: string; acceptableAnswers?: string[] }[]
      const all = questions.map((question) => question.answer)
      setAnswers(all)
      // 候補には、別解として認めている単語も入れる(実際の答え合わせで出てくる単語)
      setLexicon([...all, ...questions.flatMap((question) => question.acceptableAnswers ?? [])])
      setWord(all[Math.floor(Math.random() * all.length)])
    })
    return () => {
      active = false
    }
  }, [])

  const contextOf = () => {
    const canvas = canvasRef.current
    if (!canvas) return null
    if (canvas.width !== WIDTH) {
      canvas.width = WIDTH
      canvas.height = HEIGHT
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
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
    }
  }

  const clear = () => {
    contextOf()?.clearRect(0, 0, WIDTH, HEIGHT)
    strokesRef.current = []
    setReading(null)
  }

  const nextWord = () => {
    clear()
    setWord(answers[Math.floor(Math.random() * answers.length)])
  }

  const read = async () => {
    if (!word || strokesRef.current.length === 0 || reading) return
    const strokes = strokesRef.current.map((stroke) => [...stroke])
    const found = await readWord(strokes, word, lexicon)
    setReading(found)
    const lowest = found.expected ? Math.min(...found.expected.map((entry) => entry.score)) : null
    const next = [
      ...log,
      {
        word,
        text: found.text,
        groups: found.letters.length,
        exact: found.text === word,
        lowest,
        top: found.words[0]?.word ?? null,
        strokes,
        at: new Date().toISOString(),
        writer: writer || undefined,
      },
    ]
    setLog(next)
    writeLog(next)
  }

  // 成功率は、いま書いている人の分だけで出す(1台を何人かで回して使うときに混ざらないように)
  const mine = log.filter((attempt) => (attempt.writer ?? '') === writer)
  const lengthOk = mine.filter((attempt) => attempt.groups === attempt.word.length).length
  const exact = mine.filter((attempt) => attempt.exact).length
  const auto = mine.filter((attempt) => attempt.lowest !== null && attempt.lowest >= AUTO_MIN).length
  const top = mine.filter((attempt) => attempt.top === attempt.word).length

  return (
    <section className="mt-4">
      <div className="flex items-end justify-between">
        <p className="text-sm text-ink-600">この単語を書いてください(1字ずつ離して)</p>
        <button type="button" onClick={nextWord} className="text-xs font-bold text-bloom-700 underline">
          別の単語
        </button>
      </div>
      <p className="mt-1 text-4xl font-bold tracking-wide">{word ?? '…'}</p>

      <canvas
        ref={canvasRef}
        onPointerDown={(event) => {
          if (reading) return
          const context = contextOf()
          if (!context) return
          event.preventDefault()
          event.currentTarget.setPointerCapture(event.pointerId)
          drawingRef.current = true
          const point = positionOf(event)
          strokesRef.current.push([point])
          context.beginPath()
          context.moveTo(point.x, point.y)
          context.lineTo(point.x + 0.1, point.y)
          context.stroke()
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
        aria-label="英単語を書くところ"
        className="mt-3 aspect-[5/2] w-full touch-none select-none rounded-2xl border-2 border-dashed border-bloom-200 bg-white"
      />

      {reading && word && (
        <div className="mt-3 rounded-2xl bg-base-100 p-3">
          <p className="text-xs text-ink-400">そのまま読む(すき間で区切る)</p>
          <div className="mt-1">
            <Cells
              groups={reading.groups}
              labels={reading.letters.map((guesses) => ({ text: `${guesses[0]?.label} ${guesses[0]?.score.toFixed(2)}` }))}
            />
          </div>

          <p className="mt-3 text-xs text-ink-400">答えに合わせて区切る</p>
          <div className="mt-1">
            {reading.aligned && reading.expected ? (
              <Cells
                groups={reading.aligned}
                labels={reading.expected.map((entry) => ({
                  text: `${entry.letter} ${entry.score.toFixed(2)}`,
                  good: entry.score >= AUTO_MIN,
                }))}
              />
            ) : (
              <p className="text-sm">線が答えの文字数より少ない(つなげて書いた字がある)</p>
            )}
          </div>

          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-ink-400">区切り</dt>
            <dd>
              {reading.letters.length}文字(答えは {word.length}文字)
              {reading.letters.length === word.length ? ' ○' : ' ×'}
            </dd>
            <dt className="text-ink-400">そのまま読む</dt>
            <dd>
              {reading.text} {reading.text === word ? '○' : '×'}
            </dd>
            <dt className="text-ink-400">答えを使う</dt>
            <dd>
              {reading.expected
                ? Math.min(...reading.expected.map((entry) => entry.score)) >= AUTO_MIN
                  ? '自動でせいかいにできる'
                  : '迷う(自己申告へ)'
                : '分けられない(自己申告へ)'}
            </dd>
            <dt className="text-ink-400">単語の候補</dt>
            <dd>
              {reading.words.map((entry) => `${entry.word} ${entry.score.toFixed(2)}`).join(' / ') || '—'}
            </dd>
          </dl>
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
        {reading ? (
          <button type="button" onClick={nextWord} className="min-h-14 flex-2 rounded-full bg-bloom-700 font-bold text-white">
            次の単語
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
          {writer ? `${writer} さんの` : ''}これまで {mine.length}語
          {mine.length !== log.length && (
            <span className="ml-2 text-xs font-normal text-ink-400">(この端末で全部 {log.length}語)</span>
          )}
        </h2>
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-y-1">
          <dt className="text-ink-600">区切りが合った</dt>
          <dd>{rate(lengthOk, mine.length)}</dd>
          <dt className="text-ink-600">そのまま読んで合った</dt>
          <dd>{rate(exact, mine.length)}</dd>
          <dt className="text-ink-600">答えを使って自動でせいかい</dt>
          <dd>{rate(auto, mine.length)}</dd>
          <dt className="text-ink-600">単語の候補の1位が合った</dt>
          <dd>{rate(top, mine.length)}</dd>
        </dl>

        <div className="mt-3 flex gap-3">
          {/* 書いた線を開発サーバーへ送る(区切り方や読み方を変えたとき、同じ字で測り直すため) */}
          <button
            type="button"
            onClick={() => {
              void fetch('/dev/words', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(log),
              })
                .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
                .then((result: { saved: number }) => setSent(`送った(手元に ${result.saved}語)`))
                .catch((error) => setSent(`送れなかった: ${String(error)}`))
            }}
            className="min-h-11 flex-1 rounded-full border-2 border-bloom-700 text-xs font-bold text-bloom-700"
          >
            送る
          </button>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm('英単語の記録を全部消します')) return
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
