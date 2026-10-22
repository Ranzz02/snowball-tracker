import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import bossData from './data/bosses.json';
import mapData from './data/maps.json';
import {
	emptyAppData,
	SCHEMA_VERSION,
	type AppData,
	type Boss,
	type Friend,
	type GameMap,
	type Payment,
	type Preset,
	type Raid,
	type RaidHelper,
	type Rates,
	type Run,
	type RunStatus,
} from './models';
import { migrate } from './lib/migrate';
import { newId } from './lib/format';
import { requiredIds } from './lib/payouts';

export const BOSSES: Boss[] = bossData as Boss[];
export const MAPS: GameMap[] = mapData as GameMap[];

export type HelperPatch = Partial<
	Pick<RaidHelper, 'pmcKills' | 'teamKills' | 'died' | 'extracted'>
>;

interface Actions {
	// Runs
	startRun: (hunterId: string, squad: string[]) => string;
	setActiveRun: (runId: string | null) => void;
	endRun: (runId: string, status: Exclude<RunStatus, 'active'>) => void;
	reopenRun: (runId: string) => void;
	deleteRun: (runId: string) => void;
	setHunter: (runId: string, hunterId: string) => void;
	setSquad: (runId: string, squad: string[]) => void;
	setRunNotes: (runId: string, notes: string) => void;

	// Raids
	addRaid: (runId: string, mapId: string) => string | null;
	deleteRaid: (runId: string, raidId: string) => void;
	setRaidNotes: (runId: string, raidId: string, notes: string) => void;
	setRaidRates: (runId: string, raidId: string, patch: Partial<Rates>) => void;
	toggleBossKilled: (runId: string, raidId: string, bossId: string, killed: boolean) => void;
	setHunterDied: (runId: string, raidId: string, died: boolean) => void;

	// Helpers within a raid
	addHelper: (runId: string, raidId: string, friendId: string) => void;
	removeHelper: (runId: string, raidId: string, friendId: string) => void;
	setHelperField: (runId: string, raidId: string, friendId: string, patch: HelperPatch) => void;
	addAdjustment: (
		runId: string,
		raidId: string,
		friendId: string,
		adj: { amount: number; reason: string; presetId?: string },
	) => void;
	removeAdjustment: (
		runId: string,
		raidId: string,
		friendId: string,
		adjustmentId: string,
	) => void;

	// Settings
	setRates: (patch: Partial<Rates>) => void;
	applyRatesToRun: (runId: string) => void;
	savePreset: (preset: Preset) => void;
	deletePreset: (presetId: string) => void;
	setRequiredBossIds: (ids: string[]) => void;

	// Friends
	addFriend: (name: string, color: string) => void;
	updateFriend: (friendId: string, patch: Partial<Omit<Friend, 'id'>>) => void;
	deleteFriend: (friendId: string) => void;

	// Payments
	addPayment: (payment: Omit<Payment, 'id' | 'timestamp'>) => void;
	removePayment: (paymentId: string) => void;

	// Data
	replaceData: (data: AppData) => void;
}

interface Runtime {
	ready: boolean;
	bosses: Boss[];
	maps: GameMap[];
}

export type Store = AppData & Runtime & Actions;

export const toAppData = (s: AppData): AppData => ({
	schemaVersion: SCHEMA_VERSION,
	friends: s.friends,
	runs: s.runs,
	activeRunId: s.activeRunId,
	rates: s.rates,
	presets: s.presets,
	requiredBossIds: s.requiredBossIds,
	payments: s.payments,
});

function newHelper(friendId: string): RaidHelper {
	return {
		friendId,
		pmcKills: 0,
		teamKills: 0,
		died: false,
		extracted: false,
		adjustments: [],
	};
}

export const useGameStore = create<Store>()(
	immer((set, get) => {
		// Run `fn` on one raid inside the immer draft; missing run/raid is a no-op
		const withRaid = (runId: string, raidId: string, fn: (raid: Raid, run: Run) => void) =>
			set((s) => {
				const run = s.runs[runId];
				const raid = run?.raids.find((r) => r.id === raidId);
				if (run && raid) fn(raid, run);
			});

		return {
			...emptyAppData(),
			ready: false,
			bosses: BOSSES,
			maps: MAPS,

			startRun: (hunterId, squad) => {
				const id = newId('run');
				set((s) => {
					s.runs[id] = {
						id,
						createdAt: new Date().toISOString(),
						status: 'active',
						hunterId,
						squad: squad.filter((f) => f !== hunterId),
						raids: [],
						notes: '',
						requiredBossIds: [...s.requiredBossIds],
						completionBonus: s.rates.completionBonus,
					};
					s.activeRunId = id;
				});
				return id;
			},

			setActiveRun: (runId) =>
				set((s) => {
					s.activeRunId = runId;
				}),

			endRun: (runId, status) =>
				set((s) => {
					const run = s.runs[runId];
					if (!run) return;
					run.status = status;
					run.endedAt = new Date().toISOString();
				}),

			reopenRun: (runId) =>
				set((s) => {
					const run = s.runs[runId];
					if (!run) return;
					run.status = 'active';
					run.endedAt = undefined;
				}),

			deleteRun: (runId) =>
				set((s) => {
					delete s.runs[runId];
					if (s.activeRunId === runId) s.activeRunId = null;
				}),

			setHunter: (runId, hunterId) =>
				set((s) => {
					const run = s.runs[runId];
					if (!run) return;
					run.hunterId = hunterId;
					run.squad = run.squad.filter((f) => f !== hunterId);
				}),

			setSquad: (runId, squad) =>
				set((s) => {
					const run = s.runs[runId];
					if (run) run.squad = squad.filter((f) => f !== run.hunterId);
				}),

			setRunNotes: (runId, notes) =>
				set((s) => {
					const run = s.runs[runId];
					if (run) run.notes = notes;
				}),

			addRaid: (runId, mapId) => {
				const s = get();
				const run = s.runs[runId];
				if (!run) return null;

				// Bosses that spawn here and still matter for this run
				const onMap = s.bosses.filter((b) => b.maps?.includes(mapId));
				const killed = new Set(
					run.raids.flatMap((r) => r.bosses.filter((b) => b.killed).map((b) => b.bossId)),
				);
				const required = new Set(requiredIds(run, s));
				const wanted = onMap.filter((b) => required.has(b.id) && !killed.has(b.id));
				const targets = wanted.length > 0 ? wanted : onMap;

				const id = newId('raid');
				set((d) => {
					d.runs[runId].raids.push({
						id,
						mapId,
						createdAt: new Date().toISOString(),
						notes: '',
						hunterDied: false,
						rates: { ...d.rates },
						bosses: targets.map((b) => ({
							bossId: b.id,
							killed: false,
						})),
						helpers: Object.fromEntries(run.squad.map((f) => [f, newHelper(f)])),
					});
				});
				return id;
			},

			deleteRaid: (runId, raidId) =>
				set((s) => {
					const run = s.runs[runId];
					if (run) run.raids = run.raids.filter((r) => r.id !== raidId);
				}),

			setRaidNotes: (runId, raidId, notes) =>
				withRaid(runId, raidId, (raid) => {
					raid.notes = notes;
				}),

			setRaidRates: (runId, raidId, patch) =>
				withRaid(runId, raidId, (raid) => {
					Object.assign(raid.rates, patch);
				}),

			toggleBossKilled: (runId, raidId, bossId, killed) =>
				withRaid(runId, raidId, (raid) => {
					const b = raid.bosses.find((x) => x.bossId === bossId);
					if (!b) return;
					b.killed = killed;
					b.killedAt = killed ? new Date().toISOString() : undefined;
				}),

			// A hunter death ends the run; clearing the last one (a mis-click) reopens it
			setHunterDied: (runId, raidId, died) =>
				withRaid(runId, raidId, (raid, run) => {
					raid.hunterDied = died;
					if (died && run.status === 'active') {
						run.status = 'abandoned';
						run.endedAt = new Date().toISOString();
					} else if (
						!died &&
						run.status === 'abandoned' &&
						!run.raids.some((r) => r.hunterDied)
					) {
						run.status = 'active';
						run.endedAt = undefined;
					}
				}),

			addHelper: (runId, raidId, friendId) =>
				withRaid(runId, raidId, (raid) => {
					raid.helpers[friendId] ??= newHelper(friendId);
				}),

			removeHelper: (runId, raidId, friendId) =>
				withRaid(runId, raidId, (raid) => {
					delete raid.helpers[friendId];
				}),

			setHelperField: (runId, raidId, friendId, patch) =>
				withRaid(runId, raidId, (raid) => {
					const h = raid.helpers[friendId];
					if (!h) return;
					if (patch.pmcKills !== undefined) h.pmcKills = Math.max(0, patch.pmcKills);
					if (patch.teamKills !== undefined) h.teamKills = Math.max(0, patch.teamKills);
					if (patch.died !== undefined) h.died = patch.died;
					if (patch.extracted !== undefined) h.extracted = patch.extracted;
				}),

			addAdjustment: (runId, raidId, friendId, adj) =>
				withRaid(runId, raidId, (raid) => {
					raid.helpers[friendId]?.adjustments.push({
						id: newId('adj'),
						amount: adj.amount,
						reason: adj.reason,
						presetId: adj.presetId,
						timestamp: new Date().toISOString(),
					});
				}),

			removeAdjustment: (runId, raidId, friendId, adjustmentId) =>
				withRaid(runId, raidId, (raid) => {
					const h = raid.helpers[friendId];
					if (h) h.adjustments = h.adjustments.filter((a) => a.id !== adjustmentId);
				}),

			setRates: (patch) =>
				set((s) => {
					Object.assign(s.rates, patch);
				}),

			applyRatesToRun: (runId) =>
				set((s) => {
					const run = s.runs[runId];
					if (!run) return;
					for (const raid of run.raids) raid.rates = { ...s.rates };
					run.completionBonus = s.rates.completionBonus;
					run.requiredBossIds = [...s.requiredBossIds];
				}),

			savePreset: (preset) =>
				set((s) => {
					const i = s.presets.findIndex((p) => p.id === preset.id);
					if (i >= 0) s.presets[i] = preset;
					else s.presets.push(preset);
				}),

			deletePreset: (presetId) =>
				set((s) => {
					s.presets = s.presets.filter((p) => p.id !== presetId);
				}),

			setRequiredBossIds: (ids) =>
				set((s) => {
					s.requiredBossIds = ids;
				}),

			addFriend: (name, color) =>
				set((s) => {
					s.friends.push({
						id: newId('friend'),
						name: name.trim(),
						color,
					});
				}),

			updateFriend: (friendId, patch) =>
				set((s) => {
					const f = s.friends.find((x) => x.id === friendId);
					if (f) Object.assign(f, patch);
				}),

			deleteFriend: (friendId) =>
				set((s) => {
					s.friends = s.friends.filter((f) => f.id !== friendId);
				}),

			addPayment: (payment) =>
				set((s) => {
					s.payments.push({
						...payment,
						id: newId('pay'),
						timestamp: new Date().toISOString(),
					});
				}),

			removePayment: (paymentId) =>
				set((s) => {
					s.payments = s.payments.filter((p) => p.id !== paymentId);
				}),

			replaceData: (data) => set(() => ({ ...toAppData(data) })),
		};
	}),
);

/** True when a friend appears in any run (as hunter, squad member or helper) or payment. */
export function friendIsUsed(data: AppData, friendId: string): boolean {
	if (data.payments.some((p) => p.friendId === friendId)) return true;
	return Object.values(data.runs).some(
		(r) =>
			r.hunterId === friendId ||
			r.squad.includes(friendId) ||
			r.raids.some((raid) => friendId in raid.helpers),
	);
}

let initPromise: Promise<void> | null = null;

// StrictMode runs effects twice in dev; initialise (and subscribe) only once
export function initializeStore(): Promise<void> {
	return (initPromise ??= loadAndWatch());
}

async function loadAndWatch() {
	const raw = await window.api.loadData();
	const data = migrate(raw, BOSSES);
	useGameStore.setState({ ...toAppData(data), ready: true });

	let last = JSON.stringify(toAppData(useGameStore.getState()));
	let timer: ReturnType<typeof setTimeout> | undefined;

	const flush = () => {
		clearTimeout(timer);
		timer = undefined;
		const current = toAppData(useGameStore.getState());
		const json = JSON.stringify(current);
		if (json === last) return;
		last = json;
		window.api.saveData(current).catch((e) => console.error('Save failed', e));
	};

	// A first launch after upgrading writes the migrated file straight away
	if (raw && (raw as { schemaVersion?: number }).schemaVersion !== SCHEMA_VERSION) {
		last = '';
		flush();
	}

	useGameStore.subscribe(() => {
		clearTimeout(timer);
		timer = setTimeout(flush, 300);
	});
	window.addEventListener('beforeunload', flush);
}
