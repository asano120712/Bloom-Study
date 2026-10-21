import type { Difficulty, GenreId, InputMode, MathTopic, PromptForm } from '@/types'

/**
 * 出題画面の行き先。選んだものはすべて URL に持たせる。
 *
 * 再読み込みや、結果画面の「つぎの問題へ」で戻ってきても同じ条件で続けられるようにするため。
 * シートから始めるときと、結果画面から次へ進むときで同じ形にしたいので1か所で組む。
 */
export function quizPathOf(
  genreId: GenreId,
  settings: {
    inputMode: InputMode
    difficulty: Difficulty
    /** 筆算か1行の式か。筆算で出す学年だけ */
    form?: PromptForm
    /** 計算の種類。無ければランダム(種類で絞らない) */
    topic?: MathTopic
  },
): string {
  const query = new URLSearchParams({ mode: settings.inputMode, level: settings.difficulty })
  if (settings.form) query.set('form', settings.form)
  if (settings.topic) query.set('topic', settings.topic)
  return `/quiz/${genreId}?${query}`
}
