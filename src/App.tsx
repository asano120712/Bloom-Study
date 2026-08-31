import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { GenreSelectPage } from '@/pages/GenreSelectPage'
import { MyPage } from '@/pages/MyPage'
import { QuizPage } from '@/pages/QuizPage'
import { ResultPage } from '@/pages/ResultPage'
import { TopPage } from '@/pages/TopPage'
import { TrialEndPage } from '@/pages/TrialEndPage'
import { primeSpeech } from '@/services/speech'

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
      <Routes>
        <Route path="/" element={<TopPage />} />
        <Route path="/genres" element={<GenreSelectPage />} />
        <Route path="/quiz/:genreId" element={<QuizPage />} />
        <Route path="/result" element={<ResultPage />} />
        <Route path="/mypage" element={<MyPage />} />
        <Route path="/trial-end" element={<TrialEndPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
