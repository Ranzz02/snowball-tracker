import { useMemo } from 'react';
import { useGameStore } from '../store';
import type { BossContext } from './payouts';
import type { Friend } from '../models';

export function useBossContext(): BossContext {
	const bosses = useGameStore((s) => s.bosses);
	const requiredBossIds = useGameStore((s) => s.requiredBossIds);
	const rates = useGameStore((s) => s.rates);
	return useMemo(() => ({ bosses, requiredBossIds, rates }), [bosses, requiredBossIds, rates]);
}

export function useFriendMap(): Record<string, Friend> {
	const friends = useGameStore((s) => s.friends);
	return useMemo(() => Object.fromEntries(friends.map((f) => [f.id, f])), [friends]);
}
