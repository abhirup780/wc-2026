import { useCallback } from 'react';
import { usePolled, fetchMeta } from '../api.ts';

export default function Footer() {
  const fetcher = useCallback(() => fetchMeta(), []);
  const { data: meta } = usePolled(fetcher, 300_000);

  return (
    <footer className="border-t border-gray-800 bg-gray-950 py-4 mt-8">
      <div className="max-w-5xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <div>
          <span className="text-gray-400 font-display font-medium">WC 2026 Forecast</span>
          {meta && (
            <>
              {' · '}updated{' '}
              <span className="text-gray-400">
                {new Date(meta.lastUpdated).toLocaleString()}
              </span>
            </>
          )}
        </div>
        <div>
          Updates after every match ·{' '}
          <a
            href="https://github.com/abhirup780/wc-2026"
            className="text-gray-500 hover:text-gray-300 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            source
          </a>
        </div>
      </div>
    </footer>
  );
}
