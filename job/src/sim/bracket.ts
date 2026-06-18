/**
 * WC 2026 knockout bracket — re-exported from @wc2026/shared so the job and the
 * frontend dice sim use one identical bracket definition (no drift).
 */

export {
  R32_MATCHES,
  R16_PAIRS,
  QF_PAIRS,
  SF_PAIRS,
  THIRD_PLACE_PAIR,
  BEST_THIRD_POOLS,
  resolveSlot,
  assignBestThird,
} from '@wc2026/shared';

export type { Slot, R32Match } from '@wc2026/shared';
