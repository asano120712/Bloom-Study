interface NumberPadProps {
  onKey: (digit: string) => void
  onBackspace: () => void
  onSubmit: () => void
  canSubmit: boolean
  submitLabel: string
  /** 小数点のキーを出す(小数の答えを打つときだけ。整数の問題で出すと、押し間違えの元になる) */
  allowDecimal?: boolean
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
  allowDecimal = false,
  disabled = false,
}: NumberPadProps) {
  return (
    <div
      /*
        高さは先に確保する(最低 11rem = 4段が指で押せる高さ、最大 18rem)。
        余った高さをもらう作りにすると、筆算の段が増えたときに押し出されて、
        背の低い端末(iPhone SE)で一番下の段(消す・0・こたえあわせ)が画面から切れていた。
      */
      // 背の低い端末では筆算の置き場所も要るので、画面の高さの 30% までにとどめる
      className="flex h-[clamp(11rem,30svh,18rem)] shrink-0 flex-col gap-2"
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
          // 小数点のキーがあるときは、消すキーと小数点を細くして「こたえあわせ」が折り返さない幅を残す
          className={`h-full ${allowDecimal ? 'flex-[0.8]' : 'flex-1'} rounded-xl border-2 border-bloom-200 text-xl font-bold text-ink-600 disabled:text-ink-400`}
        >
          ⌫
        </button>
        <NumberKey digit="0" onKey={onKey} disabled={disabled} />
        {allowDecimal && (
          <NumberKey digit="." label="小数点" onKey={onKey} disabled={disabled} className="flex-[0.8]" />
        )}
        <button
          type="button"
          disabled={disabled || !canSubmit}
          onClick={onSubmit}
          // キーの幅は画面幅で決まるので、文字も幅に合わせて頭打ちにする
          className={`h-full ${allowDecimal ? 'flex-[1.6]' : 'flex-1'} rounded-xl bg-bloom-700 text-[min(1rem,4vw)] font-bold text-white disabled:bg-bloom-200`}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  )
}

function NumberKey({
  digit,
  label,
  onKey,
  disabled,
  className = 'flex-1',
}: {
  digit: string
  /** 読み上げの名前。「.」だけでは何のキーか伝わらない */
  label?: string
  /** 幅の取り方(既定は他のキーと同じ幅) */
  className?: string
  onKey: (digit: string) => void
  disabled: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      onClick={() => onKey(digit)}
      className={`h-full ${className} rounded-xl bg-white text-3xl font-bold text-ink-900 shadow-sm active:bg-bloom-100 disabled:text-ink-400`}
    >
      {digit}
    </button>
  )
}
