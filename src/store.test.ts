import { beforeEach, describe, expect, it } from 'vitest';
import { emptyAppData } from './models';
import { useGameStore } from './store';

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
