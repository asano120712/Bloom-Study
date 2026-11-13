import { prefersReducedMotion } from '@/utils/motion'

/** ロゴの花びら〜中心と同じ配色を、明るい順に並べる */
const DOT_COLORS = ['#5DCAA5', '#3FBE93', '#0F6E56']

/**
 * 3点のドットが順に跳ねるローディングマーク。
 * オープニングのロゴ下など、花のモチーフと重ねたくない場所で使う。
 */
export function LoadingDots({ label = '読み込み中' }: { label?: string }) {
  const isStill = prefersReducedMotion()

  return (
    <div role="status" aria-label={label} className="flex items-center gap-2">
      {DOT_COLORS.map((color, index) => (
        <span
          key={color}
          className={`size-2.5 rounded-full ${isStill ? 'opacity-60' : 'animate-loading-dot'}`}
          style={{ backgroundColor: color, animationDelay: `${index * 160}ms` }}
        />
      ))}
    </div>
  )
}
