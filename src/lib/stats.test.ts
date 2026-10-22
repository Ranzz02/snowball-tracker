import { describe, expect, it } from 'vitest';
import { defaultRates, type Run } from '../models';
import { helperStats } from './stats';

const helper = (friendId: string, over = {}) => ({
	friendId,
	pmcKills: 0,
	teamKills: 0,
	died: false,
	extracted: false,
	adjustments: [],
	...over,
});

const run: Run = {
	id: 'run1',
	createdAt: '',
	status: 'active',
	hunterId: 'h',
	squad: ['f1', 'f2'],
	notes: '',
	requiredBossIds: [],
	completionBonus: 0,
	raids: [
		{
			id: 'r1',
			mapId: 'customs',
			createdAt: '',
			notes: '',
			hunterDied: false,
			rates: defaultRates,
			bosses: [
				{ bossId: 'a', killed: true },
				{ bossId: 'b', killed: false },
			],
			helpers: {
				f1: helper('f1', { pmcKills: 2, extracted: true }),
				f2: helper('f2', { died: true, teamKills: 1 }),
			},
		},
		{
			id: 'r2',
			mapId: 'woods',
			createdAt: '',
			notes: '',
			hunterDied: false,
			rates: defaultRates,
			bosses: [{ bossId: 'c', killed: true }],
			helpers: { f1: helper('f1', { pmcKills: 1 }) },
		},
	],
};

describe('helperStats', () => {
	it('adds up each helper across raids', () => {
		const s = helperStats([run]);
		expect(s.f1).toEqual({
			raids: 2,
			bossKills: 2,
			pmcKills: 3,
			teamKills: 0,
			deaths: 0,
			extracts: 1,
		});
		expect(s.f2).toEqual({
			raids: 1,
			bossKills: 1,
			pmcKills: 0,
			teamKills: 1,
			deaths: 1,
			extracts: 0,
		});
	});

	it('is empty without runs', () => {
		expect(helperStats([])).toEqual({});
	});
});
