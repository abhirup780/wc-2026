import { useEffect, useMemo, useState } from 'react';
import {
  MATCHES, NETWORKS, STREAMS, onAirFor, nextFor, phaseOf,
  type Network, type WatchMatch, type MatchPhase,
} from '../watchSchedule.ts';
import { FIFA_NAMES, teamName } from '../utils.ts';
import Flag from './Flag.tsx';

const isTeamCode = (code: string) => code in FIFA_NAMES;

function fmtClock(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function fmtDay(ms: number) {
  const d = new Date(ms);
  const today = new Date();
  const tomorrow = new Date(Date.now() + 864e5);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, tomorrow)) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtCountdown(ms: number) {
  if (ms <= 0) return 'now';
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─── Team name + flag (or bracket-slot badge) ──────────────────────────────────

function Side({ code, size = 24 }: { code: string; size?: number }) {
  return (
    <span className="flex items-center gap-2 min-w-0">
      {isTeamCode(code) ? (
        <Flag code={code} size={size} />
      ) : (
        <span
          className="flex items-center justify-center rounded bg-gray-800 text-gray-400 font-mono text-[10px] font-bold px-1 flex-shrink-0"
          style={{ width: size, height: Math.round(size * 0.67) }}
        >
          {code}
        </span>
      )}
      <span className="truncate text-sm font-semibold text-gray-100">{teamName(code)}</span>
    </span>
  );
}

// ─── Phase badge ───────────────────────────────────────────────────────────────

function PhaseBadge({ phase, now, kickoff }: { phase: MatchPhase; now: number; kickoff: number }) {
  if (phase === 'live') {
    return (
      <span className="flex items-center gap-1.5 bg-green-950 border border-green-800/60 text-green-300 text-[11px] font-semibold px-2.5 py-1 rounded-full">
        <span className="live-dot" /> LIVE
      </span>
    );
  }
  if (phase === 'pre') {
    return (
      <span className="badge-scheduled tabular-nums">Kick-off in {fmtCountdown(kickoff - now)}</span>
    );
  }
  return <span className="badge-finished">Just finished</span>;
}

// ─── Channel tab ───────────────────────────────────────────────────────────────

function ChannelTab(
  { network, active, live, onSelect }:
  { network: Network; active: boolean; live: boolean; onSelect: () => void },
) {
  return (
    <button
      onClick={onSelect}
      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold tracking-wide transition-colors border ${
        active
          ? 'bg-fifa-gold text-fifa-navy border-fifa-gold'
          : 'text-gray-300 border-gray-800 hover:border-gray-600 hover:text-gray-100'
      }`}
    >
      {network}
      {live && (
        <span className={`flex items-center gap-1 text-[10px] font-semibold ${active ? 'text-fifa-navy/80' : 'text-green-400'}`}>
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${active ? 'bg-fifa-navy/80' : 'bg-green-400'}`} /> LIVE
        </span>
      )}
    </button>
  );
}

// ─── On-air / up-next info card for the selected channel ───────────────────────

function NowCard({ network, now }: { network: Network; now: number }) {
  const onAir = onAirFor(network, now);
  const next = nextFor(network, now);

  if (onAir) {
    const { match: m, phase } = onAir;
    return (
      <div className="card">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold">
            {phase === 'live' ? 'On air now' : phase === 'pre' ? 'Up next' : 'Replay window'} · {network}
          </span>
          <PhaseBadge phase={phase} now={now} kickoff={m.kickoff} />
        </div>
        <div className="space-y-1.5">
          <Side code={m.home} size={28} />
          <Side code={m.away} size={28} />
        </div>
        <div className="mt-3 pt-3 hairline-t flex items-center justify-between text-[11px] text-gray-500">
          <span>{m.stage}</span>
          <span className="tabular-nums">{fmtClock(m.kickoff)} · {m.venue}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <span className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold">No live match · {network}</span>
      {next ? (
        <div className="mt-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] text-gray-500">Next on {network}</span>
            <span className="badge-scheduled tabular-nums">in {fmtCountdown(next.kickoff - now)}</span>
          </div>
          <div className="space-y-1.5">
            <Side code={next.home} size={28} />
            <Side code={next.away} size={28} />
          </div>
          <div className="mt-3 pt-3 hairline-t flex items-center justify-between text-[11px] text-gray-500">
            <span>{next.stage}</span>
            <span className="tabular-nums">{fmtDay(next.kickoff)} · {fmtClock(next.kickoff)}</span>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-gray-500">No further matches scheduled on {network}.</p>
      )}
    </div>
  );
}

// ─── Upcoming list (both channels, next few) ───────────────────────────────────

function UpcomingList({ now }: { now: number }) {
  const upcoming = useMemo(
    () => MATCHES.filter(m => !phaseOf(m, now) && m.kickoff > now).slice(0, 8),
    [now],
  );
  if (upcoming.length === 0) return null;

  // Group by day for readable headers.
  const groups: { day: string; items: WatchMatch[] }[] = [];
  for (const m of upcoming) {
    const day = fmtDay(m.kickoff);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(m);
    else groups.push({ day, items: [m] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Coming up</span>
        <div className="flex-1 h-px bg-gray-800/80" />
      </div>
      {groups.map(g => (
        <div key={g.day} className="space-y-1.5">
          <p className="text-[11px] text-gray-500 font-semibold pl-1 uppercase tracking-widest">{g.day}</p>
          {g.items.map(m => (
            <div key={m.no} className="flex items-center gap-3 rounded-xl border border-gray-800/60 bg-gray-900/50 px-3.5 py-2.5">
              <div className="flex-1 min-w-0 space-y-1">
                <Side code={m.home} size={20} />
                <Side code={m.away} size={20} />
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  m.network === 'FOX' ? 'bg-blue-950 text-blue-300' : 'bg-purple-950 text-purple-300'
                }`}>
                  {m.network}
                </span>
                <span className="text-[11px] text-gray-400 tabular-nums whitespace-nowrap">{fmtClock(m.kickoff)}</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export default function WatchLive() {
  const [now, setNow] = useState(() => Date.now());
  const [channel, setChannel] = useState<Network>(() => {
    const t = Date.now();
    // Default to a channel that's live; prefer the one actually in-progress.
    const inPlay = NETWORKS.find(n => onAirFor(n, t)?.phase === 'live');
    if (inPlay) return inPlay;
    const onAir = NETWORKS.find(n => onAirFor(n, t));
    return onAir ?? 'FOX';
  });
  const [loaded, setLoaded] = useState(false);

  // Tick every 30s so badges, countdowns and live windows stay current.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Reset the loading overlay whenever the channel (and thus the iframe) changes.
  useEffect(() => setLoaded(false), [channel]);

  const liveNetworks = useMemo(
    () => NETWORKS.filter(n => onAirFor(n, now)?.phase === 'live'),
    [now],
  );

  return (
    <div className="space-y-5 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Watch Live</h2>
          <p className="text-xs text-gray-500">Live FOX &amp; FS1 broadcast — the right match for each channel.</p>
        </div>
        {liveNetworks.length === 2 && (
          <span className="flex items-center gap-1.5 bg-green-950 border border-green-800/60 text-green-300 text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
            <span className="live-dot" /> 2 matches live
          </span>
        )}
      </div>

      {/* Channel selector */}
      <div className="flex gap-2">
        {NETWORKS.map(n => (
          <ChannelTab
            key={n}
            network={n}
            active={channel === n}
            live={liveNetworks.includes(n)}
            onSelect={() => setChannel(n)}
          />
        ))}
      </div>

      {/* Player */}
      <div
        className="relative w-full overflow-hidden rounded-xl bg-black ring-1 ring-black/20"
        style={{ aspectRatio: '16 / 9' }}
      >
        {!loaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
            <svg className="animate-spin" style={{ width: 28, height: 28 }} viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <span className="text-xs font-medium tracking-wide">Loading {channel} stream… this can take a moment</span>
          </div>
        )}
        <iframe
          key={channel}
          src={STREAMS[channel]}
          title={`${channel} live stream`}
          className="absolute inset-0 h-full w-full"
          frameBorder={0}
          scrolling="no"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          onLoad={() => setLoaded(true)}
        />
      </div>

      {/* What's on the selected channel */}
      <NowCard network={channel} now={now} />

      {/* Coming up across both channels */}
      <UpcomingList now={now} />

      <p className="text-[11px] leading-relaxed text-gray-500">
        Streams are provided by a third party and are not hosted or controlled by this site. Coverage appears
        from about an hour before kick-off through full time. If the player is blank, give it a moment to buffer
        or switch channels and back.
      </p>
    </div>
  );
}
