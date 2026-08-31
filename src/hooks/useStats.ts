import { useCallback, useEffect, useState } from 'react'
import { EMPTY_STATS, statsRepository } from '@/services/statsRepository'
import type { AnswerRecord, UserStats } from '@/types'

/** スコア・ストリーク・トライアル回数を読み書きするフック */
export function useStats() {
  const [stats, setStats] = useState<UserStats>(EMPTY_STATS)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true
    statsRepository.load().then((loaded) => {
      if (active) {
        setStats(loaded)
        setIsLoading(false)
      }
    })
    return () => {
      active = false
    }
  }, [])

  const record = useCallback(async (answer: AnswerRecord) => {
    const next = await statsRepository.record(answer)
    setStats(next)
    return next
  }, [])

  const reset = useCallback(async () => {
    await statsRepository.reset()
    setStats(EMPTY_STATS)
  }, [])

  return { stats, isLoading, record, reset }
}
