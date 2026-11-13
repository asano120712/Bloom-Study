/**
 * 学習アプリに出してはいけない語の判定。漢字・英単語の両方の生成で使う。
 *
 * JMdict のタグでは弾けない。射精・精液は俗語でも古語でもなく
 * 医学用語として普通に登録されているため、vulg も sens も付かない。
 * 英語の語義に現れる語で見分けるのが、いまのところ唯一の機械的な方法。
 *
 * 判定は必ず「第一語義(その語の主要な意味)」だけに掛けること。
 * 全語義を見ると、二次的な意味を持つだけの普通の語まで落ちる
 * (関係 = sexual relations、国際 = diplomatic intercourse、営み = execution)。
 */
const TERMS = [
  // 性的なもの
  'sex', 'sexual', 'sexuality', 'ejacul\\w*', 'semen', 'sperm', 'genital\\w*',
  'penis', 'vagina', 'masturbat\\w*', 'orgasm', 'prostitut\\w*', 'erotic',
  'porn\\w*', 'obscene', 'anus', 'anal', 'testicl\\w*', 'menstrua\\w*',
  'pubic', 'nipple', 'intercourse', 'copulat\\w*', 'castrat\\w*',
  'brothel', 'adultery', 'lewd', 'lust', 'incest', 'rape', 'abortion',
  // 排泄
  'urin\\w*', 'excrem\\w*', 'feces', 'faeces', 'defecat\\w*',
  // 死・暴力
  'corpse', 'cadaver', 'murder', 'suicide', 'homicide', 'death', 'kill',
  'disembowel\\w*', 'torture', 'execution',
]

const PATTERN = new RegExp(`\\b(${TERMS.join('|')})\\b`, 'i')

/** その語義が学習アプリに出すのに向かないか */
export function isUnsuitable(primaryGloss: string): boolean {
  return PATTERN.test(primaryGloss)
}
