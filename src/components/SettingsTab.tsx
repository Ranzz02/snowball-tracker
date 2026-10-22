import { Plus, Trash2 } from 'lucide-react';
import { toAppData, useGameStore } from '../store';
import { migrate } from '../lib/migrate';
import { newId } from '../lib/format';
import { RATE_FIELDS } from '../lib/rateFields';
import { confirmAction, toast } from './ui/feedback';
import { BossAvatar, Button, NumberInput, Panel, Toggle, inputClass } from './ui/ui';

function RatesPanel() {
	const rates = useGameStore((s) => s.rates);
	const setRates = useGameStore((s) => s.setRates);
	const activeRunId = useGameStore((s) => s.activeRunId);
	const applyRatesToRun = useGameStore((s) => s.applyRatesToRun);

	return (
		<Panel
			title="Rates"
			actions={
				activeRunId && (
					<Button
						size="sm"
						onClick={async () => {
							const ok = await confirmAction({
								title: 'Apply to current run?',
								message:
									'Overwrites the rates of every raid in the open run, including hand-edited ones, and its achievement targets and completion bonus.',
								confirmLabel: 'Apply',
							});
							if (ok) {
								applyRatesToRun(activeRunId);
								toast('Rates applied to the open run');
							}
						}}
					>
						Apply to open run
					</Button>
				)
			}
		>
			<p className="mb-4 text-xs text-mute">
				These are copied into each new raid (the completion bonus into each new run).
				Changing them here does not touch existing raids or runs. Penalties are entered as
				positive numbers.
			</p>
			<div className="grid gap-4 md:grid-cols-2">
				{RATE_FIELDS.map((f) => (
					<label key={f.key} className="block">
						<span
							className={`label-caps mb-0.5 block text-xs ${
								f.kind === 'penalty' ? 'text-danger' : 'text-mute'
							}`}
						>
							{f.label}
							{f.kind === 'penalty' && ' (penalty)'}
						</span>
						<NumberInput
							label={f.label}
							value={rates[f.key]}
							min={0}
							onChange={(v) => setRates({ [f.key]: v })}
							className="w-full"
						/>
						<span className="mt-0.5 block text-xs text-mute">{f.hint}</span>
					</label>
				))}
			</div>
		</Panel>
	);
}

function PresetsPanel() {
	const presets = useGameStore((s) => s.presets);
	const savePreset = useGameStore((s) => s.savePreset);
	const deletePreset = useGameStore((s) => s.deletePreset);

	return (
		<Panel
			title="Quick adjustments"
			actions={
				<Button
					size="sm"
					onClick={() =>
						savePreset({ id: newId('preset'), label: 'New preset', amount: 0 })
					}
				>
					<Plus size={13} /> Add
				</Button>
			}
		>
			<p className="mb-3 text-xs text-mute">
				One-click bonuses and penalties shown on every helper in the raid editor. Use a
				negative amount for a penalty.
			</p>
			<div className="space-y-2">
				{presets.map((p) => (
					<div key={p.id} className="flex items-center gap-2">
						<input
							aria-label="Preset label"
							value={p.label}
							onChange={(e) => savePreset({ ...p, label: e.target.value })}
							className={`${inputClass} flex-1`}
						/>
						<NumberInput
							label={`Amount for ${p.label}`}
							value={p.amount}
							onChange={(v) => savePreset({ ...p, amount: v })}
							className="w-36"
						/>
						<button
							aria-label={`Delete ${p.label}`}
							onClick={() => deletePreset(p.id)}
							className="p-1 text-mute hover:text-danger"
						>
							<Trash2 size={15} />
						</button>
					</div>
				))}
				{presets.length === 0 && <p className="text-mute">No presets.</p>}
			</div>
		</Panel>
	);
}

function TargetsPanel() {
	const bosses = useGameStore((s) => s.bosses);
	const required = useGameStore((s) => s.requiredBossIds);
	const setRequired = useGameStore((s) => s.setRequiredBossIds);
	const active = required.length > 0 ? required : bosses.map((b) => b.id);

	const toggle = (id: string, on: boolean) => {
		const next = on ? [...active, id] : active.filter((x) => x !== id);
		// All selected is stored as "empty" so new bosses added later count too
		setRequired(next.length === bosses.length ? [] : next);
	};

	return (
		<Panel
			title="Achievement targets"
			actions={
				<Button size="sm" variant="ghost" onClick={() => setRequired([])}>
					Select all
				</Button>
			}
		>
			<p className="mb-3 text-xs text-mute">
				Bosses that count toward the progress bar and the completion bonus. Copied into each
				new run; use "Apply to open run" under Rates to update the current one.
			</p>
			<div className="flex flex-wrap gap-2">
				{bosses.map((b) => (
					<Toggle
						key={b.id}
						checked={active.includes(b.id)}
						onChange={(on) => toggle(b.id, on)}
					>
						<BossAvatar boss={b} size={20} dim={!active.includes(b.id)} />
						{b.name}
					</Toggle>
				))}
			</div>
		</Panel>
	);
}

function DataPanel() {
	const replaceData = useGameStore((s) => s.replaceData);
	const bosses = useGameStore((s) => s.bosses);

	const exportBackup = async () => {
		const path = await window.api.exportData(toAppData(useGameStore.getState()));
		if (path) toast(`Backup saved to ${path}`);
	};

	const importBackup = async () => {
		const raw = await window.api.importData();
		if (!raw) return;
		const ok = await confirmAction({
			title: 'Replace all data?',
			message:
				'Everything currently in the app (runs, friends, payments, settings) is replaced by the backup file. Export a backup first if unsure.',
			confirmLabel: 'Replace',
			danger: true,
		});
		if (!ok) return;
		replaceData(migrate(raw, bosses));
		toast('Backup imported');
	};

	return (
		<Panel title="Data">
			<div className="flex flex-wrap gap-2">
				<Button onClick={exportBackup}>Export backup</Button>
				<Button onClick={importBackup}>Import backup</Button>
				<Button variant="ghost" onClick={() => window.api.openDataFolder()}>
					Open data folder
				</Button>
			</div>
			<p className="mt-3 text-xs text-mute">
				Data saves automatically as one JSON file in the app data folder.
			</p>
		</Panel>
	);
}

export default function SettingsTab() {
	return (
		<div className="max-w-4xl space-y-5">
			<RatesPanel />
			<PresetsPanel />
			<TargetsPanel />
			<DataPanel />
		</div>
	);
}
