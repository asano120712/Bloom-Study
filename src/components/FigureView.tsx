import { COLORS, FIGURE_BOX, SHAPES, type Figure } from '@/features/match'

/**
 * 図形ひとつ。おなじものさがしのお手本にも選択肢にも使う。
 *
 * 名前は置いている側(ボタン)が持つので、ここは支援技術から隠す。
 * 図形とラベルの両方が読まれると、同じものを二度言うことになる。
 */
export function FigureView({ figure }: { figure: Figure }) {
  return (
    <svg
      viewBox={`0 0 ${FIGURE_BOX} ${FIGURE_BOX}`}
      aria-hidden="true"
      className="h-full w-full"
    >
      <path
        d={SHAPES[figure.shape].path}
        fill={COLORS[figure.color].hex}
        transform={`rotate(${figure.rotation} ${FIGURE_BOX / 2} ${FIGURE_BOX / 2})`}
      />
    </svg>
  )
}
