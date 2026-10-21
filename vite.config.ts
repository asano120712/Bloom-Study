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
 */
function devSampleSink(): Plugin {
  const target = fileURLToPath(new URL('./scripts/train/.cache/samples.json', import.meta.url))

  return {
    name: 'bloomstudy:dev-sample-sink',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/dev/samples', (request, response) => {
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

            // 同じものを二度送っても増えないよう、書いた時刻で見分ける
            const seen = new Set(existing.map((entry) => entry.at))
            const merged = [...existing, ...sent.filter((entry) => !seen.has(entry.at))]

            mkdirSync(dirname(target), { recursive: true })
            writeFileSync(target, JSON.stringify(merged))

            console.log(`[見本] ${sent.length}枚うけとり / 合計 ${merged.length}枚`)
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
  plugins: [react(), tailwindcss(), devSampleSink()],
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
