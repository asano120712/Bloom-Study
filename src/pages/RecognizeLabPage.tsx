import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AppShell } from '@/components/AppShell'
import { guessDigit, guessLetter, type Guess } from '@/features/recognize'
import { addSample, clearSamples, packInk, readSamples } from '@/features/recognize/samples'
import { useNoTouchGesture } from '@/hooks/useNoTouchGesture'
import { RecognizePractice } from './RecognizePractice'

/**
 * 読み取りの試し場(開発時だけ)。
 *
 * 書いた字が何に見えているかを、その場で並べて出す。
 * 自動判定を本番の画面へ入れる前に、**どれくらい当たるのか・どこで外すのか**を
 * 自分の字で確かめるための画面。出題にも記録にも関わらない。
 */
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('')

/** 書くところの描画バッファ。本番のマス(BoxHandwriting)と同じ大きさにしてある */
const CELL = 120
const LINE_WIDTH = 6

export function RecognizeLabPage() {
  /** practice = お題を書いて自分の字を覚える、try = 自由に書いて読み・外れた字を集める */
  const [tab, setTab] = useState<'practice' | 'try'>('practice')

  return (
    <AppShell>
      <h1 className="text-xl font-bold">読み取りの試し場</h1>
      <p className="mt-1 text-sm text-ink-600">開発用の画面です。書いた字は、この端末の外へは送りません。</p>

      <div className="mt-4 flex gap-1 rounded-full border-2 border-bloom-200 p-1">
        {(
          [
            ['practice', '練習して覚える'],
            ['try', '試す・外れた字を集める'],
          ] as const
        ).map(([id, name]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`min-h-10 flex-1 rounded-full text-sm font-bold ${
              tab === id ? 'bg-bloom-700 text-white' : 'text-ink-600'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {tab === 'practice' ? <RecognizePractice /> : <TryPanel />}
    </AppShell>
  )
}

/**
 * 自由に書いて、何に見えているかを並べる。外れた字は残して、共通のモデルの学習に回す
 * (こちらは「送る」で開発サーバーへ集める。練習の字とは別に、端末の中に置く)。
 */
function TryPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useNoTouchGesture(canvasRef)
  const drawingRef = useRef(false)
  const [candidates, setCandidates] = useState<'digits' | 'letters'>('digits')
  const [guesses, setGuesses] = useState<Guess[]>([])
  /** 「ほんとうは何を書いたか」。外れた字を残すときに使う */
  const [truth, setTruth] = useState('7')
  const [saved, setSaved] = useState(() => readSamples().length)
  /** 送った結果の知らせ。スマートフォンから試すので、画面に出ないと分からない */
  const [sent, setSent] = useState<string | null>(null)

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

  const read = () => {
    const context = contextOf()
    if (!context) return
    const image = context.getImageData(0, 0, CELL, CELL)
    // どちらも学習したモデルで読む(英字は EMNIST、数字は MNIST)
    const read = candidates === 'digits' ? guessDigit(image, DIGITS) : guessLetter(image, LETTERS)
    void read.then((found) => setGuesses(found.slice(0, 5)))
  }

  const clear = () => {
    contextOf()?.clearRect(0, 0, CELL, CELL)
    setGuesses([])
  }

  return (
    <>
      <div className="mt-4 flex gap-2">
        {(['digits', 'letters'] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => setCandidates(kind)}
            className={`min-h-11 flex-1 rounded-full border-2 px-4 text-sm font-bold ${
              candidates === kind
                ? 'border-bloom-700 bg-bloom-700 text-white'
                : 'border-bloom-200 text-ink-600'
            }`}
          >
            {kind === 'digits' ? '数字 0-9' : '英字 a-z'}
          </button>
        ))}
      </div>

      <canvas
        ref={canvasRef}
        onPointerDown={(event) => {
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
          read()
        }}
        onPointerCancel={() => {
          drawingRef.current = false
        }}
        className="mt-4 aspect-square w-full touch-none rounded-2xl border-2 border-dashed border-bloom-200 bg-white"
      />

      <ul className="mt-4 flex flex-col gap-2">
        {guesses.map((entry, index) => (
          <li
            key={entry.label}
            className={`flex items-center justify-between rounded-2xl px-4 py-3 ${
              index === 0 ? 'bg-bloom-100 font-bold' : 'bg-base-100'
            }`}
          >
            <span className="text-2xl">{entry.label}</span>
            <span className="text-sm text-ink-600">
              きょり {entry.distance.toFixed(2)} / score {entry.score.toFixed(3)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={clear}
          className="min-h-14 flex-1 rounded-full border-2 border-bloom-200 font-bold text-ink-600"
        >
          けす
        </button>
        <button
          type="button"
          onClick={read}
          className="min-h-14 flex-2 rounded-full bg-bloom-700 font-bold text-white"
        >
          よむ
        </button>
      </div>

      {/*
        外れた字を残す。何を書いたのかを選んでから「この字を残す」。
        送らずに端末の中(localStorage)へ置き、「書き出す」でまとめてファイルにする。
      */}
      <section className="mt-8 rounded-2xl bg-base-100 p-4">
        <h2 className="text-sm font-bold">外れた字を残す({saved}枚)</h2>

        <div className="mt-3 flex flex-wrap gap-2">
          {(candidates === 'digits' ? DIGITS : LETTERS).map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setTruth(label)}
              className={`flex size-10 items-center justify-center rounded-lg border-2 text-base font-bold ${
                truth === label ? 'border-bloom-700 bg-bloom-700 text-white' : 'border-bloom-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex gap-3">
          <button
            type="button"
            onClick={() => {
              const context = contextOf()
              if (!context) return
              const image = context.getImageData(0, 0, CELL, CELL)
              setSaved(
                addSample({
                  label: truth,
                  size: CELL,
                  ink: packInk(image),
                  guessed: guesses[0]?.label,
                  score: guesses[0]?.score,
                  at: new Date().toISOString(),
                }).length,
              )
            }}
            className="min-h-12 flex-2 rounded-full border-2 border-bloom-700 text-sm font-bold text-bloom-700"
          >
            この字を「{truth}」として残す
          </button>
          {/*
            開発サーバーへ送る。スマートフォンで試すと、ブラウザからの書き出しは
            その端末の中に落ちてしまい、手元のプロジェクトに届かない。
          */}
          <button
            type="button"
            onClick={() => {
              const samples = readSamples()
              void fetch('/dev/samples', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(samples),
              })
                .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
                .then((result: { saved: number }) => setSent(`送った(手元に ${result.saved}枚)`))
                .catch((error) => setSent(`送れなかった: ${String(error)}`))
            }}
            className="min-h-12 flex-1 rounded-full border-2 border-bloom-200 text-sm font-bold text-ink-600"
          >
            送る
          </button>
        </div>

        {sent && <p className="mt-3 text-xs text-ink-600">{sent}</p>}

        <button
          type="button"
          onClick={() => {
            clearSamples()
            setSaved(0)
            setSent(null)
          }}
          className="mt-3 min-h-10 w-full rounded-full border-2 border-bloom-200 text-xs font-bold text-ink-400"
        >
          残したものを全部消す
        </button>
      </section>
    </>
  )
}
