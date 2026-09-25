import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { AssembleLayout } from '@/features/assemble'
import { useCopy } from '@/hooks/useAudienceMode'

interface PartsInputProps {
  /** 下のトレイに並べるタイル(正解の2部品 + ダミー) */
  tiles: string[]
  /** 割れる向き。マスを左右に割るか、上下に割るか */
  layout: AssembleLayout
  /**
   * 置いた2部品が字として組み上がるなら、その字。組み上がらないなら null。
   *
   * 正解の部品そのものは渡さない。この画面は答えを持たないまま、
   * 「組み上がったかどうか」だけを受け取って演出する。
   */
  assembledOf: (first: string, second: string) => string | null
  /** 組み上がりを見せ終わったとき。first は左(または上) */
  onSubmit: (first: string, second: string) => void
  /** 「思い出した」を押してタイルが出たとき。お手本を引っこめる側で使う */
  onReveal?: () => void
  disabled?: boolean
}

/** マスの2枠。first = 左(または上)、second = 右(または下) */
type Slot = 'first' | 'second'
type Source = Slot | 'tray'

interface Dragging {
  tile: string
  from: Source
  /** 指の現在位置(ゴーストの追従に使う) */
  x: number
  y: number
  /** つかんだ位置。ほとんど動いていなければ「タップ」として扱う */
  startX: number
  startY: number
}

/** 指がわずかに動いただけならタップ扱いにするしきい値(px) */
const TAP_SLOP = 8

/**
 * 「こたえあわせ」を押してからの段階。
 * placing = 組み立て中、joining = 2部品が寄っていく、built = 字になって咲いた
 */
type Phase = 'placing' | 'joining' | 'built'

/** 2部品が寄るまで(ms) */
const JOIN_MS = 300
/** 組み上がった字を見せておく時間(ms) */
const HOLD_MS = 750
/** 組み上がらなかったときに、離れた形へ戻して見せる時間(ms) */
const MISS_MS = 200

/**
 * こたえあわせで2部品が寄る向き。半分の枠の幅(高さ)に対する割合で動かす。
 * 寄せきらないのは、字に置き換わるまで部品のままだと分かるようにしておくため。
 */
const JOIN_SHIFT: Record<AssembleLayout, Record<Slot, string>> = {
  horizontal: { first: 'translate-x-[18%]', second: '-translate-x-[18%]' },
  vertical: { first: 'translate-y-[18%]', second: '-translate-y-[18%]' },
}

/*
 * 寸法は画面の高さで2段階に切り替える。
 *
 * マスもタイルも高さが決まっているので、縦に短い端末ではヒント枠へせり上がってしまう
 * (手書きのキャンバスと違って縮まない)。背の高い端末だけ大きい寸法にする。
 * 判定は画面幅ではなく高さで行う。せり上がるかどうかを決めているのは高さのため。
 *
 * 変種は [@media(min-height:780px)]: をクラス名に直接書く。
 * Tailwind はソースを文字列として走査するので、変数と連結して組み立てた
 * クラス名(`${TALL}:size-32` のような形)は生成されない。
 */

/**
 * 部品を1つのマスに組んで漢字を作る入力。
 *
 * タイルは「思い出した」を押すまで見せない。
 * 先に並べると、思い出さずに見比べて選べてしまい、再認の練習にしかならないため。
 *
 * マスは結果画面の「おてほん」と同じ正方形+十字ガイドにする。書いて覚える先の形と
 * 同じ枠に組ませたいため。十字ガイドがそのまま2枠の境目になり、部品はマスの半分に入る。
 * 下のトレイからタイルをスライドして枠に当てはめ、2枠そろったら判定する。
 * どちらに置いたかまで正解に含めるので、入れ替えると不正解。
 * タップでも置けるようにして、ドラッグが苦手でも詰まらないようにする。
 *
 * 「こたえあわせ」を押すと、2部品がマスの中央へ寄って**1字に組み上がる**。
 * 組み上がりを見せるのは押した後だけにしている。置いた時点で字になると、
 * 総当たりで正解が分かってしまい、思い出す練習にならないため。
 */
export function PartsInput({
  tiles,
  layout,
  assembledOf,
  onSubmit,
  onReveal,
  disabled = false,
}: PartsInputProps) {
  const copy = useCopy()
  const [revealed, setRevealed] = useState(false)
  const [placed, setPlaced] = useState<{ first: string | null; second: string | null }>({
    first: null,
    second: null,
  })
  const [dragging, setDragging] = useState<Dragging | null>(null)
  /** ドラッグ中に指が乗っている枠。ハイライトに使う */
  const [hovered, setHovered] = useState<Slot | null>(null)
  const [phase, setPhase] = useState<Phase>('placing')
  /** 組み上がった字。組み上がらなかったときは null のまま */
  const [assembled, setAssembled] = useState<string | null>(null)

  const firstRef = useRef<HTMLDivElement>(null)
  const secondRef = useRef<HTMLDivElement>(null)

  /** 演出中のタイマー。答え合わせの途中で画面を離れても後片付けできるように持つ */
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  /** 組み立て中以外(=演出が始まった後)はタイルを動かせない */
  const locked = disabled || phase !== 'placing'

  // トレイに残すのは、まだどちらの枠にも置いていないタイル
  const trayTiles = tiles.filter((tile) => tile !== placed.first && tile !== placed.second)
  const ready = placed.first !== null && placed.second !== null

  /** 座標がどちらの枠の上か(枠の外なら null) */
  const slotAt = (x: number, y: number): Slot | null => {
    for (const [slot, ref] of [
      ['first', firstRef],
      ['second', secondRef],
    ] as const) {
      const rect = ref.current?.getBoundingClientRect()
      if (rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return slot
      }
    }
    return null
  }

  /** タイルを枠に置く。置き先に別のタイルがあれば入れ替える */
  const place = (tile: string, from: Source, slot: Slot) => {
    setPlaced((current) => {
      const next = { ...current }
      // どこか別の枠から動かしてきたなら、そこは空ける
      if (from === 'first' || from === 'second') next[from] = null
      // 置き先に居たタイルは、もと居た枠へ戻す(入れ替え)。トレイからならトレイへ押し出す
      const displaced = next[slot]
      next[slot] = tile
      if (displaced && (from === 'first' || from === 'second')) next[from] = displaced
      return next
    })
  }

  const onPointerDown = (event: ReactPointerEvent, tile: string, from: Source) => {
    if (locked) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging({
      tile,
      from,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
    })
  }

  const onPointerMove = (event: ReactPointerEvent) => {
    if (!dragging) return
    setDragging({ ...dragging, x: event.clientX, y: event.clientY })
    setHovered(slotAt(event.clientX, event.clientY))
  }

  const onPointerUp = (event: ReactPointerEvent) => {
    if (!dragging) return
    const { tile, from, startX, startY } = dragging
    const target = slotAt(event.clientX, event.clientY)
    const isTap =
      Math.abs(event.clientX - startX) < TAP_SLOP && Math.abs(event.clientY - startY) < TAP_SLOP

    if (target) {
      place(tile, from, target)
    } else if (from === 'first' || from === 'second') {
      // マスの外へ出したら、その枠を空けてトレイへ戻す
      setPlaced((current) => ({ ...current, [from]: null }))
    } else if (isTap) {
      // トレイのタイルをタップ:空いている枠(左・上を優先)へ入れる
      const open: Slot | null =
        placed.first === null ? 'first' : placed.second === null ? 'second' : null
      if (open) place(tile, 'tray', open)
    }

    setDragging(null)
    setHovered(null)
  }

  /** あとで片付けられるように、タイマーは必ずここを通して仕掛ける */
  const later = (run: () => void, ms: number) => {
    timers.current.push(window.setTimeout(run, ms))
  }

  /**
   * こたえあわせ。2部品を中央へ寄せ、組み上がるなら字に置き換えてから結果画面へ渡す。
   *
   * 組み上がりを見せるのはここだけ。置いた時点で字になると、
   * 入れ替えて試すだけで正解が分かってしまう。
   */
  const submit = () => {
    const { first, second } = placed
    if (!first || !second || phase !== 'placing') return

    const composed = assembledOf(first, second)
    setAssembled(composed)
    setPhase('joining')

    later(() => {
      if (composed) {
        // 組み上がった字を少し見せてから結果画面へ
        setPhase('built')
        later(() => onSubmit(first, second), HOLD_MS)
      } else {
        // 組み上がらないので、離れた形に戻してから結果画面へ
        setPhase('placing')
        later(() => onSubmit(first, second), MISS_MS)
      }
    }, JOIN_MS)
  }

  if (!revealed) {
    return (
      <div className="flex shrink-0 flex-col gap-3">
        <p className="text-center text-sm text-ink-600">
          {copy.parts.recall[0]}
          <br />
          {copy.parts.recall[1]}
        </p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setRevealed(true)
            onReveal?.()
          }}
          className="min-h-14 rounded-full bg-bloom-700 px-6 text-lg font-bold text-white disabled:bg-bloom-200"
        >
          {copy.parts.recalled}
        </button>
      </div>
    )
  }

  return (
    <div className="flex shrink-0 flex-col gap-2 select-none [@media(min-height:780px)]:gap-3">
      <p className="text-center text-sm text-ink-600">{copy.parts.heading[layout]}</p>

      {/* 組み立てのマス。結果画面のおてほんと同じ正方形+十字ガイドに揃える */}
      <div className="relative mx-auto size-20 rounded-2xl border-2 border-bloom-200 bg-white [@media(min-height:780px)]:size-32">
        {/* 十字ガイドは字形を追うための飾り。割れる向きの線がそのまま2枠の境目になる */}
        <span
          aria-hidden="true"
          className="absolute inset-x-3 top-1/2 border-t border-dashed border-bloom-200"
        />
        <span
          aria-hidden="true"
          className="absolute inset-y-3 left-1/2 border-l border-dashed border-bloom-200"
        />

        {/* 部品の層。組み上がったら消えて、下の字の層と入れ替わる */}
        <div
          className={`absolute inset-0 flex transition-opacity duration-300 ${
            layout === 'vertical' ? 'flex-col' : 'flex-row'
          } ${phase === 'built' ? 'opacity-0' : ''}`}
        >
          {(['first', 'second'] as const).map((slot) => {
            const tile = placed[slot]
            return (
              <div
                key={slot}
                ref={slot === 'first' ? firstRef : secondRef}
                className={`flex flex-1 items-center justify-center rounded-xl transition-colors ${
                  hovered === slot ? 'bg-bloom-100' : ''
                }`}
              >
                {tile ? (
                  <button
                    type="button"
                    disabled={locked}
                    onPointerDown={(event) => onPointerDown(event, tile, slot)}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    // マスの半分に収まる大きさ。2つ並ぶと1字ぶんの見た目になる。
                    // こたえあわせを押したら相手へ寄せ、字に置き換わるまでその位置に留める
                    className={`flex h-full w-full touch-none items-center justify-center font-display text-3xl leading-none text-ink-900 transition-transform duration-300 [@media(min-height:780px)]:text-5xl ${
                      phase === 'placing' ? '' : JOIN_SHIFT[layout][slot]
                    }`}
                  >
                    {tile}
                  </button>
                ) : (
                  // 小さいマスでは「つくり」が折り返すので、枠に収まる字面まで落とす
                  <span className="text-xs whitespace-nowrap text-ink-400 [@media(min-height:780px)]:text-sm">
                    {copy.parts.slot[layout][slot]}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* 組み上がった字。マスいっぱいに、ヒントと同じ「咲く」動きで現れる */}
        {phase === 'built' && assembled && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="animate-bloom-in font-display text-5xl leading-none text-bloom-700 [@media(min-height:780px)]:text-7xl">
              {assembled}
            </span>
          </div>
        )}
      </div>

      {/* 下のトレイ。ここからスライド(またはタップ)してマスへ入れる */}
      <div className="grid grid-cols-4 gap-2">
        {trayTiles.map((tile) => (
          <button
            key={tile}
            type="button"
            disabled={locked}
            onPointerDown={(event) => onPointerDown(event, tile, 'tray')}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className={`min-h-11 touch-none rounded-xl border-2 border-bloom-200 bg-white font-display text-2xl text-ink-900 [@media(min-height:780px)]:min-h-14 [@media(min-height:780px)]:text-3xl ${
              dragging?.from === 'tray' && dragging.tile === tile ? 'opacity-40' : ''
            }`}
          >
            {tile}
          </button>
        ))}
      </div>

      <button
        type="button"
        // 演出中も緑のまま置いておく。押しても submit 側で弾く
        disabled={disabled || !ready}
        onClick={submit}
        className="min-h-11 rounded-full bg-bloom-700 px-6 text-lg font-bold text-white disabled:bg-bloom-200 [@media(min-height:780px)]:min-h-12"
      >
        {copy.parts.submit}
      </button>

      {/* ドラッグ中に指を追うゴースト。指の先に浮かせて、どれを運んでいるか見せる */}
      {dragging && (
        <div
          className="pointer-events-none fixed z-50 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border-2 border-bloom-700 bg-white font-display text-5xl leading-none text-ink-900 shadow-lg"
          style={{ left: dragging.x, top: dragging.y }}
        >
          {dragging.tile}
        </div>
      )}
    </div>
  )
}
