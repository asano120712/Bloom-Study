import type { Genre } from '@/types'

export const GENRES: Genre[] = [
  {
    id: 'english',
    label: '英単語',
    description: '日本語の出題語を見て、英単語を思い出す',
    inputModes: ['typing', 'handwriting'],
    defaultInputMode: 'typing',
    speechLang: 'en-US',
  },
  {
    id: 'kanji',
    label: '漢字',
    description: '読みを見て、漢字を書いて思い出す',
    // 漢字を打つには IME が要り、変換候補に答えが出てしまうためタイピングは置かない
    inputModes: ['handwriting'],
    defaultInputMode: 'handwriting',
  },
]

export function findGenre(id: string): Genre | undefined {
  return GENRES.find((genre) => genre.id === id)
}
