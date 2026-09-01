/**
 * 問題の難易度(easy/normal/hard)を、元データの学年・頻度帯から割り当てる。
 *
 * 出題側(src/types の Difficulty)と同じ3段階。ここは生成スクリプトが使うので、
 * src への依存を作らないよう文字列リテラルで持つ。値を変えるときは両方そろえること。
 */
export type Level = 'easy' | 'normal' | 'hard'

/**
 * 漢字の配当学年 → 難易度。
 * 教育漢字は小1〜小6。数が偏らないよう小3・小4をやさしい、小5をふつう、小6をむずかしいに寄せる。
 * 小2以下(手書きの手動問題など)はやさしい、中学以上(grade 8)はむずかしいに入れる。
 */
export function kanjiLevelOf(grade: number | null | undefined): Level {
  if (grade == null) return 'normal'
  if (grade <= 4) return 'easy'
  if (grade === 5) return 'normal'
  return 'hard'
}

/**
 * 英単語の NGSL 頻度帯 → 難易度。
 * 上位1000語をやさしい、〜2000語をふつう、〜3000語をむずかしいに割り当てる。
 */
export function englishLevelOf(band: string | null | undefined): Level {
  if (band === '1000') return 'easy'
  if (band === '2000') return 'normal'
  if (band === '3000') return 'hard'
  return 'normal'
}
