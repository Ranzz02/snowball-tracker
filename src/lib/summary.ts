import type { AppData, Boss, Raid, Run } from '../models';
import { formatDate, formatDateTime, formatRub } from './format';
import {
	bossProgress,
	ledger,
	raidLines,
	runBreakdown,
	sumLines,
	type BossContext,
} from './payouts';

const nameOf = (data: AppData, id: string) =>
	data.friends.find((f) => f.id === id)?.name ?? 'Unknown';

/** Plain-text recap of one run, ready to paste into Discord. */
export function runSummaryText(run: Run, data: AppData, ctx: BossContext): string {
	const bd = runBreakdown(run, ctx);
	const p = bossProgress(run, ctx);
	const bossName = (id: string) => ctx.bosses.find((b: Boss) => b.id === id)?.name ?? id;

	const lines = [
		`**Snowball run, ${formatDate(run.createdAt)}** (${run.status})`,
		`Hunter: ${run.hunterId ? nameOf(data, run.hunterId) : 'not set'} | Bosses ${p.killed.length}/${p.required.length} | Raids ${run.raids.length}`,
	];
	if (p.killed.length) lines.push(`Killed: ${p.killed.map(bossName).join(', ')}`);
	if (p.remaining.length) lines.push(`Remaining: ${p.remaining.map(bossName).join(', ')}`);
	lines.push('', '**Payouts**');
	const rows = Object.entries(bd.totals).sort((a, b) => b[1] - a[1]);
	if (rows.length === 0) lines.push('No payouts yet.');
	for (const [fid, total] of rows) {
		lines.push(`- ${nameOf(data, fid)}: ${formatRub(total)}`);
	}
	lines.push(`Total: ${formatRub(bd.grandTotal)}`);
	return lines.join('\n');
}

/** Plain-text recap of one raid, ready to paste into Discord. */
export function raidSummaryText(
	raid: Raid,
	data: AppData,
	ctx: BossContext,
	mapName: string,
): string {
	const bossName = (id: string) => ctx.bosses.find((b: Boss) => b.id === id)?.name ?? id;
	const killed = raid.bosses.filter((b) => b.killed).map((b) => bossName(b.bossId));
	const missed = raid.bosses.filter((b) => !b.killed).map((b) => bossName(b.bossId));
	const perHelper = raidLines(raid);

	const lines = [`**Raid on ${mapName}, ${formatDateTime(raid.createdAt)}**`];
	const bosses = [
		killed.length ? `Killed: ${killed.join(', ')}` : '',
		missed.length ? `Missed: ${missed.join(', ')}` : '',
	].filter(Boolean);
	lines.push(bosses.length ? bosses.join(' | ') : 'No bosses tracked');
	if (raid.hunterDied) lines.push('Hunter died, run over');
	lines.push('', '**Payouts**');

	const rows = Object.entries(perHelper)
		.map(([fid, l]) => ({ fid, total: sumLines(l), labels: l.map((x) => x.label) }))
		.sort((a, b) => b.total - a.total);
	if (rows.length === 0) lines.push('No helpers.');
	for (const r of rows) {
		const detail = r.labels.length ? ` (${r.labels.join(', ')})` : '';
		lines.push(`- ${nameOf(data, r.fid)}: ${formatRub(r.total)}${detail}`);
	}
	lines.push(`Total: ${formatRub(rows.reduce((s, r) => s + r.total, 0))}`);
	if (raid.notes.trim()) lines.push('', `Notes: ${raid.notes.trim()}`);
	return lines.join('\n');
}

/** Plain-text view of what everyone is owed across all runs. */
export function owedSummaryText(data: AppData, bosses: Boss[]): string {
	const l = ledger(data, bosses);
	const rows = Object.values(l)
		.filter((e) => e.earned !== 0 || e.paid !== 0)
		.sort((a, b) => b.owed - a.owed);
	const lines = ['**Snowball payouts owed**'];
	if (rows.length === 0) lines.push('Nothing yet.');
	for (const e of rows) {
		lines.push(
			`- ${nameOf(data, e.friendId)}: ${formatRub(e.owed)} (earned ${formatRub(e.earned)}, paid ${formatRub(e.paid)})`,
		);
	}
	lines.push(`Total owed: ${formatRub(rows.reduce((s, e) => s + e.owed, 0))}`);
	return lines.join('\n');
}
