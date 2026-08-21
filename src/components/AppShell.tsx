import type { ReactNode } from 'react'

/** スマホ幅を基準にした共通レイアウト。タブレット・PCでは中央寄せにする */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full bg-cream-50">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-5 py-6">
        {children}
      </div>
    </div>
  )
}
