import type { AppData, Boss } from '../models';
import { CATEGORY_LABELS, ledger, type Category } from './payouts';
import { helperStats } from './stats';
import { nameOf } from './summary';

type Cell = string | number;

// Quote when needed, and stop spreadsheets from running text that looks like a formula
function cell(value: Cell): string {
	if (typeof value === 'number') return String(value);
	const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
	return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const toCsv = (rows: Cell[][]) =>
	rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';

/**
 * One row per friend: totals, earnings by category and helper stats, in roubles. With a
 * run id, earnings and stats cover that run only (as the Ledger screen does), while paid
 * and owed stay all-time.
 */
export function ledgerCsv(data: AppData, bosses: Boss[], runId?: string): string {
	const all = ledger(data, bosses);
	const run = runId ? data.runs[runId] : undefined;
	const scoped = run ? ledger({ ...data, runs: { [run.id]: run }, payments: [] }, bosses) : all;
	const entries = Object.values(all).filter((e) => e.earned || e.paid);
	const stats = helperStats(run ? [run] : Object.values(data.runs));
	const categories = Object.keys(CATEGORY_LABELS) as Category[];
	const rows: Cell[][] = [
		[
			'Friend',
			run ? 'Earned (this run)' : 'Earned',
			'Paid (all)',
			'Owed (all)',
			...categories.map((c) => CATEGORY_LABELS[c]),
			'Raids',
			'Bosses killed',
			'PMC kills',
			'Team kills',
			'Deaths',
			'Extracts',
		],
	];
	for (const e of entries.sort((a, b) => b.owed - a.owed)) {
		const s = stats[e.friendId];
		rows.push([
			nameOf(data, e.friendId),
			scoped[e.friendId]?.earned ?? 0,
			e.paid,
			e.owed,
			...categories.map((c) => scoped[e.friendId]?.byCategory[c] ?? 0),
			s?.raids ?? 0,
			s?.bossKills ?? 0,
			s?.pmcKills ?? 0,
			s?.teamKills ?? 0,
			s?.deaths ?? 0,
			s?.extracts ?? 0,
		]);
	}
	return toCsv(rows);
}

/** Payment history, oldest first. */
export function paymentsCsv(data: AppData): string {
	const rows: Cell[][] = [['Date', 'Friend', 'Amount', 'Note']];
	const sorted = [...data.payments].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
	for (const p of sorted) {
		rows.push([p.timestamp, nameOf(data, p.friendId), p.amount, p.note ?? '']);
	}
	return toCsv(rows);
}
