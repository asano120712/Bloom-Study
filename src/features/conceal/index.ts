import { createContext, useContext } from 'react'

/**
 * 漢字の問題の答えを、画面のほかの文字で見せてしまわないようにする。
 *
 * 出題画面には「漢字」(ジャンル名)・「3 連続 / 5 問目」・「消す」など、いつも同じ文字が出ている。
 * 答えが 漢・連・消 の問題だと、その字が画面にそのまま見えて、思い出す前に答えが分かってしまう。
 * 答えの字が入っている言葉だけ、ひらがなにして出す(漢字 → かんじ)。ふだんの画面は変えない。
 *
 * 画面の言葉は data/copy.ts に集めてあり、useCopy() がここを通して返す。
 * 画面に言葉を足したら、ひらがなを KANA_OF に足すこと(npm run check:conceal が足りない言葉を挙げる)。
 */

/**
 * 出題画面に出る言葉と、そのひらがな。答えの字が入っている言葉を、これで置きかえる。
 * 送りがなまで含めて書く(書く → かく、書けた → かけた)。同じ字でも読みが変わるため。
 */
export const KANA_OF: Record<string, string> = {
  // ジャンル名・出題語の上の一言
  漢字: 'かんじ',
  英単語: 'えいたんご',
  計算: 'けいさん',
  熟語: 'じゅくご',
  言葉: 'ことば',
  入る: 'はいる',
  思い出そう: 'おもいだそう',
  思い出す: 'おもいだす',
  思い出した: 'おもいだした',
  思い出せたら: 'おもいだせたら',
  // 進み具合・パス
  連続: 'れんぞく',
  問目: 'もんめ',
  問題: 'もんだい',
  // ヒント
  次: 'つぎ',
  秒: 'びょう',
  出ます: 'でます',
  // 書く道具
  道具: 'どうぐ',
  書く: 'かく',
  書いて: 'かいて',
  書いた: 'かいた',
  書けた: 'かけた',
  消す: 'けす',
  全消し: 'ぜんけし',
  全部: 'ぜんぶ',
  一度: 'いちど',
  押すと: 'おすと',
  押して: 'おして',
  手書き: 'てがき',
  入力中: 'にゅうりょくちゅう',
  入力する: 'にゅうりょくする',
  入力: 'にゅうりょく',
  マス目: 'マスめ',
  // 書いたあとの読み取り(答えを見せたあとだが、言葉はそろえておく)
  字: 'じ',
  見えました: 'みえました',
  自信: 'じしん',
  合っていたら: 'あっていたら',
  読み取れませんでした: 'よみとれませんでした',
  答え合わせ: 'こたえあわせ',
  答え: 'こたえ',
  違った: 'ちがった',
  // パズル
  頭: 'あたま',
  中: 'なか',
  進みます: 'すすみます',
  左: 'ひだり',
  右: 'みぎ',
  上: 'うえ',
  下: 'した',
  選ぼう: 'えらぼう',
  覚えよう: 'おぼえよう',
  見て: 'みて',
  // ほかのあそびのジャンル名(漢字の問題では出ないが、ジャンル名はそろえておく)
  なぞり書き: 'なぞりがき',
  形: 'かたち',
  違い探し: 'ちがいさがし',
  // タイピング
  画面: 'がめん',
  使う: 'つかう',
  文字: 'もじ',
  // メモ(計算だけだが、同じ画面の言葉なのでそろえる)
  開く: 'ひらく',
  閉じる: 'とじる',
  透かす: 'すかす',
  // ヘッダーのお知らせ
  お知らせ: 'おしらせ',
  更新情報: 'こうしんじょうほう',
  一覧: 'いちらん',
  戻る: 'もどる',
  // やめるときの確かめ
  途中: 'とちゅう',
  今: 'いま',
  飛ばされます: 'とばされます',
  続ける: 'つづける',
}

/** 長い言葉から当てる(思い出した を 思い出す より先に) */
const WORDS = Object.keys(KANA_OF).sort((a, b) => b.length - a.length)

/**
 * 文字列の中で、答えの字を含む言葉をひらがなにする。
 * 答えが無い・答えの字が入っていない文字列は、そのまま返す。
 */
export function concealText(text: string, answer: string | undefined): string {
  if (!answer || !text.includes(answer)) return text
  let result = text
  for (const word of WORDS) {
    if (word.includes(answer)) result = result.replaceAll(word, KANA_OF[word])
  }
  return result
}

/**
 * 言葉の集まり(data/copy.ts の Copy)を、まるごと concealText に通す。
 * 文字列を返す関数(進み具合など)は、返した文字列を通す。
 */
export function concealCopy<T>(value: T, answer: string | undefined): T {
  if (!answer) return value
  const cached = cache.get(value as object)?.get(answer)
  if (cached !== undefined) return cached as T
  const concealed = concealDeep(value, answer)
  if (!cache.has(value as object)) cache.set(value as object, new Map())
  cache.get(value as object)!.set(answer, concealed)
  return concealed
}

/** Copy(おとな・こどもの2つ)× 答え ごとに、作ったものを使い回す */
const cache = new WeakMap<object, Map<string, unknown>>()

function concealDeep<T>(value: T, answer: string): T {
  if (typeof value === 'string') return concealText(value, answer) as T
  if (typeof value === 'function') {
    return ((...args: unknown[]) => {
      const result = (value as (...a: unknown[]) => unknown)(...args)
      return typeof result === 'string' ? concealText(result, answer) : result
    }) as T
  }
  if (Array.isArray(value)) return value.map((item) => concealDeep(item, answer)) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, concealDeep(item, answer)])) as T
  }
  return value
}

// ----------------------------------------------------------- いまの答え

/**
 * 出題画面の中の部品へ、いまの答えを渡す。出題画面が自分の中身(ヘッダーもふくむ)を包む。
 * 描画と同じ回で答えが変わるので、問題が切りかわった瞬間に前の問題の字が出ることがない。
 */
export const ConcealAnswerContext = createContext<string | undefined>(undefined)

/** いま隠すべき答え。出題画面の外では undefined(何も隠さない) */
export function useConcealedAnswer(): string | undefined {
  return useContext(ConcealAnswerContext)
}
