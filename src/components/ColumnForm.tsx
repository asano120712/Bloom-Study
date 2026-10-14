import type { CSSProperties, ReactNode } from 'react'
import { parseExpression, type ColumnSlot } from '@/features/math'

/** 筆算のマス1つぶん。打ち終わったもの・いま打っているものを、場所つきで表す */
export interface ColumnCell {
  slot: ColumnSlot
  /** 入っている数。空文字なら、まだ何も打っていない点線のマス */
  digits: string
  /**
   * 数のかわりに置くもの(手書きのマスなど)。
   * 渡すと、数のマスのかわりにこれを同じ場所へ置く。
   */
  content?: ReactNode
  /**
   * 出しておくマスの数(いま打っているところだけ)。
   *
   * 右づめのまま1字ずつ出すと、打つたびに前の数字が左へずれて読みにくい。
   * 先に入りうるぶんのマスを出しておき、左から順に埋める。
   */
  width?: number
  tone: CellTone
}

type CellTone = 'typing' | 'done' | 'wrong'

/**
 * マス1つの幅。
 *
 * **式の数字も、打つマスも、同じ幅のマスに1字ずつ置く。** 幅が違うと、
 * 上の数字と下のマスで位が縦にそろわず、どの位を打っているのか読めなくなる。
 * 幅は CSS 変数で配り、ずらし幅やわり算の桁位置もこれを見る。
 *
 * 手書きのときだけ広い(指で1字書ける大きさ)。式のほうもそれに合わせて広げる。
 */
const CELL = '1.15em'
/*
  手書きのマスは字の大きさの2倍ほしいが、**上限も要る**。
  字に比例させたままだと、背の低い端末で画面からはみ出し、
  書いている最中に画面が引っ張られる。

  4rem(64px)は、指で1字書くのに窮屈でない大きさ。筆算でいちばん横に長いのは
  4列(79 × 33、371 + 742)で、この大きさでも iPhone SE の幅に収まる。
  それでも入らない背の低い画面のために、画面の高さにも頭打ちを掛ける。
  svh(ブラウザのバーが出ている状態の高さ)で測るのは、バーのぶんを見込むため。
  書く場所は答えの1行だけなので、頭打ちは段のあった頃ほどきつくなくてよい。
*/
const WRITE_CELL = 'min(2em, 4rem, 11svh)'
/*
  かけ算の段があるときは、式2行・段2行・こたえで5行になる。11svh のままだと
  iPhone SE でボタンが画面から押し出されるので、高さの頭打ちをきつくする
  (SE で 50px ほど。背の高い端末では 4rem のまま)。
*/
const WRITE_CELL_ROWS = 'min(2em, 4rem, 7.5svh)'

/**
 * 筆算(たし算・ひき算・かけ算)。式を縦に積んで、桁をそろえて見せる。
 * わり算は形が違う(商を上に書く)ので DivisionForm に分けてある。
 *
 * 2桁以上の計算を「24 × 5」と1行で出すと暗算に近くなり、小3・4には難しい。
 * 筆算はこの学年で習う形なので、縦に積むほうが解きやすく、位をそろえる練習にもなる。
 *
 * 式の文字列(「24 × 5」)から組み立てる。問題データは1行の式のまま持っておきたい
 * (マイページの履歴や読み上げは1行のほうが扱いやすい)ので、分けるのは見せる側で行う。
 * 読めない形だったときは、そのまま1行で出す。
 *
 * どこに何が入るかは `cells` が持つ。進み方(段で打つのか、位ごとに打つのか)は
 * 式で決まるので、その組み立ては `features/math` 側にまとめてある。
 */
export function ColumnForm({
  expression,
  cells = [],
  writing = false,
}: {
  expression: string
  cells?: ColumnCell[]
  /** 手書きで書くとき。マスが指で書ける大きさになり、式のほうも一緒に広がる */
  writing?: boolean
}) {
  const parsed = parseExpression(expression)
  if (!parsed) return <span>{expression}</span>

  const { left, operator, right } = parsed
  const rows = cells.filter((cell) => cell.slot.kind === 'row')
  /*
    位のマスは**位の大きいほうから左へ**並べる。渡された順ではなく位で並べるのは、
    打つとき(一のくらいから)と手書き(左から書く)で渡す順が違うため。
  */
  const places = cells
    .flatMap((cell) => (cell.slot.kind === 'place' ? [{ cell, place: cell.slot.place }] : []))
    .sort((a, b) => b.place - a.place)
  const answer = cells.find((cell) => cell.slot.kind === 'answer')

  return (
    // tabular-nums: 数字の幅をそろえて、位が縦に並ぶようにする
    <span
      // 読み上げには1行の式を渡す。縦に積んだ数字だけでは式として読まれない
      aria-label={expression}
      className="inline-grid grid-cols-[auto_auto] gap-x-3 text-right font-bold tabular-nums"
      style={
        { '--cell': writing ? (rows.length > 0 ? WRITE_CELL_ROWS : WRITE_CELL) : CELL } as CSSProperties
      }
    >
      <span aria-hidden="true" />
      <PlainDigits digits={left} />
      <span aria-hidden="true" className="self-center">
        {operator}
      </span>
      <PlainDigits digits={right} />
      <span aria-hidden="true" className="col-span-2 mt-1 border-t-2 border-ink-900" />

      {/* かけ算の段。ずらして書くのも筆算と同じ */}
      {rows.map((cell, index) => (
        <Row
          key={index}
          cell={cell}
          shift={cell.slot.kind === 'row' ? cell.slot.shift : 0}
          tight={writing}
        />
      ))}

      {/* 段があるなら、答えの前にもう1本線を引く */}
      {rows.length > 0 && (
        <span aria-hidden="true" className="col-span-2 mt-1 border-t-2 border-ink-900" />
      )}

      {/* たし算・ひき算の答え。位の大きいほうから左へ並ぶ */}
      {(places.length > 0 || answer) && (
        <span
          aria-hidden="true"
          className={`col-span-2 flex justify-end gap-1 ${writing ? 'mt-1' : 'mt-2'}`}
        >
          {places.map(({ cell }, index) => (
            <Cell key={index} cell={cell} />
          ))}
          {answer && <Cell cell={answer} />}
        </span>
      )}
    </span>
  )
}

/**
 * 式の数字。枠は出さないが、**打つマスと同じ幅・同じすきま**で1字ずつ置く。
 * こうしないと、上の数字と下のマスで位が縦にそろわない。
 */
function PlainDigits({ digits }: { digits: string }) {
  return (
    <span aria-hidden="true" className="flex justify-end gap-1">
      {[...digits].map((digit, index) => (
        <span key={index} className="flex size-[var(--cell)] items-center justify-center">
          {digit}
        </span>
      ))}
    </span>
  )
}

/** かけ算の段1つ。ずらす段は、その幅ぶん右を空ける */
function Row({ cell, shift, tight }: { cell: ColumnCell; shift: number; tight?: boolean }) {
  return (
    <span
      aria-hidden="true"
      // 手書きはマスが大きく段も増えるので、行間を詰めて画面に収める
      className={`col-span-2 flex justify-end gap-1 ${tight ? 'mt-1' : 'mt-2'}`}
      style={shift ? { paddingRight: `calc(${shift} * (var(--cell) + 0.25rem))` } : undefined}
    >
      <Cell cell={cell} />
    </span>
  )
}

/** マス1つぶんの中身。手書きのマス(content)があればそれを、無ければ数を置く */
function Cell({ cell }: { cell: ColumnCell }) {
  if (cell.content !== undefined) return <>{cell.content}</>
  return <Digits digits={cell.digits} width={cell.width} tone={cell.tone} />
}

/**
 * 数をマスに1字ずつ。
 *
 * 打っているところは、**答えの桁数ぶんのマスは置かない**。マスの数が見えると
 * 桁数が分かってしまい、見当をつける手間が減る。打った数に追いて増える形にして、
 * まだ何も打っていないときだけ点線のマスを1つ出す。
 */
function Digits({ digits, width, tone }: { digits: string; width?: number; tone: CellTone }) {
  // 足りないぶんは空のマス。width が無いときは、打った数のぶんだけ(空なら1つ)
  const cells = [...digits]
  while (cells.length < Math.max(width ?? 1, 1)) cells.push('')

  return (
    <>
      {cells.map((digit, index) => (
        <span
          key={index}
          className={`flex size-[var(--cell)] shrink-0 items-center justify-center rounded-md border-2 leading-none ${
            tone === 'wrong'
              ? 'border-warm-500 text-warm-600'
              : digit
                ? 'border-bloom-300 text-ink-900'
                : 'border-dashed border-bloom-200'
          }`}
        >
          {digit}
        </span>
      ))}
    </>
  )
}

/**
 * わり算の筆算(長除法)。割る数 │ 割られる数 の形にして、商を上に書く。
 *
 * かけ算の筆算と形が違うので別にしてある(縦に積むのではなく、囲って上に書く)。
 * 割られる数を1桁ずつマス目に置き、商・引く段・ひいた数を**その桁の下にそろえて**置く。
 * 桁がずれると、どの数からどれを引いたのかが読めなくなる。
 */
export function DivisionForm({
  expression,
  cells = [],
  writing = false,
}: {
  expression: string
  cells?: ColumnCell[]
  writing?: boolean
}) {
  const parsed = parseExpression(expression)
  if (!parsed || parsed.operator !== '÷') return <span>{expression}</span>

  const [dividend, divisor] = [parsed.left, parsed.right]
  const quotient = cells.filter((cell) => cell.slot.kind === 'quotient')
  const lines = cells.filter((cell) => cell.slot.kind === 'product' || cell.slot.kind === 'rest')

  /** 割られる数の桁(0始まり、左から)が、グリッドの何列目か。1列目は割る数 */
  const columnOf = (index: number) => index + 2

  /*
    引く段とひいた数は、1行ずつ下へ積む。ひいた数の上には線を引くので、その段は2行ぶん使う。
    線は紙と同じく**引く段の幅**に引く(ひいた数は、おろした桁のぶん右へ伸びるため)。
  */
  const placed = lines.reduce<Placed[]>((done, cell) => {
    const column = cell.slot.kind === 'product' || cell.slot.kind === 'rest' ? cell.slot.column : 0
    // いま打っているところは、入りうるぶんの幅で置く。打つたびに置き場所が動かないように
    const span = Math.max(cell.digits.length, cell.width ?? 1, 1)
    const start = Math.max(2, columnOf(column) - span + 1)
    const above = done[done.length - 1]
    const top = above ? above.row + 1 : 3
    const ruled = cell.slot.kind === 'rest' && above !== undefined

    return [
      ...done,
      {
        cell,
        row: ruled ? top + 1 : top,
        start,
        span,
        rule: ruled ? { row: top, start: above.start, span: above.span } : undefined,
      },
    ]
  }, [])

  return (
    <span
      // 読み上げには1行の式を渡す。囲いと数字の位置だけでは式として読まれない
      aria-label={expression}
      className={`inline-grid text-right font-bold tabular-nums ${writing ? 'gap-0.5' : 'gap-1'}`}
      style={
        {
          '--cell': writing ? WRITE_CELL : CELL,
          gridTemplateColumns: `auto repeat(${dividend.length}, var(--cell))`,
        } as CSSProperties
      }
    >
      {/* 商。割られる数の、その桁の真上に置く */}
      {quotient.map((cell, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="flex justify-center"
          style={{
            gridRow: 1,
            gridColumn: cell.slot.kind === 'quotient' ? columnOf(cell.slot.column) : 2,
          }}
        >
          <Cell cell={cell} />
        </span>
      ))}

      {/* 割る数 │ 割られる数 */}
      <span aria-hidden="true" className="self-center pr-1" style={{ gridRow: 2, gridColumn: 1 }}>
        {divisor}
      </span>
      {[...dividend].map((digit, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={`border-t-2 border-ink-900 pt-1 text-center ${
            index === 0 ? 'rounded-tl-md border-l-2 pl-1' : ''
          }`}
          style={{ gridRow: 2, gridColumn: columnOf(index) }}
        >
          {digit}
        </span>
      ))}

      {/* 引く段とひいた数 */}
      {placed.map(({ cell, row, start, span, rule }, index) => (
        <span key={index} className="contents">
          {rule && (
            <span
              aria-hidden="true"
              className="mt-1 border-t-2 border-ink-900"
              style={{ gridRow: rule.row, gridColumn: `${rule.start} / span ${rule.span}` }}
            />
          )}
          <span
            aria-hidden="true"
            className="flex justify-end gap-1"
            style={{ gridRow: row, gridColumn: `${start} / span ${span}` }}
          >
            <Cell cell={cell} />
          </span>
        </span>
      ))}
    </span>
  )
}

/** 引く段・ひいた数を、グリッドのどこに置くか */
interface Placed {
  cell: ColumnCell
  row: number
  start: number
  span: number
  rule?: { row: number; start: number; span: number }
}
