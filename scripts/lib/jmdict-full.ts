/**
 * JMdict の全体(生XML)から、語を必要な分だけ取り出す。
 *
 * ふだんの熟語は jmdict-simplified の「よく使われる語」(約2万語)から選ぶ。
 * それだけでは熟語が足りない字があるので、全体(約22万語)から補うときに使う。
 * KanjiVG・word-priority.ts と同じく、XML 用の依存を増やさずに必要な箇所だけ読む。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { CACHE_DIR } from './dict-cache.ts'

const XML_FILE = 'JMdict_e.xml'

export interface FullEntry {
  /** 見出し番号(ent_seq)。jmdict-simplified の id と同じ */
  id: string
  kanji: { text: string; priority: string[]; info: string[] }[]
  kana: { text: string; priority: string[]; restrictTo: string[]; noKanji: boolean }[]
  /** 先頭の語義だけ。品詞・注記は `&n;` などの実体名から `n` を取り出したもの */
  firstSense: { partOfSpeech: string[]; misc: string[]; gloss: string[] } | null
}

/** `<tag>&n;</tag>` → `n`、`<tag>text</tag>` → `text` */
function valuesOf(xml: string, tag: string): string[] {
  const pattern = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'g')
  return [...xml.matchAll(pattern)].map((m) => m[1].replace(/^&(.*);$/, '$1'))
}

export function readFullJmdict(): FullEntry[] {
  const xml = readFileSync(join(CACHE_DIR, XML_FILE), 'utf8')
  const entries: FullEntry[] = []

  let cursor = 0
  for (;;) {
    const start = xml.indexOf('<entry>', cursor)
    if (start < 0) break
    const end = xml.indexOf('</entry>', start)
    const entry = xml.slice(start, end)
    cursor = end

    const id = /<ent_seq>(\d+)<\/ent_seq>/.exec(entry)?.[1]
    if (!id) continue

    const kanji = [...entry.matchAll(/<k_ele>([\s\S]*?)<\/k_ele>/g)].map(([, inner]) => ({
      text: valuesOf(inner, 'keb')[0] ?? '',
      priority: valuesOf(inner, 'ke_pri'),
      info: valuesOf(inner, 'ke_inf'),
    }))
    if (kanji.length === 0) continue

    const kana = [...entry.matchAll(/<r_ele>([\s\S]*?)<\/r_ele>/g)].map(([, inner]) => ({
      text: valuesOf(inner, 'reb')[0] ?? '',
      priority: valuesOf(inner, 're_pri'),
      restrictTo: valuesOf(inner, 're_restr'),
      noKanji: inner.includes('<re_nokanji'),
    }))

    const sense = /<sense>([\s\S]*?)<\/sense>/.exec(entry)?.[1]
    entries.push({
      id,
      kanji,
      kana,
      firstSense: sense
        ? {
            partOfSpeech: valuesOf(sense, 'pos'),
            misc: valuesOf(sense, 'misc'),
            gloss: valuesOf(sense, 'gloss'),
          }
        : null,
    })
  }

  return entries
}
