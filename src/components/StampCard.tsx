import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { useCopy } from '@/hooks/useAudienceMode'
import type { PressStage } from '@/hooks/usePressStage'
import { STAMP_GOAL, dayKey } from '@/services/stampCard'
import { prefersReducedMotion } from '@/utils/motion'

/**
 * こどものスタンプカード(カレンダーの形)。
 *
 * 1日に STAMP_GOAL 回あそぶと、その日のマスにスタンプが押される。
 * 今日のマスには、あと何回かが分かるように、回数ぶん埋まる輪を出す。
 */

interface MonthProps {
  year: number
  /** 0 はじまり(1月 = 0) */
  month: number
  plays: Record<string, number>
  /** 今日のマスに押す演出を出すとき */
  pressStage?: PressStage
}

/** スタンプの傾き。日ごとに決まった角度にして、描き直しても動かないようにする */
const angleOf = (day: number) => ((day * 37) % 25) - 12

/** きらきらの飛ぶ向き(12方向)。遠くへ飛ぶ大粒と、近くに散る小粒を交互に */
const SPARKLES = Array.from({ length: 12 }, (_, index) => {
  const radian = (index / 12) * Math.PI * 2 + 0.3
  const distance = index % 2 === 0 ? 52 : 34
  return { dx: `${Math.cos(radian) * distance}px`, dy: `${Math.sin(radian) * distance}px`, big: index % 2 === 0 }
})

/** 紙吹雪。横の位置・遅れ・落ちる長さ・流れ・回転を1枚ずつ決めておく(描き直しても同じ) */
const CONFETTI = Array.from({ length: 28 }, (_, index) => ({
  left: `${(index * 47) % 100}%`,
  // 落ち始める高さと遅れをばらけさせる。そろうと横一列の線に見えて、紙吹雪らしくない
  top: `${-((index * 37) % 60)}px`,
  delay: `${(index * 89) % 800}ms`,
  fall: `${1300 + ((index * 131) % 900)}ms`,
  distance: `${240 + ((index * 61) % 160)}px`,
  drift: `${((index * 29) % 60) - 30}px`,
  spin: `${index % 2 === 0 ? 540 : -460}deg`,
  color: ['bg-warm-500', 'bg-bloom-400', 'bg-bloom-600', 'bg-warm-600'][index % 4],
  round: index % 3 === 0,
}))

/** 押したあとに、カードの上から降らせる紙吹雪 */
export function Confetti() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-30 h-0 overflow-visible">
      {CONFETTI.map((piece, index) => (
        <span
          key={index}
          className={`animate-confetti absolute ${piece.color} ${piece.round ? 'size-2.5 rounded-full' : 'h-3 w-1.5 rounded-sm'}`}
          style={
            {
              left: piece.left,
              top: piece.top,
              '--distance': piece.distance,
              '--delay': piece.delay,
              '--fall': piece.fall,
              '--drift': piece.drift,
              '--spin': piece.spin,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}

/** はんこの絵。花の形を、二重の丸で囲む */
export function Stamp({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={className}>
      <circle cx="20" cy="20" r="17.6" fill="none" stroke="currentColor" strokeWidth="2.6" />
      <circle cx="20" cy="20" r="14" fill="none" stroke="currentColor" strokeWidth="0.9" strokeDasharray="2.2 1.5" />
      {[0, 1, 2, 3, 4].map((index) => (
        <ellipse
          key={index}
          cx="20"
          cy="13.4"
          rx="4.1"
          ry="6"
          fill="currentColor"
          opacity="0.88"
          transform={`rotate(${index * 72} 20 20)`}
        />
      ))}
      <circle cx="20" cy="20" r="2.7" fill="white" />
    </svg>
  )
}

/** 今日のマスの輪。あそんだ回数のぶんだけ埋まる */
function TodayRing({ count }: { count: number }) {
  const ratio = Math.min(1, count / STAMP_GOAL)
  const length = 2 * Math.PI * 16
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className="absolute inset-[10%] -rotate-90">
      <circle cx="20" cy="20" r="16" fill="none" strokeWidth="3.4" className="stroke-bloom-100" />
      <circle
        cx="20"
        cy="20"
        r="16"
        fill="none"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeDasharray={length}
        strokeDashoffset={length * (1 - ratio)}
        className="stroke-bloom-400 transition-[stroke-dashoffset] duration-700"
      />
    </svg>
  )
}

/** 1か月ぶんのカードの中身(見出し・曜日・日のマス) */
export function StampMonth({ year, month, plays, pressStage }: MonthProps) {
  const copy = useCopy()
  const today = dayKey()
  const firstWeekday = new Date(year, month, 1).getDay()
  const days = new Date(year, month + 1, 0).getDate()

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-center gap-2">
        <p className="text-3xl font-bold text-bloom-700">{copy.stampCard.month(month + 1)}</p>
        <p className="text-sm text-ink-400">{copy.stampCard.year(year)}</p>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold">
        {copy.stampCard.weekdays.map((weekday, index) => (
          <span
            key={weekday}
            className={index === 0 ? 'text-warm-600' : index === 6 ? 'text-bloom-600' : 'text-ink-400'}
          >
            {weekday}
          </span>
        ))}
      </div>

      <ol className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstWeekday }, (_, index) => (
          <li key={`blank-${index}`} aria-hidden="true" />
        ))}
        {Array.from({ length: days }, (_, index) => {
          const day = index + 1
          const key = dayKey(new Date(year, month, day))
          const count = plays[key] ?? 0
          const isToday = key === today
          const isFuture = key > today
          const weekday = (firstWeekday + index) % 7
          // 今日に押す演出の途中は、スタンプが現れるまで輪を満タンにして待つ
          const pressing = isToday && pressStage !== undefined
          const stamped = count >= STAMP_GOAL && !(pressing && pressStage === 'before')
          /** 押す前(光らせて待つ・スタンプがためている)あいだ */
          const waiting = pressing && pressStage !== 'press'
          const angle = angleOf(day)

          return (
            <li
              key={key}
              aria-label={copy.stampCard.day(day, count >= STAMP_GOAL)}
              className={`relative aspect-square rounded-xl ${
                isToday ? 'bg-bloom-50 ring-2 ring-bloom-400' : isFuture ? 'bg-base-50' : 'bg-base-100'
              } ${waiting ? 'animate-cell-glow' : ''} ${
                // 押すマスは、落ちてくるスタンプやきらきらがほかのマスの下に隠れないよう前に出す
                pressing ? 'z-10' : ''
              }`}
            >
              <span
                className={`absolute top-0.5 left-1 text-[0.65rem] leading-none font-bold ${
                  isFuture
                    ? 'text-ink-400/60'
                    : weekday === 0
                      ? 'text-warm-600'
                      : weekday === 6
                        ? 'text-bloom-600'
                        : 'text-ink-600'
                }`}
              >
                {day}
              </span>

              {isToday && (!stamped || waiting) && <TodayRing count={pressing ? STAMP_GOAL : count} />}

              {stamped && (
                // 右下に寄せる。左上の日付の数字にかぶると、何日か読めなくなる
                <span
                  className="absolute right-[4%] bottom-[4%] size-[80%]"
                  style={{ '--stamp-angle': `${angle}deg` } as CSSProperties}
                >
                  {pressing && pressStage === 'press' && (
                    <>
                      {/* インクのにじみ。押した瞬間に輪が広がって消える */}
                      <span className="animate-ink-ring absolute inset-0 rounded-full border-4 border-warm-500" />
                      {SPARKLES.map((sparkle, index) => (
                        <span
                          key={index}
                          className={`animate-sparkle absolute top-1/2 left-1/2 rounded-full ${
                            sparkle.big ? '-mt-1.5 -ml-1.5 size-3 bg-warm-500' : '-mt-1 -ml-1 size-2 bg-bloom-400'
                          }`}
                          style={{ '--dx': sparkle.dx, '--dy': sparkle.dy } as CSSProperties}
                        />
                      ))}
                    </>
                  )}
                  <Stamp
                    className={`block size-full text-warm-600 ${
                      // 浮かんでいるあいだは紙に乗っていないので、インクのにじみ(重ねて濃くなる色)にしない
                      pressing && pressStage === 'hold' ? 'animate-stamp-hold drop-shadow-lg' : 'mix-blend-multiply'
                    } ${pressing && pressStage === 'press' ? 'animate-stamp-press' : ''}`}
                  />
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** そのつきに押されたスタンプの数 */
function stampsIn(year: number, month: number, plays: Record<string, number>): number {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`
  return Object.entries(plays).filter(([day, count]) => day.startsWith(prefix) && count >= STAMP_GOAL).length
}

/** カードの紙。リングで綴じた壁かけカレンダーのように見せる */
function Sheet({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl border-2 border-bloom-200 bg-white px-3 pt-6 pb-3 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

/** 綴じのリング。紙の上の辺にかかるように置く */
function Rings() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-2 z-20 flex justify-center gap-24">
      {[0, 1].map((index) => (
        <span key={index} className="h-5 w-3 rounded-full border-2 border-ink-400 bg-base-50" />
      ))}
    </div>
  )
}

/** 今月のカード1枚(めくらない)。終わりの画面で、スタンプを押すところを見せる */
export function StampCardSheet({ plays, pressStage }: BookProps) {
  const now = new Date()
  return (
    <div className="relative">
      <Rings />
      <div aria-hidden="true" className="absolute inset-x-1.5 top-1 -bottom-1 rounded-3xl border-2 border-bloom-100 bg-white" />
      <Sheet className="relative">
        <StampMonth year={now.getFullYear()} month={now.getMonth()} plays={plays} pressStage={pressStage} />
      </Sheet>
    </div>
  )
}

/** めくる動き(ms)。紙が上の辺を軸に、奥へ倒れるように回る */
const FLIP_MS = 620

interface BookProps {
  plays: Record<string, number>
  /** 今日のマスに押す演出を出すとき(今月を開いているあいだだけ効く) */
  pressStage?: PressStage
}

/**
 * めくれるスタンプカード。前の月・次の月へ、壁かけカレンダーのようにめくる。
 *
 * 次の月へ進むときは、いまの紙が上の辺を軸に奥へめくれ上がり、下から次の紙が見える。
 * 前の月へ戻るときは、前の紙が上から倒れてきて、いまの紙の上にかぶさる。
 * 左右のスワイプでもめくれる。めくれるのは、記録のある最初の月から今月まで。
 */
export function StampCardBook({ plays, pressStage }: BookProps) {
  const copy = useCopy()
  const now = new Date()
  /** 今月を 0 として、何か月前か(0, 1, 2…) */
  const earliest = Object.keys(plays).sort()[0]
  const maxBack = earliest
    ? Math.max(0, (now.getFullYear() - Number(earliest.slice(0, 4))) * 12 + now.getMonth() - (Number(earliest.slice(5, 7)) - 1))
    : 0
  const [back, setBack] = useState(0)
  /** めくっている途中の紙。どの月を、どちら向きに動かしているか */
  const [flipping, setFlipping] = useState<{ back: number; direction: 'away' | 'over' } | null>(null)
  const flipRef = useRef<HTMLDivElement>(null)
  const swipe = useRef<{ x: number; y: number } | null>(null)

  const monthOf = (offset: number) => {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    return { year: date.getFullYear(), month: date.getMonth() }
  }

  const go = (to: number) => {
    if (flipping || to < 0 || to > maxBack || to === back) return
    if (prefersReducedMotion()) {
      setBack(to)
      return
    }
    if (to < back) {
      // 次の月へ。いまの紙を上にのせて奥へめくり、下には次の月を置いておく
      setFlipping({ back, direction: 'away' })
      setBack(to)
    } else {
      // 前の月へ。前の紙を上から倒してかぶせ、倒れきったら入れ替える
      setFlipping({ back: to, direction: 'over' })
    }
  }

  useLayoutEffect(() => {
    const element = flipRef.current
    if (!flipping || !element) return
    const away = flipping.direction === 'away'
    const frames: Keyframe[] = away
      ? [
          { transform: 'rotateX(0deg)', filter: 'brightness(1)' },
          { transform: 'rotateX(100deg)', filter: 'brightness(0.8)' },
        ]
      : [
          { transform: 'rotateX(100deg)', filter: 'brightness(0.8)' },
          { transform: 'rotateX(0deg)', filter: 'brightness(1)' },
        ]
    const animation = element.animate(frames, {
      duration: FLIP_MS,
      easing: away ? 'cubic-bezier(0.45, 0, 0.75, 0.6)' : 'cubic-bezier(0.25, 0.9, 0.35, 1.15)',
      fill: 'forwards',
    })
    animation.onfinish = () => {
      if (!away) setBack(flipping.back)
      setFlipping(null)
    }
    return () => animation.cancel()
  }, [flipping])

  const shown = monthOf(back)
  const moving = flipping ? monthOf(flipping.back) : null
  const isThisMonth = back === 0

  const onPointerDown = (event: ReactPointerEvent) => {
    swipe.current = { x: event.clientX, y: event.clientY }
  }
  const onPointerUp = (event: ReactPointerEvent) => {
    const start = swipe.current
    swipe.current = null
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return
    // 左へはらうと次の月、右へはらうと前の月(本のページと同じ向き)
    go(dx < 0 ? back - 1 : back + 1)
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative touch-pan-y select-none"
        style={{ perspective: '1100px' }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (swipe.current = null)}
      >
        <Rings />
        {/* 下に重なった紙。めくるカレンダーの厚みに見せる */}
        <div aria-hidden="true" className="absolute inset-x-3 top-2 -bottom-2 rounded-3xl border-2 border-bloom-100 bg-base-50" />
        <div aria-hidden="true" className="absolute inset-x-1.5 top-1 -bottom-1 rounded-3xl border-2 border-bloom-100 bg-white" />

        <Sheet className="relative">
          <StampMonth {...shown} plays={plays} pressStage={isThisMonth ? pressStage : undefined} />
        </Sheet>

        {moving && (
          <div
            ref={flipRef}
            aria-hidden="true"
            className="absolute inset-0 z-10 origin-top [backface-visibility:hidden]"
            style={{ transform: flipping?.direction === 'over' ? 'rotateX(100deg)' : undefined }}
          >
            <Sheet className="h-full">
              <StampMonth {...moving} plays={plays} />
            </Sheet>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => go(back + 1)}
          disabled={back >= maxBack || flipping !== null}
          aria-label={copy.stampCard.prev}
          className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-bloom-200 text-xl font-bold text-ink-600 disabled:opacity-30"
        >
          ‹
        </button>
        <p className="flex-1 text-center text-sm font-bold text-ink-600">
          {copy.stampCard.monthTotal(stampsIn(shown.year, shown.month, plays))}
        </p>
        <button
          type="button"
          onClick={() => go(back - 1)}
          disabled={back <= 0 || flipping !== null}
          aria-label={copy.stampCard.next}
          className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-bloom-200 text-xl font-bold text-ink-600 disabled:opacity-30"
        >
          ›
        </button>
      </div>
    </div>
  )
}

/**
 * 今日の回数を、STAMP_GOAL 個の玉で見せる。
 * added は、このあそびで増えたぶん。その玉だけ、1つずつはずむように埋まる。
 */
export function TodayMeter({ count, added = 0 }: { count: number; added?: number }) {
  const filled = Math.min(count, STAMP_GOAL)
  const firstNew = Math.max(0, filled - added)
  return (
    <div aria-hidden="true" className="flex justify-center gap-1.5">
      {Array.from({ length: STAMP_GOAL }, (_, index) => (
        <span key={index} className="relative size-5 rounded-full bg-bloom-100">
          {index < filled && (
            <span
              className={`absolute inset-0 rounded-full bg-bloom-500 ${index >= firstNew ? 'animate-dot-pop' : ''}`}
              style={index >= firstNew ? { animationDelay: `${300 + (index - firstNew) * 130}ms` } : undefined}
            />
          )}
        </span>
      ))}
    </div>
  )
}
