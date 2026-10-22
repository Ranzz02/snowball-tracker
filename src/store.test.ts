import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyAppData } from './models';
import { clearHistory, friendIsUsed, redo, undo, useGameStore } from './store';

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

describe('undo', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		useGameStore.setState({ ...emptyAppData() });
		clearHistory();
	});
	afterEach(() => vi.useRealTimers());

	const bonus = () => useGameStore.getState().rates.completionBonus;

	it('groups quick changes into one step and redoes them', () => {
		const before = bonus();
		const s = useGameStore.getState();
		s.setRates({ completionBonus: 1 });
		s.setRates({ completionBonus: 12 });
		undo();
		expect(bonus()).toBe(before);
		redo();
		expect(bonus()).toBe(12);
	});

	it('keeps separate steps when changes are apart', () => {
		const s = useGameStore.getState();
		s.setRates({ completionBonus: 1 });
		vi.advanceTimersByTime(1000);
		s.setRates({ completionBonus: 2 });
		undo();
		expect(bonus()).toBe(1);
	});

	it('starts a new step for an edit right after an undo', () => {
		const s = useGameStore.getState();
		s.setRates({ completionBonus: 1 });
		undo();
		s.setRates({ completionBonus: 5 });
		undo();
		expect(useGameStore.temporal.getState().futureStates).toHaveLength(1);
		redo();
		expect(bonus()).toBe(5);
	});

	it('does not record navigation', () => {
		useGameStore.getState().setActiveRun('x');
		expect(useGameStore.temporal.getState().pastStates).toHaveLength(0);
	});
});
