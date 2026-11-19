import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { NOTICES, type Notice, type NoticeKind } from '@/data/notices'
import { useAudienceMode, useCopy } from '@/hooks/useAudienceMode'
import { hasNewNotice, markNoticesSeen } from '@/services/noticeSeen'

/** モーダルの外側に空ける幅(px)。ヘッダーの下・コピーライトの上・左右の端から */
const GAP = 20

/**
 * ヘッダー右上(おとな/こどもの切り替えの右)に置く、お知らせのボタン。
 * 押すとモーダルでお知らせの一覧を開き、1件を押すとその本文に切り替わる。
 *
 * まだ開いていない新しいお知らせがあるあいだは、アイコンの点を塗って点滅させる。
 * 開くと読んだことにして、点は枠線だけに戻る。
 */
export function NoticeButton() {
  const copy = useCopy()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [hasNew, setHasNew] = useState(hasNewNotice)

  const open = () => {
    markNoticesSeen()
    setHasNew(false)
    setIsOpen(true)
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={copy.notice.open}
        aria-haspopup="dialog"
        onClick={open}
        className="btn-soft flex size-10 shrink-0 items-center justify-center rounded-full border border-bloom-200 bg-white [--btn-depth:1.5px]"
      >
        <NoticeIcon hasNew={hasNew} className="size-6" />
      </button>

      {isOpen && (
        <NoticeDialog
          header={buttonRef.current?.closest('header') ?? null}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  )
}

/**
 * お知らせのアイコン(形は public/images/notice.svg と同じ)。
 *
 * 封筒と右上の点を分けて描く。点だけを「新しいお知らせあり=塗って点滅」
 * 「なし=枠線だけ」に切り替えるため(1枚の絵のままだと点だけ色を変えられない)。
 */
function NoticeIcon({ hasNew, className }: { hasNew: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        className="fill-bloom-300"
        d="M5.125 4.5H16.885C16.7727 4.90656 16.7297 5.32916 16.758 5.75H5.125C4.76033 5.75 4.41059 5.89487 4.15273 6.15273C3.89487 6.41059 3.75 6.76033 3.75 7.125V7.7495L12 12.2865L18.533 8.6935C19.01 8.9875 19.558 9.1785 20.1445 9.2335L12.301 13.5475C12.2192 13.5925 12.1284 13.6186 12.0352 13.6238C11.942 13.6291 11.8488 13.6134 11.7625 13.578L11.699 13.548L3.75 9.175V16.875C3.75 17.2397 3.89487 17.5894 4.15273 17.8473C4.41059 18.1051 4.76033 18.25 5.125 18.25H18.875C19.2397 18.25 19.5894 18.1051 19.8473 17.8473C20.1051 17.5894 20.25 17.2397 20.25 16.875V9.242C20.6708 9.26932 21.0933 9.2264 21.5 9.115V16.875C21.5 18.325 20.325 19.5 18.875 19.5H5.125C4.42881 19.5 3.76113 19.2234 3.26884 18.7312C2.77656 18.2389 2.5 17.5712 2.5 16.875V7.125C2.5 5.675 3.675 4.5 5.125 4.5Z"
      />
      {hasNew ? (
        <circle cx="20.5" cy="5.5" r="2.5" className="animate-notice-blink fill-bloom-500" />
      ) : (
        <circle
          cx="20.5"
          cy="5.5"
          r="1.9"
          strokeWidth="1.2"
          className="fill-none stroke-bloom-300"
        />
      )}
    </svg>
  )
}

/** 種類ごとのタグの色。更新情報はブランドの緑、イベントは目を引く暖色 */
const TAG_CLASS: Record<NoticeKind, string> = {
  update: 'bg-bloom-100 text-bloom-700',
  event: 'bg-warm-100 text-warm-600',
}

/** お知らせの種類のタグ(更新情報・イベント) */
function NoticeTag({ kind }: { kind: NoticeKind }) {
  const copy = useCopy()
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${TAG_CLASS[kind]}`}>
      {copy.notice.kinds[kind]}
    </span>
  )
}

/** 「2026-11-18」を「2026.11.18」にする */
function formatDate(date: string) {
  return date.replaceAll('-', '.')
}

/**
 * モーダルを置く場所。
 * 横はヘッダー(アプリの列)の左右から 20px 内側、縦はヘッダーの下 20px から
 * コピーライトの上 20px まで。コピーライトが無い画面や、画面より下にあるときは画面の下端から 20px。
 */
function useDialogFrame(header: HTMLElement | null): CSSProperties | undefined {
  const [frame, setFrame] = useState<CSSProperties>()

  useLayoutEffect(() => {
    const measure = () => {
      const area = header?.getBoundingClientRect()
      const left = (area?.left ?? 0) + GAP
      const right = (area?.right ?? window.innerWidth) - GAP
      const top = Math.max(area?.bottom ?? 0, 0) + GAP
      const copyright = document.querySelector('[data-copyright]')?.getBoundingClientRect().top
      const bottom = Math.min(copyright ?? Infinity, window.innerHeight) - GAP
      setFrame({ left, top, width: right - left, height: Math.max(bottom - top, 0) })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [header])

  return frame
}

/**
 * お知らせのモーダル。一覧 → 本文 の2段。
 * 一覧はカードを並べ、上に種類のタグと日付、その下に見出しを置く。
 * 本文は見出しを色で目立たせ、その下に文章を続ける(読み物なので左にそろえる)。
 * いちばん下の中央に閉じるボタンを置き、その上に薄緑の線を1本引く(読むところと操作の境目)。
 * 本文を開いているときは、線の上に一覧へ戻るを足す。
 * Esc は1つ前へ(本文なら一覧へ、一覧なら閉じる)。
 */
function NoticeDialog({ header, onClose }: { header: HTMLElement | null; onClose: () => void }) {
  const copy = useCopy()
  const mode = useAudienceMode()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<Notice | null>(null)
  const frame = useDialogFrame(header)

  useEffect(() => {
    dialogRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (selected) setSelected(null)
      else onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selected, onClose])

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label={copy.notice.close}
        onClick={onClose}
        className="absolute inset-0 bg-ink-900/40"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={copy.notice.title}
        tabIndex={-1}
        style={frame}
        className={`animate-bloom-in fixed flex flex-col rounded-3xl bg-base-50 px-5 pt-6 pb-6 outline-none select-none ${
          frame ? '' : 'invisible'
        }`}
      >
        {selected ? (
          <>
            <div className="flex shrink-0 items-center justify-between gap-2">
              <NoticeTag kind={selected.kind} />
              <span className="text-sm text-ink-400 tabular-nums">{formatDate(selected.date)}</span>
            </div>
            <h2 className="mt-3 shrink-0 text-xl leading-snug font-bold text-bloom-700">
              {selected.words[mode].title}
            </h2>

            <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain text-base leading-relaxed text-ink-900">
              {selected.words[mode].body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setSelected(null)}
              className="btn-soft mt-5 flex min-h-12 w-full shrink-0 items-center justify-center rounded-full border-2 border-bloom-200 text-sm font-bold text-ink-600"
            >
              {copy.notice.back}
            </button>
          </>
        ) : (
          <>
            <h2 className="text-center text-xl font-bold">{copy.notice.title}</h2>

            {NOTICES.length === 0 ? (
              <p className="mt-6 flex-1 text-center text-sm text-ink-600">{copy.notice.empty}</p>
            ) : (
              <ul className="mt-5 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain pb-1.5">
                {NOTICES.map((notice) => (
                  <li key={notice.id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelected(notice)}
                      className="btn-soft flex min-h-16 w-full flex-col gap-2 rounded-2xl border-2 border-bloom-200 bg-white px-5 py-4 text-left text-ink-900"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <NoticeTag kind={notice.kind} />
                        <span className="text-xs text-ink-400 tabular-nums">
                          {formatDate(notice.date)}
                        </span>
                      </span>
                      <span className="text-base leading-snug font-bold">{notice.words[mode].title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <hr aria-hidden="true" className="mt-5 shrink-0 border-t-2 border-bloom-200" />

        <div className="mt-5 flex shrink-0 justify-center">
          <button
            type="button"
            onClick={onClose}
            className="btn-raised flex min-h-12 min-w-40 items-center justify-center rounded-full bg-bloom-700 px-8 text-sm font-bold text-white"
          >
            {copy.notice.close}
          </button>
        </div>
      </div>
    </div>
  )
}
