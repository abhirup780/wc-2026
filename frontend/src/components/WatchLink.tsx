import { findAirByTeams } from '../watchSchedule.ts';

/**
 * A "Watch live" CTA for a fixture, shown on the Scores page when the match is
 * inside its broadcast window. Deep-links to the Watch tab with the right
 * channel pre-selected (#/watch?ch=FOX|FS1). Renders nothing when the fixture
 * isn't on air, so callers can drop it in unconditionally.
 */
export default function WatchLink({ homeId, awayId, className = '' }: { homeId: string; awayId: string; className?: string }) {
  const air = findAirByTeams(homeId, awayId, Date.now());
  if (!air) return null;

  const { match, phase } = air;
  const label = phase === 'pre' ? `Watch on ${match.network}` : `Watch live on ${match.network}`;

  return (
    <a
      href={`#/watch?ch=${match.network}`}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-fifa-gold text-fifa-navy hover:brightness-95 transition-[filter] ${className}`}
    >
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
        <path d="M5 3l14 9-14 9z" />
      </svg>
      {label}
    </a>
  );
}
