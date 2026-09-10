import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { GenreSelectPage } from '@/pages/GenreSelectPage'
import { KidsTopPage } from '@/pages/KidsTopPage'
import { MyPage } from '@/pages/MyPage'
import { QuizPage } from '@/pages/QuizPage'
import { ResultPage } from '@/pages/ResultPage'
import { TopPage } from '@/pages/TopPage'
import { TracePage } from '@/pages/TracePage'
import { TrialEndPage } from '@/pages/TrialEndPage'
import { useAudienceMode } from '@/hooks/useAudienceMode'
import { primeSpeech } from '@/services/speech'

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
      <Routes>
        {/* トップだけモードごとに分ける。この先の画面は共通 */}
        <Route path="/" element={<TopPage />} />
        <Route path="/kids" element={<KidsTopPage />} />
        <Route path="/genres" element={<GenreSelectPage />} />
        <Route path="/quiz/:genreId" element={<QuizPage />} />
        <Route path="/result" element={<ResultPage />} />
        {/* こども向けのあそび。こたえかたも難易度も選ばせず、押したらすぐ始まる */}
        <Route path="/trace/:setId" element={<TracePage />} />
        <Route path="/mypage" element={<MyPage />} />
        <Route path="/trial-end" element={<TrialEndPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
