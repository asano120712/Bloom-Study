import type { ReactNode } from 'react'
import { AppHeader } from './AppHeader'

interface AppShellProps {
  children: ReactNode
  /**
   * 画面をビューポート高ぴったりに収め、ページ自体をスクロールさせない。
   * 出題画面で使う。中身がはみ出す場合は、はみ出す側(ヒント枠)で内部スクロールさせること。
   */
  fitViewport?: boolean
}

/**
 * スマホ幅を基準にした共通レイアウト。タブレット・PCでは中央寄せにする。
 *
 * 高さは min-h-dvh(動的ビューポート高)を起点にした flex チェーンで渡す。
 * 親が height:auto のまま min-h-full を重ねても % が解決されず、
 * 各画面の justify-center が効かなくなるため。
 */
export function AppShell({ children, fitViewport = false }: AppShellProps) {
  return (
    <div
      className={`flex flex-col bg-base-50 ${fitViewport ? 'h-dvh overflow-hidden' : 'min-h-dvh'}`}
    >
      {/*
        min-h-0 が要る。flex 要素の既定 min-height:auto は中身より小さくならないため、
        これが無いと下位の高さが確定せず、ヒントが増えるたびに枠が伸びて
        h-dvh を超え、overflow-hidden でキャンバスとボタンが切り落とされる。
      */}
      <div
        className={`mx-auto flex w-full max-w-md flex-1 flex-col ${fitViewport ? 'min-h-0' : ''}`}
      >
        <AppHeader />
        <div
          className={`flex flex-1 flex-col px-5 pt-5 pb-6 ${
            // 端末が小さくて収まりきらない場合に操作不能にならないよう、逃げ道だけ用意する。
            // 通常は下の flex 配分で収まるのでスクロールバーは出ない。
            fitViewport ? 'min-h-0 overflow-y-auto overscroll-contain' : ''
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
