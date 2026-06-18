import { useCallback } from 'react';
import { usePolled, fetchMeta } from '../api.ts';

export default function Footer() {
  const fetcher = useCallback(() => fetchMeta(), []);
  const { data: meta } = usePolled(fetcher, 300_000);

  return (
    <footer className="border-t border-gray-800 bg-gray-950 py-4 mt-8">
      <div className="max-w-5xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
        <div>
          <span className="text-gray-500">WC 2026 Forecast</span>
          {meta && (
            <>
              {' · '}source: <span className="text-gray-400">{meta.dataSource}</span>
              {' · '}updated:{' '}
              <span className="text-gray-400">
                {new Date(meta.lastUpdated).toLocaleString()}
              </span>
              {' · '}
              {meta.simCount.toLocaleString()} sims · seed {meta.seed}
            </>
          )}
        </div>
        <div>
          Probabilities update after each match ·{' '}
          <a
            href="https://github.com"
            className="text-gray-500 hover:text-gray-300 transition-colors"
            rel="noopener noreferrer"
          >
            source
          </a>
        </div>
      </div>
    </footer>
  );
}
