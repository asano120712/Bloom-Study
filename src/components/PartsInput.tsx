import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

interface PartsInputProps {
  /** 下のトレイに並べるタイル(へん・つくりの正解 + ダミー) */
  tiles: string[]
  /** へん(左)とつくりを組んで「こたえあわせ」を押したとき */
  onSubmit: (left: string, right: string) => void
  disabled?: boolean
}

type Slot = 'left' | 'right'
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
 * へん(左)とつくり(右)を2つの枠に組んで漢字を作る入力。
 *
 * タイルは「思い出した」を押すまで見せない。
 * 先に並べると、思い出さずに見比べて選べてしまい、再認の練習にしかならないため。
 *
 * 下のトレイからタイルをスライドして枠に当てはめ、左右がそろったら判定する。
 * どちらに置いたか(へん/つくり)まで正解に含めるので、左右を入れ替えると不正解。
 * タップでも置けるようにして、ドラッグが苦手でも詰まらないようにする。
 */
export function PartsInput({ tiles, onSubmit, disabled = false }: PartsInputProps) {
  const [revealed, setRevealed] = useState(false)
  const [placed, setPlaced] = useState<{ left: string | null; right: string | null }>({
    left: null,
    right: null,
  })
  const [dragging, setDragging] = useState<Dragging | null>(null)
  /** ドラッグ中に指が乗っている枠。ハイライトに使う */
  const [hovered, setHovered] = useState<Slot | null>(null)

  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)

  // トレイに残すのは、まだどちらの枠にも置いていないタイル
  const trayTiles = tiles.filter((tile) => tile !== placed.left && tile !== placed.right)
  const ready = placed.left !== null && placed.right !== null

  /** 座標がどちらの枠の上か(枠の外なら null) */
  const slotAt = (x: number, y: number): Slot | null => {
    for (const [slot, ref] of [
      ['left', leftRef],
      ['right', rightRef],
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
      // どこか別の枠に同じ経路で入っていたら、そこは空ける
      if (from === 'left' || from === 'right') next[from] = null
      // 置き先に居たタイルは、もと居た枠へ戻す(入れ替え)。トレイからなら押し出す
      const displaced = next[slot]
      next[slot] = tile
      if (displaced && (from === 'left' || from === 'right')) next[from] = displaced
      return next
    })
  }

  const removeFromSlot = (slot: Slot) => {
    setPlaced((current) => ({ ...current, [slot]: null }))
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
    } else if (from === 'left' || from === 'right') {
      // 枠の外に出したら、その枠を空けてトレイへ戻す
      removeFromSlot(from)
    } else if (isTap) {
      // トレイのタイルをタップ:空いている枠(左優先)へ入れる
      const open: Slot | null = placed.left === null ? 'left' : placed.right === null ? 'right' : null
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
    <div className="flex shrink-0 flex-col gap-4 select-none">
      <p className="text-center text-sm text-ink-600">
        へん(左)と つくり(右)を ならべて 漢字を つくろう
      </p>

      {/* 組み立ての枠。左右の枠をくっつけて、ひとつの漢字に見せる */}
      <div className="mx-auto flex overflow-hidden rounded-2xl border-2 border-bloom-200 bg-white">
        {(['left', 'right'] as const).map((slot) => {
          const tile = placed[slot]
          const isHover = hovered === slot
          return (
            <div
              key={slot}
              ref={slot === 'left' ? leftRef : rightRef}
              className={`flex h-24 w-24 items-center justify-center text-5xl font-bold transition-colors ${
                slot === 'left' ? 'border-r border-dashed border-bloom-200' : ''
              } ${isHover ? 'bg-bloom-100' : tile ? 'bg-white' : 'bg-bloom-50'}`}
            >
              {tile ? (
                <button
                  type="button"
                  disabled={disabled}
                  onPointerDown={(event) => onPointerDown(event, tile, slot)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  className="flex h-full w-full touch-none items-center justify-center text-ink-900"
                >
                  {tile}
                </button>
              ) : (
                <span className="text-base font-normal text-ink-400">
                  {slot === 'left' ? 'へん' : 'つくり'}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* 下のトレイ。ここからスライド(またはタップ)して枠へ入れる */}
      <div className="grid grid-cols-4 gap-2">
        {trayTiles.map((tile) => (
          <button
            key={tile}
            type="button"
            disabled={disabled}
            onPointerDown={(event) => onPointerDown(event, tile, 'tray')}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className={`min-h-14 touch-none rounded-xl border-2 border-bloom-200 bg-white text-3xl font-bold text-ink-900 ${
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
          if (placed.left && placed.right) onSubmit(placed.left, placed.right)
        }}
        className="min-h-12 rounded-full bg-bloom-700 px-6 text-lg font-bold text-white disabled:bg-bloom-200"
      >
        こたえあわせ
      </button>

      {/* ドラッグ中に指を追うゴースト。指の先に浮かせて、どれを運んでいるか見せる */}
      {dragging && (
        <div
          className="pointer-events-none fixed z-50 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border-2 border-bloom-700 bg-white text-4xl font-bold text-ink-900 shadow-lg"
          style={{ left: dragging.x, top: dragging.y }}
        >
          {dragging.tile}
        </div>
      )}
    </div>
  )
}
