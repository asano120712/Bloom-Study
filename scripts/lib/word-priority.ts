/**
 * JMdict の優先タグ(その語が「学習者の知っている語」かどうか)を読む。
 *
 * jmdict-simplified の JSON は `ke_pri` / `re_pri` を `common` の真偽値へ畳むため、
 * 「基本語彙1万語(ichi1)」と「新聞頻度の帯(nf01〜nf48)」が落ちている。
 * 同じ答えに候補が複数あるとき、どの語で出題するかはここの情報で決める。
 *
 * tier は小さいほど学習者が知っている語:
 *   0 ichi1  『一万語語彙分類集』の基本語彙
 *   1 spec1  他のリストから漏れた常用語として JMdict が手で付けたもの
 *   2 news1  新聞頻度の上位12,000語
 *   3 ichi2 / news2 / spec2 / gai  二次リストにしか入っていない
 *   4 無印
 *
 * nf は新聞頻度の帯(nf01 = 上位500語、nf48 = 24,000語め)。無い語は 99。
 *
 * **tier を先に見て nf を後に見ること。** nf だけで並べると新聞語彙に偏る
 * (急騰 nf15 が 跳ねる nf40 に勝ってしまう)。ichi1 で基本語彙に絞ってから
 * 頻度で選ぶと、跳ねる・落ちる・お金 のような語が残る。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { CACHE_DIR } from './dict-cache.ts'

/** JMdict の生XML。優先タグを持つのはこちらだけ(jmdict-simplified には無い) */
const XML_FILE = 'JMdict_e.xml'

export interface WordPriority {
  tier: number
  nf: number
}

/** 無印の語。辞書に優先タグが無い場合はこれを使う */
export const NO_PRIORITY: WordPriority = { tier: 4, nf: 99 }

/**
 * 表記ごとのキー。同じ語でも漢字表記とかな表記で頻度が違うため、
 * 見出し語(ent_seq)だけでは引けない。
 */
export function priorityKey(entrySequence: string, form: string): string {
  return `${entrySequence}|${form}`
}

function tierOf(tags: string[]): number {
  if (tags.includes('ichi1')) return 0
  if (tags.includes('spec1')) return 1
  if (tags.includes('news1')) return 2
  if (tags.some((t) => t === 'ichi2' || t === 'news2' || t === 'spec2' || t === 'gai1' || t === 'gai2')) return 3
  return 4
}

function nfOf(tags: string[]): number {
  const bands = tags.filter((t) => t.startsWith('nf')).map((t) => Number(t.slice(2)))
  return bands.length ? Math.min(...bands) : 99
}

/**
 * XML は1語ぶんが `<entry>` … `</entry>` に入っていて、表記は `<k_ele>`(漢字)と
 * `<r_ele>`(かな)に分かれる。優先タグは表記ごとに付く。
 * KanjiVG と同じく、XML 用の依存を増やさずに必要な箇所だけ取り出す。
 */
export function readWordPriority(): Map<string, WordPriority> {
  const xml = readFileSync(join(CACHE_DIR, XML_FILE), 'utf8')
  const element = /<(k_ele|r_ele)>([\s\S]*?)<\/\1>/g
  const priority = /<(?:ke|re)_pri>([^<]+)<\/(?:ke|re)_pri>/g

  const result = new Map<string, WordPriority>()
  let cursor = 0
  for (;;) {
    const start = xml.indexOf('<entry>', cursor)
    if (start < 0) break
    const end = xml.indexOf('</entry>', start)
    const entry = xml.slice(start, end)
    cursor = end

    const entrySequence = /<ent_seq>(\d+)<\/ent_seq>/.exec(entry)?.[1]
    if (!entrySequence) continue

    for (const [, , inner] of entry.matchAll(element)) {
      const form = /<(?:keb|reb)>([^<]+)<\/(?:keb|reb)>/.exec(inner)?.[1]
      if (!form) continue
      const tags = [...inner.matchAll(priority)].map((m) => m[1])
      if (tags.length) result.set(priorityKey(entrySequence, form), { tier: tierOf(tags), nf: nfOf(tags) })
    }
  }
  return result
}
