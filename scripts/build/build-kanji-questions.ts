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

import { readDict } from '../lib/dict-cache.ts'
import { kanjiLevelOf, partnerGradeCap, type Level } from '../lib/difficulty.ts'
import { JUKUGO_ALLOWLIST_OF, JUKUGO_DENYLIST, PROMPT_OF } from '../lib/jukugo-denylist.ts'
import { isUnsuitable } from '../lib/unsuitable.ts'
import { CONFUSABLE_OF, KRAD_VARIANTS, VARIANT_STROKES } from '../lib/kanji-radicals.ts'
import { readFullJmdict, type FullEntry } from '../lib/jmdict-full.ts'
import { meaningKey, meaningProblems, readKanjiMeanings } from '../lib/kanji-meanings.ts'
import { NO_PRIORITY, priorityKey, readWordPriority, type WordPriority } from '../lib/word-priority.ts'

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
    id: string
    kanji: { common: boolean; text: string }[]
    kana: { common: boolean; text: string }[]
    sense: { partOfSpeech: string[]; misc: string[]; gloss: { text: string }[] }[]
  }[]
}

// ------------------------------------------------------------------ 生成設定

/** ヒントは最低この数を確保できないと問題として出さない。 */
const MIN_HINTS = 3

/**
 * ヒントに出す熟語の数。出題文に使う1語はこれとは別に採る。
 * 2語あれば「区別がつく語」で答えを絞れる。それ以上は、よく使われる語が足りない字で
 * ほとんど見ない語(頼信紙 など)を補うことになり、手がかりにならない。
 */
const JUKUGO_HINTS = 2

/**
 * 1つの字で、出題文にする熟語の最大数。出題を始めるたびに、この中から1つを選ぶ。
 * 同じ字でも、熟語が変わると思い出せないことが多い。いろいろな語の中で思い出す練習にする。
 * 多すぎると身近でない語まで出てくるので、身近な順に3つまで。
 */
const MAX_PROMPTS = 3

/** assemble モードで並べる部品タイルの総数(正解 + ダミー) */
const PART_TILE_COUNT = 8

/**
 * 単独では字形の像を結ばない筆画レベルのパーツ。
 * これを含む字は組み立てても字形にならないので、パーツ選択の対象から外す。
 */
const STROKE_PRIMITIVES = new Set(['｜', '一', 'ノ', '丿', '丶', '乙', '亅'])

const OUT_PATH = fileURLToPath(new URL('../../src/data/generated/questions.kanji.generated.json', import.meta.url))
const PARTS_OUT_PATH = fileURLToPath(new URL('../../src/data/generated/parts.kanji.generated.json', import.meta.url))

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
const HIRAGANA = /^[ぁ-ゖー]+$/

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
function indexJukugo(
  jmdict: Jmdict,
  full: FullEntry[],
  gradeOf: Map<string, number>,
  priority: Map<string, WordPriority>,
): Map<string, Jukugo[]> {
  const index = new Map<string, Jukugo[]>()

  /** 熟語として使ってよい語なら索引に足す。よく使われる語と、全体から補う語で共通の条件 */
  const add = (
    id: string,
    text: string,
    reading: string,
    sense: { partOfSpeech: string[]; misc: string[]; gloss: string[] },
    supplement: boolean,
  ) => {
    if (!ALL_KANJI.test(text)) return
    if (text.length < 2 || text.length > 3) return
    // 外来の読み(香港 ホンコン)は読みから字を思い出す手がかりにならない
    if (!HIRAGANA.test(reading)) return
    const grades = [...text].map((c) => gradeOf.get(c))
    if (grades.some((g) => g === undefined)) return
    // 伏せていない側にどこまでの学年の字が出るか。難易度ごとの上限で絞るのに使う
    const maxGrade = Math.max(...(grades as number[]))

    if (!sense.partOfSpeech.some((pos) => pos === 'n' || pos === 'vs')) return
    if (sense.misc.some((m) => REJECTED_MISC.has(m))) return

    if (JUKUGO_DENYLIST.has(text)) return
    if ([...text].some((c) => JUKUGO_ALLOWLIST_OF[c] && !JUKUGO_ALLOWLIST_OF[c].has(text))) return
    if (isUnsuitable(sense.gloss.join(' / '))) return

    const { tier, nf } = priority.get(priorityKey(id, text)) ?? NO_PRIORITY
    for (const char of new Set(text)) {
      if (!index.has(char)) index.set(char, [])
      index.get(char)!.push({ text, reading, maxGrade, tier, nf, supplement })
    }
  }

  const commonIds = new Set<string>()
  for (const word of jmdict.words) {
    const kanji = word.kanji.find((k) => k.common)
    const kana = word.kana.find((k) => k.common)
    if (!kanji || !kana) continue
    commonIds.add(word.id)
    const sense = word.sense[0]
    if (!sense) continue
    add(word.id, kanji.text, kana.text, { ...sense, gloss: sense.gloss.map((gl) => gl.text) }, false)
  }

  /*
   * 全体から補う語。よく使われる語に入っていない見出しの、いちばん上の表記だけを使う。
   * 当て字・まれな表記(ke_inf が付いた表記)は手がかりにならないので採らない。
   * 並べるときに補った語を後ろへ回すので、よく使われる語で足りる字には出てこない。
   */
  for (const entry of full) {
    if (commonIds.has(entry.id) || !entry.firstSense) continue
    const kanji = entry.kanji[0]
    if (kanji.info.length > 0) continue
    const kana = entry.kana.find(
      (k) => !k.noKanji && (k.restrictTo.length === 0 || k.restrictTo.includes(kanji.text)),
    )
    if (!kana) continue
    add(entry.id, kanji.text, kana.text, entry.firstSense, true)
  }

  /*
   * よく使われる語 → 補った語。その中は、学習者がよく知っている語(tier)→ 新聞での頻度(nf)
   * → 短い語 の順。tier を先に見る理由は word-priority.ts を参照。
   * 同系語(委員 → 委員会)が並ばないよう、選ぶときに包含関係を見る。
   */
  for (const list of index.values()) {
    list.sort((a, b) =>
      Number(a.supplement) - Number(b.supplement)
      || a.tier - b.tier
      || a.nf - b.nf
      || a.text.length - b.text.length)
  }
  return index
}

interface Jukugo {
  text: string
  reading: string
  /** その語に出てくる字の配当学年の最大。8 は中学以上 */
  maxGrade: number
  /** どれくらい知られている語か(word-priority.ts)。小さいほど身近 */
  tier: number
  nf: number
  /** よく使われる語では足りず、辞書の全体から補った語 */
  supplement: boolean
}

/**
 * 出題文の熟語1語と、ヒントの熟語を最大 JUKUGO_HINTS 語えらぶ。
 *
 * 出題文は、伏せても答えが1字に決まる語のうち、いちばん身近な語。
 * 知らない言葉(「◯鉛」あえん など)で出題すると、字を覚えていても答えられない。
 *
 * ヒントは「区別がつく語」を先に採る。伏せても1字に決まる語(「◯動」かんどう → 感)なら、
 * 同じ読みの字(関・館 …)と迷っているときの決め手になる。
 * ただし補った語より、よく使われる語を優先するのは変えない。
 */
function chooseJukugo(
  literal: string,
  index: Map<string, Jukugo[]>,
  maskedForms: MaskedForms,
  gradeCap: number,
  /**
   * 答えの字の読みが、熟語の読みの中に見つかるか。眼鏡(めがね)のように1字ずつに
   * 分けられない読みの語は、読みから字を思い出せないので出題文には後回しにする。
   */
  readable: (word: Jukugo) => boolean,
): { prompt: Jukugo; hints: Jukugo[] }[] {
  // 伏せていない側に、その学年ではまだ習わない字が出ないようにする
  const candidates = (index.get(literal) ?? []).filter((word) => word.maxGrade <= gradeCap)
  const isDistinct = (word: Jukugo) =>
    (word.supplement ? maskedForms.all : maskedForms.common).get(maskedKey(word, literal))?.size === 1

  const canPrompt = (word: Jukugo) =>
    // 同じ字が2回出る語(人々 など)は「◯◯」になって出題文にならない
    [...word.text].filter((c) => c === literal).length === 1
    // 伏せると別の字でも成り立つ語(「◯行」かんこう = 刊行 / 慣行)は答えが定まらない
    && isDistinct(word)
  // 委員 を採ったあとに 委員会・委員長 を並べても手がかりが増えない
  const overlaps = (a: Jukugo, b: Jukugo) => a.text.includes(b.text) || b.text.includes(a.text)

  // 手で決めた出題文(PROMPT_OF)があれば、それだけを使う
  const primary = PROMPT_OF[literal] !== undefined
    ? candidates.find((word) => word.text === PROMPT_OF[literal] && canPrompt(word))
    : candidates.find((word) => canPrompt(word) && readable(word)) ?? candidates.find(canPrompt)
  if (!primary) return []

  /*
   * 2つめ以降の出題文の候補。よく使われる語のうち、学習者が知っている語(tier 2 まで)で、
   * 読みから字が分かる語だけ。ほとんど見ない語で出題すると、意味が分かっても書けない。
   */
  const prompts = [primary]
  if (PROMPT_OF[literal] === undefined) {
    for (const word of candidates) {
      if (prompts.length >= MAX_PROMPTS) break
      if (word.supplement || word.tier > 2 || !canPrompt(word) || !readable(word)) continue
      if (prompts.some((p) => p === word || overlaps(p, word))) continue
      prompts.push(word)
    }
  }

  /*
   * ヒントは出題文ごとに選ぶ。ほかの出題文の候補も「区別がつく身近な語」なので、
   * 自然とヒントの先頭に来る(落語 が出題文なら、ヒントは 集落・落下)。
   */
  const hintsFor = (prompt: Jukugo) => {
    const chosen = new Set<Jukugo>([prompt])
    const passes: ((word: Jukugo) => boolean)[] = [
      (word) => !word.supplement && isDistinct(word),
      (word) => !word.supplement,
      (word) => isDistinct(word),
      () => true,
    ]
    for (const pass of passes) {
      for (const word of candidates) {
        if (chosen.size > JUKUGO_HINTS) break
        if (chosen.has(word) || !pass(word)) continue
        if ([...chosen].some((c) => overlaps(c, word))) continue
        chosen.add(word)
      }
    }
    // 出すときは身近な語から
    return candidates.filter((word) => word !== prompt && chosen.has(word))
  }

  return prompts.map((prompt) => ({ prompt, hints: hintsFor(prompt) }))
}

/** 出題する漢字を ◯ で伏せる。「運営」→「◯営」 */
function maskedOf(word: Jukugo, literal: string): string {
  return `「${word.text.replaceAll(literal, '◯')}」`
}

/** 伏せた形と読みの組。同じ組になる字が他にあれば、伏せたときに答えが1字に決まらない */
function maskedKey(word: Jukugo, literal: string): string {
  return `${maskedOf(word, literal)}${word.reading}`
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
function indexMaskedForms(jukugo: Map<string, Jukugo[]>): MaskedForms {
  const forms: MaskedForms = { common: new Map(), all: new Map() }
  const add = (map: Map<string, Set<string>>, key: string, literal: string) => {
    if (!map.has(key)) map.set(key, new Set())
    map.get(key)!.add(literal)
  }

  for (const [literal, words] of jukugo) {
    for (const word of words) {
      const key = maskedKey(word, literal)
      add(forms.all, key, literal)
      if (!word.supplement) add(forms.common, key, literal)
    }
  }

  return forms
}

/**
 * 伏せた形と読みの組 → そこに入りうる漢字。よく使われる語だけで数えたものと、全体で数えたもの。
 *
 * よく使われる語(偉業 いぎょう)は、よく使われる語どうしでぶつからなければ1字に決まるとみなす。
 * 全体で数えると、ほとんど見ない語(遺業)とぶつかって、身近な語が出題文から外れてしまう。
 * 補った語は、全体で数えてぶつからないときだけ1字に決まるとみなす。
 */
interface MaskedForms {
  common: Map<string, Set<string>>
  all: Map<string, Set<string>>
}

/** 学習用の語義タグの除外は熟語側でも使う */
const REJECTED_MISC = new Set(['arch', 'obs', 'obsc', 'rare', 'dated', 'hist', 'sl', 'm-sl', 'col', 'vulg', 'derog', 'abbr', 'yoji', 'sens', 'X'])

interface BuildResult {
  /** 出題文。答えの字を ◯ で伏せた熟語 */
  prompt: string
  /** 出題文の熟語の読み。どの語かを一意に決めるため添える */
  promptReading: string
  hints: string[]
  /** --report で目視確認に使う */
  report: {
    promptWord: Jukugo
    hintWords: Jukugo[]
    readingKind: ReadingKind
    /** 出題文と同じ読みを、ヒント不足を埋めるために出した */
    repeatsPromptReading: boolean
  }
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
 * 熟語は出題文とヒントで同じ井戸から汲む(chooseJukugo)。
 *
 * ヒントは 意味 → 熟語(2語を1つにまとめる)→ 読み → 画数 の順に出す。
 * - 意味: 出題文の熟語の意味。知らない言葉でも、どの言葉かが分かる
 * - 熟語: 同じ読みの字と区別がつく語(chooseJukugo)
 * - 読み: 出題文で使っていない方の読み(出題文が音読みなら訓読み)
 * - 画数: 最後の決め手
 * 意味をまだ書いていない語・読みが無い字は、その段を飛ばす。
 */
function buildQuestionSource(
  char: Kanjidic2['characters'][number],
  jukugo: Map<string, Jukugo[]>,
  maskedForms: MaskedForms,
  level: Level,
  /** 出題文の熟語の意味。まだ書いていない・出してはいけない字が入っているときは undefined */
  meaningOf: (word: Jukugo) => string | undefined,
): QuestionSource | BuildSkip {
  const variants = chooseJukugo(
    char.literal, jukugo, maskedForms, partnerGradeCap(level),
    (word) => readingKindIn(char, word) !== 'unknown',
  )
  if (variants.length === 0) return { skipReason: '出題文にできる熟語が無い' }

  const [first, ...rest] = variants
  const primary = buildVariant(char, first, meaningOf)
  if ('skipReason' in primary) return primary

  // 2つめ以降は、意味を書いてあって、ヒントがそろうものだけ出す
  const extras: BuildResult[] = []
  const pending: Jukugo[] = []
  for (const words of rest) {
    if (!meaningOf(words.prompt)) { pending.push(words.prompt); continue }
    const variant = buildVariant(char, words, meaningOf)
    if (!('skipReason' in variant)) extras.push(variant)
  }
  return { primary, extras, pending }
}

/** 1つの字の出題文たち。primary が問題の既定の形、extras は出題のたびに入れかわる候補 */
interface QuestionSource {
  primary: BuildResult
  extras: BuildResult[]
  /** 出題文の候補だが、意味をまだ書いていないので出していない語 */
  pending: Jukugo[]
}

/** 出題文の熟語1つぶんの、出題文とヒント */
function buildVariant(
  char: Kanjidic2['characters'][number],
  words: { prompt: Jukugo; hints: Jukugo[] },
  meaningOf: (word: Jukugo) => string | undefined,
): BuildResult | BuildSkip {
  const literal = char.literal
  const { prompt } = words

  const hints: string[] = []

  const meaning = meaningOf(prompt)
  if (meaning) hints.push(hintLine('意味', meaning, literal))

  if (words.hints.length > 0) {
    const body = words.hints.map((word) => `${maskedOf(word, literal)}${word.reading}`).join('・')
    hints.push(hintLine('熟語', body, literal))
  }

  // 出題文と同じ読みを出しても手がかりが増えない(「◯拶」あいさつ に 音読み アイ など)
  const readingKind = readingKindIn(char, prompt)
  const kun = usableKunReadings(char)
  const on = onReadings(char)
  const unused = (reading: string) => !readingFormsOf(reading).some((f) => prompt.reading.includes(f))
  let reading: string | undefined
  if (readingKind === 'on') reading = kun[0] && hintLine('訓読み', kun[0], literal)
  else if (readingKind === 'kun') reading = on[0] && hintLine('音読み', on[0], literal)
  else {
    // どちらで読んでいるか決めきれないときは、出題文の読みに含まれない読みを探す
    const kunUnused = kun.find(unused)
    const onUnused = on.find(unused)
    if (kunUnused) reading = hintLine('訓読み', kunUnused, literal)
    else if (onUnused) reading = hintLine('音読み', onUnused, literal)
  }
  if (reading) hints.push(reading)

  // 部首やパーツは出さない(パーツを答えさせるモードで答えになってしまう)。
  // 画数なら字形を漏らさない
  const strokes = char.misc.strokeCounts[0]
  if (strokes) hints.push(hintLine('画数', `${strokes}画`, literal))

  // 最後の手段として、出題文と同じ読みを出す。熟語が1つしかない字(挨・努 など)で
  // 意味をまだ書いていないと、ヒント不足で丸ごと消えてしまうため
  let repeatsPromptReading = false
  if (hints.length < MIN_HINTS) {
    const kunLine = kun[0] && hintLine('訓読み', kun[0], literal)
    const onLine = on[0] && hintLine('音読み', on[0], literal)
    const same = [readingKind === 'kun' ? kunLine : onLine, kunLine, onLine]
      .find((line) => line && line !== reading)
    if (same) {
      hints.push(same)
      repeatsPromptReading = true
    }
  }

  if (hints.length < MIN_HINTS) {
    return { skipReason: `ヒントが${hints.length}個しか作れない` }
  }

  return {
    prompt: maskedOf(prompt, literal),
    promptReading: prompt.reading,
    hints,
    report: {
      promptWord: prompt,
      hintWords: words.hints,
      readingKind,
      repeatsPromptReading,
    },
  }
}

// ------------------------------------------------------------ 読みの見分け

const KATAKANA = /[ァ-ヶ]/g
const toHiragana = (s: string) => s.replace(KATAKANA, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))

/** 連濁(か → が)・半濁音(は → ぱ)。熟語の2字目以降で読みの頭が変わる */
const VOICED: Record<string, string> = Object.fromEntries(
  [...'かきくけこさしすせそたちつてとはひふへほ'].map((c, i) => [c, 'がぎぐげござじずぜぞだぢづでどばびぶべぼ'[i]]),
)
const SEMI_VOICED: Record<string, string> = Object.fromEntries(
  [...'はひふへほ'].map((c, i) => [c, 'ぱぴぷぺぽ'[i]]),
)

/**
 * 1つの読みが熟語の中で取りうる形。
 * 「ガク」→ がく / がっ(学校)、「はな.す」→ はな、「ほん」→ ほん / ぼん / ぽん
 */
function readingFormsOf(reading: string): string[] {
  const stem = toHiragana(reading).replace(/-/g, '').split('.')[0]
  if (!stem) return []
  const forms = new Set([stem])
  // 促音便。つ・ち・く・き で終わる音読みは、次の字の前で っ になる
  if (/[つちくき]$/.test(stem)) forms.add(`${stem.slice(0, -1)}っ`)
  for (const form of [...forms]) {
    const head = form[0]
    if (VOICED[head]) forms.add(VOICED[head] + form.slice(1))
    if (SEMI_VOICED[head]) forms.add(SEMI_VOICED[head] + form.slice(1))
  }
  return [...forms]
}

type ReadingKind = 'on' | 'kun' | 'unknown'

/**
 * 出題文の熟語で、答えの字が音読み・訓読みのどちらで読まれているか。
 *
 * 字の位置に合わせて、読みの頭(先頭の字)・お尻(最後の字)・中ほど(3字の真ん中)に
 * その字の読みが現れるかを見る。両方当てはまる・どちらも当てはまらないときは決めない。
 */
function readingKindIn(char: Kanjidic2['characters'][number], word: Jukugo): ReadingKind {
  const position = [...word.text].indexOf(char.literal)
  const last = word.text.length - 1
  const reading = word.reading
  const appears = (form: string) =>
    reading.length > form.length && (
      position === 0 ? reading.startsWith(form)
        : position === last ? reading.endsWith(form)
          : reading.slice(1, -1).includes(form))

  const readings = (char.readingMeaning?.groups ?? []).flatMap((g) => g.readings)
  const matches = (type: string) => readings
    .filter((r) => r.type === type)
    .some((r) => readingFormsOf(r.value).some(appears))

  const on = matches('ja_on')
  const kun = matches('ja_kun')
  if (on && !kun) return 'on'
  if (kun && !on) return 'kun'
  return 'unknown'
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

/** 音読み。カタカナのまま(ヒントでも音読みはカタカナで見せる) */
function onReadings(char: Kanjidic2['characters'][number]): string[] {
  return (char.readingMeaning?.groups ?? [])
    .flatMap((g) => g.readings)
    .filter((r) => r.type === 'ja_on')
    .map((r) => r.value)
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
  const jukugo = indexJukugo(
    readDict<Jmdict>('jmdict-eng-common'),
    readFullJmdict(),
    gradeOf,
    readWordPriority(),
  )
  const maskedForms = indexMaskedForms(jukugo)
  /** 出題文の熟語の意味(scripts/data/kanji-meanings.json) */
  const meanings = readKanjiMeanings()

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
    /** 出題を始めるたびに、既定の形(prompt・promptReading・hintSource)と入れかわる候補 */
    variants?: { prompt: string; promptReading: string; hintSource: string[] }[]
    parts?: string[]
    partTiles?: string[]
  }[] = []
  const skipped: Record<string, number> = {}
  const skip = (reason: string) => { skipped[reason] = (skipped[reason] ?? 0) + 1 }
  /** 目視確認用。補った語・読みの種類を決めきれなかった問題 */
  const reports: {
    answer: string
    level: Level
    report: BuildResult['report']
    hints: string[]
    /** 出題文の候補すべて(出しているもの・意味が無くてまだ出していないもの) */
    promptWords: Jukugo[]
  }[] = []

  for (const char of selected) {
    const components = kradfile.kanji[char.literal]
    if (!components) { skip('KRADFILEに分解が無い'); continue }

    const level = kanjiLevelOf(char.misc.grade!, char.misc.frequency, thresholds)
    const source = buildQuestionSource(char, jukugo, maskedForms, level, (word) => {
      const meaning = meanings.get(meaningKey(word.text, word.reading))
      if (meaning === undefined) return undefined
      // 答えが見える・まだ習わない漢字がある意味は出さない(--report で「直す」に出る)
      return meaningProblems(meaning, [char.literal], partnerGradeCap(level), gradeOf).length === 0
        ? meaning
        : undefined
    })
    if ('skipReason' in source) { skip(source.skipReason); continue }
    const { primary, extras, pending } = source
    reports.push({
      answer: char.literal,
      level,
      report: primary.report,
      hints: primary.hints,
      promptWords: [primary, ...extras].map((v) => v.report.promptWord).concat(pending),
    })

    // assemble モード用。筆画レベルまで割れる字は組み立てても字形を成さない
    const maximal = dropNestedParts(components, kradfile).map(displayGlyph)
    const assemblable = maximal.length >= 2 && maximal.length <= 4
      && !maximal.some((c) => STROKE_PRIMITIVES.has(c))
    const parts = assemblable ? maximal : undefined
    const partTiles = parts ? buildPartTiles(parts, poolByStrokes, strokesOf) : undefined

    questions.push({
      id: `kj-g${char.misc.grade}-${char.literal}`,
      genreId: 'kanji',
      prompt: primary.prompt,
      promptReading: primary.promptReading,
      answer: char.literal,
      level,
      hintSource: primary.hints,
      ...(extras.length > 0
        ? { variants: extras.map((v) => ({ prompt: v.prompt, promptReading: v.promptReading, hintSource: v.hints })) }
        : {}),
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

  const readingKinds = new Map<ReadingKind, number>()
  for (const { report } of reports) readingKinds.set(report.readingKind, (readingKinds.get(report.readingKind) ?? 0) + 1)
  console.log(`出題文での読まれ方: ${[...readingKinds].map(([k, n]) => `${k} ${n}`).join(' / ')}`)
  const supplementedPrompts = reports.filter((r) => r.report.promptWord.supplement)
  const supplementedHints = reports.filter((r) => r.report.hintWords.some((w) => w.supplement))
  console.log(`辞書の全体から補った語: 出題文 ${supplementedPrompts.length}問 / ヒント ${supplementedHints.length}問`)
  const repeats = reports.filter((r) => r.report.repeatsPromptReading)

  /*
   * 出題文の熟語の意味(scripts/data/kanji-meanings.json)。
   * まだ書いていない語と、答えの字・まだ習わない漢字が入った意味を数える。
   */
  // 出題文の候補ごとに見る(1つの字に最大 MAX_PROMPTS 語)
  const pairs = reports.flatMap((r) => r.promptWords.map((word) => ({ ...r, word, key: meaningKey(word.text, word.reading) })))
  /** 熟語 → それを出題文に使う問題の答え(病院 → 病・院) */
  const answersOf = new Map<string, string[]>()
  for (const p of pairs) answersOf.set(p.key, [...(answersOf.get(p.key) ?? []), p.answer])
  const usedMeaningKeys = new Set(pairs.map((p) => p.key))
  const missingMeanings: typeof pairs = []
  const badMeanings: string[] = []
  for (const p of pairs) {
    const meaning = meanings.get(p.key)
    if (meaning === undefined) { missingMeanings.push(p); continue }
    const problems = meaningProblems(meaning, answersOf.get(p.key)!, partnerGradeCap(p.level), gradeOf)
    if (problems.length > 0) badMeanings.push(`${p.key}(${p.answer} [${p.level}]) ${problems.join(' / ')}: ${meaning}`)
  }
  const unusedMeanings = [...meanings.keys()].filter((key) => !usedMeaningKeys.has(key))
  const withVariants = questions.filter((q) => q.variants).length
  console.log(`出題文の候補: ${pairs.length}語(2つ以上の熟語で出せる字 ${withVariants}字)`)
  console.log(`意味: 書いた ${pairs.length - missingMeanings.length}語 / まだ ${missingMeanings.length}語 / 直す必要がある ${badMeanings.length}語 / 使われていない ${unusedMeanings.length}語`)
  for (const line of badMeanings) console.log(`  直す: ${line}`)
  for (const key of unusedMeanings) console.log(`  使われていない: ${key}`)
  if (reportOnly) for (const p of missingMeanings) console.log(`  まだ: ${p.key}\t${p.answer}\t${p.level}`)
  console.log(`出題文と同じ読みでヒントを埋めた問題: ${repeats.length}問 ${repeats.map((r) => r.answer).join('')}`)

  if (reportOnly) {
    const line = (r: (typeof reports)[number]) => {
      const p = r.report.promptWord
      return `${r.answer} [${r.level}] ${p.text}(${p.reading})${p.supplement ? `*t${p.tier}` : ''}\t${r.hints.join(' / ')}`
    }
    console.log('\n--- 出題文を全体から補った問題(* が補った語) ---')
    for (const r of supplementedPrompts) console.log(line(r))
    console.log('\n--- ヒントの熟語を全体から補った問題 ---')
    for (const r of supplementedHints) {
      console.log(`${line(r)}\t補った語: ${r.report.hintWords.filter((w) => w.supplement).map((w) => w.text).join('・')}`)
    }
    console.log('\n--- 読みの種類を決めきれなかった問題 ---')
    for (const r of reports.filter((x) => x.report.readingKind === 'unknown')) console.log(line(r))
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
