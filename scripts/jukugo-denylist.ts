/**
 * ヒントに出してはいけない熟語。
 *
 * 語義による自動判定(scripts/build-kanji-questions.ts の UNSUITABLE_GLOSS)で
 * 大半は落ちるが、英語の語義に手がかりが出ない語は機械的に弾けない。
 * 見つけたらここに足すこと。生成JSONを直接消しても次回生成で戻る。
 */
export const JUKUGO_DENYLIST = new Set<string>([
  // ここに追記する
])
