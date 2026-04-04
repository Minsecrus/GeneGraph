import type { ReproductionModel } from './types'

export const DIPLOID_BIPARENTAL_MODEL: ReproductionModel = {
  id: 'diploid-biparental',
  label: 'Diploid Biparental',
  description: '双方各自产生配子，受精后形成二倍体合子。',
  supportsPloidy: ['diploid'],
}

export const HAPLODIPLOID_MODEL: ReproductionModel = {
  id: 'haplodiploid',
  label: 'Haplodiploid',
  description: '卵可单独发育为单倍体，也可受精形成二倍体。',
  supportsPloidy: ['haploid', 'diploid'],
}
