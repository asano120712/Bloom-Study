import type { AnswerRecord, UserStats } from '@/types'

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
}

const STORAGE_KEY = 'bloomstudy:stats:v1'
/** マイページの履歴表示用に保持する件数 */
const HISTORY_LIMIT = 50

function read(): UserStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_STATS
    return { ...EMPTY_STATS, ...(JSON.parse(raw) as Partial<UserStats>) }
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
