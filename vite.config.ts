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
 * 1字ずつの見本(/dev/samples)と、英単語を書いた線(/dev/words)は、形が違うので別のファイルに貯める。
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

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    devSampleSink('/dev/samples', 'samples.json', '見本'),
    devSampleSink('/dev/words', 'words.json', '英単語'),
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
