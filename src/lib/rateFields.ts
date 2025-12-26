import type { Rates } from '../models';

export interface RateField {
	key: keyof Rates;
	label: string;
	hint: string;
	kind: 'bonus' | 'penalty';
}

export const RATE_FIELDS: RateField[] = [
	{
		key: 'basePerBoss',
		label: 'Base per boss killed',
		hint: 'Every helper in the raid gets this for each boss that dies.',
		kind: 'bonus',
	},
	{
		key: 'pmcKill',
		label: 'PMC kill',
		hint: 'Per enemy PMC the helper kills.',
		kind: 'bonus',
	},
	{
		key: 'extract',
		label: 'Extract with hunter',
		hint: 'Helper extracted together with the hunter.',
		kind: 'bonus',
	},
	{
		key: 'helperDeath',
		label: 'Helper death',
		hint: 'Deducted when a helper dies in the raid.',
		kind: 'penalty',
	},
	{
		key: 'teamKill',
		label: 'Team kill',
		hint: 'Deducted per friendly kill.',
		kind: 'penalty',
	},
	{
		key: 'hunterDeath',
		label: 'Hunter death',
		hint: 'Deducted from every helper when the hunter dies. A hunter death also ends the run.',
		kind: 'penalty',
	},
	{
		key: 'completionBonus',
		label: 'Completion bonus',
		hint: 'Every helper gets this when the run is completed with all targets dead.',
		kind: 'bonus',
	},
];
