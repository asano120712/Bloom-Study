import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { InputModeSheet } from '@/components/InputModeSheet'
import { GENRES } from '@/data/genres'
import type { Genre, InputMode } from '@/types'

export function GenreSelectPage() {
  const navigate = useNavigate()
  /** 入力方法を選んでいる最中のジャンル。null なら一覧だけ */
  const [pendingGenre, setPendingGenre] = useState<Genre | null>(null)

  const start = (mode: InputMode) => {
    if (!pendingGenre) return
    // 再読み込みや結果画面からの戻りでも保てるよう、入力方法は URL に持たせる
    navigate(`/quiz/${pendingGenre.id}?mode=${mode}`)
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">ジャンルをえらぶ</h1>
      <p className="mt-2 text-sm text-ink-600">ジャンルごとにヒントの出かたが変わります。</p>

      <ul className="mt-6 flex flex-col gap-4">
        {GENRES.map((genre) => (
          <li key={genre.id}>
            <button
              type="button"
              onClick={() => setPendingGenre(genre)}
              className="flex min-h-20 w-full flex-col justify-center rounded-3xl bg-bloom-100 px-5 py-4 text-left"
            >
              <span className="text-xl font-bold text-bloom-700">{genre.label}</span>
              <span className="mt-1 text-sm text-ink-600">{genre.description}</span>
            </button>
          </li>
        ))}
      </ul>

      <Link to="/" className="mt-8 text-center text-sm text-ink-400 underline">
        トップにもどる
      </Link>

      {pendingGenre && (
        <InputModeSheet
          genre={pendingGenre}
          onStart={start}
          onClose={() => setPendingGenre(null)}
        />
      )}
    </AppShell>
  )
}
