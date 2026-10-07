import { Link } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { BloomMark } from '@/components/BloomMark'
import { TRIAL_LIMIT } from '@/config'
import { useAudienceMode } from '@/hooks/useAudienceMode'

/**
 * 無料トライアル終了案内。
 * サブスク導線の具体的な仕様は次フェーズで定義するため、暫定の案内文言に留める。
 */
export function TrialEndPage() {
  // 花マークはこども向けのときだけ顔つきにする(おとな向けは今までどおり花びらだけ)
  const isKids = useAudienceMode() === 'kids'

  return (
    <AppShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <BloomMark size={100} face={isKids ? 'smile' : undefined} />
        <h1 className="text-2xl font-bold">おつかれさまでした</h1>
        <p className="text-base leading-relaxed text-ink-600">
          無料でおためしできる {TRIAL_LIMIT} 問がおわりました。
          <br />
          つづきのジャンル・問題は準備中です。
        </p>
        <Link
          to="/mypage"
          className="flex min-h-14 w-full items-center justify-center rounded-full bg-bloom-700 text-lg font-bold text-white"
        >
          記録を見る
        </Link>
      </div>
    </AppShell>
  )
}
