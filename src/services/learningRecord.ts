import { hourKey } from '@/services/statsRepository'
import type { AnswerBuckets, AnswerCount, GenreId } from '@/types'

/**
 * 学びの記録のグラフとまとめの数を、1時間ごとの数(buckets)から作る。
 *
 * - day: 今日の0時から23時まで、1時間ごとの棒
 * - week: 今日までの7日、1日ごとの棒
 * - month: 今日までの30日、1日ごとの棒
 */
export type RecordPeriod = 'day' | 'week' | 'month'
export const RECORD_PERIODS: RecordPeriod[] = ['day', 'week', 'month']

const GENRES: GenreId[] = ['english', 'kanji', 'math']
const EMPTY: AnswerCount = { a: 0, c: 0, n: 0 }

const add = (x: AnswerCount, y: AnswerCount): AnswerCount => ({ a: x.a + y.a, c: x.c + y.c, n: x.n + y.n })

export interface RecordBar {
  /** 棒の下に出す目盛り。空なら出さない(目盛りが詰まりすぎないように間引く) */
  label: string
  /** 読み上げ用の、その棒の時間・日付 */
  name: string
  count: AnswerCount
}

export interface RecordSummary {
  bars: RecordBar[]
  total: AnswerCount
  byGenre: Record<GenreId, AnswerCount>
}

/** その1時間の、全ジャンルの合計と、ジャンルごとの数 */
function hourOf(buckets: AnswerBuckets, key: string) {
  const hour = buckets[key] ?? {}
  return GENRES.map((genre) => [genre, hour[genre] ?? EMPTY] as const)
}

export function summarize(buckets: AnswerBuckets, period: RecordPeriod, now = new Date()): RecordSummary {
  const byGenre = { english: EMPTY, kanji: EMPTY, math: EMPTY } as Record<GenreId, AnswerCount>
  let total = EMPTY
  const count = (keys: string[]) => {
    let sum = EMPTY
    for (const key of keys) {
      for (const [genre, value] of hourOf(buckets, key)) {
        sum = add(sum, value)
        byGenre[genre] = add(byGenre[genre], value)
      }
    }
    total = add(total, sum)
    return sum
  }

  const bars: RecordBar[] = []
  if (period === 'day') {
    for (let hour = 0; hour < 24; hour += 1) {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour)
      bars.push({ label: hour % 6 === 0 ? `${hour}時` : '', name: `${hour}時`, count: count([hourKey(at)]) })
    }
  } else {
    const days = period === 'week' ? 7 : 30
    const weekday = ['日', '月', '火', '水', '木', '金', '土']
    for (let back = days - 1; back >= 0; back -= 1) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back)
      const keys = Array.from({ length: 24 }, (_, hour) =>
        hourKey(new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour)),
      )
      const name = `${day.getMonth() + 1}月${day.getDate()}日`
      // 1週間は曜日、1か月は5日おきに日付を出す(いちばん右の今日は必ず出す)
      const label =
        period === 'week' ? weekday[day.getDay()] : back % 5 === 0 ? `${day.getMonth() + 1}/${day.getDate()}` : ''
      bars.push({ label, name, count: count(keys) })
    }
  }
  return { bars, total, byGenre }
}

/** 割合(%)。0問なら null(「0%」と出すと、できなかったように見える) */
export const percent = (part: number, whole: number): number | null =>
  whole === 0 ? null : Math.round((part / whole) * 100)
