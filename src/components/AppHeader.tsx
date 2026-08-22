import { Link } from 'react-router-dom'
import { BloomLogo } from './BloomLogo'

/**
 * 全画面共通のヘッダー。左に横組みロゴを置く。
 * 右側は今後ナビゲーション(マイページ導線など)を足す想定で空けてある。
 */
export function AppHeader() {
  return (
    <header className="flex items-center justify-between border-b border-bloom-100 px-5 py-3">
      <Link to="/" aria-label="トップへ" className="inline-flex">
        <BloomLogo variant="horizontal" className="h-9 w-auto" />
      </Link>
    </header>
  )
}
