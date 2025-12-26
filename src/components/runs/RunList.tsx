import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useGameStore } from '../../store';
import { useBossContext, useFriendMap } from '../../lib/hooks';
import { bossProgress, runBreakdown } from '../../lib/payouts';
import { formatDate } from '../../lib/format';
import type { Run } from '../../models';
import { confirmAction } from '../ui/feedback';
import { Badge, Button, FriendChip, Panel, Rub } from '../ui/ui';
import StartRunDialog from './StartRunDialog';

const statusTone = { active: 'accent', completed: 'ok', abandoned: 'danger' } as const;

function RunCard({ run }: { run: Run }) {
	const ctx = useBossContext();
	const friends = useFriendMap();
	const setActiveRun = useGameStore((s) => s.setActiveRun);
	const deleteRun = useGameStore((s) => s.deleteRun);
	const progress = useMemo(() => bossProgress(run, ctx), [run, ctx]);
	const total = useMemo(() => runBreakdown(run, ctx).grandTotal, [run, ctx]);
	const hunter = friends[run.hunterId];

	return (
		<div className="flex items-center justify-between gap-4 rounded-sm border bg-panel px-4 py-3 transition hover:border-accent/50">
			<div className="flex items-center gap-4">
				<FriendChip friend={hunter} size={36} />
				<div>
					<div className="flex items-center gap-2">
						<span className="font-display text-lg font-semibold">
							{formatDate(run.createdAt)}
						</span>
						<Badge tone={statusTone[run.status]}>{run.status}</Badge>
					</div>
					<div className="text-xs text-mute">
						{hunter ? `Hunter ${hunter.name}` : 'Hunter not set'} ·{' '}
						{progress.killed.length}/{progress.required.length} bosses ·{' '}
						{run.raids.length} raids
					</div>
				</div>
			</div>
			<div className="flex items-center gap-4">
				<Rub amount={total} className="font-display text-lg font-semibold text-ok" />
				<Button variant="primary" size="sm" onClick={() => setActiveRun(run.id)}>
					Open
				</Button>
				<Button
					variant="danger"
					size="sm"
					onClick={async () => {
						const ok = await confirmAction({
							title: 'Delete run?',
							message: `This removes the run from ${formatDate(run.createdAt)} and all its raids. It cannot be undone.`,
							confirmLabel: 'Delete',
							danger: true,
						});
						if (ok) deleteRun(run.id);
					}}
				>
					Delete
				</Button>
			</div>
		</div>
	);
}

export default function RunList() {
	const runs = useGameStore((s) => s.runs);
	const [starting, setStarting] = useState(false);
	const sorted = useMemo(
		() =>
			Object.values(runs).sort(
				(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			),
		[runs],
	);

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<p className="text-mute">
					One run = one attempt at the achievement. Start a run, log raids, settle up.
				</p>
				<Button variant="primary" onClick={() => setStarting(true)}>
					<Plus size={16} /> Start run
				</Button>
			</div>

			<Panel title="Runs">
				{sorted.length === 0 ? (
					<p className="py-8 text-center text-mute">No runs yet. Start one to begin.</p>
				) : (
					<div className="space-y-2">
						{sorted.map((r) => (
							<RunCard key={r.id} run={r} />
						))}
					</div>
				)}
			</Panel>

			<StartRunDialog open={starting} onClose={() => setStarting(false)} />
		</div>
	);
}
