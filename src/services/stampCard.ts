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

/**
 * スタンプの種類。押す前に、その日のぶんを子どもが選ぶ。
 * 並びは選ぶ画面の順(はな・うさぎ・ワンピース・かぶとむし・パトカー・きょうりゅう)。
 */
export const STAMP_KINDS = ['flower', 'rabbit', 'dress', 'beetle', 'police', 'dinosaur'] as const
export type StampKind = (typeof STAMP_KINDS)[number]

interface StampData {
  /** 日付(YYYY-MM-DD、端末の時刻)ごとの、あそんだ回数 */
  plays: Record<string, number>
  /**
   * スタンプを押す演出を見せ終えた日。
   * 10回目はあそびの途中で届くことがあるので、届いた瞬間ではなく、
   * あとで「ぜんぶ できた!」やスタンプカードを開いたときに、まだ見せていなければ押す
   */
  celebrated: string[]
  /** 日付ごとに選んだスタンプ。種類を選べるようになる前に押した日は無い(はなで出す) */
  kinds: Record<string, StampKind>
}

const EMPTY: StampData = { plays: {}, celebrated: [], kinds: {} }

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
    return { plays: parsed.plays ?? {}, celebrated: parsed.celebrated ?? [], kinds: parsed.kinds ?? {} }
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

/** その日に押したスタンプの種類。選ぶ前に押した日は、はな */
export const kindOf = (kinds: Record<string, StampKind>, day: string): StampKind =>
  STAMP_KINDS.includes(kinds[day]) ? kinds[day] : 'flower'

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
  const { [today]: __, ...kinds } = data.kinds
  writeStamps({ plays, kinds, celebrated: data.celebrated.filter((day) => day !== today) })
}

/** スタンプカードを全部消す(隠しページのスタッフ用。文化祭で端末を次の人に渡す前など) */
export function clearStamps(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 消せない環境では何もしない(もともと保存もできていない)
  }
}

/** 今日のスタンプを kind で押した。同じ日にもう一度、押す演出は見せない */
export function markCelebrated(kind: StampKind): void {
  const data = readStamps()
  const today = dayKey()
  // 古い日付は要らないので、直近のぶんだけ残す
  const celebrated = data.celebrated.includes(today) ? data.celebrated : [...data.celebrated, today].slice(-40)
  writeStamps({ ...data, celebrated, kinds: { ...data.kinds, [today]: kind } })
}
