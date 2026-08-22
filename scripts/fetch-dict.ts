/**
 * 問題生成に使う辞書データを .dict-cache/ に取得する。
 *
 * - JMdict / KANJIDIC2 / KRADFILE: EDRDG。CC BY-SA 4.0。
 *   jmdict-simplified が JSON 化して毎週リリースしているものを使う。
 * - NGSL: 学習者向けの英語基本語2801語。CC BY-SA 4.0。
 *
 * いずれも README のクレジット記載を消さないこと。
 *
 * 使い方: npm run dict:fetch
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { CACHE_DIR } from './dict-cache.ts'

/** jmdict-simplified のリリースから取るアセット */
const JMDICT_ASSETS = ['kanjidic2-en', 'kradfile', 'jmdict-eng-common']

const RELEASE_API = 'https://api.github.com/repos/scriptin/jmdict-simplified/releases/latest'

/**
 * NGSL の機械可読版。
 * 本家(newgeneralservicelist.com)は xlsx 配布のため、CC0 で JSON 化したものを使う。
 */
const NGSL_URL = 'https://raw.githubusercontent.com/lpmi-13/machine_readable_wordlists/master/General/NGSL/NGSL.json'
const NGSL_FILE = 'ngsl.json'

/** 前方一致で既に展開済みかどうか */
function alreadyHave(prefix: string): boolean {
  return readdirSync(CACHE_DIR).some((name) => name.startsWith(prefix) && name.endsWith('.json'))
}

async function fetchJmdict(): Promise<void> {
  const release = (await (await fetch(RELEASE_API)).json()) as { tag_name: string }
  const tag = release.tag_name
  console.log(`jmdict-simplified ${tag}`)

  for (const asset of JMDICT_ASSETS) {
    if (alreadyHave(asset)) {
      console.log(`  ${asset}: すでにある(消せば再取得)`)
      continue
    }

    // タグに含まれる + は URL 上ではエンコードが必要
    const url = `https://github.com/scriptin/jmdict-simplified/releases/download/${encodeURIComponent(tag)}/${asset}-${tag}.json.tgz`
    const archive = join(CACHE_DIR, `${asset}.json.tgz`)

    process.stdout.write(`  ${asset}: 取得中... `)
    const response = await fetch(url)
    if (!response.ok) throw new Error(`${asset} の取得に失敗: ${response.status} ${url}`)
    writeFileSync(archive, Buffer.from(await response.arrayBuffer()))
    execFileSync('tar', ['xzf', archive, '-C', CACHE_DIR])
    console.log('完了')
  }
}

async function fetchNgsl(): Promise<void> {
  console.log('NGSL')
  if (existsSync(join(CACHE_DIR, NGSL_FILE))) {
    console.log('  ngsl: すでにある(消せば再取得)')
    return
  }

  process.stdout.write('  ngsl: 取得中... ')
  const response = await fetch(NGSL_URL)
  if (!response.ok) throw new Error(`NGSL の取得に失敗: ${response.status} ${NGSL_URL}`)
  writeFileSync(join(CACHE_DIR, NGSL_FILE), await response.text())
  console.log('完了')
}

mkdirSync(CACHE_DIR, { recursive: true })
await fetchJmdict()
await fetchNgsl()
