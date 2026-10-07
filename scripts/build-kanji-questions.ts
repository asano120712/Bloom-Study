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
import { kanjiLevelOf, partnerGradeCap, type Level } from './difficulty.ts'
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

/** ヒントに出す熟語の数。出題文に使う1語はこれとは別に採る */
const JUKUGO_HINTS = 3

/** assemble モードで並べる部品タイルの総数(正解 + ダミー) */
const PART_TILE_COUNT = 8

/**
 * 単独では字形の像を結ばない筆画レベルのパーツ。
 * これを含む字は組み立てても字形にならないので、パーツ選択の対象から外す。
 */
const STROKE_PRIMITIVES = new Set(['｜', '一', 'ノ', '丿', '丶', '乙', '亅'])

const OUT_PATH = fileURLToPath(new URL('../src/data/questions.kanji.generated.json', import.meta.url))
const PARTS_OUT_PATH = fileURLToPath(new URL('../src/data/parts.kanji.generated.json', import.meta.url))

const args = process.argv.slice(2)
const reportOnly = args.includes('--report')
/**
 * 熟語を使わず、部品データだけを書き出すモード。
 *
 * 小1・小2は熟語の穴うめが成立しない(出題文に出る相手の字が読めない)ので、
 * この学年には「お手本の字を見て、部品から組み立てる」だけを出す。
 * 問題文もヒントも要らないぶん、熟語を持たない字も拾える。
 */
const partsOnly = args.includes('--parts-only')
const gradeArg = args.find((a) => a.startsWith('--grades='))?.slice('--grades='.length)
/**
 * 既定は小学3〜6年 + 中学以上の常用漢字。
 * 小1・小2は出さない。熟語の穴うめが成立しない(相手の字が読めない)学年なので、
 * なぞりがきと くみたて に渡す。
 */
const GRADES = (gradeArg ?? '3,4,5,6,8').split(',').map(Number)

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
 *
 * 伏せていない側の字は常用漢字だけにする(jouyou)。出題文にもヒントにも
 * そのまま出る字なので、読めない字が混じると手がかりにならない
 * (愛 → 「◯嬌」あいきょう)。
 */
function indexJukugo(jmdict: Jmdict, gradeOf: Map<string, number>): Map<string, Jukugo[]> {
  const index = new Map<string, Jukugo[]>()

  for (const word of jmdict.words) {
    const kanji = word.kanji.find((k) => k.common)
    const kana = word.kana.find((k) => k.common)
    if (!kanji || !kana) continue
    if (!ALL_KANJI.test(kanji.text)) continue
    if (kanji.text.length < 2 || kanji.text.length > 3) continue
    const grades = [...kanji.text].map((c) => gradeOf.get(c))
    if (grades.some((g) => g === undefined)) continue
    // 伏せていない側にどこまでの学年の字が出るか。難易度ごとの上限で絞るのに使う
    const maxGrade = Math.max(...(grades as number[]))

    const sense = word.sense[0]
    if (!sense?.partOfSpeech.some((pos) => pos === 'n' || pos === 'vs')) continue
    if (sense.misc.some((m) => REJECTED_MISC.has(m))) continue

    if (JUKUGO_DENYLIST.has(kanji.text)) continue
    if (isUnsuitable(sense.gloss.map((gl) => gl.text).join(' / '))) continue

    for (const char of new Set(kanji.text)) {
      if (!index.has(char)) index.set(char, [])
      index.get(char)!.push({ text: kanji.text, reading: kana.text, maxGrade })
    }
  }

  // 短い語を先に。同系語(委員 → 委員会)が並ばないよう、後で包含関係を見る
  for (const list of index.values()) list.sort((a, b) => a.text.length - b.text.length)
  return index
}

interface Jukugo {
  text: string
  reading: string
  /** その語に出てくる字の配当学年の最大。8 は中学以上 */
  maxGrade: number
}

/**
 * その漢字を含む熟語を、手がかりが重ならないように最大 limit 語えらぶ。
 * 先頭が出題文、残りがヒントになる。
 */
function chooseJukugo(
  literal: string,
  index: Map<string, Jukugo[]>,
  limit: number,
  gradeCap: number,
): Jukugo[] {
  const chosen: Jukugo[] = []

  for (const word of index.get(literal) ?? []) {
    if (chosen.length >= limit) break
    // 伏せていない側に、その学年ではまだ習わない字が出ないようにする
    if (word.maxGrade > gradeCap) continue
    // 委員 を採ったあとに 委員会・委員長 を並べても手がかりが増えない
    if (chosen.some((c) => word.text.includes(c.text) || c.text.includes(word.text))) continue
    chosen.push(word)
  }

  return chosen
}

/** 出題する漢字を ◯ で伏せる。「運営」→「◯営」 */
function maskedOf(word: Jukugo, literal: string): string {
  return `「${word.text.replaceAll(literal, '◯')}」`
}

/**
 * `見出し|本文` のヒント1行を作る。
 *
 * 見出しに答えの字が入る場合(訓 → 「訓読み」、熟 → 「熟語」)は見出しを落とす。
 * ヒントのラベルが答えそのものを見せてしまうため。
 */
function hintLine(caption: string, body: string, literal: string): string {
  return caption.includes(literal) ? body : `${caption}|${body}`
}

/**
 * 伏せた形と読みの組 → そこに入りうる漢字。
 *
 * 「◯行」かんこう は 刊行 でも 慣行 でもありうる。出題文にこれを使うと
 * どちらを書いても正解になってしまうので、1字に決まる語だけを出題文に回す。
 * (ヒントには使ってよい。他のヒントと合わせれば絞れるため)
 */
function indexMaskedForms(jukugo: Map<string, Jukugo[]>): Map<string, Set<string>> {
  const forms = new Map<string, Set<string>>()

  for (const [literal, words] of jukugo) {
    for (const word of words) {
      const key = `${maskedOf(word, literal)}${word.reading}`
      if (!forms.has(key)) forms.set(key, new Set())
      forms.get(key)!.add(literal)
    }
  }

  return forms
}

/** 学習用の語義タグの除外は熟語側でも使う */
const REJECTED_MISC = new Set(['arch', 'obs', 'obsc', 'rare', 'dated', 'hist', 'sl', 'm-sl', 'col', 'vulg', 'derog', 'abbr', 'yoji', 'sens', 'X'])

interface BuildResult {
  /** 出題文。答えの字を ◯ で伏せた熟語 */
  prompt: string
  /** 出題文の熟語の読み。どの語かを一意に決めるため添える */
  promptReading: string
  hints: string[]
}

/** 生成できなかった問題。理由はレポートに集計する */
interface BuildSkip {
  skipReason: string
}

/**
 * 出題文とヒントを組み立てる。
 *
 * 出題文は熟語の穴うめにする(「◯営」うんえい → 運)。
 * 訓読みだけを出す形だと「あつい」→ 熱/暑/厚 のように答えが一意に決まらず、
 * 読みが重複する字・訓読みを持たない字を丸ごと落とすしかなかった。
 * 熟語に読みを添えれば字は一意に決まるので、その分だけ出せる字が増える。
 *
 * 熟語は出題文とヒントで同じ井戸から汲む。先頭(いちばん短い語)を出題文に回し、
 * 残りをヒントにする。
 */
function buildQuestionSource(
  char: Kanjidic2['characters'][number],
  jukugo: Map<string, Jukugo[]>,
  maskedForms: Map<string, Set<string>>,
  level: Level,
): BuildResult | BuildSkip {
  const literal = char.literal
  const words = chooseJukugo(literal, jukugo, JUKUGO_HINTS + 1, partnerGradeCap(level))

  const promptIndex = words.findIndex((word) => {
    // 同じ字が2回出る語(人々 など)は「◯◯」になって出題文にならない
    if ([...word.text].filter((c) => c === literal).length !== 1) return false
    // 伏せると別の字でも成り立つ語(「◯行」かんこう = 刊行 / 慣行)は答えが定まらない
    return maskedForms.get(`${maskedOf(word, literal)}${word.reading}`)?.size === 1
  })
  if (promptIndex === -1) return { skipReason: '出題文にできる熟語が無い' }

  const hints = words
    .filter((_, index) => index !== promptIndex)
    .map((word) => hintLine('熟語', `${maskedOf(word, literal)}${word.reading}`, literal))

  // 訓読みは意味の手がかり。出題文が熟語になったので、他の字と重複する読みでも添えられる
  const kun = usableKunReadings(char)[0]
  if (kun) hints.push(hintLine('訓読み', kun, literal))

  // それでも足りない字だけ、字形を漏らさない範囲で補う。
  // 部首やパーツは出さない(パーツを答えさせるモードで答えになってしまう)。
  if (hints.length < MIN_HINTS) {
    const onReading = char.readingMeaning?.groups
      .flatMap((g) => g.readings)
      .find((r) => r.type === 'ja_on')?.value
    if (onReading) hints.push(hintLine('音読み', onReading, literal))

    const strokes = char.misc.strokeCounts[0]
    if (strokes) hints.push(hintLine('画数', `${strokes}画`, literal))
  }

  if (hints.length < MIN_HINTS) {
    return { skipReason: `ヒントが${hints.length}個しか作れない` }
  }

  return {
    prompt: maskedOf(words[promptIndex], literal),
    promptReading: words[promptIndex].reading,
    hints,
  }
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
 * ヒントに出せる訓読みだけを、辞書の並び順のまま返す。
 * KANJIDIC2 は主要な読みを先頭に置くので、並べ替えずに先頭を採るのが最も無難。
 * ハイフンつき(-じるし、わる-)は熟語の中でしか現れない読みなので単独では出せない。
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
  /** 常用漢字(配当学年を持つ字)と、その学年。熟語に混ぜてよいのはこの字だけ */
  const gradeOf = new Map(
    kanjidic.characters
      .filter((c) => c.misc.grade !== null)
      .map((c) => [c.literal, c.misc.grade!] as const),
  )
  const jukugo = indexJukugo(readDict<Jmdict>('jmdict-eng-common'), gradeOf)
  const maskedForms = indexMaskedForms(jukugo)

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

  /**
   * 中学以上(配当学年8)を3つに割る境目。実データの頻度順位を3等分して出す。
   * 決め打ちの順位にすると、辞書が更新されたときに偏る。
   */
  const frequencies = kanjidic.characters
    .filter((c) => c.misc.grade === 8 && c.misc.frequency != null)
    .map((c) => c.misc.frequency!)
    .sort((a, b) => a - b)
  const thresholds: [number, number] = [
    frequencies[Math.floor(frequencies.length / 3)] ?? 0,
    frequencies[Math.floor((frequencies.length * 2) / 3)] ?? 0,
  ]

  /** 部品に割れる字の、正解の部品とタイル。位置(へん/つくり)は画面側の表が持つ */
  const partsOf = (char: Kanjidic2['characters'][number]) => {
    const components = kradfile.kanji[char.literal]
    if (!components) return null

    const maximal = dropNestedParts(components, kradfile).map(displayGlyph)
    // 2つに割れる字だけ。筆画まで降りる字は組んでも字形にならない
    if (maximal.length !== 2 || maximal.some((c) => STROKE_PRIMITIVES.has(c))) return null

    const partTiles = buildPartTiles(maximal, poolByStrokes, strokesOf)
    if (partTiles.length !== PART_TILE_COUNT) return null

    return { parts: maximal, partTiles }
  }

  if (partsOnly) {
    const entries = selected.flatMap((char) => {
      const parts = partsOf(char)
      return parts ? [{ char: char.literal, grade: char.misc.grade!, ...parts }] : []
    })

    console.log(`対象(配当学年 ${GRADES.join('/')}): ${selected.length}字`)
    console.log(`2つの部品に割れる: ${entries.length}字`)
    console.log(`  ${entries.map((e) => `${e.char}=${e.parts.join('+')}`).join('  ')}`)

    if (reportOnly) return

    writeFileSync(
      PARTS_OUT_PATH,
      `${JSON.stringify(
        {
          _source: {
            note: '自動生成。編集しても npm run parts:kanji で上書きされる',
            generatedAt: new Date().toISOString(),
            grades: GRADES,
            credit: 'KANJIDIC2 / KRADFILE — EDRDG, CC BY-SA 4.0',
          },
          characters: entries,
        },
        null,
        2,
      )}\n`,
    )
    console.log(`\n書き出し: ${PARTS_OUT_PATH}`)
    return
  }

  const questions: {
    id: string
    genreId: 'kanji'
    prompt: string
    promptReading: string
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

    const level = kanjiLevelOf(char.misc.grade!, char.misc.frequency, thresholds)
    const source = buildQuestionSource(char, jukugo, maskedForms, level)
    if ('skipReason' in source) { skip(source.skipReason); continue }

    // assemble モード用。筆画レベルまで割れる字は組み立てても字形を成さない
    const maximal = dropNestedParts(components, kradfile).map(displayGlyph)
    const assemblable = maximal.length >= 2 && maximal.length <= 4
      && !maximal.some((c) => STROKE_PRIMITIVES.has(c))
    const parts = assemblable ? maximal : undefined
    const partTiles = parts ? buildPartTiles(parts, poolByStrokes, strokesOf) : undefined

    questions.push({
      id: `kj-g${char.misc.grade}-${char.literal}`,
      genreId: 'kanji',
      prompt: source.prompt,
      promptReading: source.promptReading,
      answer: char.literal,
      level,
      hintSource: source.hints,
      ...(parts && partTiles && partTiles.length === PART_TILE_COUNT ? { parts, partTiles } : {}),
    })
  }

  console.log(`対象(配当学年 ${GRADES.join('/')}): ${selected.length}字`)
  console.log(`生成できた問題: ${questions.length}問`)
  const byLevel = new Map<string, number>()
  for (const q of questions) byLevel.set(q.level, (byLevel.get(q.level) ?? 0) + 1)
  console.log(`  難易度べつ: ${[...byLevel].map(([l, n]) => `${l} ${n}`).join(' / ')}`)
  console.log(`  うちパーツ選択にできる: ${questions.filter((q) => q.parts).length}問`)
  console.log('除外:')
  for (const [reason, count] of Object.entries(skipped).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${reason}: ${count}`)
  }

  if (reportOnly) {
    console.log('\n--- 先頭20問 ---')
    for (const q of questions.slice(0, 20)) {
      console.log(`${q.answer}  ${q.prompt}${q.promptReading}\t${q.hintSource.join(' / ')}`)
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
