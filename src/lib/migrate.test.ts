import { describe, expect, it } from 'vitest';
import { defaultRates, type Boss } from '../models';
import { migrate } from './migrate';
import { ledger } from './payouts';

const bosses: Boss[] = [
	{ id: 'kaban', name: 'Kaban', maps: ['streets-of-tarkov'] },
	{ id: 'tagilla', name: 'Tagilla', maps: ['factory', 'interchange'] },
];

const reward = (friendId: string, extra = {}) => ({
	friendId,
	participationPayout: 250000,
	pmcKills: 0,
	pmcKillBonus: 80000,
	extractBonus: 250000,
	helpedExtract: false,
	customRewards: [],
	...extra,
});

// Oldest shape: one boss on the raid itself, no mapId
const febRaid = {
	id: 'raid-1',
	bossId: 'kaban',
	timestamp: '2026-02-08T18:19:43.928Z',
	killed: true,
	extractedWithHunter: false,
	rewards: { f1: reward('f1'), f2: reward('f2') },
	notes: '',
};

// Current shape: bosses[] with a legacy copy at raid level
const currentRaid = {
	id: 'raid-2',
	mapId: 'interchange',
	createdAt: '2026-02-09T10:00:00.000Z',
	timestamp: '2026-02-09T10:00:00.000Z',
	notes: '',
	bosses: [
		{
			bossId: 'tagilla',
			timestamp: '2026-02-09T10:00:00.000Z',
			killed: true,
			rewards: {
				f1: reward('f1', {
					customRewards: [{ id: 'c1', amount: -5000, reason: 'oops' }],
				}),
			},
		},
	],
	rewards: {
		f1: reward('f1', {
			pmcKills: 2,
			customRewards: [{ id: 'c1', amount: -5000, reason: 'oops' }],
		}),
	},
};

const makeV1 = (basePay = 250000) => ({
	runs: {
		r1: {
			id: 'r1',
			createdAt: '2026-02-08T18:00:00.000Z',
			status: 'abandoned',
			currentSquad: ['f1', 'f2'],
			raids: [
				{
					...febRaid,
					rewards: {
						f1: reward('f1'),
						f2: reward('f2', { participationPayout: basePay }),
					},
				},
				currentRaid,
			],
			notes: '',
		},
	},
	friends: [
		{ id: 'f1', name: 'One', color: '#111111' },
		{ id: 'f2', name: 'Two', color: '#222222' },
	],
	rewardConfig: {
		helperParticipationPayout: 250000,
		pmcKillBonus: 80000,
		extractBonus: 250000,
	},
	activeRunId: null,
});

describe('migrate v1', () => {
	const data = migrate(makeV1(), bosses);
	const [oldRaid, newRaid] = data.runs.r1.raids;

	it('converts the single-boss raid and infers its map', () => {
		expect(oldRaid.bosses).toEqual([
			expect.objectContaining({ bossId: 'kaban', killed: true }),
		]);
		expect(oldRaid.mapId).toBe('streets-of-tarkov');
		expect(Object.keys(oldRaid.helpers).sort()).toEqual(['f1', 'f2']);
	});

	it('takes pmc kills from the raid-level copy and dedupes adjustments', () => {
		expect(newRaid.helpers.f1.pmcKills).toBe(2);
		expect(newRaid.helpers.f1.adjustments).toHaveLength(1);
	});

	it('keeps earnings identical to the old formula', () => {
		const l = ledger(data, bosses);
		// f1: 250k (kaban) + 250k (tagilla) + 2*80k - 5k
		expect(l.f1.earned).toBe(250000 + 250000 + 160000 - 5000);
		expect(l.f2.earned).toBe(250000);
	});

	it('preserves a hand-edited base pay with an adjustment', () => {
		const l = ledger(migrate(makeV1(300000), bosses), bosses);
		expect(l.f2.earned).toBe(300000);
	});

	it('marks old runs as having no hunter', () => {
		expect(data.runs.r1.hunterId).toBe('');
		expect(data.schemaVersion).toBe(2);
	});
});

describe('migrate v2', () => {
	it('passes v2 through and fills missing fields', () => {
		const out = migrate({ schemaVersion: 2, friends: [] }, bosses);
		expect(out.presets.length).toBeGreaterThan(0);
		expect(out.payments).toEqual([]);
	});

	it('drops removed rate keys from global and raid rates', () => {
		const legacyRates = { ...defaultRates, streakBonus: 50000, streakThreshold: 3 };
		const out = migrate(
			{
				schemaVersion: 2,
				rates: legacyRates,
				runs: {
					r1: {
						id: 'r1',
						createdAt: '',
						status: 'active',
						hunterId: '',
						squad: [],
						notes: '',
						raids: [
							{
								id: 'x',
								mapId: '',
								createdAt: '',
								notes: '',
								hunterDied: false,
								rates: legacyRates,
								bosses: [],
								helpers: {},
							},
						],
					},
				},
			},
			bosses,
		);
		expect(out.rates).toEqual(defaultRates);
		expect(out.runs.r1.raids[0].rates).toEqual(defaultRates);
	});

	it('returns empty data for junk', () => {
		expect(migrate(null, bosses).friends).toEqual([]);
	});
});
