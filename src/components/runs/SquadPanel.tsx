import { useGameStore } from '../../store';
import type { Run } from '../../models';
import { FriendChip, Panel, Toggle, inputClass } from '../ui/ui';

export default function SquadPanel({ run }: { run: Run }) {
	const friends = useGameStore((s) => s.friends);
	const setHunter = useGameStore((s) => s.setHunter);
	const setSquad = useGameStore((s) => s.setSquad);

	// Archived friends stay visible only when already part of this run
	const pickable = friends.filter(
		(f) => !f.archived || f.id === run.hunterId || run.squad.includes(f.id),
	);
	const helpers = pickable.filter((f) => f.id !== run.hunterId);

	return (
		<Panel title="Squad">
			<label className="label-caps mb-1 block text-xs text-mute">Hunter</label>
			<select
				value={run.hunterId}
				onChange={(e) => setHunter(run.id, e.target.value)}
				className={`${inputClass} mb-4 w-full`}
			>
				<option value="">Not set</option>
				{pickable.map((f) => (
					<option key={f.id} value={f.id}>
						{f.name}
					</option>
				))}
			</select>

			<div className="label-caps mb-1 text-xs text-mute">Helpers in new raids</div>
			<div className="flex flex-wrap gap-2">
				{helpers.map((f) => (
					<Toggle
						key={f.id}
						checked={run.squad.includes(f.id)}
						onChange={(on) =>
							setSquad(
								run.id,
								on ? [...run.squad, f.id] : run.squad.filter((x) => x !== f.id),
							)
						}
					>
						<FriendChip friend={f} size={16} />
						{f.name}
					</Toggle>
				))}
				{helpers.length === 0 && <span className="text-mute">No friends to pick.</span>}
			</div>
		</Panel>
	);
}
