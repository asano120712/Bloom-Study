import type { AudienceMode } from '@/types'

/**
 * お知らせの種類。一覧のカードと本文の上に、タグとして出す。
 * update = 更新情報(できることが増えた・変わった)、event = イベント(期間のある催し)
 */
export type NoticeKind = 'update' | 'event'

/** お知らせ1件。上から新しい順に並べる */
export interface Notice {
  id: string
  kind: NoticeKind
  /** 出した日(YYYY-MM-DD)。一覧では「2026.11.18」の形で出す */
  date: string
  /**
   * 一覧に出す見出しと、開いたときの本文。
   * 本文は箇条書きにせず、文でつないで書く。話が変わるところで段落を分ける(1段落で足りることが多い)。
   */
  words: Record<AudienceMode, { title: string; body: string[] }>
}

/**
 * お知らせの中身。足すときは配列の先頭に書く(一覧は並び順のまま出す)。
 * こども向けは、ほかの画面と同じく ひらがな と 分かち書き にする。
 */
export const NOTICES: Notice[] = [
  {
    id: '2026-11-kanji-hints',
    kind: 'update',
    date: '2026-11-19',
    words: {
      adult: {
        title: '漢字のヒントが分かりやすくなりました',
        body: [
          '漢字の問題で、ヒントの最初に熟語の意味が出るようになりました。言葉を知らなくても、意味を手がかりに考えられます。あわせて、出題できる漢字も1,666問から1,869問に増えました。',
        ],
      },
      kids: {
        title: 'いっぱんモードの かんじが かわったよ',
        body: [
          'いっぱんモードの かんじの もんだいで、ヒントの さいしょに ことばの いみが でるように なったよ。こどもモードの あそびは いままでと おなじだよ。',
        ],
      },
    },
  },
  {
    id: '2026-11-learning-record',
    kind: 'update',
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
