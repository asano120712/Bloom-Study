/**
 * おなじもの さがし(こども向け)の出題を組み立てる。
 *
 * ダミーは正解を**1か所だけ**変えて作る。どこを変えるかで難しさが決まるので、
 * 1回の中で 形 → 色 → 向き と段階を上げる。
 * 形は SVG のパスで持つ(なぞりがきと同じ考え方。絵の素材が要らない)。
 */

/** 図形を描く正方形の座標系 */
export const FIGURE_BOX = 100

export type ShapeId =
  | 'circle'
  | 'triangle'
  | 'square'
  | 'star'
  | 'heart'
  | 'moon'
  | 'arrow'
  | 'bolt'

export type ColorId = 'red' | 'blue' | 'yellow' | 'green' | 'purple' | 'pink'

/** 回す角度。左右反転は使わない(下の ORIENTABLE の注記を参照) */
export type Rotation = 0 | 90 | 180 | 270

export interface Figure {
  shape: ShapeId
  color: ColorId
  rotation: Rotation
}

interface ShapeDef {
  /** 読み上げ・ラベル用の名前 */
  name: string
  path: string
}

export const SHAPES: Record<ShapeId, ShapeDef> = {
  circle: { name: 'まる', path: 'M8,50 A42,42 0 1 0 92,50 A42,42 0 1 0 8,50 Z' },
  triangle: { name: 'さんかく', path: 'M50,9 L91,83 L9,83 Z' },
  square: { name: 'しかく', path: 'M13,13 H87 V87 H13 Z' },
  star: {
    name: 'ほし',
    path: 'M50,8 L60.6,37.4 L91.8,38.4 L67.1,57.6 L75.9,87.6 L50,70 L24.1,87.6 L32.9,57.6 L8.2,38.4 L39.4,37.4 Z',
  },
  heart: {
    name: 'ハート',
    path: 'M50,88 C22,66 11,50 11,37 A20,20 0 0 1 50,29 A20,20 0 0 1 89,37 C89,50 78,66 50,88 Z',
  },
  moon: { name: 'つき', path: 'M64,9 A42,42 0 1 0 64,91 A34,34 0 1 1 64,9 Z' },
  arrow: { name: 'やじるし', path: 'M9,38 H57 V19 L93,50 L57,81 V62 H9 Z' },
  bolt: { name: 'いなずま', path: 'M60,6 L24,56 H45 L38,94 L78,42 H54 Z' },
}

/**
 * 回すと違って見える形。向きの問題はこれだけで作る。
 *
 * 左右反転は使わない。やじるしも つきも横軸で対称なので、
 * 反転した形は「180度まわした形」と同じになり、選択肢が重複してしまう。
 */
const ORIENTABLE: ShapeId[] = ['arrow', 'bolt', 'moon']

interface ColorDef {
  /** 「あかい まる」のように形の前に付ける形 */
  attribute: string
  hex: string
  /** 明るさ(相対輝度)。色だけで見分けさせないための判断に使う */
  lightness: number
}

/**
 * 図形の色。ブランドの緑とは別に持つ。こども向けの図形は色数が要るため。
 *
 * 明るさを併記しているのは、**色だけが違う問題**を作るときに使うため。
 * 色の見え方には個人差があるので、明るさの差が小さい組み合わせ(あか と あお)を
 * 答えとダミーに並べると、その子には原理的に解けない問題になる。
 */
export const COLORS: Record<ColorId, ColorDef> = {
  red: { attribute: 'あかい', hex: '#e0564b', lightness: 0.23 },
  blue: { attribute: 'あおい', hex: '#3f7fd4', lightness: 0.21 },
  yellow: { attribute: 'きいろい', hex: '#f3b73a', lightness: 0.53 },
  green: { attribute: 'みどりの', hex: '#46b98a', lightness: 0.38 },
  purple: { attribute: 'むらさきの', hex: '#9a6ad3', lightness: 0.22 },
  pink: { attribute: 'ピンクの', hex: '#ef8ab4', lightness: 0.4 },
}

/** 色だけが違う問題で、答えとダミーに要る明るさの差 */
const LIGHTNESS_GAP = 0.12

/** 向きの言い方。ラベルと、あとで足す読み上げで使う */
const ROTATION_WORD: Record<Rotation, string> = {
  0: '',
  90: 'みぎに まわした ',
  180: 'さかさの ',
  270: 'ひだりに まわした ',
}

/** 「あかい さんかく」。読み上げにも、支援技術のラベルにも使う */
export function figureLabel(figure: Figure): string {
  return `${ROTATION_WORD[figure.rotation]}${COLORS[figure.color].attribute}${SHAPES[figure.shape].name}`
}

export function isSameFigure(a: Figure, b: Figure): boolean {
  return a.shape === b.shape && a.color === b.color && a.rotation === b.rotation
}

export interface MatchProblem {
  /** お手本 */
  answer: Figure
  /** 並べる4つ。1つだけ答えと同じ */
  choices: Figure[]
}

/** 何が違うダミーを作るか */
type Stage = 'shape' | 'color' | 'rotation'

/**
 * 1回ぶんの段階。やさしい順に上げる。
 * 形 → 形 → 色 → 向き → 向き。毎問ルールが変わると小さい子は混乱するので、
 * 同じ見分け方を2問ずつ続けてから次へ進む。
 */
const STAGES: Stage[] = ['shape', 'shape', 'color', 'rotation', 'rotation']

export const MATCH_SESSION_SIZE = STAGES.length

const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)]

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

const ALL_SHAPES = Object.keys(SHAPES) as ShapeId[]
const ALL_COLORS = Object.keys(COLORS) as ColorId[]
const ALL_ROTATIONS: Rotation[] = [0, 90, 180, 270]

/** その段階のダミーを3つ作る。変えるのは1か所だけ */
function decoysOf(answer: Figure, stage: Stage): Figure[] {
  if (stage === 'shape') {
    const others = shuffle(ALL_SHAPES.filter((shape) => shape !== answer.shape))
    return others.slice(0, 3).map((shape) => ({ ...answer, shape }))
  }

  if (stage === 'color') {
    // 明るさの離れた色だけを使う。色の見え方に関わらず見分けられるようにする
    const others = shuffle(
      ALL_COLORS.filter(
        (color) =>
          color !== answer.color &&
          Math.abs(COLORS[color].lightness - COLORS[answer.color].lightness) >= LIGHTNESS_GAP,
      ),
    )
    return others.slice(0, 3).map((color) => ({ ...answer, color }))
  }

  const others = shuffle(ALL_ROTATIONS.filter((rotation) => rotation !== answer.rotation))
  return others.slice(0, 3).map((rotation) => ({ ...answer, rotation }))
}

function problemOf(stage: Stage): MatchProblem {
  const answer: Figure = {
    // 向きの問題は、回すと違って見える形でしか作れない
    shape: stage === 'rotation' ? pick(ORIENTABLE) : pick(ALL_SHAPES),
    color: pick(ALL_COLORS),
    // 形・色の問題では向きを揃える(違いが1か所だけになるように)
    rotation: stage === 'rotation' ? pick(ALL_ROTATIONS) : 0,
  }

  return { answer, choices: shuffle([answer, ...decoysOf(answer, stage)]) }
}

export function matchSession(): MatchProblem[] {
  return STAGES.map(problemOf)
}
