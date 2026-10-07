/**
 * 英単語ジャンルの問題を JMdict(common語のみ)から生成する。
 *
 * 漢字ジャンルと同じく、開発時に1度回して JSON をコミットする。
 * 生成物をそのまま出題に使わず、目視レビューして採否を決める前提。
 *
 * 使い方:
 *   npm run dict:fetch
 *   npm run questions:english
 *   npm run questions:english -- --bands=1000      # NGSL上位1000語の範囲だけ
 *   npm run questions:english -- --report         # 書き出さず内訳だけ
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { readDict } from './dict-cache.ts'
import { englishLevelOf, type Level } from './difficulty.ts'
import { ENGLISH_DENYLIST } from './english-denylist.ts'
import { isUnsuitable } from './unsuitable.ts'
import { NO_PRIORITY, priorityKey, readWordPriority, type WordPriority } from './word-priority.ts'

// ---------------------------------------------------------------- 辞書側の型

interface Jmdict {
  dictDate: string
  words: {
    id: string
    kanji: { common: boolean; text: string; tags: string[] }[]
    /** appliesToKanji は「その読みがどの漢字表記のものか」。'*' は全表記 */
    kana: { common: boolean; text: string; tags: string[]; appliesToKanji?: string[] }[]
    sense: {
      partOfSpeech: string[]
      misc: string[]
      gloss: { lang: string; text: string }[]
    }[]
  }[]
}

interface Kanjidic2 {
  characters: { literal: string; misc: { grade: number | null } }[]
}

/**
 * NGSL(New General Service List)。学習者が最初に覚えるべき英語2801語。
 * 頻度帯ごとに「見出し語 → 同じ語族の語」の形で入っている。
 */
type Ngsl = Record<string, Record<string, string[]>>

// ------------------------------------------------------------------ 生成設定

/**
 * 出題語に使ってよい品詞。1つ目の語義がこのいずれかであることを求める。
 * 助詞・接尾辞・慣用句は単独の出題語にならない。
 */
const ALLOWED_POS = /^(n|v1|v5[a-z]*|adj-i|adj-na|vs)$/

/** 単独の出題語にならない品詞。1つでも含んでいたら落とす。 */
const REJECTED_POS = new Set(['exp', 'n-suf', 'n-pref', 'ctr', 'pn', 'num', 'int', 'prt', 'aux', 'aux-v', 'suf', 'pref'])

/** 学習用の出題に向かない語義タグ。 */
const REJECTED_MISC = new Set([
  'arch', 'obs', 'obsc', 'rare', 'dated', 'hist', // 古語・廃語
  'sl', 'm-sl', 'net-sl', 'col', 'vulg', 'derog', 'joc', // 俗語・侮蔑
  'abbr', 'on-mim', 'yoji', 'X', // 略語・擬音語・四字熟語
  'sens', 'euph', 'chn', 'poet', // 婉曲・幼児語・詩語
])

/**
 * 答えの長さの許容範囲。
 * 英語ジャンルのヒントは1文字ずつ開放して最後の1文字を残すため、
 * 3文字だとヒントが2段階しか作れず、長すぎると開放しきるのに時間がかかる。
 */
const MIN_ANSWER_LENGTH = 4
const MAX_ANSWER_LENGTH = 10

const OUT_PATH = fileURLToPath(new URL('../src/data/questions.english.generated.json', import.meta.url))

const args = process.argv.slice(2)
const reportOnly = args.includes('--report')
const gradeArg = args.find((a) => a.startsWith('--grades='))?.slice('--grades='.length)
/**
 * 出題語の表記に使ってよい漢字の配当学年。
 * 既定は常用漢字すべて(1〜6年 + 中学以上の8)。人名用漢字(9,10)は除く。
 */
const GRADES = (gradeArg ?? '1,2,3,4,5,6,8').split(',').map(Number)

const bandArg = args.find((a) => a.startsWith('--bands='))?.slice('--bands='.length)
/**
 * 答えに使ってよい NGSL の頻度帯。
 *
 * JMdict は「その英単語が学習者にとって重要か」を持たないため、答えの側を
 * NGSL の見出し語に限る。これが無いと militarism・lipstick のような
 * 学習の優先度が低い語まで問題になる。
 */
const BANDS = (bandArg ?? '1000,2000,3000').split(',')

// ------------------------------------------------------------ 出題語の組み立て

const KATAKANA = /^[ァ-ヴー・]+$/
const KANJI = /[一-龯]/u

/**
 * 語義から答えを取り出す。
 * 「to eat」→「eat」(動詞の to を落とす)
 * 「strawberry (esp. ...)」→「strawberry」(補足の括弧を落とす)
 */
function normalizeGloss(gloss: string): string {
  return gloss
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/^to\s+/, '')
    .trim()
}

/** 1語の英単語として出題できるか。複数語・記号入りは判定にも表示にも向かない。 */
function isSingleWord(value: string): boolean {
  return /^[a-z]+$/.test(value)
}

/**
 * 出題の候補。1つの答えに複数の日本語が候補になるので、
 * 先に全部集めてから「どの語で出すか」を決める。
 */
interface Candidate {
  question: GeneratedQuestion
  /** JMdict の優先タグ。学習者が知っている語から先に選ぶための順位づけに使う */
  priority: WordPriority
}

export interface GeneratedQuestion {
  id: string
  genreId: 'english'
  prompt: string
  /** 出題語の読み。漢字表記のときだけ添える */
  promptReading?: string
  answer: string
  level: Level
  acceptableAnswers?: string[]
}

// ---------------------------------------------------------------------- 本体

function main(): void {
  const jmdict = readDict<Jmdict>('jmdict-eng-common')
  const kanjidic = readDict<Kanjidic2>('kanjidic2-en')
  const ngsl = readDict<Ngsl>('ngsl')
  const wordPriority = readWordPriority()

  /** NGSL の見出し語 → 頻度帯。語族(been, beings 等)は見出し語ではないので入れない */
  const ngslBand = new Map<string, string>()
  for (const band of BANDS) {
    for (const headword of Object.keys(ngsl[band] ?? {})) ngslBand.set(headword, band)
  }

  /** 漢字 → 配当学年。教育漢字以外(grade 8 等)は undefined 扱いにしない */
  const gradeOf = new Map<string, number | null>()
  for (const char of kanjidic.characters) gradeOf.set(char.literal, char.misc.grade)

  /** 出題語の表記が、許可した配当学年の漢字だけで書けるか */
  function isWritableWithinGrades(text: string): boolean {
    for (const char of text) {
      if (!KANJI.test(char)) continue
      const grade = gradeOf.get(char)
      if (grade === null || grade === undefined || !GRADES.includes(grade)) return false
    }
    return true
  }

  const candidates: Candidate[] = []
  const skipped: Record<string, number> = {}
  const skip = (reason: string) => { skipped[reason] = (skipped[reason] ?? 0) + 1 }

  for (const word of jmdict.words) {
    const sense = word.sense[0]
    if (!sense) { skip('語義が無い'); continue }

    if (sense.partOfSpeech.some((p) => REJECTED_POS.has(p))) { skip('単独で出せない品詞'); continue }
    if (!sense.partOfSpeech.some((p) => ALLOWED_POS.test(p))) { skip('対象外の品詞'); continue }
    if (sense.misc.some((m) => REJECTED_MISC.has(m))) { skip('古語・俗語・略語など'); continue }

    // 「かなで書くのが普通」の語は漢字表記を出さない(苺 → いちご)
    const usuallyKana = sense.misc.includes('uk')
    const kanji = word.kanji.find((k) => k.common)
    const kana = word.kana.find((k) => k.common)
    const prompt = (!usuallyKana && kanji ? kanji.text : kana?.text) ?? ''
    if (!prompt) { skip('常用の表記が無い'); continue }

    // 漢字で出す語には読みを添える。英単語ジャンルは出題語の読み自体は答えでないので、
    // 読みを出しても答えは漏れない。読めない出題語(椅子・薪炭)を捨てずに救うため。
    // appliesToKanji を見るのは、表記ごとに読みが分かれる語に別の読みを付けないため。
    const reading = !KANJI.test(prompt)
      ? undefined
      : word.kana.find(
          (k) =>
            k.common &&
            (!k.appliesToKanji || k.appliesToKanji.includes('*') || k.appliesToKanji.includes(prompt)),
        )?.text

    // カタカナ語は英語からの借用がほとんどで、出題語が答えそのものになる(テーブル → table)
    if (KATAKANA.test(prompt)) { skip('カタカナ語(答えが露出する)'); continue }
    if (!isWritableWithinGrades(prompt)) { skip(`配当学年 ${GRADES.join('/')} の外の漢字を含む`); continue }

    const glosses = sense.gloss
      .filter((g) => g.lang === 'eng')
      .map((g) => normalizeGloss(g.text))
    if (!glosses.length) { skip('英語の語義が無い'); continue }

    // 頻度で訳語を選び直すと訳が壊れる(顔ぶれ → members)。
    // 第一訳をそのまま答えにして、それが NGSL に無ければ問題ごと捨てる。
    // 答えの側で判定する。acceptableAnswers まで見ると、
    // 二次的な訳語を持つだけの普通の語が落ちる(営み → activity / execution)
    //
    // 1語かどうかは第一訳だけに掛ける。先に1語の訳へ絞ってから先頭を取ると、
    // 「最初の1語の訳」が答えになり、その語の主要な意味でない訳で出題してしまう
    // (急騰 = sudden rise / sharp rise / jump → jump が答えになり、
    //  本来の 跳ねる は「答えが重複」で落ちる)。
    if (!isSingleWord(glosses[0])) { skip('第一訳が1語の英単語にならない'); continue }
    if (isUnsuitable(glosses[0])) { skip('学習に出すのに向かない語'); continue }

    const answer = glosses[0]
    if (answer.length < MIN_ANSWER_LENGTH || answer.length > MAX_ANSWER_LENGTH) {
      skip(`答えが${MIN_ANSWER_LENGTH}〜${MAX_ANSWER_LENGTH}文字の外`)
      continue
    }
    const band = ngslBand.get(answer)
    if (!band) { skip('答えがNGSL(学習者向け基本語)に無い'); continue }

    if (ENGLISH_DENYLIST.has(prompt)) { skip('レビューで除外(english-denylist.ts)'); continue }

    // 同じ語義の別訳は正解として扱う(思い出 → memories / recollections)。
    // 判定は文字列の一致なので、1語にならない訳は正解にできない
    const alternatives = [...new Set(glosses.slice(1).filter(isSingleWord))]

    candidates.push({
      priority: wordPriority.get(priorityKey(word.id, prompt)) ?? NO_PRIORITY,
      question: {
        id: `en-${word.id}`,
        genreId: 'english',
        prompt,
        ...(reading ? { promptReading: reading } : {}),
        answer,
        level: englishLevelOf(band),
        ...(alternatives.length ? { acceptableAnswers: alternatives } : {}),
      },
    })
  }

  /**
   * 同じ答えの問題は作らない(同じ出題語も1度だけ)。どれを残すかは早い者勝ちにせず、
   * 学習者が知っている語から選ぶ。辞書ID順にすると、辞書に先に載っている語が勝って
   * 急騰 → jump・減収 → fall のような新聞語彙・専門語で出題してしまう。
   *
   * 並べる順は tier(基本語彙かどうか)→ nf(新聞頻度の帯)→ 辞書ID。
   * tier を先に見るのが要点で、nf だけだと新聞語彙に偏る(word-priority.ts を参照)。
   */
  const ranked = [...candidates].sort((a, b) =>
    a.priority.tier - b.priority.tier ||
    a.priority.nf - b.priority.nf ||
    Number(a.question.id.slice('en-'.length)) - Number(b.question.id.slice('en-'.length)),
  )

  const questions: GeneratedQuestion[] = []
  const usedPrompts = new Set<string>()
  const usedAnswers = new Set<string>()
  for (const { question } of ranked) {
    if (usedPrompts.has(question.prompt)) { skip('出題語が重複'); continue }
    if (usedAnswers.has(question.answer)) { skip('答えが他の問題と重複'); continue }
    usedPrompts.add(question.prompt)
    usedAnswers.add(question.answer)
    questions.push(question)
  }

  // 書き出しは辞書の並び(ID順)に戻す。生成のたびに並びが変わると差分が読めない
  questions.sort((a, b) => a.id.localeCompare(b.id))

  console.log(`JMdict(common)の見出し語: ${jmdict.words.length}語`)
  console.log(`生成できた問題: ${questions.length}問`)
  console.log('除外:')
  for (const [reason, count] of Object.entries(skipped).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${reason}: ${count}`)
  }

  if (reportOnly) {
    console.log('\n--- 無作為に20問 ---')
    const sample = [...questions].sort(() => Math.random() - 0.5).slice(0, 20)
    for (const q of sample) {
      const alt = q.acceptableAnswers?.length ? `  (別解: ${q.acceptableAnswers.join(', ')})` : ''
      console.log(`${q.prompt}\t→ ${q.answer}${alt}`)
    }
    return
  }

  const payload = {
    _source: {
      note: '自動生成。編集しても npm run questions:english で上書きされる',
      generatedAt: new Date().toISOString(),
      grades: GRADES,
      bands: BANDS,
      dictDate: jmdict.dictDate,
      credit: [
        'JMdict — Electronic Dictionary Research and Development Group, CC BY-SA 4.0',
        'NGSL (New General Service List) — Browne, Culligan & Phillips, CC BY-SA 4.0',
      ],
      urls: [
        'https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project',
        'https://www.edrdg.org/edrdg/licence.html',
        'https://www.newgeneralservicelist.com/',
      ],
    },
    questions,
  }
  writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`)
  console.log(`\n書き出し: ${OUT_PATH}`)
}

main()
