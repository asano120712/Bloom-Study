/**
 * 問題の難易度を、元データの学年・頻度から割り当てる。
 *
 * 出題側(src/types の Difficulty)と同じ6段階。ここは生成スクリプトが使うので、
 * src への依存を作らないよう文字列リテラルで持つ。値を変えるときは両方そろえること。
 */
export type Level = 'g12' | 'g34' | 'g56' | 'junior' | 'senior' | 'working'

/**
 * 漢字の配当学年 → 難易度。小学校のあいだは国が決めた学年別漢字配当表をそのまま使う。
 *
 * 中学以上(配当学年8)は学年で割れない。**中学校の学習指導要領は、どの字を
 * 何年で習うかを決めていない**(教科書ごとに順番が違う)ため、そういうデータが存在しない。
 * 代わりに出現頻度の順位で3つに割る。目にする機会の多さは、体感の難しさとよく合う。
 */
export function kanjiLevelOf(
  grade: number,
  frequency: number | null | undefined,
  /** 中学以上を3つに割る境目(頻度順位)。呼び出し側が実データから出す */
  thresholds: [number, number],
): Level {
  if (grade <= 2) return 'g12'
  if (grade <= 4) return 'g34'
  if (grade <= 6) return 'g56'
  // 順位を持たない字は、いちばん見かけない側に入れる
  if (frequency == null) return 'working'
  if (frequency <= thresholds[0]) return 'junior'
  if (frequency <= thresholds[1]) return 'senior'
  return 'working'
}

/**
 * 熟語の相手に使ってよい字の、配当学年の上限。
 *
 * 出題文は「◯営」のように伏せていない側の字がそのまま出る。相手が上の学年の字だと、
 * その学年の子には出題文が読めない(一(小1)の問題に 位(小4)が出る、など)。
 * 中学以上は常用漢字すべて(8)を許す。
 */
export function partnerGradeCap(level: Level): number {
  if (level === 'g12') return 2
  if (level === 'g34') return 4
  if (level === 'g56') return 6
  return 8
}

/**
 * 英単語の NGSL 頻度帯 → 難易度。
 *
 * 学習指導要領は語数(小学校で600〜700語程度など)しか決めておらず、語彙リストを持たない。
 * 教科書ごとに語が違うので、学年に対応づけられるデータが無い。
 * NGSL の上位1000語がおおむね中学英語にあたるので、そこを起点に3つに割る。
 * 小学生向けの英単語は、いまは出さない。
 */
export function englishLevelOf(band: string | null | undefined): Level {
  if (band === '1000') return 'junior'
  if (band === '2000') return 'senior'
  if (band === '3000') return 'working'
  return 'senior'
}
