/**
 * Write canonical JSON artifacts to the output directory.
 * These files are committed (GitHub Actions) or written to R2/KV (Cloudflare).
 */

import fs from 'fs/promises';
import path from 'path';
import type { Fixtures, Standings, Scores, Forecast, Meta, Prediction } from '@wc2026/shared';

export interface Artifacts {
  fixtures: Fixtures;
  standings: Standings;
  scores: Scores;
  forecast: Forecast;
  prediction: Prediction;
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
    writeJson(path.join(outputDir, 'meta.json'), artifacts.meta),
  ]);

  console.log(`✓ Artifacts written to ${outputDir}`);
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/** Load cached artifacts from a previous run */
export async function loadCachedArtifacts(cacheDir: string): Promise<Artifacts | null> {
  try {
    const [fixtures, standings, scores, forecast, meta] = await Promise.all([
      readJson<Fixtures>(path.join(cacheDir, 'fixtures.json')),
      readJson<Standings>(path.join(cacheDir, 'standings.json')),
      readJson<Scores>(path.join(cacheDir, 'scores.json')),
      readJson<Forecast>(path.join(cacheDir, 'forecast.json')),
      readJson<Meta>(path.join(cacheDir, 'meta.json')),
    ]);
    return { fixtures, standings, scores, forecast, meta };
  } catch {
    return null;
  }
}

async function readJson<T>(filePath: string): Promise<T> {
  const text = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(text) as T;
}
