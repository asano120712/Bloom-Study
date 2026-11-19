/**
 * 出題画面の言葉に、答えの字を隠しきれない言葉が無いかを調べる。
 *
 * 漢字の問題では、答えの字が入った言葉をひらがなにして出す(src/features/conceal)。
 * ひらがなは言葉ごとに表(KANA_OF)で持つので、画面に言葉を足して表に足し忘れると、
 * その字が答えの問題で、答えが画面に見えてしまう。
 *
 * 出題画面に出る言葉(data/copy.ts の SECTIONS)のすべての漢字について、
 * その字が答えだったときに隠しきれるかを確かめる。足りない言葉があれば挙げて、失敗で終わる。
 *
 *   npm run check:conceal
 */
import { concealText } from '../src/features/conceal/index.ts'

/*
 * 言葉の表(data/copy.ts)は、型を '@/types' などの別名から読んでいる。スクリプト用の型チェック
 * (tsconfig.node.json)は別名を解決できないので、型を見ずに実行時だけ読む(型の import は実行時に消える)。
 */
const COPY_PATH = '../src/data/copy.ts'
const { copyOf } = (await import(COPY_PATH)) as { copyOf: (mode: 'adult' | 'kids') => unknown }

/** 漢字の出題中に画面に出る言葉のまとまり(ヘッダー・やめるときの確かめもふくむ) */
const SECTIONS = ['genrePrompt', 'quiz', 'hints', 'parts', 'handwriting', 'typing', 'build', 'exit'] as const

const KANJI = /[一-龯]/g

/** 文字列と、文字列を返す関数(進み具合など)から、画面に出る文字列を集める */
function collect(value: unknown, into: Set<string>): void {
  if (typeof value === 'string') into.add(value)
  else if (typeof value === 'function') {
    const result = (value as (...args: unknown[]) => unknown)(3, 5)
    if (typeof result === 'string') into.add(result)
  } else if (Array.isArray(value)) value.forEach((item) => collect(item, into))
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => collect(item, into))
}

const texts = new Set<string>()
for (const mode of ['adult', 'kids'] as const) {
  const copy = copyOf(mode) as unknown as Record<string, unknown>
  for (const section of SECTIONS) collect(copy[section], texts)
  // ジャンルは名前だけが出題画面の左上に出る(説明はジャンル選択の画面だけ)
  for (const activity of Object.values(copy.activities as Record<string, { label: string }>)) texts.add(activity.label)
}

const misses: string[] = []
for (const text of texts) {
  for (const char of new Set(text.match(KANJI) ?? [])) {
    if (concealText(text, char).includes(char)) misses.push(`「${char}」が答えのとき: ${text} → ${concealText(text, char)}`)
  }
}

console.log(`出題画面の言葉: ${texts.size}件`)
if (misses.length > 0) {
  console.log(`隠しきれない言葉: ${misses.length}件(src/features/conceal の KANA_OF に足す)`)
  for (const miss of misses) console.log(`  ${miss}`)
  process.exit(1)
}
console.log('どの字が答えでも、画面の言葉で答えは見えません')
