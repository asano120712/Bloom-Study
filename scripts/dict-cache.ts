/** .dict-cache/ に落とした辞書 JSON を読むための共通処理。 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

export const CACHE_DIR = fileURLToPath(new URL('../.dict-cache', import.meta.url))

/**
 * ファイル名にバージョンが入る(kanjidic2-en-3.6.2.json)ため、前方一致で探す。
 */
export function readDict<T>(prefix: string): T {
  const file = readdirSync(CACHE_DIR).find(
    (name) => name.startsWith(prefix) && name.endsWith('.json'),
  )
  if (!file) {
    throw new Error(`${prefix}*.json が .dict-cache/ に無い。先に npm run dict:fetch を実行すること`)
  }
  return JSON.parse(readFileSync(join(CACHE_DIR, file), 'utf8')) as T
}
