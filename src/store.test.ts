import { beforeEach, describe, expect, it } from 'vitest';
import { emptyAppData } from './models';
import { friendIsUsed, useGameStore } from './store';

describe('setHunterDied', () => {
	let runId: string;
	let raidId: string;

	beforeEach(() => {
		useGameStore.setState({ ...emptyAppData() });
		const s = useGameStore.getState();
		runId = s.startRun('hunter', ['helper']);
		raidId = s.addRaid(runId, 'customs')!;
	});

	const run = () => useGameStore.getState().runs[runId];

	it('ends the run when the hunter dies', () => {
		useGameStore.getState().setHunterDied(runId, raidId, true);
		expect(run().status).toBe('abandoned');
		expect(run().endedAt).toBeDefined();
	});

	it('reopens the run when the only death is undone', () => {
		useGameStore.getState().setHunterDied(runId, raidId, true);
		useGameStore.getState().setHunterDied(runId, raidId, false);
		expect(run().status).toBe('active');
		expect(run().endedAt).toBeUndefined();
	});

	it('does not reopen a run that was completed', () => {
		useGameStore.getState().endRun(runId, 'completed');
		useGameStore.getState().setHunterDied(runId, raidId, false);
		expect(run().status).toBe('completed');
	});
});

describe('run snapshots', () => {
	beforeEach(() => useGameStore.setState({ ...emptyAppData() }));

	it('copies targets and completion bonus when a run starts', () => {
		const s = useGameStore.getState();
		s.setRequiredBossIds(['killa']);
		s.setRates({ completionBonus: 42 });
		const id = s.startRun('hunter', ['helper']);
		s.setRequiredBossIds([]);
		s.setRates({ completionBonus: 7 });
		const run = useGameStore.getState().runs[id];
		expect(run.requiredBossIds).toEqual(['killa']);
		expect(run.completionBonus).toBe(42);
	});

	it('applyRatesToRun refreshes the run snapshots', () => {
		const s = useGameStore.getState();
		const id = s.startRun('hunter', []);
		s.setRequiredBossIds(['killa']);
		s.setRates({ completionBonus: 9 });
		s.applyRatesToRun(id);
		const run = useGameStore.getState().runs[id];
		expect(run.requiredBossIds).toEqual(['killa']);
		expect(run.completionBonus).toBe(9);
	});

	it('only targets bosses the run still needs on the map', () => {
		const s = useGameStore.getState();
		s.setRequiredBossIds(['tagilla']);
		const id = s.startRun('hunter', []);
		const raidId = s.addRaid(id, 'interchange')!;
		const raid = useGameStore.getState().runs[id].raids.find((r) => r.id === raidId)!;
		expect(raid.bosses.map((b) => b.bossId)).toEqual(['tagilla']);
	});
});

describe('friendIsUsed', () => {
	it('counts payments as use', () => {
		const data = emptyAppData();
		data.payments = [{ id: 'p', friendId: 'f1', amount: 1, timestamp: '' }];
		expect(friendIsUsed(data, 'f1')).toBe(true);
		expect(friendIsUsed(data, 'f2')).toBe(false);
	});
});
