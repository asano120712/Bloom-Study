import type { ActivityId } from '@/data/activities'
import type { AnswerChoiceId } from '@/data/genres'
import type { AssembleLayout } from '@/features/assemble'
import type { AudienceMode, Difficulty, GenreId, JudgeVerdict, MathTopic, PromptForm } from '@/types'

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
  /**
   * 出題語の上に出す一言。何を思い出すのかはジャンルで変わる。
   *
   * **計算には置かない。** 式が出ていれば何をするかは分かるので、
   * 「この式を計算しよう」は読む手間が増えるだけになる
   * (筆算の途中では、ここに「1だんめ 3 × 5」のような手の名前が入る)。
   */
  genrePrompt: Partial<Record<GenreId, string>>
  /** こたえかた。クイズの入力方法と、小1・小2のあそび(なぞり・くみたて) */
  answerModes: Record<AnswerChoiceId, { label: string; note: string }>
  difficulties: Record<Difficulty, { label: string }>
  /**
   * 結果画面の判定の見出し。
   * 絵文字は使わず、言葉そのもので正誤が分かるようにする(色だけに頼らない)。
   */
  verdicts: Record<JudgeVerdict, string>
  top: { lead: string[]; start: string; record: string }
  genreSelect: { title: string; note: string; back: string }
  /**
   * あそびかた(一覧のカードから開く)。
   *
   * あそびごとに分けてあるのは、**中身がまったく違う**ため(なぞりがきは指の動かし方、
   * 計算は筆算の打ち方)。1つにまとめると、自分に関係のある段落を探すことになる。
   */
  howTo: {
    /** カードの「？」の読み上げ。あそびの名前が入る */
    open: (activity: string) => string
    title: string
    /** つぎの手順へ */
    next: string
    /** 1つ前の手順へ */
    back: string
    close: string
    steps: Record<ActivityId, string[]>
  }
  sheet: {
    start: string
    chooseDifficulty: string
    chooseMode: string
    /** 筆算か1行の式かを選ぶ見出し(計算だけ) */
    chooseForm: string
    forms: Record<PromptForm, { label: string; note: string }>
    /** 計算の種類を選ぶ見出し(計算だけ) */
    chooseTopic: string
    topics: Record<MathTopic, string>
    /** 種類で絞らず、その学年の問題をまぜて出す */
    mixedTopic: { label: string; note: string }
    /** 種類の下に添える式の例 */
    topicExample: (expression: string) => string
    /** 解く形から、計算の種類へ戻る */
    backToTopic: string
    /** 解く形から、こたえかたへ戻る */
    backToMode: string
    /** こたえかたを選ぶ画面に出す「いま選んでいるなんいど」 */
    levelIs: (level: string) => string
    backToDifficulty: string
    close: string
  }
  quiz: {
    /** 計算のメモ。見出しと、開くボタン(読み上げ)・閉じる・全部消す・下を透かすかの切り替え */
    memo: string
    memoOpen: string
    memoClose: string
    memoClear: string
    memoSeeThrough: string
    /** 右上の進み具合。「3 れんぞく / 5 問め」 */
    progress: (streak: number, index: number) => string
    /** 分からない問題を飛ばす。答えは見せるが記録には残さない */
    pass: string
    /** 読み上げ用。「パス」だけでは何をパスするのか分からない */
    passAria: string
    /** 書いた字が何に読めたか。読み取れなかったときに見せる */
    readAs: (text: string) => string
    /**
     * 読めた数は正解と同じだが、読み取りの自信が足りなかったとき。
     * 「同じなのになぜ聞くの」とならないよう、確かめてほしい理由を言う
     */
    readAsUnsure: (text: string) => string
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
  handwriting: {
    /** 道具(えんぴつ・消しゴム)の並びの読み上げ名 */
    tools: string
    /** 道具のボタンの字。絵の下に小さく添えるので、2〜3字に収める */
    pen: string
    eraser: string
    done: string
    boxLabel: (place: number) => string
  }
  typing: { placeholderTap: string; placeholderKey: string; inputLabel: string; submit: string }
  /** あそび(なぞりがき・おなじものさがし)で共通の言葉 */
  play: { allDone: string; again: string; other: string }
  /** 数で答えるとき */
  number: {
    inputLabel: string
    placeholder: string
    submit: string
    /** かけ算の段を打ち終えたとき */
    nextRow: string
    /** たし算・ひき算で、1つの位を打ち終えたとき */
    nextPlace: string
    /** わり算で、筆算のつぎの手へ進むとき */
    nextStep: string
    /** 間違えて、同じところを打ち直してもらうとき */
    retry: string
    /** 分数の答えが、値は合っているのに約分していないとき */
    reducible: string
    /** 分数の答えのマス。読み上げと、どこに打っているかの見出し */
    fractionParts: { whole: string; numerator: string; denominator: string }
    /** 小数のわり算で、小数点を動かした式に添える一言 */
    shiftPoint: (places: number) => string
    /** 手書きの答えのマスで、小数点を打つ場所(読み上げ) */
    decimalPoint: string
    /** 文章題の式と答えのマス。見出しと、空のマスに薄く出す名前 */
    wordParts: { expression: string; answer: string; operator: string; number: string }
  }
  trace: { guide: string; done: string }
  build: { look: string; answerIs: string }
  match: { question: string; correct: string; hint: string }
  result: {
    model: string
    /** おてほんの下に出す途中式の見出し(分数だけ) */
    work: string
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
    'trace-shape': { label: 'なぞり書き(形)', description: '丸や三角を指でなぞる' },
    'trace-hiragana': { label: 'なぞり書き(ひらがな)', description: 'ひらがなを書き順どおりになぞる' },
    'trace-kanji': { label: 'なぞり書き(漢字)', description: '小1・小2の漢字を書き順どおりになぞる' },
    'build-kanji': { label: '漢字の組み立て', description: 'お手本を覚えてから、部品で漢字を組む' },
    match: { label: '違い探し', description: '少しだけ形が違う4つから、お手本と同じものを選ぶ' },
  },
  genrePrompt: {
    english: 'この言葉を思い出そう',
    kanji: '◯ に入る漢字を思い出そう',
  },
  answerModes: {
    handwriting: { label: '手書き', note: '指でなぞって書く' },
    typing: { label: 'タイピング', note: 'キーボードで入力する' },
    assemble: { label: 'パーツを組む', note: 'パーツをスライドしてマスに組む' },
    trace: { label: 'なぞり書き', note: 'お手本を書き順どおりになぞる' },
    build: { label: '組み立て', note: 'お手本を覚えてから、部品で組む' },
    number: { label: '数字で答える', note: '数字キーボードで打つ' },
  },
  /*
   * 難易度の説明は、ジャンルによらない言い方にしてある。
   * 計算も入ったので、字数(「配当漢字402字」)のような漢字だけの話は書けない。
   */
  difficulties: {
    g12: { label: '小学1・2年' },
    g34: { label: '小学3・4年' },
    g56: { label: '小学5・6年' },
    junior: { label: '中学生' },
    senior: { label: '高校生' },
    working: { label: '社会人' },
  },
  verdicts: {
    correct: '正解',
    near: '惜しい! 正解扱い',
    incorrect: '残念',
    'self-correct': 'できた',
    'self-incorrect': '違った',
    passed: 'パスした',
  },
  top: {
    lead: [
      '答えはすぐに出しません。',
      'ヒントが1つずつ浮かび上がる間に、',
      '思い出す力を育てます。',
    ],
    start: '始める',
    record: 'これまでの記録を見る',
  },
  genreSelect: {
    title: 'ジャンルを選ぶ',
    note: 'ジャンルごとにヒントの出方が変わります。',
    back: 'トップに戻る',
  },
  howTo: {
    open: (activity) => `${activity}の遊び方`,
    title: '遊び方',
    next: '次へ',
    back: '戻る',
    close: '閉じる',
    steps: {
      english: [
        '日本語の出題語が出ます。英単語を思い出して答えます。',
        '答え方は、手書きとタイピングから選べます。',
        'ヒントは時間がたつと1つずつ増えます。待つほどやさしくなります。',
        '手書きは字を読み取りません。書けたら、自分で合っていたかを選びます。',
      ],
      kanji: [
        '熟語の ◯ に入る漢字を1字答えます。読みも一緒に出ます。',
        '小1・2は、なぞり書きと、パーツを組む遊びから選べます。',
        'パーツを組むときは、へんとつくりの枠へスライドして入れます。',
      ],
      math: [
        '2桁以上の計算は、筆算の形で出ます。',
        '筆算は段ごと・位ごとに打ちます。上の見出しが、いま打つところを教えます。',
        '間違えると赤い枠になります。正しく打ち直すと先へ進みます。',
        '記録に残るのは答えのところだけです。途中の段を打ち直しても「できた」のままです。',
      ],
      'trace-shape': [
        '光っている ● から、指でなぞります。',
        '線から外れても大丈夫です。離した場所から引き直せます。',
      ],
      'trace-hiragana': [
        '光っている ● から、書き順どおりに指でなぞります。',
        '1画なぞると、次の画の ● が光ります。',
      ],
      'trace-kanji': [
        '光っている ● から、書き順どおりに指でなぞります。',
        '小1・小2で習う漢字が出ます。',
      ],
      'build-kanji': [
        'はじめにお手本の漢字が出ます。覚えたら先へ進みます。',
        'パーツをスライドして、へんとつくりの枠に入れます。',
        '組み上がると、その漢字になって見えます。',
      ],
      match: [
        'お手本と同じ形を、4つの中から1つ選びます。',
        '色も向きも同じで、形だけが少し違います。よく見比べてください。',
      ],
    },
  },
  sheet: {
    start: '始める',
    chooseDifficulty: '難易度を選ぶ',
    chooseMode: '答え方を選ぶ',
    chooseForm: 'どの形で解く?',
    forms: {
      column: { label: '筆算で解く', note: '位をそろえて、段ごとに打つ' },
      plain: { label: '1行の式で解く', note: '式を見て、答えだけ打つ' },
    },
    levelIs: (level) => `難易度：${level}`,
    chooseTopic: 'どの計算をする?',
    topics: {
      add: 'たし算',
      sub: 'ひき算',
      mul: 'かけ算',
      div: 'わり算',
      fracAdd: '分数のたし算・ひき算',
      fracMul: '分数のかけ算・わり算',
      decimal: '小数のかけ算・わり算',
      ratio: '割合(文章題)',
      speed: '速さ(文章題)',
    },
    mixedTopic: { label: 'ランダム', note: '全部の種類を混ぜて出す' },
    topicExample: (expression) => `例 ${expression}`,
    backToTopic: '計算の種類に戻る',
    backToMode: '答え方に戻る',
    backToDifficulty: '難易度に戻る',
    close: '戻る',
  },
  quiz: {
    memo: 'メモ',
    memoOpen: '計算のメモを開く',
    memoClose: '閉じる',
    memoClear: '全部消す',
    memoSeeThrough: '下を透かす',
    progress: (streak, index) => `${streak} 連続 / ${index} 問目`,
    pass: 'パス',
    passAria: 'この問題をパスする',
    readAs: (text) => `書いた字は「${text}」に見えました`,
    readAsUnsure: (text) => `「${text}」に見えましたが、自信がありません。合っていたら「できた」を押してください`,
    answerLabel: '答え',
    wrong: '違った',
    right: 'できた',
  },
  hints: {
    waiting: 'まもなくヒントが出ます',
    next: (seconds) => `次のヒントまで ${seconds} 秒`,
    done: 'ヒントはここまで',
  },
  parts: {
    recall: ['頭の中で書いてみよう。', '思い出せたら部品を組み立てます。'],
    recalled: '思い出した',
    heading: {
      horizontal: 'へん(左)とつくり(右)を組もう',
      vertical: '上と下を組もう',
    },
    slot: {
      horizontal: { first: 'へん', second: 'つくり' },
      vertical: { first: '上', second: '下' },
    },
    submit: '答え合わせ',
  },
  handwriting: {
    tools: '書く道具',
    pen: '書く',
    eraser: '消す',
    done: '書けた',
    boxLabel: (place) => `答えの ${place} マス目`,
  },
  typing: {
    placeholderTap: '答えをタップして入力',
    placeholderKey: 'キーボードで入力',
    inputLabel: '入力中の答え',
    submit: '答え合わせ',
  },
  play: { allDone: '全部できた!', again: 'もう一度', other: '他の遊び' },
  number: {
    inputLabel: '入力中の答え',
    placeholder: '数字で答えよう',
    submit: '答え合わせ',
    nextRow: '次の段へ',
    nextPlace: '次の位へ',
    nextStep: '次へ',
    retry: 'もう一度打ってみよう',
    reducible: '合っています! 約分できるので、約分してから答えよう',
    fractionParts: { whole: '整数', numerator: '分子', denominator: '分母' },
    shiftPoint: (places) => `小数点を ${places}桁右に移して割る`,
    decimalPoint: 'ここに小数点を打つ',
    wordParts: { expression: '式', answer: '答え', operator: '記号を選ぶ(× か ÷)', number: '数' },
  },
  trace: { guide: '光っている ● から指でなぞってね', done: 'できた!' },
  build: { look: 'この漢字をよく見て、覚えよう', answerIs: '答えはこれ' },
  match: {
    question: 'よく見て。どれと同じ?',
    correct: '当たり!',
    hint: '光っているのが答えだよ',
  },
  result: {
    model: 'お手本',
    work: '途中の式',
    listen: '読み方を聞く',
    mine: {
      text: '自分が打った答え',
      parts: '自分が組んだパーツ',
      handwriting: '自分が書いた答え',
    },
    streak: (streak) => `${streak} 問連続正解中`,
    next: '次の問題へ',
    chooseGenre: 'ジャンルを選ぶ',
    record: '記録を見る',
    enterHint: 'Enter でも進めます',
  },
  myPage: {
    title: 'これまでの記録',
    loading: '記録を読み込み中',
    correct: '正解数',
    currentStreak: '今の連続',
    bestStreak: '最高連続',
    trialLeft: (left) => `無料で解ける残り: ${left} 問`,
    history: '解答履歴',
    empty: 'まだ記録がありません。',
    hintsUsed: (count) => `ヒント${count}`,
    solve: '問題を解く',
    reset: '記録をリセットする(開発用)',
  },
  exit: {
    label: '← やめる',
    title: '途中でやめる?',
    note: '今の問題は飛ばされます。',
    stay: '続ける',
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
    g12: { label: '1・2ねんせい' },
    g34: { label: '3・4ねんせい' },
    g56: { label: '5・6ねんせい' },
    junior: { label: 'ちゅうがくせい' },
    senior: { label: 'こうこうせい' },
    working: { label: 'おとな' },
  },
  verdicts: {
    correct: 'せいかい！',
    near: 'おしい！ せいかいに するね',
    incorrect: 'ざんねん',
    'self-correct': 'できた！',
    'self-incorrect': 'ちがった',
    passed: 'パスしたよ',
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
  howTo: {
    open: (activity) => `${activity}の あそびかた`,
    title: 'あそびかた',
    next: 'つぎへ',
    back: 'もどる',
    close: 'とじる',
    steps: {
      english: [
        'にほんごを みて、えいごを おもいだそう。',
        'まっていると ヒントが でてくるよ。',
      ],
      kanji: ['◯ に はいる かんじを かこう。', 'まっていると ヒントが でてくるよ。'],
      math: [
        'ふたけた いじょうの けいさんは ひっさんで でるよ。',
        'うえの もじが、いま うつ ところを おしえてくれるよ。',
      ],
      'trace-shape': [
        'ひかっている ● から、ゆびで なぞってね。',
        'せんから はみだしても だいじょうぶ。',
      ],
      'trace-hiragana': [
        'ひかっている ● から、ゆびで なぞってね。',
        'いっかく なぞると、つぎの ● が ひかるよ。',
      ],
      'trace-kanji': ['ひかっている ● から、ゆびで なぞってね。'],
      'build-kanji': [
        'さいしょに おてほんを よく みてね。',
        'ぶひんを うごかして、ますに いれよう。',
      ],
      match: [
        'おてほんと おなじ かたちを、4つから えらぼう。',
        'いろも むきも おなじ。かたちだけ すこし ちがうよ。',
      ],
    },
  },
  sheet: {
    start: 'はじめる',
    chooseDifficulty: 'むずかしさを えらぼう',
    chooseMode: 'どうやって こたえる？',
    chooseForm: 'どの かたちで とく？',
    forms: {
      column: { label: 'ひっさんで とく', note: 'くらいを そろえて、だんごとに' },
      plain: { label: '1ぎょうの しきで とく', note: 'しきを みて、こたえだけ' },
    },
    levelIs: (level) => `むずかしさ：${level}`,
    chooseTopic: 'どの けいさんを する？',
    topics: {
      add: 'たしざん',
      sub: 'ひきざん',
      mul: 'かけざん',
      div: 'わりざん',
      fracAdd: 'ぶんすうの たしざん・ひきざん',
      fracMul: 'ぶんすうの かけざん・わりざん',
      decimal: 'しょうすうの かけざん・わりざん',
      ratio: 'わりあい(ぶんしょうだい)',
      speed: 'はやさ(ぶんしょうだい)',
    },
    mixedTopic: { label: 'おまかせ', note: 'いろいろな けいさんが でるよ' },
    topicExample: (expression) => `れい ${expression}`,
    backToTopic: 'けいさんの しゅるいに もどる',
    backToMode: 'こたえかたに もどる',
    backToDifficulty: 'むずかしさに もどる',
    close: 'もどる',
  },
  quiz: {
    memo: 'メモ',
    memoOpen: 'けいさんの メモを ひらく',
    memoClose: 'とじる',
    memoClear: 'ぜんぶ けす',
    memoSeeThrough: 'したを すかす',
    progress: (streak, index) => `${streak} れんぞく / ${index} もんめ`,
    pass: 'パス',
    passAria: 'この もんだいを パスする',
    readAs: (text) => `かいた じは「${text}」に みえたよ`,
    readAsUnsure: (text) => `「${text}」に みえたけど、すこし じしんが ないよ。あってたら「できた」を おしてね`,
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
  handwriting: {
    tools: 'どうぐ',
    pen: 'かく',
    eraser: 'けす',
    done: 'かけた',
    boxLabel: (place) => `こたえの ${place} マスめ`,
  },
  typing: {
    placeholderTap: 'こたえを タップして うとう',
    placeholderKey: 'キーボードで うとう',
    inputLabel: '入力中のこたえ',
    submit: 'こたえあわせ',
  },
  play: { allDone: 'ぜんぶ できた！', again: 'もういちど', other: 'ほかの あそび' },
  number: {
    inputLabel: 'いま うっている こたえ',
    placeholder: 'すうじで こたえよう',
    submit: 'こたえあわせ',
    nextRow: 'つぎの だんへ',
    nextPlace: 'つぎの くらいへ',
    nextStep: 'つぎへ',
    retry: 'もういちど うってみよう',
    reducible: 'あってるよ! やくぶん できるから、やくぶんして こたえよう',
    fractionParts: { whole: 'せいすう', numerator: 'ぶんし', denominator: 'ぶんぼ' },
    shiftPoint: (places) => `しょうすうてんを ${places}けた みぎに うつして わる`,
    decimalPoint: 'ここに しょうすうてんを うつ',
    wordParts: { expression: 'しき', answer: 'こたえ', operator: 'きごうを えらぶ(× か ÷)', number: 'かず' },
  },
  trace: { guide: 'ひかってる ● から ゆびで なぞってね', done: 'できた！' },
  build: { look: 'この かんじを よく みてね', answerIs: 'こたえは これ' },
  match: {
    question: 'よく みてね。どれと おなじ？',
    correct: 'あたり！',
    hint: 'ひかってるのが こたえだよ',
  },
  result: {
    model: 'おてほん',
    work: 'とちゅうの しき',
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
