import { useEffect, useState } from 'react'
import { kanjiShapes } from '@/features/recognize/kanji'

/**
 * パズルのタイル1つ。
 *
 * タイルの名前が「字|0」(左か上)・「字|1」(右か下)なら、KanjiVG のお手本の線から、その字の中での部品の形を描く
 * (scripts/build/build-kanji-puzzles.ts が作るパズル)。フォントに無い部品(𠦝・㑒)も出せ、見た目も字の中の形のままになる。
 * 「|」の無い名前(小1・小2のパズルの 氵 など)は、これまでどおり文字で出す。
 *
 * 大きさは文字と同じく font-size に合わせる(高さ 1.1em)。呼ぶ側の text-3xl などがそのまま効く。
 * 部品は枠いっぱいに拡大して描く。もとの字の中での大きさの違いで、正解が分かってしまわないように。
 * 枠の縦横は部品の形に合わせる(上下に分かれる字の部品は横長)。正方形に収めると、横長の部品が
 * 横幅に合わせて縮み、小さく平たく見えた。比率は 1:2 までにとどめる。
 */
export function PartTile({ id }: { id: string }) {
  const [drawing, setDrawing] = useState<{ paths: string[]; width: number } | null>(null)
  const drawn = id.includes('|')

  useEffect(() => {
    if (!drawn) return
    let active = true
    void kanjiShapes().then((shapes) => {
      if (active) setDrawing(pathsOf(id, shapes.characters, shapes.splits))
    })
    return () => {
      active = false
    }
  }, [id, drawn])

  if (!drawn) return <>{id}</>
  const width = drawing?.width ?? 100
  return (
    <svg
      viewBox={`0 0 ${width} 100`}
      aria-hidden="true"
      className="inline-block h-[1.1em] shrink-0 align-middle"
      style={{ width: `${(1.1 * width) / 100}em` }}
      fill="none"
    >
      {(drawing?.paths ?? []).map((d, index) => (
        <path
          key={index}
          d={d}
          stroke="currentColor"
          strokeWidth={8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}

/**
 * 漢字1字を、KanjiVG のお手本の線で描く(パズルのお手本の字と、組み上がった字)。
 * タイルの部品と同じ線にそろえる。フォントの字だと、部品だけ手書きのような線で、字だけキリッと見えて浮く。
 * 部品と違って枠いっぱいには伸ばさず、お手本の枠(109 四方)の配置のまま描く(字のバランスを変えないため)。
 * 大きさは font-size に合わせる(1em 角)。お手本の無い字は、文字で出す。
 */
export function KanjiDrawing({ char }: { char: string }) {
  const [paths, setPaths] = useState<string[] | null>(null)
  useEffect(() => {
    let active = true
    void kanjiShapes().then((shapes) => {
      const strokes = shapes.characters[char]
      if (!active) return
      setPaths(
        strokes
          ? strokes.map((flat) => {
              const points: [number, number][] = []
              for (let i = 0; i < flat.length; i += 2) points.push([flat[i], flat[i + 1]])
              return smooth(points)
            })
          : [],
      )
    })
    return () => {
      active = false
    }
  }, [char])

  // 読み込むまで、またはお手本が無いときは文字で出す(場所が空かないように)
  if (!paths?.length) return <>{char}</>
  return (
    <svg viewBox="0 0 109 109" role="img" aria-label={char} className="inline-block size-[1em] align-middle" fill="none">
      {paths.map((d, index) => (
        <path key={index} d={d} stroke="currentColor" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  )
}

/** 余白(100 のうち)。線の太さぶんは空けて、枠に線がかからないようにする */
const MARGIN = 10

/** 枠の横の長さ(高さを 100 としたとき)の範囲。縦長・横長が極端でも 1:2 まで */
const MIN_WIDTH = 50
const MAX_WIDTH = 200

/** タイルの部品の線を、高さ 100 の枠(横は部品の形に合わせる)に収めた SVG のパスにする */
function pathsOf(
  id: string,
  characters: Record<string, number[][]>,
  splits: Record<string, { first: number[] }>,
): { paths: string[]; width: number } {
  const [char, side] = id.split('|')
  const split = splits[char]
  const strokes = characters[char]
  if (!split || !strokes) return { paths: [], width: 100 }
  const mine = strokes
    .filter((_, index) => split.first.includes(index) === (side === '0'))
    .map((flat) => {
      const points: [number, number][] = []
      for (let i = 0; i < flat.length; i += 2) points.push([flat[i], flat[i + 1]])
      return points
    })
  const all = mine.flat()
  const left = Math.min(...all.map((p) => p[0]))
  const top = Math.min(...all.map((p) => p[1]))
  const width = Math.max(...all.map((p) => p[0])) - left
  const height = Math.max(...all.map((p) => p[1])) - top
  const box = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, (100 * Math.max(width, 1)) / Math.max(height, 1)))
  // 枠(box × 100)の内側に、縦横同じ倍率で収める
  const scale = Math.min((box - MARGIN * 2) / Math.max(width, 1), (100 - MARGIN * 2) / Math.max(height, 1))
  const place = ([x, y]: [number, number]): [number, number] => [
    (box - width * scale) / 2 + (x - left) * scale,
    (100 - height * scale) / 2 + (y - top) * scale,
  ]
  return { paths: mine.map((stroke) => smooth(stroke.map(place))), width: Math.round(box) }
}

/**
 * 点の並びを、なめらかな線のパスにする(点どうしの真ん中を通る2次曲線でつなぐ)。
 * お手本の点は線に沿って間引いてあるので、直線でつなぐと角ばって見える。
 */
function smooth(points: [number, number][]): string {
  const f = (value: number) => Math.round(value * 10) / 10
  if (points.length < 3) return `M${points.map(([x, y]) => `${f(x)},${f(y)}`).join(' L')}`
  let d = `M${f(points[0][0])},${f(points[0][1])}`
  for (let i = 1; i < points.length - 1; i += 1) {
    const [x, y] = points[i]
    const [nx, ny] = points[i + 1]
    d += ` Q${f(x)},${f(y)} ${f((x + nx) / 2)},${f((y + ny) / 2)}`
  }
  const last = points.at(-1)!
  return `${d} L${f(last[0])},${f(last[1])}`
}
