/**
 * なぞりがき(こども向け)のお手本を KanjiVG から生成する。
 * ひらがな46字と、小1・小2の漢字240字。
 *
 * KanjiVG は字形を「書き順どおりに並んだストロークの SVG パス」で持っている。
 * フォントの字形からは書き順を復元できないので、なぞらせるにはこのデータが要る。
 * 実行時に取りに行かず、開発時に生成して JSON をコミットする(辞書と同じ方針)。
 *
 * 使い方:
 *   npm run dict:fetch        # 初回のみ(KanjiVG も一緒に落ちる)
 *   npm run strokes
 *   npm run strokes -- --report   # 書き出さず、内訳だけ確認
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CACHE_DIR, readDict } from './dict-cache.ts'

/** 清音のひらがな46字。濁音・拗音はまだ出さない(なぞる字は少ないほうが迷わない) */
const HIRAGANA = [
  'あ', 'い', 'う', 'え', 'お',
  'か', 'き', 'く', 'け', 'こ',
  'さ', 'し', 'す', 'せ', 'そ',
  'た', 'ち', 'つ', 'て', 'と',
  'な', 'に', 'ぬ', 'ね', 'の',
  'は', 'ひ', 'ふ', 'へ', 'ほ',
  'ま', 'み', 'む', 'め', 'も',
  'や', 'ゆ', 'よ',
  'ら', 'り', 'る', 'れ', 'ろ',
  'わ', 'を', 'ん',
]

/**
 * なぞらせる漢字は小1・小2の配当だけ。
 *
 * この学年はまだ熟語の穴うめが成立しない(出題文に出る相手の字が読めない)。
 * 書き順をなぞって覚える時期なので、クイズではなくお手本を出す。
 * 学年は KANJIDIC2 の配当学年をそのまま使う。
 */
const KANJI_GRADES = [1, 2]

const OUT_KANA = fileURLToPath(new URL('../src/data/strokes.hiragana.generated.json', import.meta.url))
const OUT_KANJI = fileURLToPath(new URL('../src/data/strokes.kanji.generated.json', import.meta.url))

interface Kanjidic2 {
  characters: { literal: string; misc: { grade: number | null } }[]
}

/** KanjiVG のファイル名は文字のコードポイント5桁16進 */
const idOf = (char: string) => char.codePointAt(0)!.toString(16).padStart(5, '0')

/**
 * その文字のストロークを書き順どおりに取り出す。
 *
 * KanjiVG の XML は1文字ぶんが <kanji id="kvg:kanji_03042"> … </kanji> に入っていて、
 * その中の <path d="..."> が書き順に並んでいる。入れ子の <g>(部品のまとまり)は
 * 見なくてよい。なぞる側に要るのは「順に並んだ線」だけなので。
 */
function strokesOf(xml: string, char: string): string[] {
  const id = idOf(char)
  const start = xml.indexOf(`<kanji id="kvg:kanji_${id}">`)
  if (start === -1) return []
  const end = xml.indexOf('</kanji>', start)
  const block = xml.slice(start, end)

  return [...block.matchAll(/<path [^>]*\bd="([^"]+)"/g)].map((m) => round(m[1]))
}

/**
 * 座標の桁を落とす。KanjiVG は 31.01 のように小数2桁で持っているが、
 * 109 四方の中で 0.05 の違いは見えないうえ、漢字240字ぶんでは容量に効く。
 */
function round(d: string): string {
  return d.replace(/-?\d+\.\d+/g, (value) => {
    const rounded = String(Math.round(Number(value) * 10) / 10)
    // -0.04 は丸めると -0 になり、文字にすると "0" でマイナスが消える。パスではマイナスが
    // 数の区切りも兼ねている(3.3-0.04 は 3.3 と -0.04)ので、消えると前の数とつながって
    // 「3.30」という1つの数になり、そこから先の線の形が崩れる。消えたぶんは空白で区切る
    return value.startsWith('-') && !rounded.startsWith('-') ? ` ${rounded}` : rounded
  })
}

interface Entry {
  char: string
  strokes: string[]
  /** 漢字だけ。配当学年 */
  grade?: number
}

function entriesOf(xml: string, chars: string[], gradeOf?: Map<string, number>): Entry[] {
  return chars.map((char) => {
    const strokes = strokesOf(xml, char)
    if (!strokes.length) throw new Error(`${char} のストロークが KanjiVG に無い`)
    const grade = gradeOf?.get(char)
    return grade ? { char, strokes, grade } : { char, strokes }
  })
}

function report(label: string, entries: Entry[]): void {
  const byCount = new Map<number, string[]>()
  for (const { char, strokes } of entries) {
    if (!byCount.has(strokes.length)) byCount.set(strokes.length, [])
    byCount.get(strokes.length)!.push(char)
  }

  console.log(`${label}: ${entries.length}字`)
  for (const [count, chars] of [...byCount].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${count}画: ${chars.length}字  ${chars.slice(0, 30).join('')}`)
  }
}

function payloadOf(characters: Entry[]) {
  return {
    _source: {
      note: '自動生成。編集しても npm run strokes で上書きされる',
      generatedAt: new Date().toISOString(),
      credit: 'KanjiVG — Copyright (C) 2009-2013 Ulrich Apel, CC BY-SA 3.0',
      url: 'http://kanjivg.tagaini.net',
      /** KanjiVG の座標系。パスはこの正方形の中に収まっている */
      viewBox: 109,
    },
    characters,
  }
}

function main(): void {
  const xml = readFileSync(join(CACHE_DIR, 'kanjivg.xml'), 'utf8')
  const reportOnly = process.argv.includes('--report')

  const kanjidic = readDict<Kanjidic2>('kanjidic2-en')
  const gradeOf = new Map(
    kanjidic.characters
      .filter((c) => c.misc.grade != null && KANJI_GRADES.includes(c.misc.grade))
      .map((c) => [c.literal, c.misc.grade!]),
  )

  const kana = entriesOf(xml, HIRAGANA)
  const kanji = entriesOf(xml, [...gradeOf.keys()], gradeOf)

  report('ひらがな', kana)
  report(`漢字(配当学年 ${KANJI_GRADES.join('/')})`, kanji)

  if (reportOnly) return

  writeFileSync(OUT_KANA, `${JSON.stringify(payloadOf(kana), null, 2)}\n`)
  writeFileSync(OUT_KANJI, `${JSON.stringify(payloadOf(kanji), null, 2)}\n`)
  console.log(`\n書き出し: ${OUT_KANA}\n書き出し: ${OUT_KANJI}`)
}

main()
