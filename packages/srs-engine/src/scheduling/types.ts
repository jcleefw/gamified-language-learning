import type { FsrsCardState } from '../types.js'

export interface ReviewResult {
  nextIntervalDays: number
  updatedFsrsState: FsrsCardState
  isLapse: boolean
}
