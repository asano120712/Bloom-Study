import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

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
    /*
      PWA(ホーム画面に置けるアプリにする)。
      - 画面・問題データ・お手本を全部先に保存しておき、電波が無くても遊べるようにする
        (文化祭の会場は回線が混む。いちばん大きい計算の問題で約1.8MB)
      - 新しい版を公開したら、次に開いたときに入れ替わる(autoUpdate)。遊んでいる途中で勝手に読み直さない
      - 登録の処理は別ファイル(registerSW.js)にする。CSP で埋め込みのスクリプトを禁じているため
      - 開発サーバーでは動かさない(古い保存が残って、直したはずの画面が出るのを避ける)
    */
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Bloomstudy',
        short_name: 'Bloomstudy',
        description: '思い出す力と書く力を鍛える、ゲーム型の学習ウェブアプリ',
        lang: 'ja',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#FBFDFC',
        theme_color: '#0F6E56',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          // 花は安全な範囲(中心から 40%)に収めてあるので、切り抜かれる用にも同じ絵を使う
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // 計算の問題(約1.8MB)と漢字のお手本(約1.3MB)も保存する。既定の 2MB では計算が漏れる
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        // フォントは Google Fonts から読む。一度読んだら保存して、電波が無くても同じ字で出す
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
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
