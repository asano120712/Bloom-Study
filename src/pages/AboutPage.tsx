import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { BloomMark } from '@/components/BloomMark'
import { DEVELOPER, NUMBERS, TECH } from '@/data/about'
import { COPYRIGHT, CREDITS } from '@/data/credits'
import { useAudienceMode, useCopy } from '@/hooks/useAudienceMode'
import { TOP_PATH } from '@/types'

/**
 * このアプリについて(ホームの下のリンクから開く)。
 * アプリの説明、込めた想い、数字で見る、使っている技術と、使っているデータの出典・ライセンスを出す。
 * こどもモードでも、読むのは保護者なので、中身はおとなの言葉のままにする。
 *
 * 項目が多く縦に長いので、項目ごとに区切り線・番号・英語の小見出しを付けて、境目をはっきりさせる。
 */
export function AboutPage() {
  const copy = useCopy()
  const mode = useAudienceMode()

  return (
    <AppShell>
      <header className="flex flex-col items-center rounded-3xl bg-bloom-50 px-5 py-8 text-center">
        <BloomMark size={64} motion="bloom" face={mode === 'kids' ? 'smile' : undefined} />
        <h1 className="mt-4 text-2xl font-bold">{copy.about.title}</h1>
        {copy.about.lead.map((line) => (
          <p key={line} className="mt-3 text-left text-sm leading-relaxed text-ink-600">
            {line}
          </p>
        ))}
      </header>

      <Section index={1} label="STORY" title={DEVELOPER.title}>
        <SubHeading>{DEVELOPER.reason.title}</SubHeading>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">{DEVELOPER.reason.intro}</p>
        <p className="mt-3 text-sm leading-relaxed text-ink-600">{DEVELOPER.reason.valuesLead}</p>
        <ol className="mt-3 flex flex-col gap-2 rounded-2xl border-2 border-bloom-100 bg-white px-4 py-3">
          {DEVELOPER.reason.values.map((value, index) => (
            <li key={value} className="flex items-start gap-3 text-sm leading-relaxed text-ink-900">
              <span
                aria-hidden="true"
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-bloom-700 text-xs font-bold text-white"
              >
                {index + 1}
              </span>
              {value}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm leading-relaxed text-ink-600">{DEVELOPER.reason.closing}</p>
        <p className="mt-3 text-sm leading-relaxed text-ink-600">{DEVELOPER.origin}</p>

        {/* 作った人の話だと分かるよう、技術のカード(灰色の地)と色を分ける */}
        <SubHeading className="mt-6">{DEVELOPER.points.title}</SubHeading>
        <ul className="mt-3 flex flex-col gap-2">
          {DEVELOPER.points.items.map((item) => (
            <li key={item.title} className="rounded-2xl bg-bloom-50 px-4 py-3">
              <p className="text-sm font-bold text-bloom-700">{item.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-600">{item.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section index={2} label="NUMBERS" title={copy.about.numbers}>
        <ul className="grid grid-cols-2 gap-2">
          {NUMBERS.map((item) => (
            <li key={item.label} className="rounded-2xl bg-bloom-50 px-3 py-4 text-center">
              <p className="text-xs text-ink-600">{item.label}</p>
              <p className="mt-1 text-2xl font-bold text-bloom-700">
                {item.value.toLocaleString('ja-JP')}
                <span className="ml-0.5 text-sm">{item.unit}</span>
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section index={3} label="TECHNOLOGY" title={copy.about.tech}>
        <ul className="flex flex-col gap-2">
          {TECH.map((item) => (
            <li key={item.title} className="flex gap-3 rounded-2xl bg-base-100 px-4 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-bloom-700">
                <TechIcon icon={item.icon} />
              </span>
              <div>
                <p className="text-sm font-bold text-ink-900">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-600">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section index={4} label="CREDITS" title={copy.about.credits}>
        <p className="text-xs leading-relaxed text-ink-600">{copy.about.creditsNote}</p>
        {/* 出典は読む人が少ないので、1枚のカードに区切り線で並べて場所を取らないようにする */}
        <ul className="mt-3 divide-y divide-bloom-100 rounded-2xl bg-base-100 px-4">
          {CREDITS.map((credit) => (
            <li key={credit.name} className="py-3 text-sm">
              <a href={credit.url} target="_blank" rel="noreferrer" className="font-bold text-bloom-700 underline">
                {credit.name}
              </a>
              <p className="mt-1 text-xs text-ink-600">{credit.author}</p>
              <p className="mt-1 text-xs text-ink-600">{credit.usedFor}</p>
              {credit.license && (
                <a
                  href={credit.license.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block rounded-full bg-white px-2 py-0.5 text-xs text-ink-600 underline"
                >
                  {credit.license.name}
                </a>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Link
        to={TOP_PATH[mode]}
        className="mt-10 flex min-h-14 items-center justify-center rounded-full border-2 border-bloom-200 text-base font-bold text-ink-600"
      >
        {copy.about.back}
      </Link>
      <p className="mt-6 text-center text-xs text-ink-400">{COPYRIGHT}</p>
    </AppShell>
  )
}

/** 項目ひとつ。上に区切り線を引き、番号と英語の小見出しを添える */
function Section({ index, label, title, children }: { index: number; label: string; title: string; children: ReactNode }) {
  return (
    <section className="mt-10 border-t-2 border-dashed border-bloom-200 pt-8">
      <p aria-hidden="true" className="text-xs font-bold tracking-widest text-bloom-600">
        {String(index).padStart(2, '0')} — {label}
      </p>
      <h2 className="mt-1 mb-4 text-xl font-bold">{title}</h2>
      {children}
    </section>
  )
}

/** 項目の中の小見出し。左に色の線を引いて、本文と分ける */
function SubHeading({ children, className = 'mt-0' }: { children: ReactNode; className?: string }) {
  return <h3 className={`border-l-4 border-bloom-400 pl-2 text-base font-bold ${className}`}>{children}</h3>
}

/** 使っている技術のアイコン(線だけの簡単な絵) */
function TechIcon({ icon }: { icon: (typeof TECH)[number]['icon'] }) {
  const paths: Record<typeof icon, ReactNode> = {
    pen: <path d="M4 20l4-1L19 8l-3-3L5 16l-1 4z M14 7l3 3" />,
    kanji: (
      <>
        <rect x="3" y="3" width="11" height="11" rx="2" />
        <rect x="10" y="10" width="11" height="11" rx="2" />
      </>
    ),
    auto: <path d="M12 3v4 M12 17v4 M3 12h4 M17 12h4 M6 6l2.5 2.5 M15.5 15.5L18 18 M6 18l2.5-2.5 M15.5 8.5L18 6" />,
    lock: (
      <>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </>
    ),
  }
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[icon]}
    </svg>
  )
}
