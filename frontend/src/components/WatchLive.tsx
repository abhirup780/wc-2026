import { useState } from 'react';

const STREAM_SRC = 'https://junkieembeds.pages.dev/embed/fox-usa';

export default function WatchLive() {
  const [loaded, setLoaded] = useState(false);

  return (
    <div>
      <div className="mb-3">
        <h2 className="font-display text-lg font-bold text-fifa-navy dark:text-white">Watch Live</h2>
        <p className="text-xs text-gray-500 dark:text-white/55">
          Live broadcast stream — it may take a few moments to load.
        </p>
      </div>

      <div
        className="relative w-full overflow-hidden rounded-xl bg-black ring-1 ring-black/10 dark:ring-white/10"
        style={{ aspectRatio: '16 / 9' }}
      >
        {!loaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
            <svg className="animate-spin" style={{ width: 28, height: 28 }} viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <span className="text-xs font-medium tracking-wide">Loading stream…</span>
          </div>
        )}
        <iframe
          src={STREAM_SRC}
          title="Live broadcast"
          className="absolute inset-0 h-full w-full"
          frameBorder={0}
          scrolling="no"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          onLoad={() => setLoaded(true)}
        />
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-gray-400 dark:text-white/40">
        Stream is provided by a third party and is not hosted or controlled by this site. If the player
        is blank, give it a moment to buffer or refresh the page.
      </p>
    </div>
  );
}
