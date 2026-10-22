import { useMemo, useState } from 'react';
import { Check, ClipboardCopy, Skull, Trash2, X } from 'lucide-react';
import { toAppData, useGameStore } from '../../../store';
import type { Raid, RaidHelper } from '../../../models';
import { useBossContext, useFriendMap } from '../../../lib/hooks';
import { runBreakdown, sumLines, type Line } from '../../../lib/payouts';
import { formatShort, formatSigned } from '../../../lib/format';
import { RATE_FIELDS } from '../../../lib/rateFields';
import { raidSummaryText } from '../../../lib/summary';
import { confirmAction, toast } from '../../ui/feedback';
import { Drawer } from '../../ui/Overlays';
import {
	BossAvatar,
	Button,
	FriendChip,
	NumberInput,
	Rub,
	Stepper,
	Toggle,
	inputClass,
} from '../../ui/ui';

function HelperCard({
	runId,
	raid,
	helper,
	lines,
}: {
	runId: string;
	raid: Raid;
	helper: RaidHelper;
	lines: Line[];
}) {
	const friends = useFriendMap();
	const presets = useGameStore((s) => s.presets);
	const setField = useGameStore((s) => s.setHelperField);
	const addAdjustment = useGameStore((s) => s.addAdjustment);
	const removeAdjustment = useGameStore((s) => s.removeAdjustment);
	const removeHelper = useGameStore((s) => s.removeHelper);
	const friend = friends[helper.friendId];
	const [amount, setAmount] = useState(0);
	const [reason, setReason] = useState('');

	const addCustom = (sign: 1 | -1) => {
		if (!amount || !reason.trim()) return;
		addAdjustment(runId, raid.id, helper.friendId, {
			amount: sign * Math.abs(amount),
			reason: reason.trim(),
		});
		setAmount(0);
		setReason('');
	};

	const id = (field: string) => `${helper.friendId}-${field}`;
	const patch = (p: Parameters<typeof setField>[3]) =>
		setField(runId, raid.id, helper.friendId, p);

	return (
		<div className="rounded-sm border bg-surface p-3">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<FriendChip friend={friend} size={28} />
					<span className="font-display text-lg font-semibold">
						{friend?.name ?? 'Unknown'}
					</span>
				</div>
				<div className="flex items-center gap-3">
					<Rub
						amount={sumLines(lines)}
						className="font-display text-lg font-semibold text-ok"
					/>
					<button
						aria-label={`Remove ${friend?.name ?? 'helper'} from raid`}
						onClick={() => removeHelper(runId, raid.id, helper.friendId)}
						className="text-mute hover:text-danger"
					>
						<X size={16} />
					</button>
				</div>
			</div>

			<div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
				<div className="flex items-center gap-2">
					<span id={id('pmc')} className="label-caps text-xs text-mute">
						PMC kills
					</span>
					<Stepper
						label="PMC kills"
						value={helper.pmcKills}
						onChange={(v) => patch({ pmcKills: v })}
					/>
				</div>
				<div className="flex items-center gap-2">
					<span className="label-caps text-xs text-mute">Team kills</span>
					<Stepper
						label="Team kills"
						value={helper.teamKills}
						onChange={(v) => patch({ teamKills: v })}
					/>
				</div>
				<Toggle checked={helper.died} tone="danger" onChange={(v) => patch({ died: v })}>
					<Skull size={13} /> Died
				</Toggle>
				<Toggle
					checked={helper.extracted}
					tone="ok"
					onChange={(v) => patch({ extracted: v })}
				>
					<Check size={13} /> Extracted with hunter
				</Toggle>
			</div>

			{presets.length > 0 && (
				<div className="mt-3 flex flex-wrap gap-1.5">
					{presets.map((p) => (
						<button
							key={p.id}
							onClick={() =>
								addAdjustment(runId, raid.id, helper.friendId, {
									amount: p.amount,
									reason: p.label,
									presetId: p.id,
								})
							}
							className={`rounded-sm border px-2 py-0.5 text-xs transition hover:brightness-125 ${
								p.amount < 0
									? 'border-danger/40 text-danger'
									: 'border-ok/40 text-ok'
							}`}
						>
							{p.label} {formatShort(p.amount)}
						</button>
					))}
				</div>
			)}

			<div className="mt-3 flex flex-wrap items-center gap-2">
				<NumberInput
					label="Custom amount"
					value={amount}
					min={0}
					onChange={setAmount}
					className="w-28"
				/>
				<input
					aria-label="Custom reason"
					value={reason}
					onChange={(e) => setReason(e.target.value)}
					placeholder="Reason"
					className={`${inputClass} min-w-32 flex-1`}
				/>
				<Button size="sm" onClick={() => addCustom(1)} disabled={!amount || !reason.trim()}>
					+ Bonus
				</Button>
				<Button
					size="sm"
					variant="danger"
					onClick={() => addCustom(-1)}
					disabled={!amount || !reason.trim()}
				>
					− Penalty
				</Button>
			</div>

			{helper.adjustments.length > 0 && (
				<ul className="mt-2 space-y-1">
					{helper.adjustments.map((a) => (
						<li key={a.id} className="flex items-center justify-between text-xs">
							<span className="text-mute">{a.reason}</span>
							<span className="flex items-center gap-2">
								<Rub amount={a.amount} signed />
								<button
									aria-label={`Remove ${a.reason}`}
									onClick={() =>
										removeAdjustment(runId, raid.id, helper.friendId, a.id)
									}
									className="text-mute hover:text-danger"
								>
									<X size={13} />
								</button>
							</span>
						</li>
					))}
				</ul>
			)}

			<details className="mt-2 text-xs">
				<summary className="cursor-pointer text-mute hover:text-ink">Breakdown</summary>
				<ul className="mt-1 space-y-0.5">
					{lines.length === 0 && <li className="text-mute">Nothing earned yet.</li>}
					{lines.map((l, i) => (
						<li key={i} className="flex justify-between">
							<span>{l.label}</span>
							<span className={l.amount < 0 ? 'text-danger' : ''}>
								{formatSigned(l.amount)}
							</span>
						</li>
					))}
				</ul>
			</details>
		</div>
	);
}

export default function RaidEditor({
	runId,
	raidId,
	onClose,
}: {
	runId: string;
	raidId: string | null;
	onClose: () => void;
}) {
	const run = useGameStore((s) => s.runs[runId]);
	const bosses = useGameStore((s) => s.bosses);
	const maps = useGameStore((s) => s.maps);
	const friends = useGameStore((s) => s.friends);
	const toggleBossKilled = useGameStore((s) => s.toggleBossKilled);
	const setHunterDied = useGameStore((s) => s.setHunterDied);
	const addHelper = useGameStore((s) => s.addHelper);
	const deleteRaid = useGameStore((s) => s.deleteRaid);
	const setRaidRates = useGameStore((s) => s.setRaidRates);
	const setRaidNotes = useGameStore((s) => s.setRaidNotes);
	const ctx = useBossContext();

	const raid = run?.raids.find((r) => r.id === raidId);
	const breakdown = useMemo(() => (run ? runBreakdown(run, ctx) : null), [run, ctx]);

	const mapName = maps.find((m) => m.id === raid?.mapId)?.name ?? 'Raid';
	const addable = friends.filter(
		(f) => !f.archived && f.id !== run?.hunterId && !(raid && f.id in raid.helpers),
	);
	const lines = (raid && breakdown?.perRaid[raid.id]) || {};
	const total = Object.values(lines).reduce((s, l) => s + sumLines(l), 0);

	const copySummary = async () => {
		if (!raid) return;
		const text = raidSummaryText(raid, toAppData(useGameStore.getState()), ctx, mapName);
		try {
			await navigator.clipboard.writeText(text);
			toast('Raid summary copied');
		} catch {
			toast('Could not copy to clipboard', 'danger');
		}
	};

	return (
		<Drawer
			open={!!raid}
			onClose={onClose}
			title={mapName}
			subtitle={raid ? new Date(raid.createdAt).toLocaleString() : undefined}
			actions={
				raid && (
					<>
						<Button size="sm" onClick={copySummary}>
							<ClipboardCopy size={13} /> Copy
						</Button>
						<Button
							variant="danger"
							size="sm"
							onClick={async () => {
								const ok = await confirmAction({
									title: 'Delete raid?',
									message:
										'This removes the raid and its payouts. It cannot be undone.',
									confirmLabel: 'Delete',
									danger: true,
								});
								if (ok) {
									deleteRaid(runId, raid.id);
									onClose();
								}
							}}
						>
							<Trash2 size={13} /> Delete
						</Button>
					</>
				)
			}
		>
			{raid && (
				<div className="space-y-6">
					<div className="flex items-center justify-between rounded-sm border bg-raised px-4 py-3">
						<span className="label-caps text-xs text-mute">Raid total</span>
						<Rub
							amount={total}
							className="font-display text-2xl font-semibold text-ok"
						/>
					</div>

					<section>
						<h3 className="label-caps mb-2 text-sm text-accent">Bosses</h3>
						<div className="flex flex-wrap gap-2">
							{raid.bosses.map((b) => (
								<Toggle
									key={b.bossId}
									checked={b.killed}
									tone="ok"
									onChange={(v) => toggleBossKilled(runId, raid.id, b.bossId, v)}
								>
									<BossAvatar
										boss={bosses.find((x) => x.id === b.bossId)}
										size={22}
										dim={!b.killed}
									/>
									{bosses.find((x) => x.id === b.bossId)?.name ?? b.bossId}
									{b.killed && <Check size={13} />}
								</Toggle>
							))}
							<Toggle
								checked={raid.hunterDied}
								tone="danger"
								onChange={async (v) => {
									if (v) {
										const ok = await confirmAction({
											title: 'Hunter died?',
											message:
												'This ends the run as failed. Achievement progress resets, so start a new run for the next attempt.',
											confirmLabel: 'Hunter died',
											danger: true,
										});
										if (!ok) return;
									}
									setHunterDied(runId, raid.id, v);
								}}
							>
								<Skull size={13} /> Hunter died
							</Toggle>
						</div>
					</section>

					<section>
						<div className="mb-2 flex items-center justify-between">
							<h3 className="label-caps text-sm text-accent">Helpers</h3>
							{addable.length > 0 && (
								<select
									aria-label="Add helper"
									value=""
									onChange={(e) =>
										e.target.value && addHelper(runId, raid.id, e.target.value)
									}
									className={inputClass}
								>
									<option value="">Add helper…</option>
									{addable.map((f) => (
										<option key={f.id} value={f.id}>
											{f.name}
										</option>
									))}
								</select>
							)}
						</div>
						<div className="space-y-3">
							{Object.values(raid.helpers).map((h) => (
								<HelperCard
									key={h.friendId}
									runId={runId}
									raid={raid}
									helper={h}
									lines={lines[h.friendId] ?? []}
								/>
							))}
							{Object.keys(raid.helpers).length === 0 && (
								<p className="text-mute">No helpers in this raid.</p>
							)}
						</div>
					</section>

					<section>
						<h3 className="label-caps mb-2 text-sm text-accent">Notes</h3>
						<textarea
							aria-label="Raid notes"
							value={raid.notes}
							onChange={(e) => setRaidNotes(runId, raid.id, e.target.value)}
							rows={2}
							className={`${inputClass} w-full resize-y`}
						/>
					</section>

					<details>
						<summary className="label-caps cursor-pointer text-sm text-accent">
							Rates for this raid
						</summary>
						<p className="mt-2 text-xs text-mute">
							Copied from Settings when the raid was created. Edits here affect only
							this raid.
						</p>
						<div className="mt-3 grid grid-cols-2 gap-3">
							{RATE_FIELDS.map((f) => (
								<label key={f.key} className="block">
									<span className="mb-1 block text-xs text-mute">{f.label}</span>
									<NumberInput
										label={f.label}
										value={raid.rates[f.key]}
										min={0}
										onChange={(v) =>
											setRaidRates(runId, raid.id, { [f.key]: v })
										}
										className="w-full"
									/>
								</label>
							))}
						</div>
					</details>

					<Button variant="primary" className="w-full" onClick={onClose}>
						Done
					</Button>
				</div>
			)}
		</Drawer>
	);
}
