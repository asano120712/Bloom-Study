import { useCallback, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { HeroVisual } from '@/components/HeroVisual'
import { OpeningSplash } from '@/components/OpeningSplash'
import { useCopy } from '@/hooks/useAudienceMode'
import { readAudienceMode } from '@/services/audienceMode'
import { shouldPlayOpening } from '@/services/openingSession'
import { TOP_PATH } from '@/types'

/** おとな向けのトップ。こども向けは KidsTopPage(`/kids`) */
export function TopPage() {
  const [isOpening, setIsOpening] = useState(shouldPlayOpening)
  const finishOpening = useCallback(() => setIsOpening(false), [])
  // 前に使っていた側から始める。切り替えは押した時点で保存されるので往復しない
  const [mode] = useState(readAudienceMode)
  const copy = useCopy()

  if (mode === 'kids') return <Navigate to={TOP_PATH.kids} replace />

  return (
    <>
      {isOpening && <OpeningSplash onFinish={finishOpening} />}

      <AppShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
          <HeroVisual className="w-full rounded-3xl" />

          <p className="text-base leading-relaxed text-ink-600">
            {copy.top.lead[0]}
            <br />
            {copy.top.lead[1]}
            <br />
            {copy.top.lead[2]}
          </p>

          <div className="flex w-full flex-col gap-4">
            <Link
              to="/genres"
              className="flex min-h-14 w-full items-center justify-center rounded-full bg-bloom-700 text-lg font-bold text-white"
            >
              {copy.top.start}
            </Link>
            <Link to="/mypage" className="flex min-h-14 items-center justify-center rounded-full border-2 border-bloom-200 text-base font-bold text-ink-600">
              {copy.top.record}
            </Link>
          </div>
        </div>
      </AppShell>
    </>
  )
}
