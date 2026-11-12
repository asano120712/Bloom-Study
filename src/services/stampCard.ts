/**
 * こどものスタンプカード。こどもモードのあそびを、1日に何回したかを覚えておく。
 *
 * なぞりがきの1字、おなじものさがしの1問を、それぞれ1回と数える。
 * その日に STAMP_GOAL 回に届くと、その日にスタンプが押される(5問のあそびを2回で届く)。
 *
 * 保存は localStorage(端末の中だけ)。スタンプは「その日がんばった」の印なので、
 * 正解かどうかは問わない。おなじものさがしは、当てるまで次へ進まないので、
 * 1問終えた = 1回でよい。
 */
const STORAGE_KEY = 'bloomstudy:stamps:v1'

/** 1日にこの回数あそぶと、その日にスタンプが押される */
export const STAMP_GOAL = 10

interface StampData {
  /** 日付(YYYY-MM-DD、端末の時刻)ごとの、あそんだ回数 */
  plays: Record<string, number>
  /**
   * スタンプを押す演出を見せ終えた日。
   * 10回目はあそびの途中で届くことがあるので、届いた瞬間ではなく、
   * あとで「ぜんぶ できた!」やスタンプカードを開いたときに、まだ見せていなければ押す
   */
  celebrated: string[]
}

const EMPTY: StampData = { plays: {}, celebrated: [] }

/** 端末の時刻での日付。toISOString は世界時なので、日本の朝9時までは前の日になってしまう */
export function dayKey(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function readStamps(): StampData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as Partial<StampData>
    return { plays: parsed.plays ?? {}, celebrated: parsed.celebrated ?? [] }
  } catch {
    // 読めない(プライベートモードなど)・壊れているときは、まっさらから始める
    return EMPTY
  }
}

function writeStamps(data: StampData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // 覚えられなくても、あそび自体は続けられる
  }
}

export const isStamped = (data: StampData, day: string) => (data.plays[day] ?? 0) >= STAMP_GOAL

/** あそびを1回終えたとき。今日の回数を返す */
export function addPlay(): number {
  const data = readStamps()
  const today = dayKey()
  const count = (data.plays[today] ?? 0) + 1
  writeStamps({ ...data, plays: { ...data.plays, [today]: count } })
  return count
}

/** 今日のスタンプが押されたのに、まだ押す演出を見せていないか */
export function needsCelebration(data = readStamps()): boolean {
  const today = dayKey()
  return isStamped(data, today) && !data.celebrated.includes(today)
}

/**
 * 今日のスタンプまでの回数を 0 に戻す(隠しページのスタッフ用)。
 * 押す演出を見せたことも忘れるので、また10回あそべば、もう一度スタンプを押すところが見られる。
 */
export function resetToday(): void {
  const data = readStamps()
  const today = dayKey()
  const { [today]: _, ...plays } = data.plays
  writeStamps({ plays, celebrated: data.celebrated.filter((day) => day !== today) })
}

/** スタンプカードを全部消す(隠しページのスタッフ用。文化祭で端末を次の人に渡す前など) */
export function clearStamps(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 消せない環境では何もしない(もともと保存もできていない)
  }
}

/** 押す演出を見せ終えた。同じ日にもう一度は見せない */
export function markCelebrated(): void {
  const data = readStamps()
  const today = dayKey()
  if (data.celebrated.includes(today)) return
  // 古い日付は要らないので、直近のぶんだけ残す
  writeStamps({ ...data, celebrated: [...data.celebrated, today].slice(-40) })
}
