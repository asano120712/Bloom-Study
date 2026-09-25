import type { ActivityId } from '@/data/activities'
import type { AssembleLayout } from '@/features/assemble'
import type {
  AudienceMode,
  Difficulty,
  GenreId,
  InputMode,
  JudgeVerdict,
} from '@/types'

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
  inputModes: Record<InputMode, { label: string; note: string }>
  difficulties: Record<Difficulty, { label: string; note: string }>
  /** 結果画面の判定の見出し。色だけに頼らずアイコン+文でも分かるようにする */
  verdicts: Record<JudgeVerdict, string>
  top: { lead: string[]; start: string; record: string }
  genreSelect: { title: string; note: string; back: string }
  sheet: {
    start: string
    chooseMode: string
    chooseDifficulty: string
    modeIs: (mode: string) => string
    backToMode: string
    close: string
  }
  quiz: {
    /** 右上の進み具合。「🌱 3 れんぞく / 5 問め」 */
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
  trace: { guide: string; done: string }
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
    'trace-shape': { label: 'なぞりがき(かたち)', description: 'まるやさんかくを指でなぞる' },
    'trace-hiragana': { label: 'なぞりがき(ひらがな)', description: 'ひらがなを書き順どおりになぞる' },
    match: { label: 'ちがい さがし', description: 'すこしだけ形が違う4つから、お手本と同じものを選ぶ' },
  },
  genrePrompt: {
    english: 'この言葉を思い出そう',
    kanji: '◯ に入る漢字を思い出そう',
  },
  inputModes: {
    typing: { label: 'タイピング', note: 'キーボードで入力する' },
    handwriting: { label: '手書き', note: '指でなぞって書く' },
    assemble: { label: 'パーツを組む', note: 'パーツをスライドしてマスに組む' },
  },
  difficulties: {
    easy: { label: 'やさしい', note: '小学生むけ' },
    normal: { label: 'ふつう', note: '中学生むけ' },
    hard: { label: 'むずかしい', note: '高校・社会人むけ' },
  },
  verdicts: {
    correct: '⭕️ せいかい',
    near: '⭕️ おしい! せいかいあつかい',
    incorrect: '✖️ ざんねん',
    'self-correct': '⭕️ できた',
    'self-incorrect': '✖️ ちがった',
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
    chooseMode: 'こたえかたをえらぶ',
    chooseDifficulty: 'なんいどをえらぶ',
    modeIs: (mode) => `こたえかた：${mode}`,
    backToMode: 'こたえかたにもどる',
    close: 'もどる',
  },
  quiz: {
    progress: (streak, index) => `🌱 ${streak} れんぞく / ${index} 問め`,
    answerLabel: 'こたえ',
    wrong: '✖️ ちがった',
    right: '⭕️ できた',
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
  trace: { guide: '光っている ● から指でなぞってね', done: 'できた!' },
  match: {
    question: 'よく見て。どれと おなじ?',
    correct: 'あたり!',
    hint: 'ひかっているのが こたえだよ',
  },
  result: {
    model: 'おてほん',
    listen: '🔊 読み方を聞く',
    mine: {
      text: 'じぶんが うった こたえ',
      parts: 'じぶんが 組んだ パーツ',
      handwriting: 'じぶんが かいた こたえ',
    },
    streak: (streak) => `🌱 ${streak} 問れんぞく正解中`,
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
    'trace-shape': { label: 'かたちを なぞろう', description: 'まる・さんかく・しかくを ゆびで なぞる' },
    'trace-hiragana': { label: 'ひらがなを なぞろう', description: 'ゆびで なぞって じを おぼえる' },
    match: { label: 'ちがい さがし', description: 'よく みて、おなじ かたちを さがそう' },
  },
  genrePrompt: {
    english: 'この ことばを おもいだそう',
    kanji: '◯ に はいる かんじは なにかな？',
  },
  inputModes: {
    typing: { label: 'キーボード', note: 'もじを うって こたえる' },
    handwriting: { label: 'てがき', note: 'ゆびで かいて こたえる' },
    assemble: { label: 'ぶひんを くむ', note: 'ぶひんを うごかして マスに いれる' },
  },
  difficulties: {
    easy: { label: 'やさしい', note: 'しょうがくせい むけ' },
    normal: { label: 'ふつう', note: 'ちゅうがくせい むけ' },
    hard: { label: 'むずかしい', note: 'こうこうせい いじょう' },
  },
  verdicts: {
    correct: '⭕️ せいかい！',
    near: '⭕️ おしい！ せいかいに するね',
    incorrect: '✖️ ざんねん',
    'self-correct': '⭕️ できた！',
    'self-incorrect': '✖️ ちがった',
  },
  top: {
    lead: ['こたえは すぐに でません。', 'ヒントが ひとつずつ ひらくあいだに', 'おもいだして みよう。'],
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
    chooseMode: 'どうやって こたえる？',
    chooseDifficulty: 'むずかしさを えらぼう',
    modeIs: (mode) => `こたえかた：${mode}`,
    backToMode: 'こたえかたに もどる',
    close: 'もどる',
  },
  quiz: {
    progress: (streak, index) => `🌱 ${streak} れんぞく / ${index} もんめ`,
    answerLabel: 'こたえ',
    wrong: '✖️ ちがった',
    right: '⭕️ できた',
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
  trace: { guide: 'ひかってる ● から ゆびで なぞってね', done: 'できた！' },
  match: {
    question: 'よく みてね。どれと おなじ？',
    correct: 'あたり！',
    hint: 'ひかってるのが こたえだよ',
  },
  result: {
    model: 'おてほん',
    listen: '🔊 よみかたを きく',
    mine: {
      text: 'じぶんが うった こたえ',
      parts: 'じぶんが くんだ ぶひん',
      handwriting: 'じぶんが かいた こたえ',
    },
    streak: (streak) => `🌱 ${streak} もん つづけて せいかい`,
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
