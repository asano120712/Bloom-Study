import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { Loading } from '@/components/Loading'
import { GenreSelectPage } from '@/pages/GenreSelectPage'
import { KidsTopPage } from '@/pages/KidsTopPage'
import { TopPage } from '@/pages/TopPage'
import { useAudienceMode } from '@/hooks/useAudienceMode'
import { primeSpeech } from '@/services/speech'

/*
 * 出題データとお手本データは重い(漢字の問題で約100KB、なぞりのストロークで約170KB)。
 * その画面に入るまで読まないよう、データを抱える画面は遅延読み込みにする。
 * トップとジャンル選択は最初に必ず通るので、そのまま同梱する。
 *
 * 待っている間は Loading を出すが、Loading 自体が 200ms は何も描かないので、
 * 手元で開くぶんにはチラつかない。
 */
const QuizPage = lazy(() => import('@/pages/QuizPage').then((m) => ({ default: m.QuizPage })))
const ResultPage = lazy(() => import('@/pages/ResultPage').then((m) => ({ default: m.ResultPage })))
const TracePage = lazy(() => import('@/pages/TracePage').then((m) => ({ default: m.TracePage })))
const MatchPage = lazy(() => import('@/pages/MatchPage').then((m) => ({ default: m.MatchPage })))
const MyPage = lazy(() => import('@/pages/MyPage').then((m) => ({ default: m.MyPage })))
const TrialEndPage = lazy(() =>
  import('@/pages/TrialEndPage').then((m) => ({ default: m.TrialEndPage })),
)
/**
 * 読み取りの試し場。開発中だけ使う。
 * 本番のビルドからは丸ごと消えるよう、取り込み自体を DEV で切り分ける。
 */
const RecognizeLabPage = import.meta.env.DEV
  ? lazy(() => import('@/pages/RecognizeLabPage').then((m) => ({ default: m.RecognizeLabPage })))
  : null

/**
 * いまのモードを <html data-audience> に貼る。
 * 配色トークンの差し替え(src/index.css)を、画面の外側(body の地)まで効かせるため。
 */
function AudienceTheme() {
  const mode = useAudienceMode()

  useEffect(() => {
    document.documentElement.dataset.audience = mode
  }, [mode])

  return null
}

export default function App() {
  // 最初のタップで音声合成を解除しておく(iOS は操作なしの初回発話を弾くため)。
  // どの画面から始めても効くよう、アプリ全体で1度だけ拾う。
  useEffect(() => {
    const onFirstGesture = () => primeSpeech()
    window.addEventListener('pointerdown', onFirstGesture, { once: true })
    return () => window.removeEventListener('pointerdown', onFirstGesture)
  }, [])

  return (
    <BrowserRouter>
      <AudienceTheme />
      <Suspense
        fallback={
          <AppShell>
            <Loading />
          </AppShell>
        }
      >
        <Routes>
          {/* トップだけモードごとに分ける。この先の画面は共通 */}
          <Route path="/" element={<TopPage />} />
          <Route path="/kids" element={<KidsTopPage />} />
          <Route path="/genres" element={<GenreSelectPage />} />
          <Route path="/quiz/:genreId" element={<QuizPage />} />
          <Route path="/result" element={<ResultPage />} />
          {/* こども向けのあそび。こたえかたも難易度も選ばせず、押したらすぐ始まる */}
          <Route path="/trace/:setId" element={<TracePage />} />
          <Route path="/match" element={<MatchPage />} />
          <Route path="/mypage" element={<MyPage />} />
          <Route path="/trial-end" element={<TrialEndPage />} />
          {/*
            読み取りの試し場。開発中だけ出す(本番のビルドには入らない)。
            自動判定を画面へ入れる前に、自分の字でどれだけ当たるかを見るための場所。
          */}
          {RecognizeLabPage && (
            <Route path="/dev/recognize" element={<RecognizeLabPage />} />
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
