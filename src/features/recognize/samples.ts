/**
 * 書いた字を貯める(開発時だけ)。
 *
 * 外れた字を**そのまま**残しておくと、何が起きているのかを数字で確かめられるし、
 * あとで学習に混ぜることもできる。自分の端末の中だけに置き、送らない。
 *
 * 形は「書いたマスの生の線」。前処理を変えたくなっても作り直せるよう、
 * そろえたあとの絵ではなく、描いたままを 1bit に詰めて持つ。
 */

const KEY = 'bloomstudy:dev:samples:v1'
const WRITER_KEY = 'bloomstudy:dev:writer:v1'

/** 試し場で最後に入れた「書いた人」。何人かで1台を回すときも、毎回入れ直さなくて済むように覚えておく */
export function readWriter(): string {
  try {
    return localStorage.getItem(WRITER_KEY) ?? ''
  } catch {
    return ''
  }
}

export function writeWriter(writer: string): void {
  try {
    localStorage.setItem(WRITER_KEY, writer)
  } catch {
    // 覚えられないだけで、書いた字には付けられる
  }
}

export interface Sample {
  label: string
  /** 正方形の一辺 */
  size: number
  /** 線のあるところを 1 とした bit 列(base64) */
  ink: string
  /** そのとき読み取れた1位と確からしさ(あとで見返すため) */
  guessed?: string
  /**
   * 書いた人(A、B などの記号)。人ごとに読めた割合を比べたり、学習に使っていない人の字だけで
   * 測ったりするため。最初の頃に送ったもの(この欄を作る前)には無い
   */
  writer?: string
  score?: number
  at: string
}

/** 透明度から 1bit へ詰める。1マス120×120なら 1800 バイト */
export function packInk(image: ImageData): string {
  const bits = new Uint8Array(Math.ceil((image.width * image.height) / 8))
  for (let i = 0; i < image.width * image.height; i += 1) {
    if (image.data[i * 4 + 3] < 48) continue
    bits[i >> 3] |= 0x80 >> (i & 7)
  }
  let binary = ''
  for (const byte of bits) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function readSamples(): Sample[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Sample[]) : []
  } catch {
    return []
  }
}

export function addSample(sample: Sample): Sample[] {
  const next = [...readSamples(), sample]
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // 入りきらなくなったら、そこまでのぶんで諦める(開発用なので止めない)
  }
  return next
}

export function clearSamples(): void {
  localStorage.removeItem(KEY)
}
