import { Link } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { GENRES } from '@/data/genres'

export function GenreSelectPage() {
  return (
    <AppShell>
      <h1 className="text-2xl font-bold">ジャンルをえらぶ</h1>
      <p className="mt-2 text-sm text-ink-600">ジャンルごとにヒントの出かたが変わります。</p>

      <ul className="mt-6 flex flex-col gap-4">
        {GENRES.map((genre) => (
          <li key={genre.id}>
            <Link
              to={`/quiz/${genre.id}`}
              className="flex min-h-20 flex-col justify-center rounded-3xl bg-petal-100 px-5 py-4"
            >
              <span className="text-xl font-bold text-petal-600">{genre.label}</span>
              <span className="mt-1 text-sm text-ink-600">{genre.description}</span>
            </Link>
          </li>
        ))}
      </ul>

      <Link to="/" className="mt-8 text-center text-sm text-ink-400 underline">
        トップにもどる
      </Link>
    </AppShell>
  )
}
