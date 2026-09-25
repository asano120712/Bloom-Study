import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ActivityArt } from '@/components/ActivityArt'
import { AppShell } from '@/components/AppShell'
import { InputModeSheet } from '@/components/InputModeSheet'
import { activitiesFor, type Activity } from '@/data/activities'
import { findGenre, type AnswerChoice } from '@/data/genres'
import { useAudienceMode, useCopy } from '@/hooks/useAudienceMode'
import { TOP_PATH, type Difficulty, type Genre } from '@/types'

export function GenreSelectPage() {
  const navigate = useNavigate()
  const copy = useCopy()
  const mode = useAudienceMode()
  /** 入力方法を選んでいる最中のジャンル。null なら一覧だけ */
  const [pendingGenre, setPendingGenre] = useState<Genre | null>(null)

  const start = (difficulty: Difficulty, choice: AnswerChoice) => {
    if (!pendingGenre) return
    // 別画面のあそび(小1・小2の漢字)は、そのまま行き先へ
    if (choice.path) {
      navigate(choice.path)
      return
    }
    // 再読み込みや結果画面からの戻りでも保てるよう、こたえかたと難易度は URL に持たせる
    navigate(`/quiz/${pendingGenre.id}?mode=${choice.inputMode}&level=${difficulty}`)
  }

  /**
   * クイズはこたえかた・なんいどを選んでから始める。
   * あそびは選ぶものが無いので、押したらすぐ始める(小さい子ほど手数は少ないほうがいい)。
   */
  const open = (activity: Activity) => {
    if (activity.path) {
      navigate(activity.path)
      return
    }
    const genre = activity.genreId ? findGenre(activity.genreId) : undefined
    if (genre) setPendingGenre(genre)
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">{copy.genreSelect.title}</h1>
      <p className="mt-2 text-sm text-ink-600">{copy.genreSelect.note}</p>

      <ul className="mt-6 flex flex-col gap-4">
        {activitiesFor(mode).map((activity) => (
          <li key={activity.id}>
            <button
              type="button"
              onClick={() => open(activity)}
              className="flex min-h-20 w-full items-center gap-4 rounded-3xl bg-bloom-100 p-4 text-left"
            >
              {/*
                中身を小さくして流す絵。字を読まなくても選べるよう、
                こども向けは一回り大きくする。
              */}
              <ActivityArt
                id={activity.id}
                className={`shrink-0 ${mode === 'kids' ? 'size-24' : 'size-18'}`}
              />
              <span className="flex min-w-0 flex-col">
                <span className="text-xl font-bold text-bloom-700">
                  {copy.activities[activity.id].label}
                </span>
                <span className="mt-1 text-sm break-keep text-ink-600">
                  {copy.activities[activity.id].description}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* 戻り先はモードごとのトップ。こどもは /kids から来ている */}
      <Link to={TOP_PATH[mode]} className="mt-8 text-center text-sm text-ink-400 underline">
        {copy.genreSelect.back}
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
