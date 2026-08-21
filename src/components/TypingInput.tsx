import { useState } from 'react'

interface TypingInputProps {
  onSubmit: (value: string) => void
  disabled?: boolean
}

/** タイピング入力。判定はレベル1+レベル2(features/judge)が担う */
export function TypingInput({ onSubmit, disabled = false }: TypingInputProps) {
  const [value, setValue] = useState('')

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (!value.trim()) return
        onSubmit(value)
      }}
    >
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={disabled}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="こたえを入力"
        aria-label="こたえを入力"
        className="w-full rounded-2xl border-2 border-petal-200 bg-white px-4 py-4 text-lg outline-none focus:border-petal-400"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="min-h-14 rounded-full bg-petal-500 px-6 text-lg font-bold text-white disabled:bg-petal-200"
      >
        こたえあわせ
      </button>
    </form>
  )
}
