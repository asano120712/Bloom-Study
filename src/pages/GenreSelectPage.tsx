import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ActivityArt } from '@/components/ActivityArt'
import { AppShell } from '@/components/AppShell'
import { HowToSheet } from '@/components/HowToSheet'
import { InputModeSheet } from '@/components/InputModeSheet'
import { activitiesFor, type Activity, type ActivityId } from '@/data/activities'
import { findGenre, type AnswerChoice } from '@/data/genres'
import { useAudienceMode, useCopy } from '@/hooks/useAudienceMode'
import { TOP_PATH, type Difficulty, type Genre, type MathTopic, type PromptForm } from '@/types'
import { quizPathOf } from '@/utils/quizPath'

export function GenreSelectPage() {
  const navigate = useNavigate()
  const copy = useCopy()
  const mode = useAudienceMode()
  /** 入力方法を選んでいる最中のジャンル。null なら一覧だけ */
  const [pendingGenre, setPendingGenre] = useState<Genre | null>(null)
  /** あそびかたを開いているあそび。null なら閉じている */
  const [howTo, setHowTo] = useState<ActivityId | null>(null)

  const start = (
    difficulty: Difficulty,
    choice: AnswerChoice,
    form?: PromptForm,
    topic?: MathTopic,
  ) => {
    if (!pendingGenre) return
    // 別画面のあそび(小1・小2の漢字)は、そのまま行き先へ
    if (choice.path) {
      navigate(choice.path)
      return
    }
    // 再読み込みや結果画面からの戻りでも保てるよう、選んだものは URL に持たせる
    if (!choice.inputMode) return
    navigate(quizPathOf(pendingGenre.id, { inputMode: choice.inputMode, difficulty, form, topic }))
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
            あそびかたのボタンはカードの外に出して、名前の行の右へ重ねる。
          */
          <li key={activity.id} className="relative">
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
                {/*
                  text-balance は掛けない。下の float で1行目だけが短くなっているので、
                  balance を掛けると「かた / ちを なぞろう」のように、
                  短い1行目にそろえて2行目まで切り詰めてしまう。
                */}
                <span className="text-xl font-bold text-bloom-700">
                  {/*
                    あそびかたのボタンのぶんを、**名前の行にだけ**空ける。
                    カード全体に右の余白を取ると、下の説明まで一緒に狭くなる。
                    float なら、ボタンに重なる行だけが短くなり、説明は幅いっぱい使える。
                  */}
                  <span
                    aria-hidden="true"
                    className={`float-right h-7 ${mode === 'kids' ? 'w-24' : 'w-12'}`}
                  />
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
              こども向けは「あそびかた」と言葉で出す。記号だけだと、何が出るのか
              分からないまま押すことになる(読む相手は保護者)。
              おとな向けは名前が短く、言葉を置くと名前の行を食うので「？」のまま。
            */}
            <button
              type="button"
              onClick={() => setHowTo(activity.id)}
              // 読み上げでは、どのあそびのものか分かるように名前を添える
              aria-label={copy.howTo.open(copy.activities[activity.id].label)}
              className="absolute top-1.5 right-2 flex min-h-11 items-center px-2"
            >
              {/*
                押し場所は 44px のまま、**見た目は1行ぶんの高さ**に収める。
                見た目まで 44px にすると、名前の2行目まで場所を空けることになり、
                こども向けの長い名前が3行になる。
              */}
              <span
                aria-hidden="true"
                className={`flex h-7 items-center justify-center rounded-full border-2 border-bloom-300 bg-base-50/80 font-bold text-bloom-700 ${
                  mode === 'kids' ? 'px-3 text-xs' : 'w-7 text-sm'
                }`}
              >
                {mode === 'kids' ? copy.howTo.title : '?'}
              </span>
            </button>

          </li>
        ))}
      </ul>

      {/* 戻り先はモードごとのトップ。こどもは /kids から来ている */}
      <Link to={TOP_PATH[mode]} className="mt-8 flex min-h-14 items-center justify-center rounded-full border-2 border-bloom-200 text-base font-bold text-ink-600">
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
