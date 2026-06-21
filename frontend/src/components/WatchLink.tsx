/**
 * Subtle "Watch live" CTA shown on live / about-to-kick-off matches on the
 * Scores page. Points all requests to a single external stream aggregator — no
 * per-match links to maintain. Intentionally low-key.
 */
const WATCH_URL = 'https://watchfooty.su/en/football';

export default function WatchLink({ className = '' }: { className?: string }) {
  return (
    <a
      href={WATCH_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-300 transition-colors ${className}`}
    >
      <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor"><path d="M5 3l14 9-14 9z" /></svg>
      Watch live
      <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 opacity-70" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 17 17 7M9 7h8v8" />
      </svg>
    </a>
  );
}
