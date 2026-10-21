import type { CSSProperties, ReactNode } from 'react'
import { useCopy } from '@/hooks/useAudienceMode'

interface HandwritingToolsProps {
  /** 消しゴムを持っているか */
  erasing: boolean
  onChange: (erasing: boolean) => void
  /** 消すものがあるか。何も書いていないあいだは、消しゴムを選ばせない */
  canErase: boolean
  disabled?: boolean
}

/**
 * 手書きの道具(えんぴつ・消しゴム)の持ち替え。
 *
 * 字だけの「けす」ボタン1つだと、押すと何が起きるのか(全部消えるのか)が分からず、
 * 押したあとも、いま書くのか消すのかが字の入れ替わりでしか見えなかった。
 * お絵かきアプリと同じく道具を2つ並べ、持っているほうに色を付ける。
 */
export function HandwritingTools({ erasing, onChange, canErase, disabled = false }: HandwritingToolsProps) {
  const copy = useCopy()
  return (
    <div role="group" aria-label={copy.handwriting.tools} className="flex shrink-0 gap-1 rounded-full border-2 border-bloom-200 p-1">
      <ToolButton
        label={copy.handwriting.pen}
        icon={<PencilIcon className="size-6" />}
        active={!erasing}
        activeClassName="bg-bloom-100 text-bloom-800"
        onClick={() => onChange(false)}
        disabled={disabled}
      />
      <ToolButton
        label={copy.handwriting.eraser}
        icon={<EraserIcon className="size-6" />}
        active={erasing}
        activeClassName="bg-warm-500 text-white"
        onClick={() => onChange(true)}
        disabled={disabled || !canErase}
      />
    </div>
  )
}

interface ToolButtonProps {
  label: string
  icon: ReactNode
  active: boolean
  activeClassName: string
  onClick: () => void
  disabled: boolean
}

function ToolButton({ label, icon, active, activeClassName, onClick, disabled }: ToolButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      // SE の幅でも「かけた」の場所を残すため、絵の下に小さく字を添える縦並びにする
      className={`flex w-14 flex-col items-center justify-center rounded-full text-xs leading-none font-bold disabled:text-ink-400 ${
        active ? activeClassName : 'text-ink-600'
      }`}
    >
      {icon}
      <span className="mt-0.5">{label}</span>
    </button>
  )
}

export function PencilIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20l1.2-4.4L15.6 5.2a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.4 18.8z" />
      <path d="M14 7l3 3" />
    </svg>
  )
}

export function EraserIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 19.5L3.9 14.4a1.6 1.6 0 0 1 0-2.3l8.2-8.2a1.6 1.6 0 0 1 2.3 0l5.7 5.7a1.6 1.6 0 0 1 0 2.3L12 19.5z" />
      <path d="M8.5 8.5l7 7" />
      <path d="M9 19.5h11" />
    </svg>
  )
}

/**
 * 消しているあいだ指先に出す、色付きの消しゴム。
 * 左下の角が消す場所(指の当たったところ)に来るように描いてある。
 */
export function EraserArt({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={className} style={style}>
      <g transform="rotate(-40 20 20)" stroke="var(--color-ink-900)" strokeWidth={1.5} strokeLinejoin="round">
        <rect x="6" y="13" width="28" height="14" rx="3" fill="var(--color-warm-100)" />
        <path d="M21 13h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H21z" fill="var(--color-bloom-400)" />
      </g>
    </svg>
  )
}
