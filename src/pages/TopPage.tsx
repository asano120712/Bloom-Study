import { Link } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { BloomLogo } from '@/components/BloomLogo'

export function TopPage() {
  return (
    <AppShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        {/* 縦組みロゴ。花びらが開いてから文字が出るアニメーションはSVG側で完結している */}
        <BloomLogo variant="vertical" className="w-56 max-w-full" />

        <p className="text-base leading-relaxed text-ink-600">
          答えはすぐに出しません。
          <br />
          ヒントがひとつずつ浮かびあがるあいだに、
          <br />
          思い出す力を育てます。
        </p>

        <div className="flex w-full flex-col gap-4">
          <Link
            to="/genres"
            className="flex min-h-14 w-full items-center justify-center rounded-full bg-bloom-700 text-lg font-bold text-white"
          >
            はじめる
          </Link>
          <Link to="/mypage" className="text-sm text-ink-400 underline">
            これまでの記録を見る
          </Link>
        </div>
      </div>
    </AppShell>
  )
}
