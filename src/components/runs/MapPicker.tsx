import { useGameStore } from '../../store';
import type { Run } from '../../models';
import { useBossContext } from '../../lib/hooks';
import { bossProgress } from '../../lib/payouts';
import { BossAvatar, Panel } from '../ui/ui';

export default function MapPicker({
	run,
	onRaidAdded,
}: {
	run: Run;
	onRaidAdded: (raidId: string) => void;
}) {
	const maps = useGameStore((s) => s.maps);
	const addRaid = useGameStore((s) => s.addRaid);
	const ctx = useBossContext();
	const remaining = new Set(bossProgress(run, ctx).remaining);
	const locked = run.status !== 'active';

	return (
		<Panel title="New raid: pick a map">
			{run.squad.length === 0 && (
				<p className="mb-3 text-sm text-warn">
					No helpers selected. New raids will start without helpers.
				</p>
			)}
			<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
				{maps.map((m) => {
					const left = ctx.bosses.filter(
						(b) => b.maps?.includes(m.id) && remaining.has(b.id),
					);
					return (
						<button
							key={m.id}
							disabled={locked}
							onClick={() => {
								const id = addRaid(run.id, m.id);
								if (id) onRaidAdded(id);
							}}
							className={`rounded-sm border px-3 py-2 text-left transition disabled:opacity-40 ${
								left.length > 0
									? 'border-accent/50 bg-raised hover:border-accent'
									: 'bg-surface text-mute hover:border-line'
							}`}
						>
							<div className="font-display text-base font-semibold uppercase tracking-wide">
								{m.name}
							</div>
							{left.length > 0 ? (
								<div
									className="mt-1.5 flex -space-x-1.5"
									title={left.map((b) => b.name).join(', ')}
								>
									{left.map((b) => (
										<BossAvatar key={b.id} boss={b} size={22} />
									))}
								</div>
							) : (
								<div className="mt-1.5 text-xs text-mute">No targets left</div>
							)}
						</button>
					);
				})}
			</div>
		</Panel>
	);
}
