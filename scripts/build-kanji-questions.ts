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
import { kanjiLevelOf, type Level } from './difficulty.ts'
import { JUKUGO_DENYLIST } from './jukugo-denylist.ts'
import { isUnsuitable } from './unsuitable.ts'
import { CONFUSABLE_OF, KRAD_VARIANTS, VARIANT_STROKES } from './kanji-radicals.ts'

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

interface Jmdict {
  words: {
    kanji: { common: boolean; text: string }[]
    kana: { common: boolean; text: string }[]
    sense: { partOfSpeech: string[]; misc: string[]; gloss: { text: string }[] }[]
  }[]
}

// ------------------------------------------------------------------ 生成設定

/** ヒントは最低この数を確保できないと問題として出さない。 */
const MIN_HINTS = 3

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

/** ヒントに出す熟語の数 */
const JUKUGO_HINTS = 3

/** assemble モードで並べる部品タイルの総数(正解 + ダミー) */
const PART_TILE_COUNT = 8

/**
 * 単独では字形の像を結ばない筆画レベルのパーツ。
 * これを含む字は組み立てても字形にならないので、パーツ選択の対象から外す。
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

const ALL_KANJI = /^[一-龯々]+$/

/**
 * 漢字 → その字を含む常用の熟語。
 *
 * ヒントに部首やパーツを出すと、パーツを答えさせるモードでは答えそのものになる。
 * 熟語なら字形を一切漏らさずに、意味と読みの手がかりだけ渡せる。
 * 送りがな付き(悪さ など)は手がかりが弱いので、漢字だけの語に絞る。
 */
function indexJukugo(jmdict: Jmdict): Map<string, { text: string; reading: string }[]> {
  const index = new Map<string, { text: string; reading: string }[]>()

  for (const word of jmdict.words) {
    const kanji = word.kanji.find((k) => k.common)
    const kana = word.kana.find((k) => k.common)
    if (!kanji || !kana) continue
    if (!ALL_KANJI.test(kanji.text)) continue
    if (kanji.text.length < 2 || kanji.text.length > 3) continue

    const sense = word.sense[0]
    if (!sense?.partOfSpeech.some((pos) => pos === 'n' || pos === 'vs')) continue
    if (sense.misc.some((m) => REJECTED_MISC.has(m))) continue

    if (JUKUGO_DENYLIST.has(kanji.text)) continue
    if (isUnsuitable(sense.gloss.map((gl) => gl.text).join(' / '))) continue

    for (const char of new Set(kanji.text)) {
      if (!index.has(char)) index.set(char, [])
      index.get(char)!.push({ text: kanji.text, reading: kana.text })
    }
  }

  // 短い語を先に。同系語(委員 → 委員会)が並ばないよう、後で包含関係を見る
  for (const list of index.values()) list.sort((a, b) => a.text.length - b.text.length)
  return index
}

/** 出題する漢字を ◯ で伏せた熟語ヒントを最大 JUKUGO_HINTS 個作る */
function jukugoHints(literal: string, index: Map<string, { text: string; reading: string }[]>): string[] {
  const chosen: { text: string; reading: string }[] = []

  for (const word of index.get(literal) ?? []) {
    if (chosen.length >= JUKUGO_HINTS) break
    // 委員 を採ったあとに 委員会・委員長 を並べても手がかりが増えない
    if (chosen.some((c) => word.text.includes(c.text) || c.text.includes(word.text))) continue
    chosen.push(word)
  }

  return chosen.map((w) => `熟語|「${w.text.replaceAll(literal, '◯')}」${w.reading}`)
}

/** 学習用の語義タグの除外は熟語側でも使う */
const REJECTED_MISC = new Set(['arch', 'obs', 'obsc', 'rare', 'dated', 'hist', 'sl', 'm-sl', 'col', 'vulg', 'derog', 'abbr', 'yoji', 'sens', 'X'])

interface BuildResult {
  hints: string[]
  /** 生成できなかった場合の理由。レポート用 */
  skipReason?: string
}

function buildHintSource(
  char: Kanjidic2['characters'][number],
  jukugo: Map<string, { text: string; reading: string }[]>,
): BuildResult {
  const literal = char.literal
  const hints = jukugoHints(literal, jukugo)

  // 熟語が足りない字だけ、字形を漏らさない範囲で補う。
  // 部首やパーツは出さない(パーツを答えさせるモードで答えになってしまう)。
  if (hints.length < MIN_HINTS) {
    const onReading = char.readingMeaning?.groups
      .flatMap((g) => g.readings)
      .find((r) => r.type === 'ja_on')?.value
    if (onReading) hints.push(`音読み|${onReading}`)

    const strokes = char.misc.strokeCounts[0]
    if (strokes) hints.push(`画数|${strokes}画`)
  }

  if (hints.length < MIN_HINTS) {
    return { hints, skipReason: `ヒントが${hints.length}個しか作れない` }
  }
  return { hints }
}

/**
 * assemble モードの部品タイル。正解の部品にダミーを混ぜて PART_TILE_COUNT 個にする。
 *
 * ダミーは「見分けにくい部品」を優先し、足りない分を同じ画数の常用部品で埋める。
 * 形が違いすぎる部品を混ぜると、思い出さなくても消去法で解けてしまう。
 */
function buildPartTiles(
  correct: string[],
  poolByStrokes: Map<number, string[]>,
  strokesOf: (part: string) => number | undefined,
): string[] {
  const tiles = new Set(correct)

  for (const part of correct) {
    for (const similar of CONFUSABLE_OF[part] ?? []) {
      if (tiles.size >= PART_TILE_COUNT) break
      if (!correct.includes(similar)) tiles.add(similar)
    }
  }

  for (const part of correct) {
    if (tiles.size >= PART_TILE_COUNT) break
    for (const candidate of poolByStrokes.get(strokesOf(part) ?? -1) ?? []) {
      if (tiles.size >= PART_TILE_COUNT) break
      if (!tiles.has(candidate)) tiles.add(candidate)
    }
  }

  return [...tiles]
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
  const jukugo = indexJukugo(readDict<Jmdict>('jmdict-eng-common'))

  /** 部品の画数。KANJIDIC に無い変体は手持ちの表で補う */
  const kanjiStrokes = new Map(kanjidic.characters.map((c) => [c.literal, c.misc.strokeCounts[0]]))
  const strokesOf = (part: string) => VARIANT_STROKES[part] ?? kanjiStrokes.get(part)

  /** ダミーを埋めるための、画数ごとの常用部品 */
  const usage = new Map<string, number>()
  for (const list of Object.values(kradfile.kanji)) {
    for (const raw of list) {
      const part = displayGlyph(raw)
      usage.set(part, (usage.get(part) ?? 0) + 1)
    }
  }
  const poolByStrokes = new Map<number, string[]>()
  for (const [part, count] of [...usage].sort((a, b) => b[1] - a[1])) {
    if (count < 20) continue
    const strokes = strokesOf(part)
    if (strokes === undefined) continue
    if (!poolByStrokes.has(strokes)) poolByStrokes.set(strokes, [])
    poolByStrokes.get(strokes)!.push(part)
  }

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
    level: Level
    hintSource: string[]
    parts?: string[]
    partTiles?: string[]
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

    const { hints, skipReason } = buildHintSource(char, jukugo)
    if (skipReason) { skip(skipReason); continue }

    // assemble モード用。筆画レベルまで割れる字は組み立てても字形を成さない
    const maximal = dropNestedParts(components, kradfile).map(displayGlyph)
    const assemblable = maximal.length >= 2 && maximal.length <= 4
      && !maximal.some((c) => STROKE_PRIMITIVES.has(c))
    const parts = assemblable ? maximal : undefined
    const partTiles = parts ? buildPartTiles(parts, poolByStrokes, strokesOf) : undefined

    questions.push({
      id: `kj-g${char.misc.grade}-${char.literal}`,
      genreId: 'kanji',
      prompt: usable[0],
      answer: char.literal,
      level: kanjiLevelOf(char.misc.grade),
      hintSource: hints,
      ...(parts && partTiles && partTiles.length === PART_TILE_COUNT ? { parts, partTiles } : {}),
    })
  }

  console.log(`対象(配当学年 ${GRADES.join('/')}): ${selected.length}字`)
  console.log(`生成できた問題: ${questions.length}問`)
  console.log(`  うちパーツ選択にできる: ${questions.filter((q) => q.parts).length}問`)
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
