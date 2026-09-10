/**
 * なぞりがき(こども向け)のお手本を KanjiVG から生成する。
 *
 * KanjiVG は字形を「書き順どおりに並んだストロークの SVG パス」で持っている。
 * フォントの字形からは書き順を復元できないので、なぞらせるにはこのデータが要る。
 * 実行時に取りに行かず、開発時に生成して JSON をコミットする(辞書と同じ方針)。
 *
 * 使い方:
 *   npm run dict:fetch        # 初回のみ(KanjiVG も一緒に落ちる)
 *   npm run strokes:kana
 *   npm run strokes:kana -- --report   # 書き出さず、内訳だけ確認
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CACHE_DIR } from './dict-cache.ts'

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

const OUT_PATH = fileURLToPath(new URL('../src/data/strokes.hiragana.generated.json', import.meta.url))

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

  return [...block.matchAll(/<path [^>]*\bd="([^"]+)"/g)].map((m) => m[1])
}

function main(): void {
  const xml = readFileSync(join(CACHE_DIR, 'kanjivg.xml'), 'utf8')
  const reportOnly = process.argv.includes('--report')

  const characters = HIRAGANA.map((char) => {
    const strokes = strokesOf(xml, char)
    if (!strokes.length) throw new Error(`${char} のストロークが KanjiVG に無い`)
    return { char, strokes }
  })

  const byCount = new Map<number, string[]>()
  for (const { char, strokes } of characters) {
    if (!byCount.has(strokes.length)) byCount.set(strokes.length, [])
    byCount.get(strokes.length)!.push(char)
  }

  console.log(`ひらがな: ${characters.length}字`)
  for (const [count, chars] of [...byCount].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${count}画: ${chars.length}字  ${chars.join('')}`)
  }

  if (reportOnly) return

  const payload = {
    _source: {
      note: '自動生成。編集しても npm run strokes:kana で上書きされる',
      generatedAt: new Date().toISOString(),
      credit: 'KanjiVG — Copyright (C) 2009-2013 Ulrich Apel, CC BY-SA 3.0',
      url: 'http://kanjivg.tagaini.net',
      /** KanjiVG の座標系。パスはこの正方形の中に収まっている */
      viewBox: 109,
    },
    characters,
  }
  writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`)
  console.log(`\n書き出し: ${OUT_PATH}`)
}

main()
