import counts from 'virtual:data-counts'

/**
 * このアプリについて の画面の中身(数字と技術の説明)。
 * 読むのは保護者や詳しい人なので、おとな・こどもで言葉は分けない。
 */

/** 込めた想い。作った理由と、こだわったところ(作った人の言葉をもとに整えたもの) */
export const DEVELOPER = {
  title: '込めた想い',
  reason: {
    title: '作った理由',
    intro:
      '今は、調べればすぐに答えが見つかり、紙とペンを使う機会も減っています。自分で思い出したり、手を動かしたりする時間が少なくなり、覚えたことが身につきにくい時代になっていると考えました。',
    valuesLead: 'そこで、次の3つを大切にした学習アプリを作りました。',
    values: [
      '答えをすぐに見せず、「思い出す」「考える」時間をつくる',
      '少なくなった「書く」機会をつくる',
      'これからのデジタル社会に向けて、キーボードの練習にもなる',
    ],
    closing:
      '学ぶ時間をなかなか取れない人や、これまでのアプリではなかなか覚えられなかった人にも、ゲームのように楽しみながら学べる、新しい感覚の学びを体験してもらえたらうれしいです。',
  },
  origin: '学校の文化祭に出展するために作りました。今後、正式なリリースも考えています。',
  points: {
    title: 'こだわったところ',
    items: [
      {
        title: 'コンセプトをぶらさない',
        body: '「思い出す力を育てる」から外れないよう、方向性を決めてから機能を足していきました。',
      },
      {
        title: 'どの端末でも使いやすく',
        body: 'スマートフォン・iPad・パソコンのどれでも、指でもマウスでも操作しやすいようにしました。',
      },
      {
        title: '判定は厳しすぎないように',
        body: '手書きの字が少し崩れていても、正解にできるようにしました。',
      },
    ],
  },
}

/** 数字で見る。数はビルドのときにデータから数える(vite.config.ts の dataCounts) */
export const NUMBERS: { label: string; value: number; unit: string }[] = [
  { label: '漢字の問題', value: counts.kanjiQuestions, unit: '問' },
  { label: '英単語', value: counts.englishWords, unit: '語' },
  { label: '計算の問題', value: counts.mathQuestions, unit: '問' },
  { label: '漢字のパズル', value: counts.kanjiPuzzles, unit: '字' },
  { label: 'なぞりがきできる字', value: counts.traceCharacters, unit: '字' },
  { label: 'お手本の線を持つ漢字', value: counts.kanjiShapes, unit: '字' },
]

/** 使っている技術。仕組みを一言ずつ */
/** icon は AboutPage の TechIcon で描く */
export const TECH: { icon: 'pen' | 'kanji' | 'auto' | 'lock'; title: string; body: string }[] = [
  {
    icon: 'pen',
    title: '手書きの英字・数字を読み取る',
    body: '端末の中で動く小さな AI(ニューラルネットワーク)で、1字ずつ読み取ります。手書きの字の見本(MNIST・EMNIST)で学習させました。書いた字は外へ送りません。',
  },
  {
    icon: 'kanji',
    title: '手書きの漢字を形で確かめる',
    body: '書いた線を、お手本の線(KanjiVG)と比べて、答えの漢字の形になっているかを確かめます。形の似た漢字よりはっきり近いときだけ「正解」にします。',
  },
  {
    icon: 'auto',
    title: '問題とヒントを自動で作る',
    body: '漢字や英語の辞書のデータから、熟語・読み・意味を集めて、問題とヒントを自動で作っています。漢字のパズルは、お手本の線を部品ごとに分けて作りました。',
  },
  {
    icon: 'lock',
    title: 'アプリの作り',
    body: '記録や情報を預かると、それを守る責任が生まれます。安心して使ってもらえるよう、なるべくデータを持たない作りにしました。記録や書いた字はサーバーに送らず、使っている端末の中だけに保存します。会員登録やログインもありません。React と TypeScript で作り、Vercel で公開しています。',
  },
]
