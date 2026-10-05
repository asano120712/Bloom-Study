interface NumberPadProps {
  onKey: (digit: string) => void
  onBackspace: () => void
  onSubmit: () => void
  canSubmit: boolean
  submitLabel: string
  disabled?: boolean
}

/** 電話やテンキーと同じ並び。見慣れた並びのほうが迷わない */
const ROWS = ['123', '456', '789'] as const

/**
 * 画面内の数字キーボード。
 *
 * アルファベットのキーボードと別に持つ。数の答えに a〜z は要らないし、
 * キーが10個なら1つずつを大きく取れる(小さい子の指でも押し分けられる)。
 * OS のキーボードを出さないのはアルファベット側と同じ理由
 * (iOS の予測変換バーを抑止できない)。
 */
export function NumberPad({
  onKey,
  onBackspace,
  onSubmit,
  canSubmit,
  submitLabel,
  disabled = false,
}: NumberPadProps) {
  return (
    <div
      className="flex max-h-72 min-h-0 flex-1 flex-col gap-2"
      role="group"
      aria-label="数字キーボード"
    >
      {ROWS.map((row) => (
        <div key={row} className="flex min-h-11 flex-1 justify-center gap-2">
          {[...row].map((digit) => (
            <NumberKey key={digit} digit={digit} onKey={onKey} disabled={disabled} />
          ))}
        </div>
      ))}

      <div className="flex min-h-11 flex-1 justify-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={onBackspace}
          aria-label="1文字消す"
          className="h-full flex-1 rounded-xl border-2 border-bloom-200 text-xl font-bold text-ink-600 disabled:text-ink-400"
        >
          ⌫
        </button>
        <NumberKey digit="0" onKey={onKey} disabled={disabled} />
        <button
          type="button"
          disabled={disabled || !canSubmit}
          onClick={onSubmit}
          // キーの幅は画面幅で決まるので、文字も幅に合わせて頭打ちにする
          className="h-full flex-1 rounded-xl bg-bloom-700 text-[min(1rem,4vw)] font-bold text-white disabled:bg-bloom-200"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  )
}

function NumberKey({
  digit,
  onKey,
  disabled,
}: {
  digit: string
  onKey: (digit: string) => void
  disabled: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onKey(digit)}
      className="h-full flex-1 rounded-xl bg-white text-3xl font-bold text-ink-900 shadow-sm active:bg-bloom-100 disabled:text-ink-400"
    >
      {digit}
    </button>
  )
}
