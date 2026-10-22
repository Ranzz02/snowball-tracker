import type { Run } from '../models';

export interface HelperStats {
	raids: number;
	bossKills: number; // bosses killed in raids the friend helped in
	pmcKills: number;
	teamKills: number;
	deaths: number;
	extracts: number;
}

const empty = (): HelperStats => ({
	raids: 0,
	bossKills: 0,
	pmcKills: 0,
	teamKills: 0,
	deaths: 0,
	extracts: 0,
});

/** Per-friend helper record across the given runs. */
export function helperStats(runs: Run[]): Record<string, HelperStats> {
	const out: Record<string, HelperStats> = {};
	for (const run of runs) {
		for (const raid of run.raids) {
			const killed = raid.bosses.filter((b) => b.killed).length;
			for (const h of Object.values(raid.helpers)) {
				const s = (out[h.friendId] ??= empty());
				s.raids += 1;
				s.bossKills += killed;
				s.pmcKills += h.pmcKills;
				s.teamKills += h.teamKills;
				if (h.died) s.deaths += 1;
				if (h.extracted) s.extracts += 1;
			}
		}
	}
	return out;
}
