/** vite.config.ts の dataCounts が、ビルドのときに数えて渡す */
declare module 'virtual:data-counts' {
  const counts: {
    kanjiQuestions: number
    englishWords: number
    mathQuestions: number
    /** なぞりがきのお手本がある字(漢字 + ひらがな) */
    traceCharacters: number
    kanjiPuzzles: number
    /** 手書きの漢字を形で判定できる字(KanjiVG のお手本がある字) */
    kanjiShapes: number
  }
  export default counts
}
