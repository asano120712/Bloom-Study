import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { copyOf, type Copy } from '@/data/copy'
import { readAudienceMode } from '@/services/audienceMode'
import { TOP_PATH, type AudienceMode } from '@/types'

/**
 * いま使っているモード。
 *
 * トップに居るときは開いているURL、それ以外の画面では保存した設定を見る。
 * 切り替えは必ずトップへの移動をともなうので、URLが変わるたびに見直せば足りる。
 */
export function useAudienceMode(): AudienceMode {
  const { pathname } = useLocation()
  return useMemo(() => {
    if (pathname === TOP_PATH.kids) return 'kids'
    if (pathname === TOP_PATH.adult) return 'adult'
    return readAudienceMode()
  }, [pathname])
}

/** そのモードの言葉。画面はここから文字列を受け取る(src/data/copy.ts) */
export function useCopy(): Copy {
  return copyOf(useAudienceMode())
}
