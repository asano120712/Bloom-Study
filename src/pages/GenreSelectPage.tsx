import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ActivityArt } from '@/components/ActivityArt'
import { AppShell } from '@/components/AppShell'
import { HowToSheet } from '@/components/HowToSheet'
import { InputModeSheet } from '@/components/InputModeSheet'
import { activitiesFor, type Activity, type ActivityId } from '@/data/activities'
import { findGenre, type AnswerChoice } from '@/data/genres'
import { useAudienceMode, useCopy } from '@/hooks/useAudienceMode'
import { TOP_PATH, type Difficulty, type Genre } from '@/types'

export function GenreSelectPage() {
  const navigate = useNavigate()
  const copy = useCopy()
  const mode = useAudienceMode()
  /** 入力方法を選んでいる最中のジャンル。null なら一覧だけ */
  const [pendingGenre, setPendingGenre] = useState<Genre | null>(null)
  /** あそびかたを開いているあそび。null なら閉じている */
  const [howTo, setHowTo] = useState<ActivityId | null>(null)

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
          /*
            カードの中にボタンは置けない(入れ子のボタンは成立しない)ので、
            「？」はカードの外に出して右上に重ねる。
          */
          <li key={activity.id} className="relative">
            <button
              type="button"
              onClick={() => open(activity)}
              className="flex min-h-20 w-full items-center gap-4 rounded-3xl bg-bloom-100 p-4 pb-14 text-left"
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
                {/*
                  text-balance: 狭い端末で名前が折り返したとき、
                  最後の1字だけが次の行に残らないよう、2行を同じくらいの長さに割る。
                */}
                <span className="text-xl font-bold text-balance text-bloom-700">
                  {copy.activities[activity.id].label}
                </span>
                {/*
                break-keep は掛けない。掛けると「やり方のヒントを見ながら解く」が
                14文字の切れない塊になり、絵の右の列(375px の端末で約210px)に
                収まるかどうかが紙一重になる。日本語は既定どおりどこでも折り返させる。
                大きさも幅で頭打ちにして、狭い端末では小さくする。
              */}
              <span className="mt-1 text-[min(0.875rem,3.7vw)] leading-5 text-ink-600">
                  {copy.activities[activity.id].description}
                </span>
              </span>
            </button>

            {/*
              「？」ではなく言葉で出す。記号は、何が出るのか分からないまま押すことになる。
              右上ではなく右下に置くのは、右上だと名前の幅を食って
              こども向けの長い名前(「かたちを なぞろう」)が折り返すため。
              カードの下に場所を空けて(pb-14)、説明と重ならないようにしてある。
            */}
            <button
              type="button"
              onClick={() => setHowTo(activity.id)}
              // 読み上げでは、どのあそびのものか分かるように名前を添える
              aria-label={copy.howTo.open(copy.activities[activity.id].label)}
              className="absolute right-3 bottom-3 flex min-h-11 items-center rounded-full border-2 border-bloom-300 bg-base-50/80 px-4 text-sm font-bold text-bloom-700"
            >
              {copy.howTo.title}
            </button>
          </li>
        ))}
      </ul>

      {/* 戻り先はモードごとのトップ。こどもは /kids から来ている */}
      <Link to={TOP_PATH[mode]} className="mt-8 text-center text-sm text-ink-400 underline">
        {copy.genreSelect.back}
      </Link>

      {howTo && <HowToSheet activity={howTo} onClose={() => setHowTo(null)} />}

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
