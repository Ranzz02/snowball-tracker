import { useMemo, useState } from 'react';
import { ClipboardCopy, Undo2 } from 'lucide-react';
import { useGameStore, toAppData } from '../../store';
import { SCHEMA_VERSION, type Friend } from '../../models';
import { useBossContext } from '../../lib/hooks';
import { ledger, runBreakdown, type Category, type LedgerEntry } from '../../lib/payouts';
import { owedSummaryText } from '../../lib/summary';
import { formatDate, formatDateTime } from '../../lib/format';
import { toast } from '../ui/feedback';
import { Modal } from '../ui/Overlays';
import { Badge, Button, FriendChip, NumberInput, Panel, Rub, Stat, inputClass } from '../ui/ui';

const CATEGORY_LABELS: Record<Category, string> = {
	base: 'Base',
	pmc: 'PMC kills',
	extract: 'Extracts',
	died: 'Deaths',
	teamKill: 'Team kills',
	hunterDeath: 'Hunter deaths',
	completion: 'Completion',
	adjustment: 'Custom',
};

function FriendLedger({
	friend,
	entry,
	scopeEarned,
	scopeCategories,
	onSettle,
}: {
	friend: Friend;
	entry: LedgerEntry;
	scopeEarned: number;
	scopeCategories: Partial<Record<Category, number>>;
	onSettle: () => void;
}) {
	const runs = useGameStore((s) => s.runs);
	const payments = useGameStore((s) => s.payments).filter((p) => p.friendId === friend.id);
	const removePayment = useGameStore((s) => s.removePayment);

	return (
		<Panel className="h-full">
			<div className="mb-4 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<FriendChip friend={friend} size={36} />
					<div>
						<div className="font-display text-xl font-semibold">{friend.name}</div>
						{friend.archived && <Badge>archived</Badge>}
					</div>
				</div>
				<Button variant="primary" size="sm" disabled={entry.owed <= 0} onClick={onSettle}>
					Settle up
				</Button>
			</div>

			<div className="grid grid-cols-3 gap-3">
				<Stat label="Earned">
					<Rub amount={scopeEarned} />
				</Stat>
				<Stat label="Paid (all)">
					<Rub amount={entry.paid} />
				</Stat>
				<Stat label="Owed (all)">
					<Rub
						amount={entry.owed}
						className={entry.owed > 0 ? 'text-warn' : entry.owed < 0 ? '' : 'text-ok'}
					/>
				</Stat>
			</div>

			<div className="mt-3 flex flex-wrap gap-1.5">
				{(Object.keys(CATEGORY_LABELS) as Category[])
					.filter((c) => scopeCategories[c])
					.map((c) => (
						<Badge key={c} tone={(scopeCategories[c] ?? 0) < 0 ? 'danger' : 'neutral'}>
							{CATEGORY_LABELS[c]} <Rub amount={scopeCategories[c] ?? 0} signed />
						</Badge>
					))}
			</div>

			<details className="mt-3 text-sm">
				<summary className="cursor-pointer text-mute hover:text-ink">
					By run ({Object.keys(entry.perRun).length}) and payments ({payments.length})
				</summary>
				<ul className="mt-2 space-y-1">
					{Object.entries(entry.perRun).map(([runId, amount]) => (
						<li key={runId} className="flex justify-between text-xs">
							<span className="text-mute">
								Run {runs[runId] ? formatDate(runs[runId].createdAt) : runId}
							</span>
							<Rub amount={amount} />
						</li>
					))}
					{payments.map((p) => (
						<li key={p.id} className="flex items-center justify-between text-xs">
							<span className="text-mute">
								Paid {formatDateTime(p.timestamp)}
								{p.note ? `, ${p.note}` : ''}
							</span>
							<span className="flex items-center gap-2">
								<Rub amount={-p.amount} />
								<button
									aria-label="Undo payment"
									title="Undo payment"
									onClick={() => removePayment(p.id)}
									className="text-mute hover:text-danger"
								>
									<Undo2 size={13} />
								</button>
							</span>
						</li>
					))}
				</ul>
			</details>
		</Panel>
	);
}

export default function LedgerTab() {
	const friends = useGameStore((s) => s.friends);
	const runs = useGameStore((s) => s.runs);
	const payments = useGameStore((s) => s.payments);
	const requiredBossIds = useGameStore((s) => s.requiredBossIds);
	const rates = useGameStore((s) => s.rates);
	const presets = useGameStore((s) => s.presets);
	const bosses = useGameStore((s) => s.bosses);
	const addPayment = useGameStore((s) => s.addPayment);
	const ctx = useBossContext();

	const [scope, setScope] = useState('all');
	const [settling, setSettling] = useState<Friend | null>(null);
	const [payAmount, setPayAmount] = useState(0);
	const [payNote, setPayNote] = useState('');

	const data = useMemo(
		() =>
			toAppData({
				schemaVersion: SCHEMA_VERSION,
				friends,
				runs,
				activeRunId: null,
				rates,
				presets,
				requiredBossIds,
				payments,
			}),
		[friends, runs, rates, presets, requiredBossIds, payments],
	);
	const entries = useMemo(() => ledger(data, bosses), [data, bosses]);

	const scopeRun = scope !== 'all' ? runs[scope] : undefined;
	const scopeBreakdown = useMemo(
		() => (scopeRun ? runBreakdown(scopeRun, ctx) : null),
		[scopeRun, ctx],
	);

	const scopeCategories = (friendId: string) => {
		if (!scopeBreakdown) return entries[friendId].byCategory;
		const out: Partial<Record<Category, number>> = {};
		const all = [...Object.values(scopeBreakdown.perRaid), scopeBreakdown.completion];
		for (const lines of all) {
			for (const l of lines[friendId] ?? []) {
				out[l.category] = (out[l.category] ?? 0) + l.amount;
			}
		}
		return out;
	};

	const visible = friends
		.filter((f) => !f.archived || entries[f.id]?.earned || entries[f.id]?.paid)
		.sort((a, b) => entries[b.id].owed - entries[a.id].owed);
	const totalOwed = visible.reduce((s, f) => s + entries[f.id].owed, 0);

	const openSettle = (f: Friend) => {
		setSettling(f);
		setPayAmount(Math.max(0, entries[f.id].owed));
		setPayNote('');
	};

	const confirmSettle = () => {
		if (!settling || payAmount <= 0) return;
		addPayment({
			friendId: settling.id,
			amount: payAmount,
			note: payNote.trim() || undefined,
		});
		toast(`Recorded payment to ${settling.name}`);
		setSettling(null);
	};

	const copyOwed = async () => {
		try {
			await navigator.clipboard.writeText(owedSummaryText(data, bosses));
			toast('Payout summary copied');
		} catch {
			toast('Could not copy to clipboard', 'danger');
		}
	};

	return (
		<div className="space-y-5">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<Stat label="Total still owed">
					<Rub amount={totalOwed} className="text-warn" />
				</Stat>
				<div className="flex items-center gap-2">
					<select
						aria-label="Earnings scope"
						value={scope}
						onChange={(e) => setScope(e.target.value)}
						className={inputClass}
					>
						<option value="all">Earned: all runs</option>
						{Object.values(runs)
							.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
							.map((r) => (
								<option key={r.id} value={r.id}>
									Earned: run {formatDate(r.createdAt)}
								</option>
							))}
					</select>
					<Button onClick={copyOwed}>
						<ClipboardCopy size={14} /> Copy for Discord
					</Button>
				</div>
			</div>

			{visible.length === 0 ? (
				<Panel>
					<p className="py-8 text-center text-mute">
						No friends yet. Add them on the Friends tab.
					</p>
				</Panel>
			) : (
				<div className="grid gap-4 xl:grid-cols-2">
					{visible.map((f) => (
						<FriendLedger
							key={f.id}
							friend={f}
							entry={entries[f.id]}
							scopeEarned={
								scopeBreakdown
									? (scopeBreakdown.totals[f.id] ?? 0)
									: entries[f.id].earned
							}
							scopeCategories={scopeCategories(f.id)}
							onSettle={() => openSettle(f)}
						/>
					))}
				</div>
			)}

			<Modal
				open={!!settling}
				onClose={() => setSettling(null)}
				title={`Settle up with ${settling?.name ?? ''}`}
				footer={
					<>
						<Button variant="ghost" onClick={() => setSettling(null)}>
							Cancel
						</Button>
						<Button variant="primary" onClick={confirmSettle} disabled={payAmount <= 0}>
							Record payment
						</Button>
					</>
				}
			>
				<div className="space-y-3">
					<label className="block">
						<span className="label-caps mb-1 block text-xs text-mute">
							Amount paid (₽)
						</span>
						<NumberInput
							label="Payment amount"
							value={payAmount}
							min={0}
							onChange={setPayAmount}
							className="w-full"
						/>
					</label>
					<label className="block">
						<span className="label-caps mb-1 block text-xs text-mute">
							Note (optional)
						</span>
						<input
							value={payNote}
							onChange={(e) => setPayNote(e.target.value)}
							placeholder="e.g. flea market transfer"
							className={`${inputClass} w-full`}
						/>
					</label>
				</div>
			</Modal>
		</div>
	);
}
