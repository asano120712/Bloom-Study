import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { AssembleLayout } from '@/features/assemble'

interface PartsInputProps {
  /** 下のトレイに並べるタイル(正解の2部品 + ダミー) */
  tiles: string[]
  /** 割れる向き。マスを左右に割るか、上下に割るか */
  layout: AssembleLayout
  /** 2枠を埋めて「こたえあわせ」を押したとき。first は左(または上) */
  onSubmit: (first: string, second: string) => void
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

/** 空き枠に出す見出し。何をどこに置くのかを枠自体に書いておく */
const SLOT_LABEL: Record<AssembleLayout, Record<Slot, string>> = {
  horizontal: { first: 'へん', second: 'つくり' },
  vertical: { first: 'うえ', second: 'した' },
}

const HEADING: Record<AssembleLayout, string> = {
  horizontal: 'へん(左)と つくり(右)を 組もう',
  vertical: 'うえと したを 組もう',
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
 */
export function PartsInput({ tiles, layout, onSubmit, disabled = false }: PartsInputProps) {
  const [revealed, setRevealed] = useState(false)
  const [placed, setPlaced] = useState<{ first: string | null; second: string | null }>({
    first: null,
    second: null,
  })
  const [dragging, setDragging] = useState<Dragging | null>(null)
  /** ドラッグ中に指が乗っている枠。ハイライトに使う */
  const [hovered, setHovered] = useState<Slot | null>(null)

  const firstRef = useRef<HTMLDivElement>(null)
  const secondRef = useRef<HTMLDivElement>(null)

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
    if (disabled) return
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

  if (!revealed) {
    return (
      <div className="flex shrink-0 flex-col gap-3">
        <p className="text-center text-sm text-ink-600">
          あたまの中で書いてみよう。
          <br />
          思い出せたら部品を組み立てます。
        </p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setRevealed(true)}
          className="min-h-14 rounded-full bg-bloom-700 px-6 text-lg font-bold text-white disabled:bg-bloom-200"
        >
          思い出した
        </button>
      </div>
    )
  }

  return (
    <div className="flex shrink-0 flex-col gap-2 select-none [@media(min-height:780px)]:gap-3">
      <p className="text-center text-sm text-ink-600">{HEADING[layout]}</p>

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

        <div
          className={`absolute inset-0 flex ${layout === 'vertical' ? 'flex-col' : 'flex-row'}`}
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
                    disabled={disabled}
                    onPointerDown={(event) => onPointerDown(event, tile, slot)}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    // マスの半分に収まる大きさ。2つ並ぶと1字ぶんの見た目になる
                    className="flex h-full w-full touch-none items-center justify-center font-display text-3xl leading-none text-ink-900 [@media(min-height:780px)]:text-5xl"
                  >
                    {tile}
                  </button>
                ) : (
                  // 小さいマスでは「つくり」が折り返すので、枠に収まる字面まで落とす
                  <span className="text-xs whitespace-nowrap text-ink-400 [@media(min-height:780px)]:text-sm">
                    {SLOT_LABEL[layout][slot]}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 下のトレイ。ここからスライド(またはタップ)してマスへ入れる */}
      <div className="grid grid-cols-4 gap-2">
        {trayTiles.map((tile) => (
          <button
            key={tile}
            type="button"
            disabled={disabled}
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
        disabled={disabled || !ready}
        onClick={() => {
          if (placed.first && placed.second) onSubmit(placed.first, placed.second)
        }}
        className="min-h-11 rounded-full bg-bloom-700 px-6 text-lg font-bold text-white disabled:bg-bloom-200 [@media(min-height:780px)]:min-h-12"
      >
        こたえあわせ
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
