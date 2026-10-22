import { describe, expect, it } from 'vitest';
import { defaultRates, emptyAppData, type Boss, type Raid, type Run } from '../models';
import { owedSummaryText, raidSummaryText, runSummaryText } from './summary';

const bosses: Boss[] = [
	{ id: 'killa', name: 'Killa' },
	{ id: 'tagilla', name: 'Tagilla' },
];
const ctx = { bosses };

const raid: Raid = {
	id: 'r1',
	mapId: 'interchange',
	createdAt: '2026-01-01T18:00:00.000Z',
	notes: ' good raid ',
	hunterDied: false,
	rates: defaultRates,
	bosses: [
		{ bossId: 'killa', killed: true },
		{ bossId: 'tagilla', killed: false },
	],
	helpers: {
		f1: {
			friendId: 'f1',
			pmcKills: 1,
			teamKills: 0,
			died: false,
			extracted: false,
			adjustments: [],
		},
	},
};

const run: Run = {
	id: 'run1',
	createdAt: raid.createdAt,
	status: 'active',
	hunterId: 'h',
	squad: ['f1'],
	raids: [raid],
	notes: '',
	requiredBossIds: [],
	completionBonus: 0,
};

const data = emptyAppData();
data.friends = [
	{ id: 'h', name: 'Hunter', color: '#fff' },
	{ id: 'f1', name: 'Helper', color: '#fff' },
];
data.runs = { run1: run };

describe('raidSummaryText', () => {
	const text = raidSummaryText(raid, data, ctx, 'Interchange');

	it('lists killed and missed bosses', () => {
		expect(text).toContain('**Raid on Interchange,');
		expect(text).toContain('Killed: Killa | Missed: Tagilla');
	});

	it('shows each helper total with its line labels and the notes', () => {
		const total = defaultRates.basePerBoss + defaultRates.pmcKill;
		expect(text).toContain(`- Helper: ${total.toLocaleString('en-US')} ₽ (Base × 1 boss,`);
		expect(text).toContain('Notes: good raid');
	});

	it('mentions a hunter death', () => {
		expect(raidSummaryText({ ...raid, hunterDied: true }, data, ctx, 'X')).toContain(
			'Hunter died',
		);
	});
});

describe('runSummaryText', () => {
	it('shows hunter, progress and payouts', () => {
		const text = runSummaryText(run, data, ctx);
		expect(text).toContain('Hunter: Hunter | Bosses 1/2 | Raids 1');
		expect(text).toContain('Remaining: Tagilla');
		expect(text).toContain('- Helper:');
	});
});

describe('owedSummaryText', () => {
	it('lists only friends with money moving', () => {
		const text = owedSummaryText(data, bosses);
		expect(text).toContain('- Helper:');
		expect(text).not.toContain('- Hunter:');
	});
});
