import { useCallback } from 'react';
import { usePolled, fetchPrediction } from '../api.ts';
import { teamName } from '../utils.ts';
import Flag from './Flag.tsx';
import type { PredictedMatch } from '@wc2026/shared';

// ─── Bracket topology ─────────────────────────────────────────────────────────
// Which two earlier matches feed each knockout match (winners advance).
// Mirrors R16_PAIRS / QF_PAIRS / SF_PAIRS in job/src/sim/bracket.ts.

const FEEDERS: Record<string, [string, string]> = {
  'R16-01': ['R32-02', 'R32-05'],
  'R16-02': ['R32-01', 'R32-03'],
  'R16-03': ['R32-04', 'R32-06'],
  'R16-04': ['R32-07', 'R32-08'],
  'R16-05': ['R32-11', 'R32-12'],
  'R16-06': ['R32-09', 'R32-10'],
  'R16-07': ['R32-14', 'R32-16'],
  'R16-08': ['R32-13', 'R32-15'],
  'QF-01': ['R16-01', 'R16-02'],
  'QF-02': ['R16-05', 'R16-06'],
  'QF-03': ['R16-03', 'R16-04'],
  'QF-04': ['R16-07', 'R16-08'],
  'SF-01': ['QF-01', 'QF-02'],
  'SF-02': ['QF-03', 'QF-04'],
  'FINAL-01': ['SF-01', 'SF-02'],
};
const ROOT = 'FINAL-01';

// ─── Match card ───────────────────────────────────────────────────────────────

function TeamRow({ code, goals, win }: { code: string; goals: number | null; win: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-1.5 px-1.5 py-1 ${win ? 'text-white font-semibold' : 'text-gray-500'}`}>
      <div className="flex items-center gap-1.5 min-w-0">
        <Flag code={code} size={15} />
        <span className="truncate text-[11px]">{code}</span>
      </div>
      <span className={`w-3.5 text-center text-[11px] tabular-nums shrink-0 ${win ? 'text-fifa-gold' : ''}`}>
        {goals ?? '-'}
      </span>
    </div>
  );
}

function MatchCard({ m }: { m?: PredictedMatch }) {
  if (!m) {
    return <div className="w-28 h-[52px] rounded border border-dashed border-gray-800 bg-gray-900/40" />;
  }
  const homeWin = m.winnerId === m.homeId;
  const pens = m.homeGoals === m.awayGoals && m.winnerId;
  return (
    <div className="w-28 rounded border border-gray-700/60 bg-gray-800/40 overflow-hidden shrink-0">
      <TeamRow code={m.homeId} goals={m.homeGoals} win={homeWin} />
      <div className="border-t border-gray-700/40" />
      <TeamRow code={m.awayId} goals={m.awayGoals} win={!homeWin} />
      {pens && (
        <div className="text-[9px] text-gray-600 text-center border-t border-gray-700/30 leading-tight py-px">
          {m.winnerId} pens
        </div>
      )}
    </div>
  );
}

// ─── Recursive tree ─────────────────────────────────────────────────────────--
// Balanced binary tree: leaves (R32) on the left, final on the right.
// Parents vertically center against their two feeders; CSS borders draw the
// connecting elbows.

function Node({ id, byId }: { id: string; byId: Map<string, PredictedMatch> }) {
  const kids = FEEDERS[id];
  if (!kids) {
    return (
      <div className="flex items-center py-1">
        <MatchCard m={byId.get(id)} />
      </div>
    );
  }
  return (
    <div className="flex items-stretch">
      {/* feeders */}
      <div className="flex flex-col justify-center">
        <div className="flex-1 flex items-center"><Node id={kids[0]} byId={byId} /></div>
        <div className="flex-1 flex items-center"><Node id={kids[1]} byId={byId} /></div>
      </div>
      {/* connector: vertical bus spans the middle 50% (feeders sit at 25%/75%
          in a balanced tree); horizontal stub reaches the parent at the midpoint */}
      <div className="flex flex-col w-4 self-stretch shrink-0">
        <div className="grow" />
        <div className="grow-[2] border-l border-gray-700 relative">
          <div className="absolute top-1/2 left-0 w-4 h-px bg-gray-700" />
        </div>
        <div className="grow" />
      </div>
      {/* parent match */}
      <div className="flex items-center">
        <MatchCard m={byId.get(id)} />
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────--

const COL_LABELS = ['Round of 32', 'Round of 16', 'Quarters', 'Semis', 'Final'];

export default function Bracket() {
  const fetcher = useCallback(() => fetchPrediction(), []);
  const { data: prediction, loading, lastUpdated } = usePolled(fetcher, 60_000);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-500">Loading bracket…</div>
  );
  if (!prediction) return (
    <div className="card text-yellow-500 text-sm">Bracket data not yet available.</div>
  );

  const byId = new Map(prediction.matches.map(m => [m.id, m]));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Predicted Bracket</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          The model's single most-likely knockout path. Updates as real results come in.
          {lastUpdated ? ` · ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
        </p>
      </div>

      {/* Champion */}
      <div className="card flex items-center gap-4 border border-fifa-gold/30 bg-fifa-gold/5">
        <span className="text-3xl">🏆</span>
        <div>
          <div className="text-xs text-gray-400 mb-0.5">Predicted champion</div>
          <div className="flex items-center gap-2">
            <Flag code={prediction.champion} size={30} />
            <span className="text-2xl font-bold">{teamName(prediction.champion)}</span>
          </div>
        </div>
      </div>

      {/* Bracket tree — horizontally scrollable on mobile */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto p-3">
          <div style={{ minWidth: '700px' }}>
            <div className="flex justify-between mb-2 text-[10px] uppercase tracking-wider text-gray-600 font-semibold">
              {COL_LABELS.map(l => <span key={l}>{l}</span>)}
            </div>
            <Node id={ROOT} byId={byId} />
          </div>
        </div>
        <div className="sm:hidden text-center py-2 text-[10px] text-gray-700 border-t border-gray-800">
          ← scroll to see the full bracket →
        </div>
      </div>

      <p className="text-xs text-gray-600 text-center">
        Deterministic best-guess path — at each match the higher-rated/favoured side advances.
        For probabilities across all teams, see the Forecast tab; for a random scenario, see Simulate.
      </p>
    </div>
  );
}
