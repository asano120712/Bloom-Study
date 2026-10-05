import type { ActivityId } from '@/data/activities'
import type { AnswerChoiceId } from '@/data/genres'
import type { AssembleLayout } from '@/features/assemble'
import type { AudienceMode, Difficulty, GenreId, JudgeVerdict } from '@/types'

/**
 * 画面に出す言葉を、モード(おとな / こども)ごとにここへ集める。
 *
 * こども向けは漢字を減らし、文を短く、話しかける調子にする。
 * 画面側に文字列を置かないのは、言い回しを直すときに全画面を触らせないため。
 * ジャンルの「構造」(こたえかた・ガイド・読み上げ)は data/genres.ts、
 * 「言葉」はこちらに置く。
 */
export interface Copy {
  /** 一覧に並べるもの(クイズのジャンル・あそび)の名前と説明 */
  activities: Record<ActivityId, { label: string; description: string }>
  /** 出題語の上に出す一言。何を思い出すのかはジャンルで変わる */
  genrePrompt: Record<GenreId, string>
  /** こたえかた。クイズの入力方法と、小1・小2のあそび(なぞり・くみたて) */
  answerModes: Record<AnswerChoiceId, { label: string; note: string }>
  difficulties: Record<Difficulty, { label: string; note: string }>
  /**
   * 結果画面の判定の見出し。
   * 絵文字は使わず、言葉そのもので正誤が分かるようにする(色だけに頼らない)。
   */
  verdicts: Record<JudgeVerdict, string>
  top: { lead: string[]; start: string; record: string }
  genreSelect: { title: string; note: string; back: string }
  sheet: {
    start: string
    chooseDifficulty: string
    chooseMode: string
    /** こたえかたを選ぶ画面に出す「いま選んでいるなんいど」 */
    levelIs: (level: string) => string
    backToDifficulty: string
    close: string
  }
  quiz: {
    /** 右上の進み具合。「3 れんぞく / 5 問め」 */
    progress: (streak: number, index: number) => string
    answerLabel: string
    wrong: string
    right: string
  }
  hints: { waiting: string; next: (seconds: number) => string; done: string }
  parts: {
    recall: string[]
    recalled: string
    heading: Record<AssembleLayout, string>
    slot: Record<AssembleLayout, { first: string; second: string }>
    submit: string
  }
  handwriting: { clear: string; done: string }
  typing: { placeholderTap: string; placeholderKey: string }
  /** あそび(なぞりがき・おなじものさがし)で共通の言葉 */
  play: { allDone: string; again: string; other: string }
  /** 数で答えるとき */
  number: { inputLabel: string; placeholder: string; submit: string }
  trace: { guide: string; done: string }
  build: { look: string; answerIs: string }
  match: { question: string; correct: string; hint: string }
  result: {
    model: string
    listen: string
    mine: { text: string; parts: string; handwriting: string }
    streak: (streak: number) => string
    next: string
    chooseGenre: string
    record: string
    enterHint: string
  }
  myPage: {
    title: string
    loading: string
    correct: string
    currentStreak: string
    bestStreak: string
    trialLeft: (left: number) => string
    history: string
    empty: string
    hintsUsed: (count: number) => string
    solve: string
    reset: string
  }
  exit: { label: string; title: string; note: string; stay: string; leave: string }
}

const ADULT: Copy = {
  activities: {
    english: { label: '英単語', description: '日本語の出題語を見て、英単語を思い出す' },
    kanji: { label: '漢字', description: '熟語の ◯ に入る漢字を書いて思い出す' },
    math: { label: '計算', description: 'かけ算・わり算を、ヒントを見ながら解く' },
    'trace-shape': { label: 'なぞりがき(かたち)', description: 'まるやさんかくを指でなぞる' },
    'trace-hiragana': { label: 'なぞりがき(ひらがな)', description: 'ひらがなを書き順どおりになぞる' },
    'trace-kanji': { label: 'なぞりがき(漢字)', description: '小1・小2の漢字を書き順どおりになぞる' },
    'build-kanji': { label: 'かんじの くみたて', description: 'お手本を覚えてから、部品で漢字を組む' },
    match: { label: 'ちがい さがし', description: 'すこしだけ形が違う4つから、お手本と同じものを選ぶ' },
  },
  genrePrompt: {
    english: 'この言葉を思い出そう',
    kanji: '◯ に入る漢字を思い出そう',
    math: 'この式を計算しよう',
  },
  answerModes: {
    handwriting: { label: '手書き', note: '指でなぞって書く' },
    typing: { label: 'タイピング', note: 'キーボードで入力する' },
    assemble: { label: 'パーツを組む', note: 'パーツをスライドしてマスに組む' },
    trace: { label: 'なぞりがき', note: 'お手本を書き順どおりになぞる' },
    build: { label: 'くみたて', note: 'お手本を覚えてから、部品で組む' },
    number: { label: '数字で答える', note: '数字キーボードで打つ' },
  },
  difficulties: {
    g12: { label: '小学1・2年', note: '配当漢字240字。なぞる・組み立てる' },
    g34: { label: '小学3・4年', note: '配当漢字402字' },
    g56: { label: '小学5・6年', note: '配当漢字384字' },
    junior: { label: '中学生', note: '常用漢字のうち、よく見るもの' },
    senior: { label: '高校生', note: '常用漢字のうち、中くらいの頻度' },
    working: { label: '社会人', note: '常用漢字のうち、あまり見ないもの' },
  },
  verdicts: {
    correct: 'せいかい',
    near: 'おしい! せいかいあつかい',
    incorrect: 'ざんねん',
    'self-correct': 'できた',
    'self-incorrect': 'ちがった',
  },
  top: {
    lead: [
      '答えはすぐに出しません。',
      'ヒントがひとつずつ浮かびあがるあいだに、',
      '思い出す力を育てます。',
    ],
    start: 'はじめる',
    record: 'これまでの記録を見る',
  },
  genreSelect: {
    title: 'ジャンルをえらぶ',
    note: 'ジャンルごとにヒントの出かたが変わります。',
    back: 'トップにもどる',
  },
  sheet: {
    start: 'はじめる',
    chooseDifficulty: 'なんいどをえらぶ',
    chooseMode: 'こたえかたをえらぶ',
    levelIs: (level) => `なんいど：${level}`,
    backToDifficulty: 'なんいどにもどる',
    close: 'もどる',
  },
  quiz: {
    progress: (streak, index) => `${streak} れんぞく / ${index} 問め`,
    answerLabel: 'こたえ',
    wrong: 'ちがった',
    right: 'できた',
  },
  hints: {
    waiting: 'まもなくヒントが出ます',
    next: (seconds) => `つぎのヒントまで ${seconds} 秒`,
    done: 'ヒントはここまで',
  },
  parts: {
    recall: ['あたまの中で書いてみよう。', '思い出せたら部品を組み立てます。'],
    recalled: '思い出した',
    heading: {
      horizontal: 'へん(左)と つくり(右)を 組もう',
      vertical: 'うえと したを 組もう',
    },
    slot: {
      horizontal: { first: 'へん', second: 'つくり' },
      vertical: { first: 'うえ', second: 'した' },
    },
    submit: 'こたえあわせ',
  },
  handwriting: { clear: 'けす', done: 'かけた' },
  typing: { placeholderTap: 'こたえをタップして入力', placeholderKey: 'キーボードで入力' },
  play: { allDone: 'ぜんぶ できた!', again: 'もういちど', other: 'ほかのあそび' },
  number: { inputLabel: '入力中のこたえ', placeholder: '数字で答えよう', submit: 'こたえあわせ' },
  trace: { guide: '光っている ● から指でなぞってね', done: 'できた!' },
  build: { look: 'この漢字をよく見て、覚えよう', answerIs: 'こたえは これ' },
  match: {
    question: 'よく見て。どれと おなじ?',
    correct: 'あたり!',
    hint: 'ひかっているのが こたえだよ',
  },
  result: {
    model: 'おてほん',
    listen: '読み方を聞く',
    mine: {
      text: 'じぶんが うった こたえ',
      parts: 'じぶんが 組んだ パーツ',
      handwriting: 'じぶんが かいた こたえ',
    },
    streak: (streak) => `${streak} 問れんぞく正解中`,
    next: 'つぎの問題へ',
    chooseGenre: 'ジャンルをえらぶ',
    record: '記録を見る',
    enterHint: 'Enter でも進めます',
  },
  myPage: {
    title: 'これまでの記録',
    loading: '記録をよみこみ中',
    correct: '正解数',
    currentStreak: 'いま連続',
    bestStreak: '最高連続',
    trialLeft: (left) => `無料でとける残り: ${left} 問`,
    history: '解答履歴',
    empty: 'まだ記録がありません。',
    hintsUsed: (count) => `ヒント${count}`,
    solve: '問題をとく',
    reset: '記録をリセットする(開発用)',
  },
  exit: {
    label: '← やめる',
    title: 'とちゅうで やめる?',
    note: 'いまの問題は とばされます。',
    stay: 'つづける',
    leave: 'やめる',
  },
}

const KIDS: Copy = {
  activities: {
    english: { label: 'えいご', description: 'にほんごを みて、えいごを おもいだそう' },
    kanji: { label: 'かんじ', description: '◯ に はいる かんじを かこう' },
    math: { label: 'けいさん', description: 'ヒントを みながら かけざん・わりざん' },
    'trace-shape': { label: 'かたちを なぞろう', description: 'まる・さんかく・しかくを ゆびで なぞる' },
    'trace-hiragana': { label: 'ひらがなを なぞろう', description: 'ゆびで なぞって じを おぼえる' },
    'trace-kanji': { label: 'かんじを なぞろう', description: 'ゆびで なぞって かんじを おぼえる' },
    'build-kanji': { label: 'かんじを くみたてよう', description: 'おぼえてから ぶひんで くみたてる' },
    match: { label: 'ちがい さがし', description: 'よく みて、おなじ かたちを さがそう' },
  },
  genrePrompt: {
    english: 'この ことばを おもいだそう',
    kanji: '◯ に はいる かんじは なにかな？',
    math: 'この しきを けいさんしよう',
  },
  answerModes: {
    handwriting: { label: 'てがき', note: 'ゆびで かいて こたえる' },
    typing: { label: 'キーボード', note: 'もじを うって こたえる' },
    assemble: { label: 'ぶひんを くむ', note: 'ぶひんを うごかして マスに いれる' },
    trace: { label: 'なぞる', note: 'おてほんを ゆびで なぞる' },
    build: { label: 'くみたてる', note: 'おぼえてから ぶひんで くみたてる' },
    number: { label: 'すうじで こたえる', note: 'すうじの キーボードで うつ' },
  },
  difficulties: {
    g12: { label: '1・2ねんせい', note: 'なぞったり、くみたてたり' },
    g34: { label: '3・4ねんせい', note: 'しょうがく3・4年の かんじ' },
    g56: { label: '5・6ねんせい', note: 'しょうがく5・6年の かんじ' },
    junior: { label: 'ちゅうがくせい', note: 'よく みる かんじ' },
    senior: { label: 'こうこうせい', note: 'ちょっと むずかしい かんじ' },
    working: { label: 'おとな', note: 'あまり みない かんじ' },
  },
  verdicts: {
    correct: 'せいかい！',
    near: 'おしい！ せいかいに するね',
    incorrect: 'ざんねん',
    'self-correct': 'できた！',
    'self-incorrect': 'ちがった',
  },
  top: {
    lead: ['したのボタンで すすめるよ', 'きになったのを やってみよう！'],
    start: 'はじめる',
    record: 'これまでの きろく',
  },
  genreSelect: {
    title: 'なにを べんきょう する？',
    note: 'えらぶと ヒントの でかたが かわるよ。',
    back: 'さいしょに もどる',
  },
  sheet: {
    start: 'はじめる',
    chooseDifficulty: 'むずかしさを えらぼう',
    chooseMode: 'どうやって こたえる？',
    levelIs: (level) => `むずかしさ：${level}`,
    backToDifficulty: 'むずかしさに もどる',
    close: 'もどる',
  },
  quiz: {
    progress: (streak, index) => `${streak} れんぞく / ${index} もんめ`,
    answerLabel: 'こたえ',
    wrong: 'ちがった',
    right: 'できた',
  },
  hints: {
    waiting: 'もうすぐ ヒントが でるよ',
    next: (seconds) => `つぎの ヒントまで ${seconds} びょう`,
    done: 'ヒントは ここまで',
  },
  parts: {
    recall: ['あたまの なかで かいてみよう。', 'おもいだせたら ぶひんを くみたてよう。'],
    recalled: 'おもいだした',
    heading: {
      horizontal: 'ひだりと みぎを くみあわせよう',
      vertical: 'うえと したを くみあわせよう',
    },
    slot: {
      horizontal: { first: 'ひだり', second: 'みぎ' },
      vertical: { first: 'うえ', second: 'した' },
    },
    submit: 'こたえあわせ',
  },
  handwriting: { clear: 'けす', done: 'かけた' },
  typing: { placeholderTap: 'こたえを タップして うとう', placeholderKey: 'キーボードで うとう' },
  play: { allDone: 'ぜんぶ できた！', again: 'もういちど', other: 'ほかの あそび' },
  number: { inputLabel: 'いま うっている こたえ', placeholder: 'すうじで こたえよう', submit: 'こたえあわせ' },
  trace: { guide: 'ひかってる ● から ゆびで なぞってね', done: 'できた！' },
  build: { look: 'この かんじを よく みてね', answerIs: 'こたえは これ' },
  match: {
    question: 'よく みてね。どれと おなじ？',
    correct: 'あたり！',
    hint: 'ひかってるのが こたえだよ',
  },
  result: {
    model: 'おてほん',
    listen: 'よみかたを きく',
    mine: {
      text: 'じぶんが うった こたえ',
      parts: 'じぶんが くんだ ぶひん',
      handwriting: 'じぶんが かいた こたえ',
    },
    streak: (streak) => `${streak} もん つづけて せいかい`,
    next: 'つぎの もんだい',
    chooseGenre: 'べんきょうを えらぶ',
    record: 'きろくを みる',
    enterHint: 'Enter でも すすめるよ',
  },
  myPage: {
    title: 'これまでの きろく',
    loading: 'きろくを よみこみちゅう',
    correct: 'せいかいの かず',
    currentStreak: 'いま れんぞく',
    bestStreak: 'さいこう れんぞく',
    trialLeft: (left) => `むりょうで とける のこり: ${left} もん`,
    history: 'といた もんだい',
    empty: 'まだ きろくが ないよ。',
    hintsUsed: (count) => `ヒント${count}`,
    solve: 'もんだいを とく',
    reset: 'きろくを けす(かいはつよう)',
  },
  exit: {
    label: '← やめる',
    title: 'とちゅうで やめる?',
    note: 'いまの もんだいは とばされるよ。',
    stay: 'つづける',
    leave: 'やめる',
  },
}

const COPY: Record<AudienceMode, Copy> = { adult: ADULT, kids: KIDS }

export function copyOf(mode: AudienceMode): Copy {
  return COPY[mode]
}
