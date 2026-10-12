import { Fragment, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { HeroVisual } from '@/components/HeroVisual'
import { OpeningSplash } from '@/components/OpeningSplash'
import { useCopy } from '@/hooks/useAudienceMode'
import { writeAudienceMode } from '@/services/audienceMode'
import { shouldPlayOpening } from '@/services/openingSession'

/**
 * こども向けのトップ(`/kids`)。おとな向けは TopPage(`/`)。
 *
 * トップだけをモードごとに分けている。言葉づかいや文字の大きさを別々に決められて、
 * その先(ジャンル選択・出題・結果)は同じ画面を使えるため。
 * こども向けのジャンルを足すときは、ここではなくジャンル側をモードで出し分ける。
 */
export function KidsTopPage() {
  const [isOpening, setIsOpening] = useState(shouldPlayOpening)
  const finishOpening = useCallback(() => setIsOpening(false), [])
  const copy = useCopy()

  // 直接このURLを開いた場合もこども向けとして覚える(ヘッダーの切り替えは押した時点で保存済み)
  useEffect(() => writeAudienceMode('kids'), [])

  return (
    <>
      {isOpening && <OpeningSplash onFinish={finishOpening} />}

      <AppShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
          <HeroVisual className="w-full rounded-3xl" />

          <p className="text-lg leading-relaxed text-ink-600">
            {copy.top.lead.map((line, index) => (
              <Fragment key={line}>
                {index > 0 && <br />}
                {line}
              </Fragment>
            ))}
          </p>

          <div className="flex w-full flex-col gap-4">
            <Link
              to="/genres"
              className="flex min-h-16 w-full items-center justify-center rounded-full bg-bloom-700 text-xl font-bold text-white"
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
