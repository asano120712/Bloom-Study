import { useState } from 'react'

interface PartsInputProps {
  /** 並べるタイル(正解パーツ + ダミー) */
  tiles: string[]
  /** 選ぶべきパーツの数。あと何個かを示すために使う */
  requiredCount: number
  onSubmit: (selected: string[]) => void
  disabled?: boolean
}

/**
 * 部品を選んで漢字を組み立てる入力。
 *
 * タイルは「思い出した」を押すまで見せない。
 * 先に並べると、思い出さずに見比べて選べてしまい、再認の練習にしかならないため。
 *
 * 並べ方(左右・上下)は当てさせない。KRADFILE に配置の情報が無く、
 * 画数から推測すると各(口+夂 どちらも3画)のような字で判定を誤る。
 */
export function PartsInput({ tiles, requiredCount, onSubmit, disabled = false }: PartsInputProps) {
  const [revealed, setRevealed] = useState(false)
  const [selected, setSelected] = useState<string[]>([])

  const toggle = (tile: string) => {
    setSelected((current) =>
      current.includes(tile) ? current.filter((t) => t !== tile) : [...current, tile],
    )
  }

  if (!revealed) {
    return (
      <div className="flex shrink-0 flex-col gap-3">
        <p className="text-center text-sm text-ink-600">
          あたまの中で書いてみよう。
          <br />
          思い出せたら部品をえらびます。
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
    <div className="flex shrink-0 flex-col gap-3">
      <p className="text-center text-sm text-ink-600">
        使われている部品を <span className="font-bold text-bloom-700">{requiredCount}</span> つえらぼう
        <span className="text-ink-400">（{selected.length} / {requiredCount}）</span>
      </p>

      <div className="grid grid-cols-4 gap-2">
        {tiles.map((tile) => {
          const isSelected = selected.includes(tile)
          return (
            <button
              key={tile}
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              onClick={() => toggle(tile)}
              className={`min-h-14 rounded-xl border-2 text-3xl font-bold ${
                isSelected
                  ? 'border-bloom-700 bg-bloom-700 text-white'
                  : 'border-bloom-200 bg-white text-ink-900'
              }`}
            >
              {tile}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        disabled={disabled || selected.length !== requiredCount}
        onClick={() => onSubmit(selected)}
        className="min-h-12 rounded-full bg-bloom-700 px-6 text-lg font-bold text-white disabled:bg-bloom-200"
      >
        こたえあわせ
      </button>
    </div>
  )
}
