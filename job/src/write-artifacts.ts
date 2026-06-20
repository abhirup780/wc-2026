/**
 * Write canonical JSON artifacts to the output directory.
 * These files are committed (GitHub Actions) or written to R2/KV (Cloudflare).
 */

import fs from 'fs/promises';
import path from 'path';
import type { Fixtures, Standings, Scores, Forecast, Meta, Prediction, Upcoming, R32Projection } from '@wc2026/shared';

export interface Artifacts {
  fixtures: Fixtures;
  standings: Standings;
  scores: Scores;
  forecast: Forecast;
  prediction: Prediction;
  upcoming: Upcoming;
  r32: R32Projection;
  meta: Meta;
}

export async function writeArtifacts(artifacts: Artifacts, outputDir: string): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });

  await Promise.all([
    writeJson(path.join(outputDir, 'fixtures.json'), artifacts.fixtures),
    writeJson(path.join(outputDir, 'standings.json'), artifacts.standings),
    writeJson(path.join(outputDir, 'scores.json'), artifacts.scores),
    writeJson(path.join(outputDir, 'forecast.json'), artifacts.forecast),
    writeJson(path.join(outputDir, 'prediction.json'), artifacts.prediction),
    writeJson(path.join(outputDir, 'upcoming.json'), artifacts.upcoming),
    writeJson(path.join(outputDir, 'r32.json'), artifacts.r32),
    writeJson(path.join(outputDir, 'meta.json'), artifacts.meta),
  ]);

  console.log(`✓ Artifacts written to ${outputDir}`);
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}
