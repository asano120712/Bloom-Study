/**
 * 問題生成に使う辞書データを .dict-cache/ に取得する。
 *
 * 取得元: jmdict-simplified (https://github.com/scriptin/jmdict-simplified)
 * EDRDG の JMdict / KANJIDIC2 / KRADFILE を JSON 化して毎週リリースしているもの。
 * 元データは CC BY-SA 4.0。README のクレジット記載を消さないこと。
 *
 * 使い方: npm run dict:fetch
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { CACHE_DIR } from './dict-cache.ts'

/** 今回の生成に必要なアセットだけ。JMdict(英単語ジャンル)は使うときに足す。 */
const ASSETS = ['kanjidic2-en', 'kradfile']

const RELEASE_API = 'https://api.github.com/repos/scriptin/jmdict-simplified/releases/latest'

async function main(): Promise<void> {
  const release = (await (await fetch(RELEASE_API)).json()) as { tag_name: string }
  const tag = release.tag_name
  console.log(`jmdict-simplified ${tag}`)

  mkdirSync(CACHE_DIR, { recursive: true })

  for (const asset of ASSETS) {
    // タグに含まれる + は URL 上ではエンコードが必要
    const url = `https://github.com/scriptin/jmdict-simplified/releases/download/${encodeURIComponent(tag)}/${asset}-${tag}.json.tgz`
    const archive = join(CACHE_DIR, `${asset}.json.tgz`)

    const alreadyExtracted = existsSync(CACHE_DIR)
      && readdirSync(CACHE_DIR).some((name) => name.startsWith(asset) && name.endsWith('.json'))
    if (alreadyExtracted) {
      console.log(`  ${asset}: すでにある(消せば再取得)`)
      continue
    }

    process.stdout.write(`  ${asset}: 取得中... `)
    const response = await fetch(url)
    if (!response.ok) throw new Error(`${asset} の取得に失敗: ${response.status} ${url}`)
    writeFileSync(archive, Buffer.from(await response.arrayBuffer()))
    execFileSync('tar', ['xzf', archive, '-C', CACHE_DIR])
    console.log('完了')
  }
}

await main()
