import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * 手書きの見本を受け取って保存する口(開発時だけ)。
 *
 * 読み取りを外した字を集めるために使う。スマートフォンで試すと、ブラウザからの
 * 書き出しはその端末の中に落ちてしまい、学習に回せない。開発サーバーへ送れば、
 * 同じLANのどの端末から書いても、手元のプロジェクトに溜まる。
 *
 * `apply: 'serve'` なので本番のビルドには入らない。受けるのも開発サーバーだけ。
 *
 * 1字ずつの見本(/dev/samples)と、英単語を書いた線(/dev/words)、漢字を書いた線(/dev/kanji)は、
 * 形が違うので別のファイルに貯める。
 *
 * 試し場の「送る」は端末に残っている見本を毎回全部送るので、手元で消した見本(書き損じなど)も
 * 次に送ったときに戻ってくる。消した見本の時刻を `<ファイル名>.removed.json` に並べておくと、受け取らない。
 */
function devSampleSink(route: string, file: string, name: string): Plugin {
  const target = fileURLToPath(new URL(`./scripts/train/.cache/${file}`, import.meta.url))
  const removedList = target.replace(/\.json$/, '.removed.json')

  return {
    name: `bloomstudy:dev-sample-sink:${route}`,
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(route, (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405
          response.end('POST だけ受ける')
          return
        }

        const chunks: Buffer[] = []
        request.on('data', (chunk: Buffer) => chunks.push(chunk))
        request.on('end', () => {
          try {
            const sent = JSON.parse(Buffer.concat(chunks).toString('utf-8')) as { at?: string }[]
            const existing: { at?: string }[] = existsSync(target)
              ? (JSON.parse(readFileSync(target, 'utf-8')) as { at?: string }[])
              : []

            // 同じものを二度送っても増えないよう、書いた時刻で見分ける。手元で消したものも受け取らない
            const removed: string[] = existsSync(removedList)
              ? (JSON.parse(readFileSync(removedList, 'utf-8')) as string[])
              : []
            const seen = new Set([...existing.map((entry) => entry.at), ...removed])
            const merged = [...existing, ...sent.filter((entry) => !seen.has(entry.at))]

            mkdirSync(dirname(target), { recursive: true })
            writeFileSync(target, JSON.stringify(merged))

            console.log(`[${name}] ${sent.length}件うけとり / 合計 ${merged.length}件`)
            response.setHeader('content-type', 'application/json')
            response.end(JSON.stringify({ saved: merged.length }))
          } catch (error) {
            response.statusCode = 400
            response.end(String(error))
          }
        })
      })
    },
  }
}

/**
 * このアプリについて の画面に出す、データの数(漢字の問題 〇問 など)。
 *
 * 数えるためだけに、重い問題データ(全部で数MB)を画面に読ませたくないので、
 * ビルドのときに数えて、数だけを `virtual:data-counts` として渡す。
 * 問題を作り直せば、次のビルド(開発中は開き直し)で数も変わる。
 */
function dataCounts(): Plugin {
  const id = 'virtual:data-counts'
  const read = (file: string) =>
    JSON.parse(readFileSync(fileURLToPath(new URL(`./src/data/${file}`, import.meta.url)), 'utf-8'))
  return {
    name: 'bloomstudy:data-counts',
    resolveId: (source) => (source === id ? `\0${id}` : undefined),
    load(resolved) {
      if (resolved !== `\0${id}`) return
      const counts = {
        kanjiQuestions: read('questions.kanji.generated.json').questions.length,
        englishWords: read('questions.english.generated.json').questions.length,
        mathQuestions: read('questions.math.generated.json').questions.length,
        traceCharacters:
          read('strokes.kanji.generated.json').characters.length +
          read('strokes.hiragana.generated.json').characters.length,
        kanjiPuzzles: Object.keys(read('puzzles.kanji.generated.json').puzzles).length,
        kanjiShapes: Object.keys(read('shapes.kanji.generated.json').characters).length,
      }
      return `export default ${JSON.stringify(counts)}`
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    dataCounts(),
    devSampleSink('/dev/samples', 'samples.json', '見本'),
    devSampleSink('/dev/words', 'words.json', '英単語'),
    devSampleSink('/dev/kanji', 'kanji.json', '漢字'),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // スマートフォン実機から同一LAN経由で確認するため
    host: true,
  },
})
