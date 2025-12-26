import { useMemo, useState } from 'react';
import { ArrowLeft, ClipboardCopy, Skull } from 'lucide-react';
import { toAppData, useGameStore } from '../../store';
import type { Run } from '../../models';
import { useBossContext } from '../../lib/hooks';
import { bossProgress, runBreakdown } from '../../lib/payouts';
import { runSummaryText } from '../../lib/summary';
import { formatDateTime } from '../../lib/format';
import { confirmAction, toast } from '../ui/feedback';
import { Badge, Button, Panel } from '../ui/ui';
import BossChecklist from './BossChecklist';
import MapPicker from './MapPicker';
import SquadPanel from './SquadPanel';
import RaidCard from './raids/RaidCard';
import RaidEditor from './raids/RaidEditor';

const statusTone = { active: 'accent', completed: 'ok', abandoned: 'danger' } as const;

export default function RunDashboard({ run }: { run: Run }) {
	const ctx = useBossContext();
	const setActiveRun = useGameStore((s) => s.setActiveRun);
	const endRun = useGameStore((s) => s.endRun);
	const reopenRun = useGameStore((s) => s.reopenRun);
	const [openRaidId, setOpenRaidId] = useState<string | null>(null);

	const breakdown = useMemo(() => runBreakdown(run, ctx), [run, ctx]);
	const raids = useMemo(
		() =>
			[...run.raids].sort(
				(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			),
		[run.raids],
	);

	const hunterKia = run.raids.some((r) => r.hunterDied);

	const finish = async (status: 'completed' | 'abandoned') => {
		const remaining = bossProgress(run, ctx).remaining.length;
		const ok = await confirmAction({
			title: status === 'completed' ? 'Complete run?' : 'Abandon run?',
			message:
				status === 'completed'
					? remaining > 0
						? `${remaining} target boss(es) are still alive, so the completion bonus will not be paid.`
						: 'Marks the run complete and pays the completion bonus to every helper.'
					: 'Marks the run as failed. You can reopen it later.',
			confirmLabel: status === 'completed' ? 'Complete' : 'Abandon',
			danger: status === 'abandoned',
		});
		if (ok) endRun(run.id, status);
	};

	const copySummary = async () => {
		const text = runSummaryText(run, toAppData(useGameStore.getState()), ctx);
		try {
			await navigator.clipboard.writeText(text);
			toast('Run summary copied');
		} catch {
			toast('Could not copy to clipboard', 'danger');
		}
	};

	return (
		<div className="space-y-5">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					<Button variant="ghost" size="sm" onClick={() => setActiveRun(null)}>
						<ArrowLeft size={14} /> All runs
					</Button>
					<Badge tone={statusTone[run.status]}>{run.status}</Badge>
					{hunterKia && (
						<span className="flex items-center gap-1 text-xs text-danger">
							<Skull size={13} /> Hunter KIA, run over
						</span>
					)}
					<span className="text-xs text-mute">
						Started {formatDateTime(run.createdAt)}
					</span>
				</div>
				<div className="flex gap-2">
					<Button size="sm" onClick={copySummary}>
						<ClipboardCopy size={14} /> Copy summary
					</Button>
					{run.status === 'active' ? (
						<>
							<Button variant="primary" size="sm" onClick={() => finish('completed')}>
								Complete
							</Button>
							<Button variant="danger" size="sm" onClick={() => finish('abandoned')}>
								Abandon
							</Button>
						</>
					) : (
						<Button size="sm" onClick={() => reopenRun(run.id)}>
							Reopen
						</Button>
					)}
				</div>
			</div>

			<div className="grid gap-5 lg:grid-cols-[320px_1fr]">
				<div className="space-y-5">
					<BossChecklist run={run} />
					<SquadPanel run={run} />
				</div>
				<div className="space-y-5">
					<MapPicker run={run} onRaidAdded={setOpenRaidId} />
					<Panel title={`Raids (${raids.length})`}>
						{raids.length === 0 ? (
							<p className="py-6 text-center text-mute">
								No raids yet. Pick a map above to log one.
							</p>
						) : (
							<div className="space-y-2">
								{raids.map((raid) => (
									<RaidCard
										key={raid.id}
										raid={raid}
										lines={breakdown.perRaid[raid.id] ?? {}}
										onOpen={() => setOpenRaidId(raid.id)}
									/>
								))}
							</div>
						)}
					</Panel>
				</div>
			</div>

			<RaidEditor runId={run.id} raidId={openRaidId} onClose={() => setOpenRaidId(null)} />
		</div>
	);
}
