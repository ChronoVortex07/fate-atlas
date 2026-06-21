import type { Responder, PhaseContext, EffectReport, DebugConfig } from './types';
import { PRIORITY_BANDS } from './types';
import { REDUCERS } from './reducers';

export interface DispatchResult {
  reports: EffectReport[];
  forcedConsumed: string[];
}

function pickWeighted(rs: Responder[], ctx: PhaseContext): Responder {
  if (rs.length === 1) return rs[0];
  const weights = rs.map((r) => (r.weight ? Math.max(0, r.weight(ctx)) : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return rs[Math.floor(ctx.rng() * rs.length)];
  let x = ctx.rng() * total;
  for (let i = 0; i < rs.length; i++) { x -= weights[i]; if (x <= 0) return rs[i]; }
  return rs[rs.length - 1];
}

export function dispatch(
  trigger: string,
  ctx: PhaseContext,
  responders: Responder[],
  debug: DebugConfig,
): DispatchResult {
  const forcedConsumed: string[] = [];

  let candidates = responders.filter((r) => r.triggers.includes(trigger));
  if (debug.isolate) candidates = candidates.filter((r) => debug.forced.includes(r.id));

  const eligible = candidates.filter((r) => {
    if (!r.condition(ctx)) return false;
    if (debug.forced.includes(r.id)) { forcedConsumed.push(r.id); return true; } // skip roll
    return r.roll(ctx);
  });

  const reports: EffectReport[] = [];

  // Exclusive groups: at most one winner per band, bands in order.
  for (const band of PRIORITY_BANDS) {
    const winners = eligible.filter(
      (r) => r.group.kind === 'exclusive' && r.group.band === band,
    );
    if (winners.length === 0) continue;
    const chosen = pickWeighted(winners, ctx);
    const report = chosen.apply(ctx);
    if (report) reports.push(report);
  }

  // Combine channels: all contributors push, then the channel reducer collapses.
  const channels = new Set<string>();
  for (const r of eligible) if (r.group.kind === 'combine') channels.add(r.group.channel);
  for (const channel of channels) {
    for (const r of eligible) {
      if (r.group.kind === 'combine' && r.group.channel === channel) r.apply(ctx);
    }
    const reducer = REDUCERS[channel];
    if (reducer) { const rep = reducer.reduce(ctx); if (rep) reports.push(rep); }
  }

  return { reports, forcedConsumed };
}
