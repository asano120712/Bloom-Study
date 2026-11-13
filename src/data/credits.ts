/**
 * このアプリで使っている、ほかの人が作ったデータ(このアプリについて の画面に出す)。
 *
 * CC BY-SA のデータは、作った人・ライセンス・ライセンスへのリンクを、アプリの中に出すのが使う条件。
 * データを足したら、ここにも足すこと(scripts/ の生成物の _source.credit と合わせる)。
 */
export interface Credit {
  name: string
  /** 作った人(著作権者) */
  author: string
  /** 何に使っているか */
  usedFor: string
  url: string
  /** ライセンスが決まっていないもの(MNIST・EMNIST の配布元の表示に従う)は無し */
  license?: { name: string; url: string }
}

const CC_BY_SA_3 = { name: 'CC BY-SA 3.0', url: 'https://creativecommons.org/licenses/by-sa/3.0/deed.ja' }
const CC_BY_SA_4 = { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/deed.ja' }

export const CREDITS: Credit[] = [
  {
    name: 'KanjiVG',
    author: 'Copyright (C) 2009-2013 Ulrich Apel',
    usedFor: '漢字・ひらがなのお手本の線と書き順、漢字のパズルの部品',
    url: 'https://kanjivg.tagaini.net/',
    license: CC_BY_SA_3,
  },
  {
    name: 'JMdict / KANJIDIC2 / KRADFILE',
    author: 'Electronic Dictionary Research and Development Group',
    usedFor: '漢字の読み・熟語・部品、英単語の意味',
    url: 'https://www.edrdg.org/edrdg/licence.html',
    license: CC_BY_SA_4,
  },
  {
    name: 'NGSL (New General Service List)',
    author: 'Browne, C., Culligan, B., & Phillips, J.',
    usedFor: '出題する英単語の選び方',
    url: 'https://www.newgeneralservicelist.com/',
    license: CC_BY_SA_4,
  },
  {
    name: 'MNIST',
    author: 'Yann LeCun, Corinna Cortes, Christopher J.C. Burges',
    usedFor: '手書きの数字を読み取る仕組みの学習',
    url: 'https://yann.lecun.com/exdb/mnist/',
    license: CC_BY_SA_3,
  },
  {
    name: 'EMNIST',
    author: 'Cohen, G., Afshar, S., Tapson, J., & van Schaik, A. (2017) / NIST',
    usedFor: '手書きの英字を読み取る仕組みの学習',
    url: 'https://www.nist.gov/itl/products-and-services/emnist-dataset',
  },
]

export const COPYRIGHT = '© 2026 Bloom Study'
