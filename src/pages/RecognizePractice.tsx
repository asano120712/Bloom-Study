import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { guessWithPersonal, leaveOneOut, type Guess } from '@/features/recognize'
import { forgetAll, personalSamples, rememberSample } from '@/features/recognize/personal'
import { useNoTouchGesture } from '@/hooks/useNoTouchGesture'

/**
 * 練習して覚える(試し場の中の1画面。開発時だけ)。
 *
 * お題の字を出して書いてもらい、**読んでから**その字を自分の見本として覚える。
 * 先に読むので、正解率は「それまでに覚えた見本でどれだけ当たったか」になり、
 * 書くほど上がっていくかがそのまま見える。
 *
 * お題を見せて書いてもらうので、何を書いたかは確か。だから覚えてよい
 * (出題中の字は合っているとは限らないので、そちらでは覚えない)。
 */

const SETS = {
  letters: { name: '英字 a-z', labels: 'abcdefghijklmnopqrstuvwxyz'.split(''), base: 'letters' },
  digits: { name: '数字 0-9', labels: '0123456789'.split(''), base: 'digits' },
} as const
type SetId = keyof typeof SETS

/** 書くところの描画バッファ。本番のマス(BoxHandwriting)と同じ大きさにしてある */
const CELL = 120
const LINE_WIDTH = 6

/** 書いた結果の記録(開発用なので localStorage で足りる)。正解率の移り変わりを見るため */
const LOG_KEY = 'bloomstudy:dev:practice:v1'
interface Attempt {
  set: SetId
  label: string
  guessed: string | null
  hit: boolean
  /** そのとき覚えていた、その字の見本の枚数 */
  known: number
  at: string
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

/** 次のお題。見本のいちばん少ない字から(同じ枚数なら、ばらばらに) */
function nextLabel(labels: readonly string[], counts: Map<string, number>, previous?: string): string {
  const pool = labels.filter((label) => label !== previous)
  const fewest = Math.min(...pool.map((label) => counts.get(label) ?? 0))
  const picks = pool.filter((label) => (counts.get(label) ?? 0) === fewest)
  return picks[Math.floor(Math.random() * picks.length)]
}

/** 字ごとの、覚えた見本の枚数 */
function countsOf(samples: { label: string }[], labels: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const sample of samples) {
    if (labels.includes(sample.label)) counts.set(sample.label, (counts.get(sample.label) ?? 0) + 1)
  }
  return counts
}

export function RecognizePractice() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useNoTouchGesture(canvasRef)
  const drawingRef = useRef(false)
  const [setId, setSetId] = useState<SetId>('letters')
  const set = SETS[setId]
  /** 字ごとの、覚えた見本の枚数 */
  const [counts, setCounts] = useState<Map<string, number>>(new Map())
  const [target, setTarget] = useState<string>(set.labels[0])
  const [result, setResult] = useState<{ guesses: Guess[]; hit: boolean } | null>(null)
  const [remember, setRemember] = useState(true)
  const [log, setLog] = useState<Attempt[]>(readLog)
  const [checked, setChecked] = useState<string | null>(null)

  const refreshCounts = async (labels: readonly string[]) => {
    const next = countsOf(await personalSamples(), labels)
    setCounts(next)
    return next
  }

  useEffect(() => {
    let active = true
    void personalSamples().then((samples) => {
      if (!active) return
      const next = countsOf(samples, set.labels)
      setCounts(next)
      setTarget(nextLabel(set.labels, next))
    })
    return () => {
      active = false
    }
  }, [set])

  const contextOf = () => {
    const canvas = canvasRef.current
    if (!canvas) return null
    if (canvas.width !== CELL) {
      canvas.width = CELL
      canvas.height = CELL
    }
    const context = canvas.getContext('2d', { willReadFrequently: true })
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
      x: ((event.clientX - rect.left) / rect.width) * CELL,
      y: ((event.clientY - rect.top) / rect.height) * CELL,
    }
  }

  const clear = () => {
    contextOf()?.clearRect(0, 0, CELL, CELL)
    setResult(null)
  }

  /** 答え合わせ。読んでから覚える(覚えた字で自分を読むと、必ず当たってしまう) */
  const check = async () => {
    const context = contextOf()
    if (!context || result) return
    const image = context.getImageData(0, 0, CELL, CELL)
    const guesses = await guessWithPersonal(image, [...set.labels], set.base)
    if (guesses.length === 0) return // 何も書いていない
    const hit = guesses[0].label === target
    setResult({ guesses: guesses.slice(0, 3), hit })

    const next = [
      ...log,
      { set: setId, label: target, guessed: guesses[0].label, hit, known: counts.get(target) ?? 0, at: new Date().toISOString() },
    ]
    setLog(next)
    writeLog(next)

    if (remember) {
      await rememberSample(target, image)
      await refreshCounts(set.labels)
    }
  }

  const goNext = () => {
    clear()
    setTarget(nextLabel(set.labels, counts, target))
  }

  const mine = log.filter((attempt) => attempt.set === setId)
  const recent = mine.slice(-20)
  const recentRate = recent.length ? Math.round((recent.filter((a) => a.hit).length / recent.length) * 100) : null
  const known = [...counts.values()].reduce((sum, count) => sum + count, 0)

  return (
    <section className="mt-4">
      <div className="flex gap-2">
        {(Object.keys(SETS) as SetId[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              clear()
              setChecked(null)
              setSetId(id)
            }}
            className={`min-h-11 flex-1 rounded-full border-2 px-4 text-sm font-bold ${
              setId === id ? 'border-bloom-700 bg-bloom-700 text-white' : 'border-bloom-200 text-ink-600'
            }`}
          >
            {SETS[id].name}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-end justify-between">
        <p className="text-sm text-ink-600">
          この字を書いてください
          <span className="ml-2 text-xs text-ink-400">(見本 {counts.get(target) ?? 0}枚)</span>
        </p>
        <p className="text-5xl font-bold leading-none">{target}</p>
      </div>

      <canvas
        ref={canvasRef}
        onPointerDown={(event) => {
          if (result) return
          const context = contextOf()
          if (!context) return
          event.preventDefault()
          event.currentTarget.setPointerCapture(event.pointerId)
          drawingRef.current = true
          const { x, y } = positionOf(event)
          context.beginPath()
          context.moveTo(x, y)
        }}
        onPointerMove={(event) => {
          if (!drawingRef.current) return
          const context = contextOf()
          if (!context) return
          const { x, y } = positionOf(event)
          context.lineTo(x, y)
          context.stroke()
        }}
        onPointerUp={() => {
          drawingRef.current = false
        }}
        onPointerCancel={() => {
          drawingRef.current = false
        }}
        aria-label="お題の字を書くところ"
        className="mt-3 aspect-square w-full touch-none select-none rounded-2xl border-2 border-dashed border-bloom-200 bg-white"
      />

      {result && (
        <div className={`mt-3 rounded-2xl px-4 py-3 ${result.hit ? 'bg-bloom-100' : 'bg-warm-100'}`}>
          <p className="font-bold">{result.hit ? '読めた' : `「${result.guesses[0]?.label}」と読んだ`}</p>
          <ul className="mt-1 flex gap-3 text-sm text-ink-600">
            {result.guesses.map((entry) => (
              <li key={entry.label}>
                {entry.label} {entry.score.toFixed(2)}
                {entry.source === 'personal' ? '(自分の字)' : ''}
              </li>
            ))}
          </ul>
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
            onClick={goNext}
            className="min-h-14 flex-2 rounded-full bg-bloom-700 font-bold text-white"
          >
            次へ
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void check()}
            className="min-h-14 flex-2 rounded-full bg-bloom-700 font-bold text-white"
          >
            答え合わせ
          </button>
        )}
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-ink-600">
        <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
        書いた字を自分の見本として覚える(外すと、覚えずに試すだけ)
      </label>

      <div className="mt-6 rounded-2xl bg-base-100 p-4">
        <h2 className="text-sm font-bold">
          正解率 {recentRate === null ? '—' : `${recentRate}%`}
          <span className="ml-2 text-xs font-normal text-ink-400">
            最近 {recent.length}回 / 覚えた見本 {known}枚
          </span>
        </h2>

        {/* 字ごと: 上が見本の枚数、下がその字の正解率。苦手な字が赤くなる */}
        <div className="mt-3 grid grid-cols-6 gap-2 sm:grid-cols-9">
          {set.labels.map((label) => {
            const tries = mine.filter((attempt) => attempt.label === label)
            const hits = tries.filter((attempt) => attempt.hit).length
            const rate = tries.length ? hits / tries.length : null
            return (
              <div
                key={label}
                className={`flex flex-col items-center rounded-lg border-2 py-1 ${
                  rate === null ? 'border-bloom-100' : rate >= 0.8 ? 'border-bloom-400' : 'border-warm-500'
                }`}
              >
                <span className="text-lg font-bold leading-tight">{label}</span>
                <span className="text-[10px] text-ink-400">{counts.get(label) ?? 0}枚</span>
                <span className="text-[10px] text-ink-600">
                  {rate === null ? '—' : `${hits}/${tries.length}`}
                </span>
              </div>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() =>
            void leaveOneOut([...set.labels], set.base).then(({ total, hits }) =>
              setChecked(total ? `覚えた見本 ${total}枚を1枚ずつ伏せて読むと ${Math.round((hits / total) * 100)}%(${hits}/${total})` : '見本がまだありません'),
            )
          }
          className="mt-4 min-h-11 w-full rounded-full border-2 border-bloom-200 text-sm font-bold text-ink-600"
        >
          今の見本で正解率を測る
        </button>
        {checked && <p className="mt-2 text-xs text-ink-600">{checked}</p>}

        <button
          type="button"
          onClick={() => {
            if (!window.confirm('覚えた自分の字と、練習の記録を全部消します')) return
            void forgetAll().then(() => {
              writeLog([])
              setLog([])
              setChecked(null)
              void refreshCounts(set.labels)
            })
          }}
          className="mt-3 min-h-10 w-full rounded-full border-2 border-bloom-200 text-xs font-bold text-ink-400"
        >
          自分の字を全部忘れる
        </button>
      </div>
    </section>
  )
}
