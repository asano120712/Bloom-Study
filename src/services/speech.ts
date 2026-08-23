/**
 * 答えの読み上げ。ブラウザ内蔵の Web Speech API を使う。
 *
 * 外部の音声合成APIを使わないのは、通信・利用料・ライセンスがどれも増えるため。
 * Web Speech API なら追加コストゼロで、対応環境も広い。
 *
 * ただし読み上げは「あると良い」機能として扱う。
 * 端末に音声が入っていない、iOS がユーザー操作なしの発話を弾く、といった理由で
 * 鳴らないことがあるので、鳴らなくても学習の流れは止めない。
 */
export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/**
 * 発話中の utterance を握っておく。
 *
 * Chrome は発話中の utterance が GC されると、エラーも出さずに音を止める。
 * ローカル変数のままだと speak() を抜けた時点で回収され得るので、
 * モジュール側で参照を持ち続ける。
 */
const inFlight = new Set<SpeechSynthesisUtterance>()

/** 発話待ち・発話中の数。診断用 */
export function inFlightCount(): number {
  return inFlight.size
}

let primed = false

/**
 * 最初のユーザー操作に合わせて、音声合成を使える状態にしておく。
 *
 * iOS はユーザー操作を伴わない最初の発話を弾く。結果画面の自動読み上げは
 * 画面遷移後に走るため操作の文脈から外れ、初回だけ鳴らないことがある
 * (一度ボタンを押すと以降は鳴る、という症状になる)。
 * 無音の発話を1回だけ通しておくと、以降の自動読み上げも鳴るようになる。
 *
 * 呼ぶのはタップ・クリックのハンドラの中からでなければ意味がない。
 */
export function primeSpeech(): void {
  if (primed || !canSpeak()) return
  primed = true
  try {
    const utterance = new SpeechSynthesisUtterance(' ')
    utterance.volume = 0
    window.speechSynthesis.speak(utterance)
  } catch {
    // 解除に失敗しても、読み上げボタンからは鳴らせる
  }
}

/** 最後に起きた失敗。診断用 */
let lastError: string | null = null
export function lastSpeechError(): string | null {
  return lastError
}

/**
 * 音声一覧を待つ。
 *
 * Chrome は音声一覧を非同期に読み込むため、getVoices() は最初 空配列を返す。
 * 読み込み前に speak() すると、エラーも出さずに無音になる。
 */
function loadVoices(synth: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const settle = () => resolve(synth.getVoices())
    synth.addEventListener?.('voiceschanged', settle, { once: true })
    // voiceschanged が飛んでこない環境でも待ち続けないようにする
    window.setTimeout(settle, 1500)
  })
}

const normalizeLang = (value: string) => value.replace('_', '-').toLowerCase()

/**
 * macOS に入っているネタ音声。発音の手本にならないので選ばない。
 *
 * en-US の一覧はアルファベット順で、先頭がこれらで埋まっている。
 * 「最初に見つかった一致」を採ると Albert(しゃがれ声)が選ばれてしまう。
 */
const NOVELTY_VOICES = new Set([
  'albert', 'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos', 'deranged',
  'good news', 'hysterical', 'jester', 'organ', 'pipe organ', 'superstar',
  'trinoids', 'whisper', 'wobble', 'zarvox',
])

const isNovelty = (voice: SpeechSynthesisVoice) => NOVELTY_VOICES.has(voice.name.trim().toLowerCase())

/**
 * 読み上げに使う音声を選ぶ。
 * 端末の既定 → ネタ以外の完全一致 → ネタ以外の言語一致、の順に降りる。
 */
function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  const wanted = normalizeLang(lang)
  const base = wanted.split('-')[0]
  const exact = voices.filter((voice) => normalizeLang(voice.lang) === wanted)
  const sameLanguage = voices.filter((voice) => normalizeLang(voice.lang).split('-')[0] === base)

  return (
    exact.find((voice) => voice.default && !isNovelty(voice)) ??
    sameLanguage.find((voice) => voice.default && !isNovelty(voice)) ??
    exact.find((voice) => !isNovelty(voice)) ??
    sameLanguage.find((voice) => !isNovelty(voice)) ??
    null
  )
}

function speakNow(synth: SpeechSynthesis, text: string, lang: string, voices: SpeechSynthesisVoice[]): void {
  // 何も喋っていないときの cancel() は Chrome の合成器を止めることがある
  if (synth.speaking || synth.pending) synth.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang
  const voice = pickVoice(voices, lang)
  if (voice) utterance.voice = voice
  utterance.rate = 0.9
  utterance.onerror = (event) => {
    lastError = event.error ?? 'unknown'
    inFlight.delete(utterance)
  }
  utterance.onend = () => {
    inFlight.delete(utterance)
  }

  inFlight.add(utterance)
  lastError = null
  synth.speak(utterance)

  // Chrome は一時停止状態のまま止まることがある
  if (synth.paused) synth.resume()
}

/**
 * 読み上げる。
 *
 * 音声一覧が既にあるときは同期的に speak() まで進める。
 * await を挟むとユーザー操作の文脈から外れ、ブラウザに発話を抑止されることがあるため。
 */
export function speak(text: string, lang: string): void {
  if (!canSpeak()) return

  try {
    const synth = window.speechSynthesis
    const voices = typeof synth.getVoices === 'function' ? synth.getVoices() : []
    if (voices.length) {
      speakNow(synth, text, lang, voices)
      return
    }
    void loadVoices(synth).then((loaded) => speakNow(synth, text, lang, loaded))
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error)
  }
}
