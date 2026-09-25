/**
 * おなじもの さがし(こども向け)の出題を組み立てる。
 *
 * 4つとも**同じ色・同じ向き・同じ種類の形**で、違うのは形のこまかいところだけ。
 * (ほしの角が5つか6つか、しかくの角がどれだけ丸いか)
 * どこが違うかを探して、お手本と同じものを選ぶ。
 *
 * 形はパスを手で書かずに、数から組み立てる。角の数や丸みを数で持てば、
 * 「隣どうしがいちばん似ている」並びが作れて、違いの大きさを問題ごとに変えられる。
 */

/** 図形を描く正方形の座標系 */
export const FIGURE_BOX = 100

const CENTER = FIGURE_BOX / 2

export type ColorId = 'red' | 'blue' | 'yellow' | 'green' | 'purple' | 'pink'

interface ColorDef {
  /** 「あかい まる」のように形の前に付ける形 */
  attribute: string
  hex: string
}

/**
 * 図形の色。ブランドの緑とは別に持つ。こども向けの図形は色数が要るため。
 * 4つとも同じ色にするので、色で迷わせることはない(違いは形だけ)。
 */
export const COLORS: Record<ColorId, ColorDef> = {
  red: { attribute: 'あかい', hex: '#e0564b' },
  blue: { attribute: 'あおい', hex: '#3f7fd4' },
  yellow: { attribute: 'きいろい', hex: '#f3b73a' },
  green: { attribute: 'みどりの', hex: '#46b98a' },
  purple: { attribute: 'むらさきの', hex: '#9a6ad3' },
  pink: { attribute: 'ピンクの', hex: '#ef8ab4' },
}

// ------------------------------------------------------------- 形の組み立て

const point = (angle: number, radius: number) => ({
  x: CENTER + radius * Math.cos(angle),
  y: CENTER + radius * Math.sin(angle),
})

const polyline = (points: { x: number; y: number }[]) =>
  `${points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} Z`

/** 角が count 個の星。sharpness が小さいほど、へこみが浅くてまるい */
function star(count: number, sharpness: number): string {
  const outer = 45
  const points = []
  for (let i = 0; i < count * 2; i++) {
    const radius = i % 2 === 0 ? outer : outer * sharpness
    points.push(point(-Math.PI / 2 + (i * Math.PI) / count, radius))
  }
  return polyline(points)
}

/** 角が count 個の多角形 */
function polygon(count: number): string {
  const points = []
  for (let i = 0; i < count; i++) {
    points.push(point(-Math.PI / 2 + (i * 2 * Math.PI) / count, 44))
  }
  return polyline(points)
}

/** 角を radius だけ丸めた正方形 */
function roundedSquare(radius: number): string {
  const [left, right] = [14, 86]
  const r = radius
  return [
    `M${left + r},${left}`,
    `H${right - r}`,
    r ? `A${r},${r} 0 0 1 ${right},${left + r}` : '',
    `V${right - r}`,
    r ? `A${r},${r} 0 0 1 ${right - r},${right}` : '',
    `H${left + r}`,
    r ? `A${r},${r} 0 0 1 ${left},${right - r}` : '',
    `V${left + r}`,
    r ? `A${r},${r} 0 0 1 ${left + r},${left}` : '',
    'Z',
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * 縦横比 ratio の楕円(1 なら まん丸)。
 * 横幅は、いちばん縦長の変種でも枠に収まる大きさから逆算する。
 * 頭打ちにすると、いちばん縦長の2つが同じ形になってしまう。
 */
function ellipse(ratio: number): string {
  const rx = 34
  const ry = rx * ratio
  return `M${CENTER - rx},${CENTER} A${rx},${ry} 0 0 0 ${CENTER + rx},${CENTER} A${rx},${ry} 0 0 0 ${CENTER - rx},${CENTER} Z`
}

/**
 * 花びらが count 枚の花。中心からの距離を角度で波打たせて作る。
 * 谷を深くすると花びらが細いトゲになるので、浅めにして丸い花びらにする。
 */
function flower(count: number): string {
  const points = []
  const steps = count * 24
  for (let i = 0; i < steps; i++) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / steps
    const radius = 45 * (0.72 + 0.28 * Math.cos(count * (angle + Math.PI / 2)))
    points.push(point(angle, radius))
  }
  return polyline(points)
}

// ------------------------------------------------------------------ 形の家族

export type FamilyId =
  | 'star-corners'
  | 'star-sharpness'
  | 'polygon'
  | 'square-roundness'
  | 'circle-height'
  | 'flower-petals'

interface Variant {
  /** 読み上げ・支援技術のラベル。隣どうしでも必ず言い分けられるようにする */
  label: string
  path: string
}

interface Family {
  /** どこを見比べるかの手がかり。画面には出さないがラベルの組み立てに使う */
  variants: Variant[]
}

/**
 * 形の家族。**並び順が似ている順**で、隣どうしがいちばん見分けにくい。
 * 出題はこの並びの上で「どれだけ離れた変種をダミーにするか」を変えて難しさを作る。
 */
const FAMILIES: Record<FamilyId, Family> = {
  'star-corners': {
    variants: [4, 5, 6, 7, 8, 9, 10].map((count) => ({
      label: `かどが ${count}この ほし`,
      path: star(count, 0.42),
    })),
  },
  'star-sharpness': {
    variants: [
      ['まるっこい ほし', 0.62],
      ['すこし まるい ほし', 0.55],
      ['ふつうの ほし', 0.48],
      ['すこし とがった ほし', 0.41],
      ['とがった ほし', 0.34],
      ['するどい ほし', 0.27],
    ].map(([label, sharpness]) => ({
      label: label as string,
      path: star(5, sharpness as number),
    })),
  },
  polygon: {
    variants: [
      ['ごかくけい', 5],
      ['ろっかくけい', 6],
      ['ななかくけい', 7],
      ['はちかくけい', 8],
      ['きゅうかくけい', 9],
      ['じゅっかくけい', 10],
    ].map(([label, count]) => ({ label: label as string, path: polygon(count as number) })),
  },
  'square-roundness': {
    variants: [
      ['かくばった しかく', 0],
      ['ほんのり まるい しかく', 5],
      ['すこし まるい しかく', 10],
      ['まるい しかく', 16],
      ['よく まるい しかく', 22],
      ['まんまるに ちかい しかく', 30],
    ].map(([label, radius]) => ({
      label: label as string,
      path: roundedSquare(radius as number),
    })),
  },
  'circle-height': {
    variants: [
      ['まんまるの まる', 1],
      ['ほんのり たてながの まる', 1.07],
      ['すこし たてながの まる', 1.14],
      ['たてながの まる', 1.21],
      ['よく たてながの まる', 1.28],
      ['ほそながい まる', 1.35],
    ].map(([label, ratio]) => ({ label: label as string, path: ellipse(ratio as number) })),
  },
  'flower-petals': {
    variants: [4, 5, 6, 7, 8, 9].map((count) => ({
      label: `はなびらが ${count}まいの はな`,
      path: flower(count),
    })),
  },
}

const ALL_FAMILIES = Object.keys(FAMILIES) as FamilyId[]
const ALL_COLORS = Object.keys(COLORS) as ColorId[]

// -------------------------------------------------------------------- 出題

export interface Figure {
  family: FamilyId
  /** その家族の中の何番目か */
  variant: number
  color: ColorId
}

export function figurePath(figure: Figure): string {
  return FAMILIES[figure.family].variants[figure.variant].path
}

/** 「あかい かどが 5つの ほし」。図形は読み上げられないので支援技術にはこれが要る */
export function figureLabel(figure: Figure): string {
  return `${COLORS[figure.color].attribute} ${FAMILIES[figure.family].variants[figure.variant].label}`
}

export function isSameFigure(a: Figure, b: Figure): boolean {
  return a.family === b.family && a.variant === b.variant && a.color === b.color
}

export interface MatchProblem {
  /** お手本 */
  answer: Figure
  /** 並べる4つ。1つだけ答えと同じ */
  choices: Figure[]
}

/** ダミーを答えからどれだけ離すか。near がいちばん似ていて難しい */
type Closeness = 'far' | 'middle' | 'near'

/**
 * 1回ぶんの難しさの並び。違いの大きいものから始めて、だんだん詰める。
 * 「よく見れば分かる」から「じっと見ないと分からない」へ運ぶ。
 */
const CLOSENESS: Closeness[] = ['far', 'far', 'middle', 'near', 'near']

export const MATCH_SESSION_SIZE = CLOSENESS.length

const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)]

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * ダミーに使う変種を3つ選ぶ。
 * 答えから近い順に並べ、near なら手前から、far なら後ろから取る。
 */
function decoyVariants(family: FamilyId, answer: number, closeness: Closeness): number[] {
  const others = FAMILIES[family].variants
    .map((_, index) => index)
    .filter((index) => index !== answer)
    .sort((a, b) => Math.abs(a - answer) - Math.abs(b - answer))

  if (closeness === 'near') return others.slice(0, 3)
  if (closeness === 'far') return others.slice(-3)

  const start = Math.floor((others.length - 3) / 2)
  return others.slice(start, start + 3)
}

function problemOf(closeness: Closeness): MatchProblem {
  const family = pick(ALL_FAMILIES)
  const color = pick(ALL_COLORS)
  const variant = Math.floor(Math.random() * FAMILIES[family].variants.length)
  const answer: Figure = { family, variant, color }

  const choices = [
    answer,
    ...decoyVariants(family, variant, closeness).map((index) => ({
      family,
      variant: index,
      color,
    })),
  ]

  return { answer, choices: shuffle(choices) }
}

export function matchSession(): MatchProblem[] {
  return CLOSENESS.map(problemOf)
}
