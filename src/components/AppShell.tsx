import type { ReactNode } from 'react'
import { AppHeader } from './AppHeader'

/**
 * スマホ幅を基準にした共通レイアウト。タブレット・PCでは中央寄せにする。
 *
 * 高さは min-h-dvh(動的ビューポート高)を起点にした flex チェーンで渡す。
 * 親が height:auto のまま min-h-full を重ねても % が解決されず、
 * 各画面の justify-center が効かなくなるため。
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-base-50">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <AppHeader />
        <div className="flex flex-1 flex-col px-5 pt-5 pb-6">{children}</div>
      </div>
    </div>
  )
}
