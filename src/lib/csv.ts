import type { AppData, Boss } from '../models';
import { CATEGORY_LABELS, ledger, type Category } from './payouts';
import { helperStats } from './stats';

type Cell = string | number;

// Quote when needed, and stop spreadsheets from running text that looks like a formula
function cell(value: Cell): string {
	if (typeof value === 'number') return String(value);
	const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
	return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const toCsv = (rows: Cell[][]) =>
	rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';

const nameOf = (data: AppData, id: string) =>
	data.friends.find((f) => f.id === id)?.name ?? 'Unknown';

/** One row per friend: totals, earnings by category and helper stats. Amounts in roubles. */
export function ledgerCsv(data: AppData, bosses: Boss[]): string {
	const entries = Object.values(ledger(data, bosses)).filter((e) => e.earned || e.paid);
	const stats = helperStats(Object.values(data.runs));
	const categories = Object.keys(CATEGORY_LABELS) as Category[];
	const rows: Cell[][] = [
		[
			'Friend',
			'Earned',
			'Paid',
			'Owed',
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
			e.earned,
			e.paid,
			e.owed,
			...categories.map((c) => e.byCategory[c] ?? 0),
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
