import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  MATCHES, NETWORKS, STREAMS, onAirFor, nextFor, phaseOf,
  type Network, type WatchMatch,
} from '../watchSchedule.ts';
import { useESPNLive, type ESPNLiveMatch } from '../api.ts';
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

// ─── ESPN overlay ──────────────────────────────────────────────────────────────
// ESPN's live scoreboard carries the same FIFA codes we use, so a schedule match
// can be matched on home/away. The reversed lookup (and score swap) guards
// against ESPN listing the fixture with the opposite home/away orientation.

type LiveInfo = ESPNLiveMatch & { home: number | null; away: number | null };

function liveFor(m: WatchMatch, espn: ESPNLiveMatch[]): LiveInfo | null {
  if (!isTeamCode(m.home) || !isTeamCode(m.away)) return null;
  const direct = espn.find(e => e.homeCode === m.home && e.awayCode === m.away);
  if (direct) return { ...direct, home: direct.homeScore, away: direct.awayScore };
  const rev = espn.find(e => e.homeCode === m.away && e.awayCode === m.home);
  if (rev) return { ...rev, home: rev.awayScore, away: rev.homeScore };
  return null;
}

// True live state, preferring ESPN ground-truth over the published schedule.
function isLiveNow(network: Network, now: number, espn: ESPNLiveMatch[]): boolean {
  const onAir = onAirFor(network, now);
  if (!onAir) return false;
  const live = liveFor(onAir.match, espn);
  if (live) return live.status === 'live';
  return onAir.phase === 'live';
}

// ─── Team row (flag/slot badge + name + optional score) ────────────────────────

function TeamRow({ code, size = 26, score, win }: { code: string; size?: number; score?: number | null; win?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      {isTeamCode(code) ? (
        <Flag code={code} size={size} />
      ) : (
        <span
          className="flex items-center justify-center rounded bg-gray-800 text-gray-400 font-mono text-[10px] font-bold flex-shrink-0"
          style={{ width: size, height: Math.round(size * 0.67) }}
        >
          {code}
        </span>
      )}
      <span className={`flex-1 min-w-0 truncate text-sm leading-tight ${win ? 'font-bold text-gray-50' : 'font-semibold text-gray-200'}`}>
        {teamName(code)}
      </span>
      {score != null && (
        <span className={`text-lg font-bold tabular-nums w-5 text-right ${win ? 'text-gray-50' : 'text-gray-400'}`}>
          {score}
        </span>
      )}
    </div>
  );
}

// ─── Status pill ───────────────────────────────────────────────────────────────

function StatusPill(
  { network, now, espn }: { network: Network; now: number; espn: ESPNLiveMatch[] },
) {
  const onAir = onAirFor(network, now);
  if (!onAir) {
    const next = nextFor(network, now);
    return next
      ? <span className="text-[11px] text-gray-500 tabular-nums">in {fmtCountdown(next.kickoff - now)}</span>
      : <span className="text-[11px] text-gray-500">—</span>;
  }
  const live = liveFor(onAir.match, espn);
  if (live?.status === 'live') {
    return (
      <span className="flex items-center gap-1.5 bg-green-950 border border-green-800/60 text-green-300 text-[11px] font-semibold px-2.5 py-1 rounded-full">
        <span className="live-dot" /> {live.clock || 'LIVE'}
      </span>
    );
  }
  if (live?.status === 'finished' || onAir.phase === 'post') {
    return <span className="badge-finished">Full time</span>;
  }
  if (onAir.phase === 'live') {
    return (
      <span className="flex items-center gap-1.5 bg-green-950 border border-green-800/60 text-green-300 text-[11px] font-semibold px-2.5 py-1 rounded-full">
        <span className="live-dot" /> LIVE
      </span>
    );
  }
  // pre-match
  return <span className="badge-scheduled tabular-nums">Kick-off in {fmtCountdown(onAir.match.kickoff - now)}</span>;
}

// ─── Stream card (labelled by its match — never by channel name) ───────────────

function StreamCard(
  { network, now, espn, selected, onSelect }:
  { network: Network; now: number; espn: ESPNLiveMatch[]; selected: boolean; onSelect: () => void },
) {
  const onAir = onAirFor(network, now);
  const next = nextFor(network, now);
  const m = onAir?.match ?? next ?? null;
  const live = m ? liveFor(m, espn) : null;
  const showScore = !!live && (live.status === 'live' || live.status === 'finished');
  const hW = showScore && (live!.home ?? -1) > (live!.away ?? -1);
  const aW = showScore && (live!.away ?? -1) > (live!.home ?? -1);

  const phaseLabel = onAir
    ? (onAir.phase === 'live' ? 'On air now' : onAir.phase === 'pre' ? 'Starting soon' : 'Replay window')
    : 'Up next';

  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={`text-left rounded-xl border p-3.5 transition-colors ${
        selected
          ? 'border-fifa-gold bg-gray-900 ring-1 ring-fifa-gold/40'
          : 'border-gray-800 bg-gray-900/50 hover:border-gray-600'
      }`}
    >
      {/* header — selection state + phase on the left, live/countdown on the right */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold">
          {selected && (
            <span className="flex items-center gap-1 text-fifa-gold">
              <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor"><path d="M5 3l14 9-14 9z" /></svg>
              Watching
            </span>
          )}
          <span className="text-gray-500">{phaseLabel}</span>
        </span>
        <StatusPill network={network} now={now} espn={espn} />
      </div>

      {/* match */}
      {m ? (
        <>
          <div className="space-y-1.5">
            <TeamRow code={m.home} score={showScore ? live!.home : null} win={hW} />
            <TeamRow code={m.away} score={showScore ? live!.away : null} win={aW} />
          </div>
          <div className="mt-2.5 pt-2.5 hairline-t flex items-center justify-between text-[11px] text-gray-500">
            <span>{m.stage}</span>
            <span className="tabular-nums">
              {onAir ? `${fmtClock(m.kickoff)} · ${m.venue}` : `${fmtDay(m.kickoff)} · ${fmtClock(m.kickoff)}`}
            </span>
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-500 py-2">No more matches scheduled.</p>
      )}
    </button>
  );
}

// ─── Upcoming list (both streams) ──────────────────────────────────────────────

function UpcomingList({ now }: { now: number }) {
  const upcoming = useMemo(
    () => MATCHES.filter(m => !phaseOf(m, now) && m.kickoff > now).slice(0, 8),
    [now],
  );
  if (upcoming.length === 0) return null;

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
                <TeamRow code={m.home} size={20} />
                <TeamRow code={m.away} size={20} />
              </div>
              <span className="text-[11px] text-gray-400 tabular-nums whitespace-nowrap shrink-0">
                {fmtClock(m.kickoff)}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export default function WatchLive() {
  const { matches: espn } = useESPNLive(30_000);
  const [searchParams] = useSearchParams();
  const [now, setNow] = useState(() => Date.now());
  const [channel, setChannel] = useState<Network>(() => {
    // Deep-link from the Scores page carries a match number (#/watch?m=51) — no
    // channel name in the URL. Resolve it to the stream that carries that match.
    const mParam = searchParams.get('m');
    if (mParam) {
      const match = MATCHES.find(x => String(x.no) === mParam);
      if (match) return match.network;
    }
    const t = Date.now();
    const inPlay = NETWORKS.find(n => onAirFor(n, t)?.phase === 'live');
    if (inPlay) return inPlay;
    return NETWORKS.find(n => onAirFor(n, t)) ?? NETWORKS[0];
  });
  const [loaded, setLoaded] = useState(false);

  // Tick every 30s so badges, countdowns and live windows stay current.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Reset the loading overlay whenever the stream (and thus the iframe) changes.
  useEffect(() => setLoaded(false), [channel]);

  const liveCount = useMemo(
    () => NETWORKS.filter(n => isLiveNow(n, now, espn)).length,
    [now, espn],
  );

  // What the currently-selected stream is showing, for the caption under the player.
  const selectedMatch = onAirFor(channel, now)?.match ?? null;

  return (
    <div className="space-y-5 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Watch Live</h2>
          <p className="text-xs text-gray-500">Two matches can run at once — pick the one you want to watch.</p>
        </div>
        {liveCount === 2 && (
          <span className="flex items-center gap-1.5 bg-green-950 border border-green-800/60 text-green-300 text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
            <span className="live-dot" /> 2 matches live
          </span>
        )}
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
            <span className="text-xs font-medium tracking-wide">Loading stream… this can take a moment</span>
          </div>
        )}
        <iframe
          key={channel}
          src={STREAMS[channel]}
          title="Live stream"
          className="absolute inset-0 h-full w-full"
          frameBorder={0}
          scrolling="no"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          onLoad={() => setLoaded(true)}
        />
      </div>

      {/* Caption — which match the player is showing (by teams, not channel) */}
      <p className="-mt-2 text-center text-xs text-gray-400">
        {selectedMatch
          ? <>Now watching · <span className="text-gray-200 font-semibold">{teamName(selectedMatch.home)} v {teamName(selectedMatch.away)}</span></>
          : 'Live stream'}
      </p>

      {/* Both streams at a glance — tap either match to watch it */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {NETWORKS.map(n => (
          <StreamCard
            key={n}
            network={n}
            now={now}
            espn={espn}
            selected={channel === n}
            onSelect={() => setChannel(n)}
          />
        ))}
      </div>

      {/* Coming up across both streams */}
      <UpcomingList now={now} />

      <p className="text-[11px] leading-relaxed text-gray-500">
        Live scores via ESPN. Streams are provided by a third party and are not hosted or controlled by this site.
        Coverage appears from about an hour before kick-off through full time. If the player is blank, give it a
        moment to buffer, or pick the other match and switch back.
      </p>
    </div>
  );
}
