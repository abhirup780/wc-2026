import path from 'path';
import { fileURLToPath } from 'url';
import type { ModelConfig } from '@wc2026/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  // @ts-ignore
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(path.resolve(__dirname, '../../.env'));
  }
} catch (e) {
  // Ignore missing .env file in CI
}

export const CONFIG = {
  outputDir: process.env.OUTPUT_DIR || path.resolve(__dirname, '../../frontend/public/data'),

  oddsApiKey:  process.env.ODDS_API_KEY ?? '',
  oddsApiBase: 'https://api.the-odds-api.com/v4',

  // Weight of outright tournament-winner market odds in pChampion (0–1).
  // 0.6 = 60% market, 40% Elo model.
  outrightOddsWeight: Number(process.env.OUTRIGHT_ODDS_WEIGHT ?? '0.6'),

  simCount: Number(process.env.SIM_COUNT ?? '10000'),
  seed:     Number(process.env.SIM_SEED ?? String(Date.now() % 2 ** 32)),

  model: {
    type:           (process.env.MODEL_TYPE ?? 'poisson') as 'poisson' | 'elo',
    baseGoalsRate:  Number(process.env.BASE_GOALS_RATE ?? '1.25'),
    blendOddsWeight: Number(process.env.BLEND_ODDS_WEIGHT ?? '0.6'),
    knockoutGoalsMultiplier: Number(process.env.KO_GOALS_MULTIPLIER ?? '0.85'),
    formVolatility: Number(process.env.FORM_VOLATILITY ?? '0.05'),
    eloRegressionFactor: Number(process.env.ELO_REGRESSION ?? '0.90'),
  } satisfies ModelConfig,

  version: '1.0.0',
};
