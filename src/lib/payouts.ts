import type { AppData, Boss, Raid, Run } from '../models';

export type Category =
	'base' | 'pmc' | 'extract' | 'died' | 'teamKill' | 'hunterDeath' | 'completion' | 'adjustment';

export interface Line {
	category: Category;
	label: string;
	amount: number; // signed, penalties are negative
}

export type FriendLines = Record<string, Line[]>;

export const sumLines = (lines: Line[] = []) => lines.reduce((s, l) => s + l.amount, 0);

/** Payout lines for one raid, per helper. */
export function raidLines(raid: Raid): FriendLines {
	const r = raid.rates;
	const killed = raid.bosses.filter((b) => b.killed).length;
	const out: FriendLines = {};

	for (const h of Object.values(raid.helpers)) {
		const lines: Line[] = [];
		if (killed > 0 && r.basePerBoss !== 0) {
			lines.push({
				category: 'base',
				label: `Base × ${killed} boss${killed === 1 ? '' : 'es'}`,
				amount: r.basePerBoss * killed,
			});
		}
		if (h.pmcKills > 0) {
			lines.push({
				category: 'pmc',
				label: `PMC kills × ${h.pmcKills}`,
				amount: h.pmcKills * r.pmcKill,
			});
		}
		if (h.extracted && r.extract !== 0) {
			lines.push({
				category: 'extract',
				label: 'Extracted with hunter',
				amount: r.extract,
			});
		}
		if (h.died && r.helperDeath !== 0) {
			lines.push({
				category: 'died',
				label: 'Died',
				amount: -r.helperDeath,
			});
		}
		if (h.teamKills > 0 && r.teamKill !== 0) {
			lines.push({
				category: 'teamKill',
				label: `Team kills × ${h.teamKills}`,
				amount: -h.teamKills * r.teamKill,
			});
		}
		if (raid.hunterDied && r.hunterDeath !== 0) {
			lines.push({
				category: 'hunterDeath',
				label: 'Hunter died',
				amount: -r.hunterDeath,
			});
		}
		for (const a of h.adjustments) {
			lines.push({ category: 'adjustment', label: a.reason, amount: a.amount });
		}
		out[h.friendId] = lines;
	}
	return out;
}

export interface BossContext {
	bosses: Boss[];
}

/** Bosses that count for this run; its empty snapshot means all bosses. */
export const requiredIds = (run: Run, ctx: BossContext) =>
	run.requiredBossIds.length > 0 ? run.requiredBossIds : ctx.bosses.map((b) => b.id);

export interface BossProgress {
	required: string[];
	killed: string[];
	remaining: string[];
}

export function bossProgress(run: Run, ctx: BossContext): BossProgress {
	const required = requiredIds(run, ctx);
	// A hunter death ends the run, and kills from that raid are lost to the achievement
	const killedSet = new Set(
		run.raids
			.filter((r) => !r.hunterDied)
			.flatMap((r) => r.bosses.filter((b) => b.killed).map((b) => b.bossId)),
	);
	return {
		required,
		killed: required.filter((id) => killedSet.has(id)),
		remaining: required.filter((id) => !killedSet.has(id)),
	};
}

export interface RunBreakdown {
	perRaid: Record<string, FriendLines>;
	completion: FriendLines;
	totals: Record<string, number>; // friendId -> total
	grandTotal: number;
}

export function runBreakdown(run: Run, ctx: BossContext): RunBreakdown {
	const perRaid: Record<string, FriendLines> = {};
	const totals: Record<string, number> = {};
	const add = (friendId: string, amount: number) => {
		totals[friendId] = (totals[friendId] ?? 0) + amount;
	};

	for (const raid of run.raids) {
		const lines = raidLines(raid);
		perRaid[raid.id] = lines;
		for (const [fid, l] of Object.entries(lines)) add(fid, sumLines(l));
	}

	const completion: FriendLines = {};
	const done = bossProgress(run, ctx).remaining.length === 0;
	if (run.status === 'completed' && done && run.completionBonus !== 0) {
		for (const fid of Object.keys(totals)) {
			completion[fid] = [
				{
					category: 'completion',
					label: 'Achievement complete',
					amount: run.completionBonus,
				},
			];
			add(fid, run.completionBonus);
		}
	}

	return {
		perRaid,
		completion,
		totals,
		grandTotal: Object.values(totals).reduce((s, n) => s + n, 0),
	};
}

export interface LedgerEntry {
	friendId: string;
	earned: number;
	paid: number;
	owed: number;
	perRun: Record<string, number>;
	byCategory: Partial<Record<Category, number>>;
}

export function ledger(data: AppData, bosses: Boss[]): Record<string, LedgerEntry> {
	const ctx: BossContext = { bosses };
	const out: Record<string, LedgerEntry> = {};
	const entry = (friendId: string): LedgerEntry =>
		(out[friendId] ??= {
			friendId,
			earned: 0,
			paid: 0,
			owed: 0,
			perRun: {},
			byCategory: {},
		});

	for (const f of data.friends) entry(f.id);

	for (const run of Object.values(data.runs)) {
		const bd = runBreakdown(run, ctx);
		const all = [...Object.values(bd.perRaid), bd.completion];
		for (const lines of all) {
			for (const [fid, l] of Object.entries(lines)) {
				const e = entry(fid);
				for (const line of l) {
					e.byCategory[line.category] = (e.byCategory[line.category] ?? 0) + line.amount;
				}
			}
		}
		for (const [fid, total] of Object.entries(bd.totals)) {
			const e = entry(fid);
			e.earned += total;
			e.perRun[run.id] = total;
		}
	}

	for (const p of data.payments) entry(p.friendId).paid += p.amount;
	for (const e of Object.values(out)) e.owed = e.earned - e.paid;
	return out;
}
