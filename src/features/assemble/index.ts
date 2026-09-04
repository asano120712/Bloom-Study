import type { Question } from '@/types'

/**
 * 組み立ての向き。
 * horizontal = へん(左) + つくり(右)、vertical = うえ + した。
 */
export type AssembleLayout = 'horizontal' | 'vertical'

/**
 * 左右(⿰)に割れる字と、その**左側**の部品。
 *
 * KRADFILE は部品を持つが「どこに置くか」は持たない(化 と 貝 が 貨 のように
 * 上下に並ぶのか、亻 と 立 が 位 のように左右に並ぶのかは分からない)。
 * そのため、割れる向きと先にくる部品だけをここで手で持つ。
 * もう一方は残りの部品なので表には持たない。
 *
 * 収録は「2部品がそのまま字形になる」字に絞る。組み上がりが実際の漢字に
 * 見えないと、パーツを当てはめる意味が薄れるため。
 * (例: 移 は 禾+多 だが KRADFILE では 禾+夕 になり字形と合わないので入れない)
 */
const LEFT_PART_OF: Record<string, string> = {
  // さんずい
  泣: '氵', 漁: '氵', 済: '氵', 酒: '氵', 清: '氵', 波: '氵', 洋: '氵', 浴: '氵',
  // にんべん
  位: '亻', 価: '亻', 件: '亻', 仕: '亻', 他: '亻', 代: '亻', 信: '亻', 付: '亻', 仏: '亻', 俳: '亻',
  // いとへん
  級: '糸', 純: '糸', 絶: '糸', 紅: '糸',
  // ごんべん
  訓: '言', 設: '言', 討: '言', 訪: '言',
  // かねへん
  銀: '金', 鋼: '金', 針: '金',
  // きへん
  机: '木', 枝: '木', 相: '木', 根: '木', 枚: '木',
  // のぎへん
  私: '禾', 利: '禾', 和: '禾',
  // てへん
  技: '扌', 折: '扌', 投: '扌', 推: '扌', 批: '扌',
  // りっしんべん
  情: '忄', 性: '忄',
  // おうへん・いしへん・ひへん・つきへん・うしへん・けものへん・こざとへん・おんなへん
  現: '王', 破: '石', 畑: '火', 肥: '月', 物: '牛', 牧: '牛', 独: '犭', 限: '阝', 防: '阝', 好: '女',
  // 左がへんではない左右字(左側の部品を明示する)
  加: '力', 順: '川', 則: '貝', 列: '歹', 刊: '干', 敗: '貝', 放: '方', 短: '矢', 岐: '山', 眼: '目',
  帳: '巾', 張: '弓', 律: '彳', 役: '彳', 幼: '幺',
}

/**
 * 上下(⿱)に割れる字と、その**上側**の部品。収録の考え方は LEFT_PART_OF と同じ。
 * たれ(广・厂・尸)やにょう(辶・廴)、囲む字(囗)は上下2枠に収まらないので入れない。
 */
const TOP_PART_OF: Record<string, string> = {
  // うかんむり・あなかんむり
  安: '宀', 完: '宀', 守: '宀', 宗: '宀', 定: '宀', 究: '穴',
  // くさかんむり・たけかんむり
  芽: '艹', 筆: '竹',
  // のぎ・はね・そのほかのかんむり
  委: '禾', 季: '禾', 習: '羽', 翌: '羽', 集: '隹', 登: '癶', 軍: '冖',
  // 下が心になる字
  意: '音', 志: '士', 息: '自', 悲: '非', 忘: '亡',
  // そのほかの上下字
  胃: '田', 員: '口', 去: '土', 条: '夂', 泉: '白', 善: '羊', 美: '羊', 票: '西',
  要: '西', 養: '羊', 童: '立',
}

/** 組み立ての正解。first が左(または上)、second が右(または下) */
export interface Assembly {
  layout: AssembleLayout
  /** 左右なら左、上下なら上の部品 */
  first: string
  /** 左右なら右、上下なら下の部品 */
  second: string
}

/**
 * その問題を2枠に組ませられるなら、正解の並びを返す。
 *
 * 収録字で、部品がちょうど2つ、先にくる部品が分かっていて、
 * 並べるタイルに両方が含まれているときだけ成立する。
 */
export function assemblyOf(question: Question): Assembly | null {
  const horizontal = LEFT_PART_OF[question.answer]
  const vertical = TOP_PART_OF[question.answer]
  const first = horizontal ?? vertical
  if (!first) return null

  const parts = question.parts
  if (!parts || parts.length !== 2 || !parts.includes(first)) return null
  const second = parts[0] === first ? parts[1] : parts[0]

  const tiles = question.partTiles
  if (!tiles || !tiles.includes(first) || !tiles.includes(second)) return null

  return { layout: horizontal ? 'horizontal' : 'vertical', first, second }
}
