import {
	defaultPresets,
	defaultRates,
	emptyAppData,
	SCHEMA_VERSION,
	type Adjustment,
	type AppData,
	type Boss,
	type Friend,
	type Raid,
	type RaidHelper,
	type Rates,
	type Run,
} from '../models';

// ---- Legacy (v1) shapes: loose on purpose, data came from two app generations ----

interface LegacyCustomReward {
	id: string;
	amount: number;
	reason: string;
	timestamp?: string;
}

interface LegacyReward {
	friendId: string;
	participationPayout?: number;
	pmcKills?: number;
	pmcKillBonus?: number;
	helpedExtract?: boolean;
	customRewards?: LegacyCustomReward[];
}

type LegacyRewards = Record<string, LegacyReward>;

interface LegacyBossEntry {
	bossId: string;
	timestamp?: string;
	killed?: boolean;
	rewards?: LegacyRewards;
}

interface LegacyRaid {
	id: string;
	mapId?: string;
	createdAt?: string;
	timestamp?: string;
	notes?: string;
	bossId?: string; // oldest format: single boss on the raid
	killed?: boolean;
	extractedWithHunter?: boolean;
	rewards?: LegacyRewards;
	bosses?: LegacyBossEntry[];
}

interface LegacyRun {
	id: string;
	createdAt: string;
	status: Run['status'];
	raids?: LegacyRaid[];
	currentSquad?: string[];
	notes?: string;
}

interface LegacyData {
	runs?: Record<string, LegacyRun>;
	friends?: Friend[];
	rewardConfig?: {
		helperParticipationPayout?: number;
		pmcKillBonus?: number;
		extractBonus?: number;
	} | null;
	activeRunId?: string | null;
}

const FRIEND_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];

function migrateRaid(legacy: LegacyRaid, base: Rates, bosses: Boss[]): Raid {
	const entries: LegacyBossEntry[] = Array.isArray(legacy.bosses)
		? legacy.bosses
		: legacy.bossId
			? [
					{
						bossId: legacy.bossId,
						timestamp: legacy.timestamp,
						killed: legacy.killed,
						rewards: legacy.rewards,
					},
				]
			: [];

	const createdAt = legacy.createdAt ?? legacy.timestamp ?? new Date().toISOString();

	// All reward sources for a friend: every boss entry plus the legacy raid-level copy
	const sources: LegacyRewards[] = [...entries.map((e) => e.rewards ?? {}), legacy.rewards ?? {}];
	const friendIds = new Set(sources.flatMap((s) => Object.keys(s)));

	const firstReward = sources
		.flatMap((s) => Object.values(s))
		.find((r) => r.participationPayout !== undefined);
	const rates: Rates = {
		...base,
		basePerBoss: firstReward?.participationPayout ?? base.basePerBoss,
		pmcKill: firstReward?.pmcKillBonus ?? base.pmcKill,
	};

	const killedEntries = entries.filter((e) => e.killed);
	const helpers: Record<string, RaidHelper> = {};

	for (const friendId of friendIds) {
		const rewards = sources.map((s) => s[friendId]).filter((r): r is LegacyReward => !!r);

		const pmcKills = Math.max(0, ...rewards.map((r) => r.pmcKills ?? 0));
		const extracted = !!legacy.extractedWithHunter && rewards.some((r) => r.helpedExtract);

		const adjustments: Adjustment[] = [];
		const seen = new Set<string>();
		for (const r of rewards) {
			for (const cr of r.customRewards ?? []) {
				if (seen.has(cr.id)) continue;
				seen.add(cr.id);
				adjustments.push({
					id: cr.id,
					amount: cr.amount,
					reason: cr.reason,
					timestamp: cr.timestamp ?? createdAt,
				});
			}
		}

		// Keep totals identical when an old helper had a hand-edited base or kill bonus
		const oldBase = killedEntries.reduce(
			(sum, e) => sum + (e.rewards?.[friendId]?.participationPayout ?? rates.basePerBoss),
			0,
		);
		const baseDiff = oldBase - rates.basePerBoss * killedEntries.length;
		if (baseDiff !== 0) {
			adjustments.push({
				id: `migrated-base-${friendId}`,
				amount: baseDiff,
				reason: 'Migrated base pay difference',
				timestamp: createdAt,
			});
		}
		const ownBonus = rewards.find((r) => r.pmcKillBonus !== undefined)?.pmcKillBonus;
		if (ownBonus !== undefined && pmcKills > 0 && ownBonus !== rates.pmcKill) {
			adjustments.push({
				id: `migrated-pmc-${friendId}`,
				amount: pmcKills * (ownBonus - rates.pmcKill),
				reason: 'Migrated PMC bonus difference',
				timestamp: createdAt,
			});
		}

		helpers[friendId] = {
			friendId,
			pmcKills,
			teamKills: 0,
			died: false,
			extracted,
			adjustments,
		};
	}

	// Oldest raids have no map: infer it when the boss only spawns on one
	let mapId = legacy.mapId ?? '';
	if (!mapId && entries.length > 0) {
		const maps = bosses.find((b) => b.id === entries[0].bossId)?.maps ?? [];
		if (maps.length === 1) mapId = maps[0];
	}

	return {
		id: legacy.id,
		mapId,
		createdAt,
		notes: legacy.notes ?? '',
		hunterDied: false,
		rates,
		bosses: entries.map((e) => ({
			bossId: e.bossId,
			killed: !!e.killed,
			killedAt: e.killed ? (e.timestamp ?? createdAt) : undefined,
		})),
		helpers,
	};
}

function migrateV1(raw: LegacyData, bosses: Boss[]): AppData {
	const cfg = raw.rewardConfig ?? {};
	const rates: Rates = {
		...defaultRates,
		basePerBoss: cfg.helperParticipationPayout ?? defaultRates.basePerBoss,
		pmcKill: cfg.pmcKillBonus ?? defaultRates.pmcKill,
		extract: cfg.extractBonus ?? defaultRates.extract,
	};

	const runs: Record<string, Run> = {};
	for (const [id, run] of Object.entries(raw.runs ?? {})) {
		runs[id] = {
			id: run.id,
			createdAt: run.createdAt,
			endedAt: run.status === 'active' ? undefined : run.createdAt,
			status: run.status,
			hunterId: '',
			squad: run.currentSquad ?? [],
			raids: (run.raids ?? []).map((r) => migrateRaid(r, rates, bosses)),
			notes: run.notes ?? '',
			requiredBossIds: [],
			completionBonus: rates.completionBonus,
		};
	}

	return {
		...emptyAppData(),
		friends: (raw.friends ?? []).map((f, i) => ({
			...f,
			color: f.color ?? FRIEND_COLORS[i % FRIEND_COLORS.length],
		})),
		runs,
		activeRunId: raw.activeRunId && runs[raw.activeRunId] ? raw.activeRunId : null,
		rates,
	};
}

/** Keep only known rate keys (drops removed ones such as the old streak rates). */
function pickRates(raw: Partial<Rates> | undefined): Rates {
	const out = { ...defaultRates };
	for (const key of Object.keys(defaultRates) as (keyof Rates)[]) {
		const value = raw?.[key];
		if (typeof value === 'number') out[key] = value;
	}
	return out;
}

/**
 * Fill gaps in a v2 or v3 file (older builds, hand-edited backups). v2 runs have no
 * target or completion bonus snapshot, so they take the current settings, which is
 * what v2 computed with, and totals stay the same.
 */
function normalize(raw: Partial<AppData>): AppData {
	const empty = emptyAppData();
	const rates = pickRates(raw.rates);
	const requiredBossIds = raw.requiredBossIds ?? [];
	const runs: Record<string, Run> = {};
	for (const [id, run] of Object.entries(raw.runs ?? {})) {
		runs[id] = {
			...run,
			requiredBossIds: run.requiredBossIds ?? [...requiredBossIds],
			completionBonus: run.completionBonus ?? rates.completionBonus,
			raids: run.raids.map((r) => ({ ...r, rates: pickRates(r.rates) })),
		};
	}
	return {
		schemaVersion: SCHEMA_VERSION,
		friends: raw.friends ?? empty.friends,
		runs,
		activeRunId: raw.activeRunId ?? null,
		rates,
		presets: raw.presets ?? defaultPresets.map((p) => ({ ...p })),
		requiredBossIds,
		payments: raw.payments ?? [],
	};
}

/** Accepts v1 (four old files combined), v2 or v3 data and returns v3. */
export function migrate(raw: unknown, bosses: Boss[]): AppData {
	if (!raw || typeof raw !== 'object') return emptyAppData();
	const data = raw as Record<string, unknown>;
	if (data.schemaVersion === 2 || data.schemaVersion === SCHEMA_VERSION) {
		return normalize(data as Partial<AppData>);
	}
	return migrateV1(data as LegacyData, bosses);
}
