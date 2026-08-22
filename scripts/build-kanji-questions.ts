/**
 * 漢字ジャンルの問題を KANJIDIC2 + KRADFILE から生成する。
 *
 * 実行時に辞書APIを叩くのではなく、開発時に1度だけ回して JSON をコミットする。
 * 生成物をそのまま出題に使わず、目視レビューして採否を決める前提。
 *
 * 使い方:
 *   npm run dict:fetch                       # 辞書データの取得(初回のみ)
 *   npm run questions:kanji                  # 既定(小学3〜6年配当)で生成
 *   npm run questions:kanji -- --grades=8    # 中学以上の常用漢字で生成
 *   npm run questions:kanji -- --report      # 生成せず、内訳と除外理由だけ出す
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { readDict } from './dict-cache.ts'
import { KRAD_VARIANTS, RADICAL_NAMES, VARIANT_NAMES, radicalGlyph } from './kanji-radicals.ts'

// ---------------------------------------------------------------- 辞書側の型

interface Kanjidic2 {
  dictDate: string
  characters: {
    literal: string
    radicals: { type: string; value: number }[]
    misc: {
      grade: number | null
      strokeCounts: number[]
      frequency: number | null
      jlptLevel: number | null
      radicalNames: string[]
    }
    readingMeaning: {
      groups: {
        readings: { type: string; value: string }[]
        meanings: { lang: string; value: string }[]
      }[]
    } | null
  }[]
}

interface Kradfile {
  kanji: Record<string, string[]>
}

// ------------------------------------------------------------------ 生成設定

/** ヒントは最低この数を確保できないと問題として出さない。 */
const MIN_HINTS = 3

/**
 * 「のこりのパーツ」に挙げる数の上限。
 * KRADFILE は複雑な字を筆画レベルまで割ることがあり(悪 → ｜/一/口/心)、
 * 4つ以上並べても字形が像を結ばずヒントとして機能しない。
 */
const MAX_REST_PARTS = 3

/**
 * 出題文に使ってよい訓読みの、辞書内での順位(0 = 主要な読み)。
 * ここを緩めると「圧→へす」「位→ぐらい」のような稀な読みが出題文になる。
 * 主要な読みが他の漢字と重複する字は、拾わずに落とす。
 */
const MAX_READING_RANK = 0

/**
 * 出題文の最短の長さ。1文字の読み(「や」→屋、「に」→荷)は
 * データ内で一意でも、解く側には答えを絞る手がかりにならない。
 */
const MIN_PROMPT_LENGTH = 2

/**
 * 単独では字形の像を結ばない筆画レベルのパーツ。
 * KRADFILE がこれらを返す字は分解が筆画まで降りているので、
 * 「のこりのパーツ」ヒントは作らない(悪 → ｜/一/口 は亜を指せていない)。
 */
const STROKE_PRIMITIVES = new Set(['｜', '一', 'ノ', '丿', '丶', '乙', '亅'])

const OUT_PATH = fileURLToPath(new URL('../src/data/questions.kanji.generated.json', import.meta.url))

const args = process.argv.slice(2)
const reportOnly = args.includes('--report')
const gradeArg = args.find((a) => a.startsWith('--grades='))?.slice('--grades='.length)
/** 既定は小学3〜6年配当。1〜2年は象形文字が多くパーツ分解のヒントが作れない。 */
const GRADES = (gradeArg ?? '3,4,5,6').split(',').map(Number)

// -------------------------------------------------------------- ヒントの組み立て

/** KRADFILE の正規化字を、表示してよい実際の字形に直す。 */
function displayGlyph(component: string): string {
  return KRAD_VARIANTS[component]?.glyph ?? component
}

/** その構成パーツが、この漢字の部首にあたるか。 */
function isRadicalComponent(component: string, radicalNumber: number): boolean {
  const variant = KRAD_VARIANTS[component]
  if (variant) return variant.radical === radicalNumber
  return component === radicalGlyph(radicalNumber)
}

/**
 * KANJIDIC2 の radicalNames は「その部首にあたる漢字」の側にしか入っていない
 * (安には無く、宀の項に「うかんむり」がある)。番号引きできるよう先に集約する。
 */
function collectKanjidicRadicalNames(kanjidic: Kanjidic2): Map<number, string> {
  const names = new Map<number, string>()
  for (const char of kanjidic.characters) {
    if (!char.misc.radicalNames.length) continue
    const number = char.radicals.find((r) => r.type === 'classical')?.value
    if (number !== undefined && !names.has(number)) names.set(number, char.misc.radicalNames[0])
  }
  return names
}

function radicalLabel(glyph: string, radicalNumber: number, fallbackNames: Map<number, string>): string {
  const name = VARIANT_NAMES[glyph] ?? RADICAL_NAMES[radicalNumber] ?? fallbackNames.get(radicalNumber)
  return name ? `${glyph}(${name})` : glyph
}

/**
 * KRADFILE は入れ子のパーツを重複して並べる(暗 → 日/音/立。立は音の一部)。
 * 他のパーツに含まれるものを落として、いちばん大きい単位だけ残す。
 */
function dropNestedParts(components: string[], kradfile: Kradfile): string[] {
  return components.filter((part) => {
    const glyph = displayGlyph(part)
    return !components.some((other) => {
      if (other === part) return false
      const inner = kradfile.kanji[displayGlyph(other)] ?? kradfile.kanji[other]
      return inner?.some((c) => c !== other && displayGlyph(c) === glyph) ?? false
    })
  })
}

interface BuildResult {
  hints: string[]
  /** 生成できなかった場合の理由。レポート用 */
  skipReason?: string
}

function buildHintSource(
  char: Kanjidic2['characters'][number],
  components: string[],
  kradfile: Kradfile,
  radicalNames: Map<number, string>,
): BuildResult {
  const literal = char.literal
  const radicalNumber = char.radicals.find((r) => r.type === 'classical')?.value
  if (!radicalNumber) return { hints: [], skipReason: '部首番号なし' }

  /** 見出しと本文を `|` で連結する。分解は kanjiHintRule 側で行う。 */
  const hints: string[] = []
  const push = (caption: string, text: string) => {
    // 答えそのものを含むヒントは出さない
    if (!text.includes(literal)) hints.push(`${caption}|${text}`)
  }

  const parts = dropNestedParts(components, kradfile)
  const radicalParts = parts.filter((c) => isRadicalComponent(c, radicalNumber))
  const restParts = parts.filter((c) => !isRadicalComponent(c, radicalNumber))

  // 構成パーツのどれとも部首が一致しない字(育の部首は肉だが、字形上は月)では、
  // どのパーツを指しているか特定できない。憶測で書かず、部首ヒント自体を出さない。
  const radical = radicalParts.length ? displayGlyph(radicalParts[0]) : null

  // 部首が漢字そのものの字(木・山など)では、部首ヒントが答えになってしまう
  if (radical && radical !== literal) {
    push('部首', radicalLabel(radical, radicalNumber, radicalNames))

    const strokeLevel = restParts.some((c) => STROKE_PRIMITIVES.has(displayGlyph(c)))
    if (restParts.length && restParts.length <= MAX_REST_PARTS && !strokeLevel) {
      push('のこりのパーツ', restParts.map(displayGlyph).join('・'))
    }
  }

  const strokes = char.misc.strokeCounts[0]
  if (strokes) push('画数', `${strokes}画`)

  const onReading = char.readingMeaning?.groups
    .flatMap((g) => g.readings)
    .find((r) => r.type === 'ja_on')?.value
  if (onReading) push('音読み', onReading)

  if (hints.length < MIN_HINTS) {
    return { hints, skipReason: `ヒントが${hints.length}個しか作れない` }
  }
  return { hints }
}

// ---------------------------------------------------------------------- 本体

/** 「やす.む」→「やすむ」。送りがなの区切り記号を落とす。 */
function plainReading(reading: string): string {
  return reading.replace(/\./g, '')
}

/**
 * 出題文に使える訓読みだけを、辞書の並び順のまま返す。
 * KANJIDIC2 は主要な読みを先頭に置くので、並べ替えずに先頭を採るのが最も無難。
 * ハイフンつき(-じるし、わる-)は熟語の中でしか現れない読みなので単独の出題文にできない。
 */
function usableKunReadings(char: Kanjidic2['characters'][number]): string[] {
  return (char.readingMeaning?.groups ?? [])
    .flatMap((g) => g.readings)
    .filter((r) => r.type === 'ja_kun' && !r.value.includes('-'))
    .map((r) => plainReading(r.value))
}

function main(): void {
  const kanjidic = readDict<Kanjidic2>('kanjidic2-en')
  const kradfile = readDict<Kradfile>('kradfile')
  const radicalNames = collectKanjidicRadicalNames(kanjidic)

  const selected = kanjidic.characters.filter((c) => c.misc.grade !== null && GRADES.includes(c.misc.grade))

  // 訓読みが複数の漢字にまたがる場合、出題文から答えが一意に決まらない。
  // (「あつい」→ 熱/暑/厚)。手で語釈を足すまでは出さない。
  const readingOwners = new Map<string, string[]>()
  for (const char of selected) {
    for (const reading of usableKunReadings(char)) {
      if (!readingOwners.has(reading)) readingOwners.set(reading, [])
      readingOwners.get(reading)!.push(char.literal)
    }
  }

  const questions: {
    id: string
    genreId: 'kanji'
    prompt: string
    answer: string
    hintSource: string[]
  }[] = []
  const skipped: Record<string, number> = {}
  const skip = (reason: string) => { skipped[reason] = (skipped[reason] ?? 0) + 1 }

  for (const char of selected) {
    const components = kradfile.kanji[char.literal]
    if (!components) { skip('KRADFILEに分解が無い'); continue }

    const kun = usableKunReadings(char)
    if (!kun.length) { skip('単独で出せる訓読みが無い'); continue }

    const usable = kun
      .slice(0, MAX_READING_RANK + 1)
      .filter((r) => readingOwners.get(r)!.length === 1)
    if (!usable.length) { skip('主要な訓読みが他の漢字と重複'); continue }
    if (usable[0].length < MIN_PROMPT_LENGTH) { skip('訓読みが1文字で絞り込めない'); continue }

    const { hints, skipReason } = buildHintSource(char, components, kradfile, radicalNames)
    if (skipReason) { skip(skipReason); continue }

    questions.push({
      id: `kj-g${char.misc.grade}-${char.literal}`,
      genreId: 'kanji',
      prompt: usable[0],
      answer: char.literal,
      hintSource: hints,
    })
  }

  console.log(`対象(配当学年 ${GRADES.join('/')}): ${selected.length}字`)
  console.log(`生成できた問題: ${questions.length}問`)
  console.log('除外:')
  for (const [reason, count] of Object.entries(skipped).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${reason}: ${count}`)
  }

  if (reportOnly) {
    console.log('\n--- 先頭20問 ---')
    for (const q of questions.slice(0, 20)) {
      console.log(`${q.answer}  ${q.prompt}\t${q.hintSource.join(' / ')}`)
    }
    return
  }

  const payload = {
    _source: {
      note: '自動生成。編集しても npm run questions:kanji で上書きされる',
      generatedAt: new Date().toISOString(),
      grades: GRADES,
      dictDate: kanjidic.dictDate,
      credit: 'KANJIDIC2 / KRADFILE — Electronic Dictionary Research and Development Group, CC BY-SA 4.0',
      urls: [
        'https://www.edrdg.org/wiki/index.php/KANJIDIC_Project',
        'https://www.edrdg.org/edrdg/licence.html',
      ],
    },
    questions,
  }
  writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`)
  console.log(`\n書き出し: ${OUT_PATH}`)
}

main()
