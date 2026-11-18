import type { AudienceMode } from '@/types'

/** お知らせ1件。上から新しい順に並べる */
export interface Notice {
  id: string
  /** 出した日(YYYY-MM-DD)。一覧では「2026.11.18」の形で出す */
  date: string
  /** 一覧に出す見出しと、開いたときの本文。本文は段落ごとに分ける */
  words: Record<AudienceMode, { title: string; body: string[] }>
}

/**
 * お知らせの中身。足すときは配列の先頭に書く(一覧は並び順のまま出す)。
 * こども向けは、ほかの画面と同じく ひらがな と 分かち書き にする。
 */
export const NOTICES: Notice[] = [
  {
    id: '2026-11-learning-record',
    date: '2026-11-17',
    words: {
      adult: {
        title: '「学びの記録」ができました',
        body: [
          'マイページの記録が「学びの記録」になり、解いた数や正解率をグラフとカードで見られるようになりました。',
        ],
      },
      kids: {
        title: 'スタンプを あつめよう',
        body: ['もんだいを とくと スタンプが もらえるよ。マイページで みてみてね。'],
      },
    },
  },
]
