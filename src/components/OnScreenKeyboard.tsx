interface OnScreenKeyboardProps {
  onKey: (letter: string) => void
  onBackspace: () => void
  onSubmit: () => void
  canSubmit: boolean
  /** 決定キーの文字。一般向けとこども向けで表記が違う */
  submitLabel: string
  disabled?: boolean
}

/** 見慣れた並びのほうが迷わないので QWERTY を採る */
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'] as const

/**
 * 画面内のアルファベットキーボード。
 *
 * OS のキーボードを出さないために置いている。
 * iOS の予測変換バーは autocomplete/autocorrect/spellcheck では消せず、
 * 「lib」まで打つと候補に library が出て答えが割れてしまうため。
 *
 * キーの高さは固定せず、余った高さを配ってもらう(下限 min-h-9 / 全体 max-h-40)。
 * 固定値にすると、大きい端末では小さすぎ、小さい端末でははみ出すため。
 *
 * 出題の答えは a〜z のみ(生成時に1語の英単語に限っている)なので、
 * 記号・数字・スペースは置かない。
 */
export function OnScreenKeyboard({
  onKey,
  onBackspace,
  onSubmit,
  canSubmit,
  submitLabel,
  disabled = false,
}: OnScreenKeyboardProps) {
  return (
    <div
      className="flex max-h-40 min-h-0 flex-1 flex-col gap-1.5"
      role="group"
      aria-label="アルファベットキーボード"
    >
      {ROWS.map((row) => (
        <div key={row} className="flex min-h-9 flex-1 justify-center gap-1.5">
          {[...row].map((letter) => (
            <button
              key={letter}
              type="button"
              disabled={disabled}
              onClick={() => onKey(letter)}
              className="h-full flex-1 rounded-lg bg-white text-xl font-bold text-ink-900 shadow-sm active:bg-bloom-100 disabled:text-ink-400"
            >
              {letter}
            </button>
          ))}
        </div>
      ))}

      <div className="mt-1 flex shrink-0 gap-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={onBackspace}
          aria-label="1文字消す"
          className="min-h-12 flex-1 rounded-lg border-2 border-bloom-200 text-lg font-bold text-ink-600 disabled:text-ink-400"
        >
          ⌫
        </button>
        <button
          type="button"
          disabled={disabled || !canSubmit}
          onClick={onSubmit}
          className="min-h-12 flex-2 rounded-lg bg-bloom-700 text-lg font-bold text-white disabled:bg-bloom-200"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  )
}
