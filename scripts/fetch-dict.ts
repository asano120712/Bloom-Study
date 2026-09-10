/**
 * 問題生成に使う辞書データを .dict-cache/ に取得する。
 *
 * - JMdict / KANJIDIC2 / KRADFILE: EDRDG。CC BY-SA 4.0。
 *   jmdict-simplified が JSON 化して毎週リリースしているものを使う。
 * - NGSL: 学習者向けの英語基本語2801語。CC BY-SA 4.0。
 * - KanjiVG: 字形を「書き順どおりのストローク」で持つデータ。CC BY-SA 3.0。
 *   なぞりがき(こども向け)のお手本に使う。
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

/** KanjiVG のリリース。1ファイルにまとまった XML を使う */
const KANJIVG_RELEASE_API = 'https://api.github.com/repos/KanjiVG/kanjivg/releases/latest'
const KANJIVG_FILE = 'kanjivg.xml'

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

async function fetchKanjivg(): Promise<void> {
  console.log('KanjiVG')
  if (existsSync(join(CACHE_DIR, KANJIVG_FILE))) {
    console.log('  kanjivg: すでにある(消せば再取得)')
    return
  }

  const release = (await (await fetch(KANJIVG_RELEASE_API)).json()) as {
    tag_name: string
    assets: { name: string; browser_download_url: string }[]
  }
  // 1ファイルにまとまった .xml.gz(zip の中身はファイル分割版なので使わない)
  const asset = release.assets.find((a) => a.name.endsWith('.xml.gz'))
  if (!asset) throw new Error(`KanjiVG の xml.gz が ${release.tag_name} に無い`)

  process.stdout.write(`  kanjivg ${release.tag_name}: 取得中... `)
  const response = await fetch(asset.browser_download_url)
  if (!response.ok) throw new Error(`KanjiVG の取得に失敗: ${response.status}`)
  const gz = join(CACHE_DIR, `${KANJIVG_FILE}.gz`)
  writeFileSync(gz, Buffer.from(await response.arrayBuffer()))
  execFileSync('gunzip', ['-f', gz])
  // gunzip は .gz を外した名前で書き出す
  console.log('完了')
}

mkdirSync(CACHE_DIR, { recursive: true })
await fetchJmdict()
await fetchNgsl()
await fetchKanjivg()
