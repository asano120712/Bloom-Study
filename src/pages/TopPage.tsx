import { Link } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { BloomMark } from '@/components/BloomMark'

export function TopPage() {
  return (
    <AppShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <BloomMark size={120} />
        <div>
          <h1 className="font-display text-4xl font-bold text-petal-600">Bloomstudy</h1>
          <p className="mt-3 text-base leading-relaxed text-ink-600">
            答えはすぐに出しません。
            <br />
            ヒントがひとつずつ浮かびあがるあいだに、
            <br />
            思い出す力を育てます。
          </p>
        </div>
        <Link
          to="/genres"
          className="flex min-h-14 w-full items-center justify-center rounded-full bg-petal-500 text-lg font-bold text-white"
        >
          はじめる
        </Link>
        <Link to="/mypage" className="text-sm text-ink-400 underline">
          これまでの記録を見る
        </Link>
      </div>
    </AppShell>
  )
}
