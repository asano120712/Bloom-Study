import { Link } from 'react-router-dom'
import { COPYRIGHT } from '@/data/credits'
import { useCopy } from '@/hooks/useAudienceMode'

/**
 * ホームのいちばん下に出す、このアプリについて へのリンクと ©。
 * 遊ぶ人の目に入らないよう、小さく控えめにする。
 */
export function AboutFooter() {
  const copy = useCopy()
  return (
    <footer className="mt-8 flex flex-col items-center gap-1 text-xs text-ink-400">
      <Link to="/about" className="flex min-h-11 items-center px-3 underline">
        {copy.about.link}
      </Link>
      <p>{COPYRIGHT}</p>
    </footer>
  )
}
