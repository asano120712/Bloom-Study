import type { Genre } from '@/types'

export const GENRES: Genre[] = [
  {
    id: 'english',
    label: '英単語',
    description: '日本語の出題語を見て、英単語を思い出す',
    promptCaption: 'この言葉を思い出そう',
    // 手書きを先頭に置く。書いて思い出すのが基本のこたえかたなので、
    // シートでも最初に目に入る位置にする(並び順がそのままシートの並びになる)
    inputModes: ['handwriting', 'typing'],
    defaultInputMode: 'handwriting',
    // 英語ノートの罫線に置く。大文字・小文字の高さの違いまで手本にしたいため
    answerGuide: 'baseline',
    speechLang: 'en-US',
  },
  {
    id: 'kanji',
    label: '漢字',
    description: '熟語の ◯ に入る漢字を書いて思い出す',
    promptCaption: '◯ に入る漢字を思い出そう',
    // 漢字を打つには IME が要り、変換候補に答えが出てしまうためタイピングは置かない
    inputModes: ['handwriting', 'assemble'],
    defaultInputMode: 'handwriting',
    // マスに1文字ずつ入れる。中心と字の大きさを合わせるのが漢字の手本なので
    answerGuide: 'grid',
  },
]

export function findGenre(id: string): Genre | undefined {
  return GENRES.find((genre) => genre.id === id)
}
