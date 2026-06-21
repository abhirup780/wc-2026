import { useCallback, useState } from 'react';
import { usePolled, fetchForecast, fetchUpcoming } from '../api.ts';
import { pct, teamName } from '../utils.ts';
import Flag from './Flag.tsx';
import R32Projection from './R32Projection.tsx';
import type { TeamForecast, UpcomingMatch } from '@wc2026/shared';

// ─── Next matches (model 1X2 blended with bookmaker odds) ──────────────────────

function kickoffLabel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

function NextMatchRow({ m }: { m: UpcomingMatch }) {
  const fav = m.pHome >= m.pAway && m.pHome >= m.pDraw ? 'home'
    : m.pAway >= m.pDraw ? 'away' : 'draw';
  return (
    <div className="py-2.5 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1.5">
        <span>{kickoffLabel(m.kickoffUtc)}{m.groupId ? ` · Grp ${m.groupId}` : ''}</span>
        <span className={m.marketBlended ? 'text-fifa-gold' : 'text-gray-500'}>
          {m.marketBlended ? 'model + market' : 'model only'}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className={`flex items-center gap-1.5 min-w-0 flex-1 ${fav === 'home' ? 'text-gray-50 font-semibold' : 'text-gray-300'}`}>
          <Flag code={m.homeId} size={18} />
          <span className="truncate text-xs">{teamName(m.homeId)}</span>
        </div>
        <span className="text-[10px] text-gray-500 shrink-0 tabular-nums">{m.homeXg.toFixed(1)}–{m.awayXg.toFixed(1)}</span>
        <div className={`flex items-center gap-1.5 min-w-0 flex-1 justify-end ${fav === 'away' ? 'text-gray-50 font-semibold' : 'text-gray-300'}`}>
          <span className="truncate text-xs text-right">{teamName(m.awayId)}</span>
          <Flag code={m.awayId} size={18} />
        </div>
      </div>
      {/* 1X2 split bar */}
      <div className="flex h-2 rounded-full overflow-hidden bg-gray-800">
        <div className="bg-green-500/80" style={{ width: `${m.pHome * 100}%` }} />
        <div className="bg-gray-500" style={{ width: `${m.pDraw * 100}%` }} />
        <div className="bg-fifa-blue" style={{ width: `${m.pAway * 100}%` }} />
      </div>
      <div className="flex items-center justify-between text-[10px] tabular-nums mt-1">
        <span className={fav === 'home' ? 'text-green-400' : 'text-gray-400'}>{m.homeId} {Math.round(m.pHome * 100)}%</span>
        <span className={fav === 'draw' ? 'text-gray-300' : 'text-gray-500'}>Draw {Math.round(m.pDraw * 100)}%</span>
        <span className={fav === 'away' ? 'text-blue-400' : 'text-gray-400'}>{m.awayId} {Math.round(m.pAway * 100)}%</span>
      </div>
    </div>
  );
}

function NextMatches() {
  const fetcher = useCallback(() => fetchUpcoming(), []);
  const { data: upcoming } = usePolled(fetcher, 60_000);
  if (!upcoming || upcoming.matches.length === 0) return null;
  const anyBlended = upcoming.matches.some(m => m.marketBlended);
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-300">Next match predictions</h3>
        <span className="text-[10px] text-gray-600">
          {anyBlended ? `${Math.round(upcoming.blendWeight * 100)}% market + ${Math.round((1 - upcoming.blendWeight) * 100)}% model` : 'model'}
        </span>
      </div>
      <div className="divide-y divide-gray-800/60">
        {upcoming.matches.map(m => <NextMatchRow key={m.id} m={m} />)}
      </div>
    </div>
  );
}

type SortKey = keyof Pick<TeamForecast, 'pChampion' | 'pReachFinal' | 'pReachSF' | 'pReachQF' | 'pReachR16' | 'pAdvanceGroup' | 'pWinGroup'>;

const COLUMNS: { key: SortKey; label: string; short: string; mobileHide?: boolean }[] = [
  { key: 'pWinGroup',    label: 'Win Group',     short: 'W.Grp', mobileHide: true },
  { key: 'pAdvanceGroup',label: 'Advance',        short: 'Adv.',  mobileHide: true },
  { key: 'pReachR16',    label: 'Round of 16',    short: 'R16',   mobileHide: true },
  { key: 'pReachQF',     label: 'Quarter-finals', short: 'QF',    mobileHide: true },
  { key: 'pReachSF',     label: 'Semi-finals',    short: 'SF'    },
  { key: 'pReachFinal',  label: 'Final',          short: 'Final' },
  { key: 'pChampion',    label: 'Winner',         short: 'Win'   },
];

function fmtProb(v: number): string {
  if (v <= 0) return '—';
  const r = Math.round(v * 100);
  return r === 0 ? '<1%' : `${r}%`;
}

type ChampView = 'combo' | 'model' | 'market';
const CHAMP_VIEWS: { key: ChampView; label: string; hint: string }[] = [
  { key: 'combo',  label: 'Combo',  hint: 'blended model + bookmaker odds' },
  { key: 'model',  label: 'Model',  hint: 'simulation only' },
  { key: 'market', label: 'Market', hint: 'bookmaker outright odds' },
];

export default function Forecast() {
  const [sortKey, setSortKey] = useState<SortKey>('pChampion');
  const [filterGroup, setFilterGroup] = useState<string>('');
  const [champView, setChampView] = useState<ChampView>('combo');
  const [champShowAll, setChampShowAll] = useState(false);

  const fetcher = useCallback(() => fetchForecast(), []);
  const { data: forecast, loading, error, lastUpdated } = usePolled(fetcher, 60_000);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-500">Running forecast…</div>
  );
  if (error || !forecast) return (
    <div className="card text-red-400 text-sm">Forecast unavailable: {error}</div>
  );

  const groups = [...new Set(forecast.teams.map(t => t.groupId))].sort();
  const filtered = filterGroup ? forecast.teams.filter(t => t.groupId === filterGroup) : forecast.teams;
  const sorted = [...filtered].sort((a, b) => b[sortKey] - a[sortKey]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Winner Forecast</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Round-by-round &amp; winner probabilities
          {lastUpdated ? ` · updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
        </p>
      </div>

      {/* Winner probability bar chart — toggle between combo / model / market */}
      <div className="card">
        <div className="flex items-center justify-between mb-3 gap-2">
          <h3 className="text-sm font-semibold text-gray-300">Winner probability</h3>
          <div className="flex rounded-md border border-gray-700 overflow-hidden shrink-0">
            {CHAMP_VIEWS.map(v => (
              <button
                key={v.key}
                onClick={() => setChampView(v.key)}
                className={`text-[11px] px-2.5 py-1 transition-colors ${
                  champView === v.key ? 'bg-fifa-gold text-fifa-navy font-semibold' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[10px] text-gray-400 mb-3 -mt-1">{CHAMP_VIEWS.find(v => v.key === champView)!.hint}</p>
        {(() => {
          const champProb = (t: typeof forecast.teams[number]) =>
            champView === 'model' ? (t.pChampionModel ?? t.pChampion)
            : champView === 'market' ? (t.pChampionMarket ?? 0)
            : t.pChampion;
          const ranked = [...forecast.teams]
            .map(t => ({ t, p: champProb(t) }))
            .sort((a, b) => b.p - a.p)
            .filter(x => x.p > 0.001);
          if (ranked.length === 0) return (
            <p className="text-xs text-gray-400">No market data available yet — refresh after the next data update.</p>
          );
          // Top 10 by default; the rest behind "show more".
          const visible = champShowAll ? ranked : ranked.slice(0, 10);
          // Scale bars relative to the leader so they fill the track (the % label
          // still shows the true probability).
          const maxP = ranked[0].p || 1;
          return (
            <>
              <div className="space-y-2">
                {visible.map(({ t, p }) => (
                  <div key={t.teamId} className="flex items-center gap-2">
                    <Flag code={t.code} size={20} />
                    <span className="text-xs text-gray-400 w-7 shrink-0 tabular-nums font-medium">{t.code}</span>
                    <div className="flex-1 bg-gray-800 rounded-full h-2.5 relative overflow-hidden">
                      <div
                        className="h-2.5 rounded-full bg-gradient-to-r from-fifa-blue to-fifa-gold transition-all duration-500"
                        style={{ width: `${Math.max(3, (p / maxP) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums w-9 text-right text-gray-100 shrink-0 font-bold">{pct(p)}</span>
                  </div>
                ))}
              </div>
              {ranked.length > 10 && (
                <button
                  onClick={() => setChampShowAll(s => !s)}
                  className="w-full mt-3 py-2 rounded-lg border border-gray-800 text-xs font-semibold text-gray-300 hover:border-gray-600 hover:text-gray-100 transition-colors"
                >
                  {champShowAll ? 'Show fewer' : `Show more (${ranked.length - 10})`}
                </button>
              )}
            </>
          );
        })()}
      </div>

      {/* Round of 32 — most likely ties (compact), projected from current standings */}
      <R32Projection />

      {/* Group filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 shrink-0">Group:</span>
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setFilterGroup('')}
            className={`text-xs px-2 py-1 rounded border ${!filterGroup ? 'border-fifa-gold text-fifa-gold' : 'border-gray-700 text-gray-400'}`}
          >
            All
          </button>
          {groups.map(g => (
            <button
              key={g}
              onClick={() => setFilterGroup(g === filterGroup ? '' : g)}
              className={`text-xs px-2 py-1 rounded border ${filterGroup === g ? 'border-fifa-gold text-fifa-gold' : 'border-gray-700 text-gray-400'}`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Probability table — horizontally scrollable on mobile */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                <th className="text-left py-3 pl-4 pr-3 font-normal sticky left-0 bg-gray-900">Team</th>
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    className={`text-right py-3 px-3 font-normal cursor-pointer select-none hover:text-gray-200 whitespace-nowrap ${sortKey === col.key ? 'text-fifa-gold' : ''} ${col.mobileHide ? 'hidden sm:table-cell' : ''}`}
                    onClick={() => setSortKey(col.key)}
                  >
                    <span className="hidden sm:inline">{col.label}</span>
                    <span className="sm:hidden">{col.short}</span>
                    {sortKey === col.key && <span className="ml-1">↓</span>}
                  </th>
                ))}
                <th className="text-right py-3 px-3 pr-4 font-normal whitespace-nowrap text-gray-500" title="Change in winner probability since the start of the tournament">
                  vs&nbsp;pre
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t, i) => (
                <tr key={t.teamId} className="border-b border-gray-800/40 hover:bg-gray-800/30 transition-colors">
                  <td className="py-2 pl-4 pr-3 sticky left-0 bg-gray-900">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 text-xs w-4 tabular-nums shrink-0">{i + 1}</span>
                      <Flag code={t.code} size={20} />
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{t.name}</div>
                        <div className="text-xs text-gray-500">Grp {t.groupId}</div>
                      </div>
                    </div>
                  </td>
                  {COLUMNS.map(col => (
                    <td key={col.key} className={`py-2 px-3 text-right tabular-nums text-sm ${col.mobileHide ? 'hidden sm:table-cell' : ''}`}>
                      <span className={
                        col.key === 'pChampion'
                          ? 'font-semibold text-gray-200'
                          : t[col.key] > 0.5 ? 'text-green-400'
                          : t[col.key] > 0.2 ? 'text-yellow-400'
                          : t[col.key] > 0  ? 'text-gray-400'
                          : 'text-gray-600'
                      }>
                        {fmtProb(t[col.key])}
                      </span>
                    </td>
                  ))}
                  <td className="py-2 px-3 pr-4 text-right tabular-nums text-sm">
                    {(() => {
                      const init = t.pChampionInitial;
                      if (init == null) return <span className="text-gray-700">—</span>;
                      const r = Math.round((t.pChampion - init) * 100);
                      if (r === 0) return <span className="text-gray-600">—</span>;
                      return (
                        <span className={r > 0 ? 'text-green-400' : 'text-red-400'}>
                          {r > 0 ? `↑+${r}%` : `↓${r}%`}
                        </span>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Next match predictions — model 1X2 blended with bookmaker odds */}
      <NextMatches />
    </div>
  );
}
