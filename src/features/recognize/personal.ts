import { chamfer, fieldOf } from './distance'
import { normalize, normalizeGray, type Bitmap } from './preprocess'
import { packInk } from './samples'

/**
 * 自分の字(端末の中で覚える見本)。
 *
 * 共通のお手本(書体やモデル)は「みんなの字」なので、その人のクセ(1 のひげ、
 * b と k の書き分け)までは拾えない。練習で書いた字をその人の見本として残し、
 * 読むときに**いちばん近い見本**とも比べる。学習し直す計算は要らず、1枚書けばすぐ効く。
 *
 * 置き場所は IndexedDB。**端末の外へは送らない**(送る口はどこにも作らない)。
 * localStorage は 5MB ほどで、見本を何百枚も貯めると入りきらないので使わない。
 *
 * 覚えるのは、お手本を見せて「これを書いて」と頼んだ字だけにする(呼ぶ側の約束)。
 * 出題中に書いた字は、合っているとは限らない。間違えた字を正解として覚えると、
 * 次からその間違いが正解になってしまう。
 */

const DB_NAME = 'bloomstudy-personal'
const STORE = 'samples'

/** 端末に置く形。前処理を変えても作り直せるよう、そろえる前の生の線を持つ */
interface Stored {
  id?: number
  label: string
  /** 正方形の一辺 */
  size: number
  /** 線のあるところを 1 とした bit 列(base64)。samples.ts の packInk と同じ形 */
  ink: string
  at: string
}

/** 比べられる形にそろえ終わった見本 */
export interface PersonalSample {
  id: number
  label: string
  bitmap: Bitmap
  field: Float32Array
  /** 学習したモデルに渡す濃淡(MODEL_SIZE 角)。1枚ずつ伏せて測るときに、モデルでも読むため */
  gray: Float32Array
}

let opening: Promise<IDBDatabase | null> | null = null

/** 開けない環境(プライベートモードなど)では null。覚えないだけで、読み取りは続ける */
function open(): Promise<IDBDatabase | null> {
  if (!opening) {
    opening = new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, 1)
        request.onupgradeneeded = () => {
          request.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
  }
  return opening
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return open().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) return resolve(null)
        const request = work(db.transaction(STORE, mode).objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => resolve(null)
      }),
  )
}

/** 1bit の線を、前処理に渡せる絵へ戻す */
function unpack(stored: Stored): ImageData {
  const image = new ImageData(stored.size, stored.size)
  const bytes = atob(stored.ink)
  for (let i = 0; i < stored.size * stored.size; i += 1) {
    if (bytes.charCodeAt(i >> 3) & (0x80 >> (i & 7))) image.data[i * 4 + 3] = 255
  }
  return image
}

function prepare(stored: Stored & { id: number }): PersonalSample | null {
  const image = unpack(stored)
  const bitmap = normalize(image)
  const gray = normalizeGray(image)
  return bitmap && gray ? { id: stored.id, label: stored.label, bitmap, field: fieldOf(bitmap), gray } : null
}

/** そろえるのは読み込むときに1回だけ。読むたびにそろえ直すと、見本の数だけ遅くなる */
let cache: Promise<PersonalSample[]> | null = null

export function personalSamples(): Promise<PersonalSample[]> {
  if (!cache) {
    cache = run('readonly', (store) => store.getAll() as IDBRequest<(Stored & { id: number })[]>).then(
      (all) => (all ?? []).map(prepare).filter((sample) => sample !== null),
    )
  }
  return cache
}

/** 書いた字を、label の見本として覚える */
export async function rememberSample(label: string, image: ImageData): Promise<void> {
  const stored: Stored = { label, size: image.width, ink: packInk(image), at: new Date().toISOString() }
  const id = await run('readwrite', (store) => store.add(stored) as IDBRequest<number>)
  if (id === null) return
  const prepared = prepare({ ...stored, id })
  if (prepared && cache) cache = cache.then((samples) => [...samples, prepared])
}

/** 覚えた字を全部忘れる */
export async function forgetAll(): Promise<void> {
  await run('readwrite', (store) => store.clear())
  cache = Promise.resolve([])
}

/**
 * 候補ごとの、いちばん近い自分の見本までの距離。見本の無い候補は入らない。
 * except を渡すと、その見本は比べない(1枚ずつ伏せて正解率を測るとき)。
 */
export function nearestPersonal(
  written: { bitmap: Bitmap; field: Float32Array },
  samples: PersonalSample[],
  candidates: string[],
  except?: number,
): Map<string, number> {
  const wanted = new Set(candidates)
  const nearest = new Map<string, number>()
  for (const sample of samples) {
    if (sample.id === except || !wanted.has(sample.label)) continue
    const distance = chamfer(written, sample)
    if (distance < (nearest.get(sample.label) ?? Number.POSITIVE_INFINITY)) {
      nearest.set(sample.label, distance)
    }
  }
  return nearest
}
