import type { AnswerBuckets, AnswerRecord, UserStats } from '@/types'

/**
 * スコア・ストリーク・無料トライアル回数の永続化インターフェース。
 *
 * MVP では localStorage 実装を使う。技術選定書 6章の通り Firebase / Supabase の
 * どちらを採用するかは未決定のため、差し替え点をこの層に閉じ込めておく。
 * BaaS 導入時は同じインターフェースの実装を追加して statsRepository を差し替える。
 */
export interface StatsRepository {
  load(): Promise<UserStats>
  /** 1問分の解答結果を記録し、更新後の統計を返す */
  record(answer: AnswerRecord): Promise<UserStats>
  reset(): Promise<void>
}

export const EMPTY_STATS: UserStats = {
  totalAnswered: 0,
  totalCorrect: 0,
  currentStreak: 0,
  bestStreak: 0,
  trialUsed: 0,
  history: [],
  buckets: {},
}

const STORAGE_KEY = 'bloomstudy:stats:v1'
/**
 * 学びの記録のカードに出すために残す件数。1件は数百バイトなので、200件でも 100KB に届かない。
 * グラフの数は件数で切らずに buckets に残す。
 */
const HISTORY_LIMIT = 200
/** グラフ用の数を残す日数(いちばん長い「1か月」より少し多く) */
const BUCKET_DAYS = 35

/** 端末の時刻での「YYYY-MM-DDTHH」。toISOString は世界時なので使わない */
export function hourKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}`
}

/** 1問ぶんを数に足す(もとの buckets は変えない) */
function addToBuckets(buckets: AnswerBuckets, answer: AnswerRecord): AnswerBuckets {
  const key = hourKey(new Date(answer.answeredAt))
  const hour = buckets[key] ?? {}
  const count = hour[answer.genreId] ?? { a: 0, c: 0, n: 0 }
  return {
    ...buckets,
    [key]: {
      ...hour,
      [answer.genreId]: {
        a: count.a + 1,
        c: count.c + (answer.isCorrect ? 1 : 0),
        n: count.n + (answer.isCorrect && answer.hintsUsed === 0 ? 1 : 0),
      },
    },
  }
}

/** 古い数を捨てる */
function pruneBuckets(buckets: AnswerBuckets, now = new Date()): AnswerBuckets {
  const oldest = hourKey(new Date(now.getTime() - BUCKET_DAYS * 24 * 60 * 60 * 1000))
  return Object.fromEntries(Object.entries(buckets).filter(([key]) => key >= oldest))
}

function read(): UserStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_STATS
    const stats = { ...EMPTY_STATS, ...(JSON.parse(raw) as Partial<UserStats>) }
    // グラフ用の数を足す前に保存した記録は、残っている履歴から数を作る(古い順に足す)
    if (!(JSON.parse(raw) as Partial<UserStats>).buckets) {
      stats.buckets = pruneBuckets([...stats.history].reverse().reduce(addToBuckets, {} as AnswerBuckets))
    }
    return stats
  } catch {
    // プライベートモードなど localStorage が使えない環境では統計なしで続行する
    return EMPTY_STATS
  }
}

function write(stats: UserStats): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats))
  } catch {
    // 保存できなくても出題体験自体は継続させる
  }
}

/** 1問分の結果を既存の統計に反映する(ストリークのリセット条件を含む) */
export function applyAnswer(stats: UserStats, answer: AnswerRecord): UserStats {
  const currentStreak = answer.isCorrect ? stats.currentStreak + 1 : 0

  return {
    totalAnswered: stats.totalAnswered + 1,
    totalCorrect: stats.totalCorrect + (answer.isCorrect ? 1 : 0),
    currentStreak,
    bestStreak: Math.max(stats.bestStreak, currentStreak),
    // 正誤に関わらず、解答完了時点で無料トライアルを1回消化する
    trialUsed: stats.trialUsed + 1,
    history: [answer, ...stats.history].slice(0, HISTORY_LIMIT),
    buckets: pruneBuckets(addToBuckets(stats.buckets, answer)),
  }
}

export const localStatsRepository: StatsRepository = {
  async load() {
    return read()
  },
  async record(answer) {
    const next = applyAnswer(read(), answer)
    write(next)
    return next
  },
  async reset() {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // 消せなくても致命的ではない
    }
  },
}

export const statsRepository: StatsRepository = localStatsRepository
