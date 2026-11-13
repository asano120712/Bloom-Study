import { useState } from 'react'
import type { ActivityId } from '@/data/activities'
import { COLORS, FIGURE_BOX, figurePath, type Figure } from '@/features/match'
// 定数だけを別モジュールから取る。index.ts 経由だとお手本データ(約170KB)まで一緒に読む
import { VIEW_BOX as TRACE_BOX } from '@/features/trace/box'
import { prefersReducedMotion } from '@/utils/motion'

/**
 * ジャンル選択の一覧で、名前の左に置く「動く絵」。
 *
 * 名前と説明だけの四角が並んでいても、こどもには何が始まるのか分からない。
 * 中身をそのまま小さくして流しておけば、字を読まなくても選べる。
 *
 * 動画ではなくSVGにしてある。数KBで読み込み待ちが無く、どの大きさでも粗くならず、
 * 「動きを減らす」設定のときは完成形で止められるため。
 * 動きはSVG内のSMILで完結させ(ロゴ・挿絵と同じ作法)、止める判断だけJSで行う。
 */
export function ActivityArt({ id, className }: { id: ActivityId; className?: string }) {
  // 表示中に切り替わると再生が巻き戻るため、マウント時の設定で固定する(HeroVisual と同じ)
  const [still] = useState(prefersReducedMotion)

  return (
    // 絵の内容は右の名前・説明と同じことを言っているので、支援技術からは隠す
    <svg viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <rect width="100" height="100" rx="22" fill="var(--color-base-50)" />
      {ART[id](still, CYCLE[id])}
    </svg>
  )
}

/**
 * 1周の長さ。絵ごとに変えてある。
 *
 * ひとつは中身の手数に合わせるため(3画の字はゆっくり、線1本は短く)。
 * もうひとつは、一覧に5つ並んだときに全部が同じ拍で動くと、
 * 表示が切り替わる機械のように見えるため。尺が違えば自然にずれていく。
 */
const CYCLE: Record<ActivityId, string> = {
  english: '4.6s',
  kanji: '4.2s',
  math: '4s',
  'trace-shape': '4s',
  'trace-hiragana': '4.6s',
  'trace-kanji': '5.2s',
  'build-kanji': '4.8s',
  match: '4.4s',
}

/**
 * 描き終わったあと、次の周まで消えている間。
 * 線を引き直す瞬間(0.95〜0.96)は、この中に隠す。いきなり線が消えると目に付く。
 */
const FADE_OUT = { values: '1;1;0;0;1', keyTimes: '0;0.86;0.93;0.985;1' }

const ART: Record<ActivityId, (still: boolean, cycle: string) => React.ReactNode> = {
  english: (still, cycle) => <EnglishArt still={still} cycle={cycle} />,
  kanji: (still, cycle) => <KanjiArt still={still} cycle={cycle} />,
  math: (still, cycle) => <MathArt still={still} cycle={cycle} />,
  'trace-shape': (still, cycle) => (
    <TraceArt still={still} cycle={cycle} strokes={SHAPE_SAMPLE} />
  ),
  'trace-hiragana': (still, cycle) => (
    <TraceArt still={still} cycle={cycle} strokes={KANA_SAMPLE} />
  ),
  'trace-kanji': (still, cycle) => (
    <TraceArt still={still} cycle={cycle} strokes={KANJI_SAMPLE} />
  ),
  'build-kanji': (still, cycle) => <BuildArt still={still} cycle={cycle} />,
  match: (still, cycle) => <MatchArt still={still} cycle={cycle} />,
}

// ------------------------------------------------------------ おとな向け

/**
 * 英単語。出題語の下でヒントが1つずつ灯り、最後にこたえが浮かび上がる。
 * 「ヒントが出そろう前に思い出す」という遊び方そのものを小さくしたもの。
 */
function EnglishArt({ still, cycle }: { still: boolean; cycle: string }) {
  return (
    <>
      <text
        x="50"
        y="32"
        textAnchor="middle"
        fontSize="16"
        fontWeight="700"
        fill="var(--color-ink-900)"
      >
        りんご
      </text>

      {/* ヒント3つ。順に灯る */}
      {[0, 1, 2].map((index) => (
        <circle key={index} cx={34 + index * 16} cy="52" r="3.5" fill="var(--color-bloom-400)">
          {still ? null : (
            <animate
              attributeName="opacity"
              values="0.25;0.25;1;1;0.25"
              keyTimes={`0;${0.1 + index * 0.14};${0.18 + index * 0.14};0.92;1`}
              dur={cycle}
              repeatCount="indefinite"
            />
          )}
        </circle>
      ))}

      <text
        x="50"
        y="78"
        textAnchor="middle"
        fontSize="17"
        fontFamily="Georgia, 'Times New Roman', serif"
        fill="var(--color-bloom-700)"
        opacity={still ? 1 : 0}
      >
        apple
        {still ? null : (
          <animate
            attributeName="opacity"
            values="0;0;1;1;0"
            keyTimes="0;0.6;0.72;0.92;1"
            dur={cycle}
            repeatCount="indefinite"
          />
        )}
      </text>
    </>
  )
}

/**
 * 漢字。◯ のところに、思い出した字が入る。
 * 出題(「◯ に入る漢字を思い出そう」)の見た目をそのまま縮めている。
 */
function KanjiArt({ still, cycle }: { still: boolean; cycle: string }) {
  return (
    <>
      <circle
        cx="31"
        cy="52"
        r="17"
        fill="none"
        stroke="var(--color-bloom-300)"
        strokeWidth="2"
        strokeDasharray="5 5"
        opacity={still ? 0 : 1}
      >
        {still ? null : (
          <animate
            attributeName="opacity"
            values="1;1;0;0;1"
            keyTimes="0;0.45;0.6;0.92;1"
            dur={cycle}
            repeatCount="indefinite"
          />
        )}
      </circle>

      <text
        x="31"
        y="52"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="30"
        fontWeight="700"
        fill="var(--color-bloom-700)"
        opacity={still ? 1 : 0}
      >
        学
        {still ? null : (
          <animate
            attributeName="opacity"
            values="0;0;1;1;0"
            keyTimes="0;0.5;0.63;0.92;1"
            dur={cycle}
            repeatCount="indefinite"
          />
        )}
      </text>

      <text
        x="69"
        y="52"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="30"
        fontWeight="700"
        fill="var(--color-ink-900)"
      >
        校
      </text>
    </>
  )
}

// ---------------------------------------------------------- こども向け

/**
 * 計算。式が出て、少し置いてから答えが浮かぶ。
 * 「ヒントを見ながら自分で出す」遊びなので、答えはすぐには出さない。
 */
function MathArt({ still, cycle }: { still: boolean; cycle: string }) {
  return (
    <>
      <text
        x="50"
        y="36"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="22"
        fontWeight="700"
        fill="var(--color-ink-900)"
      >
        24 × 5
      </text>
      <line
        x1="26"
        y1="52"
        x2="74"
        y2="52"
        stroke="var(--color-bloom-200)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <text
        x="50"
        y="72"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="26"
        fontWeight="700"
        fill="var(--color-bloom-700)"
        opacity={still ? 1 : 0}
      >
        120
        {still ? null : (
          <animate
            attributeName="opacity"
            values="0;0;1;1;0"
            keyTimes="0;0.42;0.58;0.9;1"
            dur={cycle}
            repeatCount="indefinite"
          />
        )}
      </text>
    </>
  )
}

/**
 * なぞりがきの見本。カードの絵は毎回おなじ形が出たほうが分かりやすいので、
 * 出題データからは引かず、代表の1つを写して持つ(座標系は同じ TRACE_BOX)。
 * length はパスの長さ。線を1本ずつ引くのに要るので、形を差し替えたら測り直すこと。
 */
interface ArtStroke {
  d: string
  /** パスの長さ。線を1本ずつ引くのに要る */
  length: number
  /** 引き終わりの位置。動きを止めているときに指を置く場所 */
  end: { x: number; y: number }
}

/** まる(図形のなぞりがき) */
const SHAPE_SAMPLE: ArtStroke[] = [
  {
    d: 'M54.5,15 A39.5,39.5 0 0 1 54.5,94 A39.5,39.5 0 0 1 54.5,15',
    length: 248,
    end: { x: 54.5, y: 15 },
  },
]

/** 「い」。2画で、書き順のあることが分かる */
const KANA_SAMPLE: ArtStroke[] = [
  {
    d: 'M21.5,29.7c2,2.2,2.6,4.7,2.2,7.4c-3.1,19.2-1,32,7.9,41.5c6.1,6.5,6.3,3.1,7-5.2',
    length: 67,
    end: { x: 38.6, y: 73.4 },
  },
  { d: 'M73,36.5c9.4,8.1,17.8,18.8,18.4,33.8', length: 40, end: { x: 91.4, y: 70.3 } },
]

/** 「山」。小1の漢字で、3画とも形がはっきり違う */
const KANJI_SAMPLE: ArtStroke[] = [
  {
    d: 'M52.5,15.5c1.4,1.4,2.3,3.5,2.3,5.8c0,0.8-0.2,58.3-0.2,59.3',
    length: 66,
    end: { x: 54.6, y: 80.6 },
  },
  {
    d: 'M21.5,54.5c0.9,0.9,1.4,2.3,1.3,3.8c-0.6,7-1,16-2.5,23c-0.7,3.3,0.1,4,2,3.8c17-2.2,47.1-5.1,65.5-6',
    length: 99,
    end: { x: 87.8, y: 79.1 },
  },
  {
    d: 'M89.2,49c0.9,0.9,1.6,2.4,1.5,4.3c-0.2,3.7-1.8,20.3-2.5,28.8c-0.2,2.6-0.4,4.5-0.4,5',
    length: 39,
    end: { x: 87.8, y: 87.1 },
  },
]

/** 1画ぶんの持ち時間。画数が増えても1周に収まるよう、引き終わりは 0.8 までにする */
const TRACE_START = 0.08
const TRACE_END = 0.8

/**
 * なぞりがき。うすいお手本の上を指が進み、通ったところが緑の線になる。
 * 線づかい(太さ10・うすいお手本・緑の線)は本編の TraceCanvas と揃えてある。
 */
function TraceArt({
  still,
  cycle,
  strokes,
}: {
  still: boolean
  cycle: string
  strokes: ArtStroke[]
}) {
  const span = (TRACE_END - TRACE_START) / strokes.length

  return (
    <g transform={`scale(${100 / TRACE_BOX})`}>
      {/* お手本。なぞる前から全部見えている */}
      {strokes.map((stroke, index) => (
        <path
          key={index}
          d={stroke.d}
          fill="none"
          stroke="var(--color-ink-400)"
          strokeOpacity="0.28"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      <g>
        {still ? null : (
          <animate attributeName="opacity" dur={cycle} repeatCount="indefinite" {...FADE_OUT} />
        )}

        {strokes.map((stroke, index) => {
          // この画を引いている間。少し間を空けて次の画へ渡す
          const from = TRACE_START + span * index
          const to = from + span * 0.78

          return (
            <g key={index}>
              <path
                d={stroke.d}
                fill="none"
                stroke="var(--color-bloom-500)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={stroke.length}
                strokeDashoffset={still ? 0 : stroke.length}
              >
                {still ? null : (
                  <animate
                    attributeName="stroke-dashoffset"
                    values={`${stroke.length};${stroke.length};0;0;${stroke.length};${stroke.length}`}
                    keyTimes={`0;${from};${to};0.95;0.96;1`}
                    dur={cycle}
                    repeatCount="indefinite"
                  />
                )}
              </path>

              {/*
                なぞっている指。線の先に付いて進む。
                transform を持たない g に animateMotion を掛け、指の傾きは
                Finger の中で持つ(同じ要素に重ねると、動きが傾きを上書きする)。
              */}
              {still ? null : (
                <g opacity="0">
                  <animate
                    attributeName="opacity"
                    values="0;0;1;1;0;0"
                    keyTimes={`0;${from};${from + 0.01};${to};${to + 0.01};1`}
                    dur={cycle}
                    repeatCount="indefinite"
                  />
                  <animateMotion
                    path={stroke.d}
                    keyPoints={`0;0;1;1`}
                    keyTimes={`0;${from};${to};1`}
                    calcMode="linear"
                    dur={cycle}
                    repeatCount="indefinite"
                  />
                  <Finger />
                </g>
              )}
            </g>
          )
        })}
      </g>

      {/* 動きを止めているときも、なぞる遊びだと分かるように指は置いておく */}
      {still && (
        <g transform={`translate(${strokes[strokes.length - 1].end.x},${strokes[strokes.length - 1].end.y})`}>
          <Finger />
        </g>
      )}
    </g>
  )
}

/**
 * かんじの くみたて。2つの部品がマスに入り、組み上がった字になる。
 * 「明 = 日 + 月」は出題データ(parts.kanji.generated.json)にある組み合わせから採った。
 */
function BuildArt({ still, cycle }: { still: boolean; cycle: string }) {
  return (
    <>
      {/* 部品とマス。組み上がると消える */}
      <g opacity={still ? 0 : 1}>
        {still ? null : (
          <animate
            attributeName="opacity"
            values="1;1;0;0;1"
            keyTimes="0;0.52;0.62;0.94;1"
            dur={cycle}
            repeatCount="indefinite"
          />
        )}

        {[
          { x: 30, part: '日' },
          { x: 70, part: '月' },
        ].map(({ x, part }, index) => (
          <g key={part}>
            <rect
              x={x - 18}
              y="34"
              width="36"
              height="36"
              rx="9"
              fill="none"
              stroke="var(--color-bloom-300)"
              strokeWidth="2"
              strokeDasharray="5 5"
            />
            <text
              x={x}
              y="52"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="26"
              fontWeight="700"
              fill="var(--color-ink-900)"
            >
              {part}
              {/* 下から1つずつマスへ入る。枠の外までは下げない(絵の縁で切れて見えるため) */}
              {still ? null : (
                <>
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values="0,34;0,34;0,0;0,0"
                    keyTimes={`0;${0.08 + index * 0.16};${0.26 + index * 0.16};1`}
                    dur={cycle}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0;0;1;1"
                    keyTimes={`0;${0.08 + index * 0.16};${0.2 + index * 0.16};1`}
                    dur={cycle}
                    repeatCount="indefinite"
                  />
                </>
              )}
            </text>
          </g>
        ))}
      </g>

      {/* 組み上がった字 */}
      <text
        x="50"
        y="52"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="44"
        fontWeight="700"
        fill="var(--color-bloom-700)"
        opacity={still ? 1 : 0}
      >
        明
        {still ? null : (
          <animate
            attributeName="opacity"
            values="0;0;1;1;0"
            keyTimes="0;0.6;0.7;0.94;1"
            dur={cycle}
            repeatCount="indefinite"
          />
        )}
      </text>
    </>
  )
}

/** ちがいさがしの見本。本編と同じ形(features/match)から作る */
const MATCH_ANSWER: Figure = { family: 'star-corners', variant: 2, color: 'yellow' }
const MATCH_CHOICES: Figure[] = [
  { family: 'star-corners', variant: 4, color: 'yellow' },
  { family: 'star-corners', variant: 0, color: 'yellow' },
  MATCH_ANSWER,
]

/**
 * ちがいさがし。お手本と、すこしだけ形の違う3つ。
 * 同じ形にしるしが付くところまでを見せる(本編は4つだが、この大きさでは潰れる)。
 */
function MatchArt({ still, cycle }: { still: boolean; cycle: string }) {
  return (
    <>
      <FigureMark figure={MATCH_ANSWER} x={50} y={24} size={32} />

      {MATCH_CHOICES.map((figure, index) => {
        const x = 22 + index * 28
        const isAnswer = figure === MATCH_ANSWER

        return (
          <g key={index}>
            <FigureMark figure={figure} x={x} y={58} size={24} />
            {isAnswer && (
              <rect
                x={x - 16}
                y={42}
                width="32"
                height="32"
                rx="10"
                fill="none"
                stroke="var(--color-bloom-600)"
                strokeWidth="3"
                opacity={still ? 1 : 0}
              >
                {still ? null : (
                  <animate
                    attributeName="opacity"
                    values="0;0;1;1;0"
                    keyTimes="0;0.55;0.68;0.92;1"
                    dur={cycle}
                    repeatCount="indefinite"
                  />
                )}
              </rect>
            )}
          </g>
        )
      })}

      {/*
        迷っている指。1つめへ寄って、隣をちらっと見て、2つめで止まり、
        それから同じ形のところへ行って押す。しるしが付くのと同じ拍(0.55〜)で押す。

        指先は図形の真下(y=74)に置く。図形に重ねると、見比べている形そのものを
        指で隠してしまう。下に手が収まるよう、図形の位置もその分だけ上へ詰めてある。
      */}
      {still ? (
        <g transform="translate(78,74)">
          <Finger />
        </g>
      ) : (
        <g>
          <animateTransform
            attributeName="transform"
            type="translate"
            values="22,106; 22,74; 31,72; 22,74; 50,74; 43,72; 50,74; 78,74; 78,79; 78,74; 78,74; 78,106"
            keyTimes="0;0.1;0.17;0.23;0.35;0.42;0.48;0.57;0.61;0.65;0.9;1"
            dur={cycle}
            repeatCount="indefinite"
          />
          <Finger />
        </g>
      )}
    </>
  )
}

/**
 * 指。デモの絵で「ここを触っている」ことを見せる。
 *
 * **指先が原点(0,0)** に来るように描いてある。置きたい点へ translate すれば
 * そこを触っている形になり、なぞりの animateMotion にもそのまま乗る。
 * 向きは右下へ流す(右手で画面を触るときの角度)。
 *
 * 白で塗って輪郭で見せる。緑の線の上でも、黄色い図形の上でも埋もれないため。
 * 輪郭は**下に太い線で同じ形を描いてから、上を白で塗りつぶして**作る。
 * ひとつずつ線を付けると、重なったところに内側の線が出てしまう。
 */
function Finger({ scale = 0.45 }: { scale?: number }) {
  /*
   * 作りは、よくある「指さしカーソル」に合わせてある。
   *
   * 立てた人差し指のとなりに、折った指を3本ならべる。山がでこぼこしていても、
   * **同じ幅の指が順に短くなって並んでいれば**手に見える(雲に見えるのは、
   * 大きさのちがうふくらみを無造作に足したとき)。親指は左下。
   *
   * 輪郭は、下に太い線で同じ形を描いてから上を白で塗りつぶして作る。
   * 形ごとに線を付けると、重なったところに内側の線が出てしまう。
   */
  const shapes = (
    <>
      {/* 立てた人差し指 */}
      <rect x="-5" y="-2" width="10" height="44" rx="5" />
      {/* 折った指。右へ順に短くなる */}
      <rect x="9" y="14" width="9" height="30" rx="4.5" />
      <rect x="17.5" y="18" width="9" height="28" rx="4.5" />
      <rect x="26" y="24" width="9" height="24" rx="4.5" />
      {/* 手のひら */}
      <rect x="-8" y="34" width="43" height="28" rx="9" />
      {/* 親指 */}
      <rect x="-19" y="38" width="17" height="13" rx="6.5" />
    </>
  )

  return (
    <g transform={`scale(${scale}) rotate(28)`}>
      <g fill="var(--color-ink-900)" stroke="var(--color-ink-900)" strokeWidth="4.5">
        {shapes}
      </g>
      <g fill="#fff">{shapes}</g>

      {/* 指の間の谷。折った指が1本ずつに見えるのは、この線のおかげ */}
      <g
        fill="none"
        stroke="var(--color-ink-900)"
        strokeWidth="2.6"
        strokeLinecap="round"
      >
        <path d="M7.5,22 V36" />
        <path d="M17.5,25 V37" />
        <path d="M26,30 V39" />
      </g>
    </g>
  )
}

/** 図形ひとつを、絵の中の好きな場所へ好きな大きさで置く */
function FigureMark({ figure, x, y, size }: { figure: Figure; x: number; y: number; size: number }) {
  const scale = size / FIGURE_BOX

  return (
    <g transform={`translate(${x},${y}) scale(${scale}) translate(${-FIGURE_BOX / 2},${-FIGURE_BOX / 2})`}>
      <path d={figurePath(figure)} fill={COLORS[figure.color].hex} />
    </g>
  )
}
