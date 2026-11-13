import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { useStats } from '@/hooks/useStats'
import { clearStamps, resetToday } from '@/services/stampCard'
import { checkStaffPasscode } from '@/services/staffPasscode'

/**
 * 隠しページ(スタッフ用)。ホーム画面・ジャンル選択画面で四隅を順に押すと開く(useStaffGesture)。
 *
 * 文化祭でお客さんが触るので、記録を消すようなボタンは、ふつうの画面には置かずにここへまとめる。
 * パスワードは毎回入れる(開いたままにしない)。間違いが続いたら、しばらく入れられないようにする。
 * ここでできるのは「この端末の記録を消す」ことだけ(ほかの人の端末やアプリ本体には影響しない)。
 */

/** 続けて間違えてよい回数と、そのあと待つ時間 */
const MAX_TRIES = 5
const LOCK_MS = 30_000
const LOCK_KEY = 'bloomstudy:staff-lock:v1'

function readLock(): number {
  try {
    return Number(localStorage.getItem(LOCK_KEY) ?? 0)
  } catch {
    return 0
  }
}

function writeLock(until: number) {
  try {
    localStorage.setItem(LOCK_KEY, String(until))
  } catch {
    // 覚えられないときは、開き直すまでの間だけ止める
  }
}

export function StaffPage() {
  const [passcode, setPasscode] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [checking, setChecking] = useState(false)
  const [tries, setTries] = useState(0)
  const [message, setMessage] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (checking || !passcode) return
    const lockedFor = readLock() - Date.now()
    if (lockedFor > 0) {
      setMessage(`間違いが続いたので、${Math.ceil(lockedFor / 1000)}秒待ってください`)
      return
    }
    setChecking(true)
    setMessage(null)
    const ok = await checkStaffPasscode(passcode).catch(() => false)
    setChecking(false)
    setPasscode('')
    if (ok) {
      setUnlocked(true)
      setTries(0)
      return
    }
    const next = tries + 1
    setTries(next)
    if (next >= MAX_TRIES) {
      writeLock(Date.now() + LOCK_MS)
      setTries(0)
      setMessage(`間違いが続いたので、${LOCK_MS / 1000}秒待ってください`)
    } else {
      setMessage('パスワードが違います')
    }
  }

  return (
    <AppShell>
      <h1 className="text-xl font-bold">スタッフ用</h1>
      {unlocked ? <StaffTools /> : (
        <form onSubmit={(event) => void submit(event)} className="mt-6 flex flex-col gap-3">
          <label className="flex flex-col gap-2 text-sm text-ink-600">
            パスワード
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={passcode}
              onChange={(event) => setPasscode(event.target.value)}
              className="min-h-12 rounded-xl border-2 border-bloom-200 bg-white px-4 text-lg text-ink-900"
            />
          </label>
          {message && <p className="text-sm text-warm-600">{message}</p>}
          <button
            type="submit"
            disabled={checking || !passcode}
            className="min-h-14 rounded-full bg-bloom-700 text-lg font-bold text-white disabled:bg-bloom-200"
          >
            {checking ? '確かめています' : '開く'}
          </button>
        </form>
      )}
      <Link to="/" className="mt-8 text-center text-sm text-ink-400 underline">
        ホームに戻る
      </Link>
    </AppShell>
  )
}

function StaffTools() {
  const { reset } = useStats()
  const [done, setDone] = useState<string | null>(null)

  const run = (label: string, action: () => void | Promise<void>) => {
    if (!window.confirm(`${label}。この端末の中のデータが消えます。よろしいですか？`)) return
    void Promise.resolve(action()).then(() => setDone(`${label}を消しました`))
  }

  return (
    <section className="mt-6 flex flex-col gap-3">
      <p className="text-sm text-ink-600">この端末の記録を消します。ほかの端末には影響しません。</p>
      <button
        type="button"
        onClick={() => run('記録(履歴)をリセット', reset)}
        className="min-h-14 rounded-full border-2 border-warm-500 font-bold text-warm-600"
      >
        記録(履歴)をリセット
      </button>
      <button
        type="button"
        onClick={() => run('スタンプカードをリセット', clearStamps)}
        className="min-h-14 rounded-full border-2 border-warm-500 font-bold text-warm-600"
      >
        スタンプカードをリセット
      </button>
      <button
        type="button"
        onClick={() => run('今日のスタンプまでの回数をリセット', resetToday)}
        className="min-h-14 rounded-full border-2 border-warm-500 font-bold text-warm-600"
      >
        今日のスタンプまでの回数をリセット
      </button>
      {done && <p className="text-sm text-bloom-700">{done}</p>}
    </section>
  )
}
