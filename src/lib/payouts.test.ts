import { describe, expect, it } from 'vitest';
import { defaultRates, emptyAppData, type Boss, type Raid, type Run } from '../models';
import { bossProgress, ledger, raidLines, runBreakdown, sumLines } from './payouts';

const bosses: Boss[] = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id }));
const rates = { ...defaultRates };

const raid = (
	id: string,
	at: number,
	killed: string[],
	over: Partial<Raid> = {},
	helperOver = {},
): Raid => ({
	id,
	mapId: 'customs',
	createdAt: new Date(2026, 0, 1, at).toISOString(),
	notes: '',
	hunterDied: false,
	rates,
	bosses: killed.map((bossId) => ({ bossId, killed: true })),
	helpers: {
		f1: {
			friendId: 'f1',
			pmcKills: 0,
			teamKills: 0,
			died: false,
			extracted: false,
			adjustments: [],
			...helperOver,
		},
	},
	...over,
});

const run = (raids: Raid[], status: Run['status'] = 'active', over: Partial<Run> = {}): Run => ({
	id: 'run1',
	createdAt: raids[0]?.createdAt ?? '',
	status,
	hunterId: 'h',
	squad: ['f1'],
	raids,
	notes: '',
	requiredBossIds: [],
	completionBonus: rates.completionBonus,
	...over,
});

const ctx = { bosses };

describe('raidLines', () => {
	it('pays base per boss killed', () => {
		const l = raidLines(raid('r', 1, ['a', 'b']));
		expect(sumLines(l.f1)).toBe(2 * rates.basePerBoss);
	});

	it('pays no base when no boss died', () => {
		expect(sumLines(raidLines(raid('r', 1, [])).f1)).toBe(0);
	});

	it('applies kills, extract and penalties', () => {
		const l = raidLines(
			raid('r', 1, ['a'], {}, { pmcKills: 2, teamKills: 1, died: true, extracted: true }),
		);
		expect(sumLines(l.f1)).toBe(
			rates.basePerBoss +
				2 * rates.pmcKill +
				rates.extract -
				rates.helperDeath -
				rates.teamKill,
		);
	});

	it('charges hunter death to every helper', () => {
		const l = raidLines(raid('r', 1, [], { hunterDied: true }));
		expect(sumLines(l.f1)).toBe(-rates.hunterDeath);
	});

	it('still pays base for bosses killed in the hunter-death raid', () => {
		const l = raidLines(raid('r', 1, ['a'], { hunterDied: true }));
		expect(sumLines(l.f1)).toBe(rates.basePerBoss - rates.hunterDeath);
	});

	it('adds signed adjustments', () => {
		const l = raidLines(
			raid(
				'r',
				1,
				[],
				{},
				{
					adjustments: [
						{ id: '1', amount: 5000, reason: 'x', timestamp: '' },
						{ id: '2', amount: -2000, reason: 'y', timestamp: '' },
					],
				},
			),
		);
		expect(sumLines(l.f1)).toBe(3000);
	});
});

describe('runBreakdown', () => {
	it('ignores kills from the raid where the hunter died', () => {
		const r = run([raid('r1', 1, ['a']), raid('r2', 2, ['b'], { hunterDied: true })]);
		const p = bossProgress(r, ctx);
		expect(p.killed).toEqual(['a']);
		expect(p.remaining).toContain('b');
	});

	it('pays completion only for a completed run with all bosses dead', () => {
		const raids = [raid('r1', 1, ['a', 'b', 'c', 'd'])];
		expect(runBreakdown(run(raids, 'active'), ctx).completion.f1).toBeUndefined();
		const done = runBreakdown(run(raids, 'completed'), ctx);
		expect(done.completion.f1[0].amount).toBe(rates.completionBonus);
		const partial = run([raid('r1', 1, ['a'])], 'completed');
		expect(runBreakdown(partial, ctx).completion.f1).toBeUndefined();
	});

	it('honours requiredBossIds', () => {
		const r = run([raid('r1', 1, ['a'])], 'active', { requiredBossIds: ['a', 'b'] });
		const p = bossProgress(r, ctx);
		expect(p.killed).toEqual(['a']);
		expect(p.remaining).toEqual(['b']);
	});
});

describe('run snapshots', () => {
	const completed = () => {
		const data = emptyAppData();
		data.friends = [{ id: 'f1', name: 'F', color: '#fff' }];
		data.runs = {
			run1: run([raid('r1', 1, ['a', 'b'])], 'completed', { requiredBossIds: ['a', 'b'] }),
		};
		return data;
	};

	it('keeps a finished run unchanged when global settings change', () => {
		const data = completed();
		const before = ledger(data, bosses).f1.earned;
		data.rates.completionBonus = 1;
		data.requiredBossIds = ['a', 'b', 'c', 'd'];
		expect(ledger(data, bosses).f1.earned).toBe(before);
		expect(before).toBe(2 * rates.basePerBoss + rates.completionBonus);
	});
});

describe('ledger', () => {
	it('subtracts payments from earnings', () => {
		const data = emptyAppData();
		data.friends = [{ id: 'f1', name: 'F', color: '#fff' }];
		data.runs = { run1: run([raid('r1', 1, ['a'])]) };
		data.payments = [{ id: 'p', friendId: 'f1', amount: 100000, timestamp: '' }];
		const l = ledger(data, bosses).f1;
		expect(l.earned).toBe(rates.basePerBoss);
		expect(l.paid).toBe(100000);
		expect(l.owed).toBe(rates.basePerBoss - 100000);
	});
});
