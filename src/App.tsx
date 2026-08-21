import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { GenreSelectPage } from '@/pages/GenreSelectPage'
import { MyPage } from '@/pages/MyPage'
import { QuizPage } from '@/pages/QuizPage'
import { ResultPage } from '@/pages/ResultPage'
import { TopPage } from '@/pages/TopPage'
import { TrialEndPage } from '@/pages/TrialEndPage'

export default function App() {
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
