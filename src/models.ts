export interface Boss {
	id: string;
	name: string;
	icon?: string;
	maps?: string[];
	group?: string;
}

export interface GameMap {
	id: string;
	name: string;
}

export interface Friend {
	id: string;
	name: string;
	color: string;
	archived?: boolean;
}

/** Amounts in roubles. Penalty rates are positive and subtracted by the payout engine. */
export interface Rates {
	basePerBoss: number; // per boss killed, per helper
	pmcKill: number; // per PMC kill
	extract: number; // helper extracted with the hunter
	helperDeath: number; // penalty, helper died
	teamKill: number; // penalty per friendly kill
	hunterDeath: number; // penalty for every helper when the hunter dies
	completionBonus: number; // every helper once the run is completed
}

export interface Adjustment {
	id: string;
	amount: number; // signed
	reason: string;
	presetId?: string;
	timestamp: string;
}

export interface RaidHelper {
	friendId: string;
	pmcKills: number;
	teamKills: number;
	died: boolean;
	extracted: boolean;
	adjustments: Adjustment[];
}

export interface RaidBoss {
	bossId: string;
	killed: boolean;
	killedAt?: string;
}

export interface Raid {
	id: string;
	mapId: string;
	createdAt: string;
	notes: string;
	hunterDied: boolean;
	rates: Rates; // snapshot of settings when the raid was created
	bosses: RaidBoss[];
	helpers: Record<string, RaidHelper>;
}

export type RunStatus = 'active' | 'completed' | 'abandoned';

export interface Run {
	id: string;
	createdAt: string;
	endedAt?: string;
	status: RunStatus;
	hunterId: string; // "" = not set (migrated runs)
	squad: string[];
	raids: Raid[];
	notes: string;
}

export interface Preset {
	id: string;
	label: string;
	amount: number; // signed
}

export interface Payment {
	id: string;
	friendId: string;
	amount: number;
	timestamp: string;
	note?: string;
}

export interface AppData {
	schemaVersion: 2;
	friends: Friend[];
	runs: Record<string, Run>;
	activeRunId: string | null;
	rates: Rates;
	presets: Preset[];
	requiredBossIds: string[]; // empty = all bosses
	payments: Payment[];
}

export const defaultRates: Rates = {
	basePerBoss: 250000,
	pmcKill: 80000,
	extract: 250000,
	helperDeath: 100000,
	teamKill: 500000,
	hunterDeath: 100000,
	completionBonus: 1000000,
};

export const defaultPresets: Preset[] = [
	{ id: 'preset-gear', label: "Lost hunter's gear", amount: -100000 },
	{ id: 'preset-loot', label: 'Carried boss loot', amount: 50000 },
	{ id: 'preset-late', label: 'Late to raid', amount: -25000 },
];

export function emptyAppData(): AppData {
	return {
		schemaVersion: 2,
		friends: [],
		runs: {},
		activeRunId: null,
		rates: { ...defaultRates },
		presets: defaultPresets.map((p) => ({ ...p })),
		requiredBossIds: [],
		payments: [],
	};
}
