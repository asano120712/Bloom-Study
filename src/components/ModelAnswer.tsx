import type { AnswerGuide } from '@/types'

interface ModelAnswerProps {
  answer: string
  /** 敷くガイド。ジャンル定義(genre.answerGuide)から渡す */
  guide: AnswerGuide
}

/**
 * 正解を「おてほん」として見せる。
 *
 * 書いて思い出すアプリなので、正解は文字列を出すだけでは足りない。
 * 自分が書いた字と見比べて、次はどう書くかが分かる形にする。
 * すぐ下に「じぶんが かいた こたえ」が並ぶので、枠の見た目と幅はそちらに揃えている。
 *
 * 字は本文の丸ゴシックではなく font-display(欧文セリフ + 明朝)で組む。
 * 手本として写すなら、線の太さに強弱がある書体のほうが字形を追いやすい。
 */
export function ModelAnswer({ answer, guide }: ModelAnswerProps) {
  return (
    <figure className="m-0 w-full">
      <figcaption className="text-sm text-ink-400">おてほん</figcaption>
      <div className="mx-auto mt-2 w-full max-w-xs">
        {guide === 'grid' ? <GridSheet answer={answer} /> : <RuledSheet answer={answer} />}
      </div>
    </figure>
  )
}

/**
 * 漢字ドリルのマス。1文字ずつ入れ、中心が取れるよう薄い十字ガイドを敷く。
 * 熟語(2文字)まで想定しているので、増えたら折り返す。
 */
function GridSheet({ answer }: { answer: string }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {[...answer].map((char, index) => (
        <div
          key={`${char}-${index}`}
          className="relative flex size-24 items-center justify-center rounded-2xl border-2 border-bloom-200 bg-white"
        >
          {/* 十字ガイドは字形を追うための飾り。読み上げには乗せない */}
          <span
            aria-hidden="true"
            className="absolute inset-x-3 top-1/2 border-t border-dashed border-bloom-200"
          />
          <span
            aria-hidden="true"
            className="absolute inset-y-3 left-1/2 border-l border-dashed border-bloom-200"
          />
          <span className="font-display text-6xl leading-none text-ink-900">{char}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * 英語ノートの罫線。上線・中線(点線)・基線の3本を敷く。
 *
 * ガイドの位置は文字サイズを基準にしたいので、font-size は外側の枠に置き、
 * 罫線の位置は em で指定する(px で置くと文字サイズを変えたときに合わなくなる)。
 */
function RuledSheet({ answer }: { answer: string }) {
  return (
    <div className="rounded-2xl border-2 border-bloom-200 bg-white px-4 pt-10 pb-8">
      {/*
        枠の下端が基線。行送り1の箱は下端が descender の位置になるため、
        その分(0.22em)だけ負のマージンで下げて、文字の基線を罫線に合わせる。
        こうすると y や g が基線の下へ出る、英語ノートと同じ見え方になる。
      */}
      <div className="relative border-b-2 border-bloom-300 text-5xl">
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-[0.52em] border-t border-dashed border-bloom-200"
        />
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-[0.8em] border-t border-bloom-100"
        />
        <p className="-mb-[0.22em] font-display leading-none tracking-wide text-ink-900">
          {answer}
        </p>
      </div>
    </div>
  )
}
