import { Check } from 'lucide-react';
import type { Boss, Run } from '../../models';
import { useBossContext } from '../../lib/hooks';
import { bossProgress } from '../../lib/payouts';
import { BossAvatar, Panel } from '../ui/ui';

export default function BossChecklist({ run }: { run: Run }) {
	const ctx = useBossContext();
	const progress = bossProgress(run, ctx);
	const killed = new Set(progress.killed);

	const bosses = ctx.bosses.filter((b) => progress.required.includes(b.id));
	const groups = new Map<string, typeof bosses>();
	for (const b of bosses) {
		const key = b.group ?? b.id;
		groups.set(key, [...(groups.get(key) ?? []), b]);
	}

	const row = (boss: Boss, indent = false) => (
		<li
			key={boss.id}
			className={`flex items-center gap-2.5 py-1 ${indent ? 'pl-4' : ''} ${
				killed.has(boss.id) ? 'text-mute line-through' : ''
			}`}
		>
			<BossAvatar boss={boss} size={30} dim={killed.has(boss.id)} />
			<span className="flex-1">{boss.name}</span>
			{killed.has(boss.id) && <Check size={16} className="text-ok" />}
		</li>
	);

	return (
		<Panel title={`Targets ${progress.killed.length}/${progress.required.length}`}>
			<ul>
				{[...groups.entries()].map(([key, members]) =>
					members.length > 1 ? (
						<li key={key}>
							<div className="label-caps pt-1 text-xs text-accent">{key}</div>
							<ul>{members.map((b) => row(b, true))}</ul>
						</li>
					) : (
						row(members[0])
					),
				)}
			</ul>
		</Panel>
	);
}
