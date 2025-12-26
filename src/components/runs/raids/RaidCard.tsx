import { Skull } from 'lucide-react';
import type { Raid } from '../../../models';
import { useGameStore } from '../../../store';
import { useFriendMap } from '../../../lib/hooks';
import { sumLines, type FriendLines } from '../../../lib/payouts';
import { formatDateTime } from '../../../lib/format';
import { Badge, BossAvatar, FriendChip, Rub } from '../../ui/ui';

export default function RaidCard({
	raid,
	lines,
	onOpen,
}: {
	raid: Raid;
	lines: FriendLines;
	onOpen: () => void;
}) {
	const bosses = useGameStore((s) => s.bosses);
	const maps = useGameStore((s) => s.maps);
	const friends = useFriendMap();
	const total = Object.values(lines).reduce((s, l) => s + sumLines(l), 0);
	const mapName = maps.find((m) => m.id === raid.mapId)?.name ?? 'Unknown map';
	const killed = raid.bosses.filter((b) => b.killed).length;

	return (
		<button
			onClick={onOpen}
			className="block w-full rounded-sm border bg-panel p-4 text-left transition hover:border-accent/60"
		>
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<span className="font-display text-lg font-semibold uppercase tracking-wide">
							{mapName}
						</span>
						<Badge tone={killed > 0 ? 'ok' : 'neutral'}>
							{killed}/{raid.bosses.length} killed
						</Badge>
						{raid.hunterDied && (
							<Badge tone="danger">
								<Skull size={12} /> Hunter KIA
							</Badge>
						)}
					</div>
					<div className="mt-2 flex flex-wrap gap-1.5">
						{raid.bosses.map((b) => {
							const boss = bosses.find((x) => x.id === b.bossId);
							return (
								<Badge key={b.bossId} tone={b.killed ? 'ok' : 'neutral'}>
									<BossAvatar boss={boss} size={16} dim={!b.killed} />
									{boss?.name ?? b.bossId}
								</Badge>
							);
						})}
					</div>
					<div className="mt-2 flex items-center gap-2 text-xs text-mute">
						<span>{formatDateTime(raid.createdAt)}</span>
						<span className="flex -space-x-1">
							{Object.keys(raid.helpers).map((fid) => (
								<FriendChip key={fid} friend={friends[fid]} size={20} />
							))}
						</span>
					</div>
				</div>
				<Rub
					amount={total}
					className="shrink-0 font-display text-xl font-semibold text-ok"
				/>
			</div>
		</button>
	);
}
