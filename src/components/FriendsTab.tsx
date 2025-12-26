import { useState } from 'react';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { friendIsUsed, toAppData, useGameStore } from '../store';
import type { Friend } from '../models';
import { confirmAction } from './ui/feedback';
import { Button, FriendChip, Panel, inputClass } from './ui/ui';

const PALETTE = [
	'#e5736a',
	'#e8a65d',
	'#d9c76a',
	'#8fbf6a',
	'#5fb8a3',
	'#5aa9d6',
	'#8a8ee0',
	'#b585d6',
	'#d681a8',
	'#a8a597',
];

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
	return (
		<div className="flex flex-wrap gap-1.5">
			{PALETTE.map((c) => (
				<button
					key={c}
					type="button"
					aria-label={`Color ${c}`}
					aria-pressed={value === c}
					onClick={() => onChange(c)}
					style={{ backgroundColor: c }}
					className={`h-5 w-5 rounded-full border-2 ${
						value === c ? 'border-ink' : 'border-transparent'
					}`}
				/>
			))}
		</div>
	);
}

function FriendRow({ friend }: { friend: Friend }) {
	const updateFriend = useGameStore((s) => s.updateFriend);
	const deleteFriend = useGameStore((s) => s.deleteFriend);
	const [name, setName] = useState(friend.name);

	const commitName = () => {
		const trimmed = name.trim();
		if (trimmed && trimmed !== friend.name) updateFriend(friend.id, { name: trimmed });
		else setName(friend.name);
	};

	const remove = async () => {
		if (friendIsUsed(toAppData(useGameStore.getState()), friend.id)) {
			await confirmAction({
				title: 'Cannot delete',
				message: `${friend.name} appears in past runs. Archive them instead to keep the history.`,
				confirmLabel: 'OK',
			});
			return;
		}
		const ok = await confirmAction({
			title: `Delete ${friend.name}?`,
			confirmLabel: 'Delete',
			danger: true,
		});
		if (ok) deleteFriend(friend.id);
	};

	return (
		<div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border bg-surface px-3 py-2">
			<div className="flex items-center gap-3">
				<FriendChip friend={friend} size={32} />
				<input
					aria-label={`Name of ${friend.name}`}
					value={name}
					onChange={(e) => setName(e.target.value)}
					onBlur={commitName}
					onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
					className={`${inputClass} w-44`}
				/>
				<ColorPicker
					value={friend.color}
					onChange={(color) => updateFriend(friend.id, { color })}
				/>
			</div>
			<div className="flex gap-2">
				<Button
					size="sm"
					onClick={() => updateFriend(friend.id, { archived: !friend.archived })}
				>
					{friend.archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
					{friend.archived ? 'Restore' : 'Archive'}
				</Button>
				<Button size="sm" variant="danger" onClick={remove}>
					<Trash2 size={13} /> Delete
				</Button>
			</div>
		</div>
	);
}

export default function FriendsTab() {
	const friends = useGameStore((s) => s.friends);
	const addFriend = useGameStore((s) => s.addFriend);
	const [name, setName] = useState('');
	const [color, setColor] = useState(PALETTE[0]);

	const active = friends.filter((f) => !f.archived);
	const archived = friends.filter((f) => f.archived);

	const add = () => {
		if (!name.trim()) return;
		addFriend(name, color);
		setName('');
		setColor(PALETTE[(friends.length + 1) % PALETTE.length]);
	};

	return (
		<div className="max-w-3xl space-y-5">
			<Panel title="Add friend">
				<div className="flex flex-wrap items-center gap-3">
					<input
						aria-label="Friend name"
						placeholder="Name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						onKeyDown={(e) => e.key === 'Enter' && add()}
						className={`${inputClass} w-56`}
					/>
					<ColorPicker value={color} onChange={setColor} />
					<Button variant="primary" onClick={add} disabled={!name.trim()}>
						Add
					</Button>
				</div>
			</Panel>

			<Panel title={`Friends (${active.length})`}>
				{active.length === 0 ? (
					<p className="text-mute">No friends yet.</p>
				) : (
					<div className="space-y-2">
						{active.map((f) => (
							<FriendRow key={f.id} friend={f} />
						))}
					</div>
				)}
			</Panel>

			{archived.length > 0 && (
				<Panel title={`Archived (${archived.length})`}>
					<div className="space-y-2">
						{archived.map((f) => (
							<FriendRow key={f.id} friend={f} />
						))}
					</div>
				</Panel>
			)}
		</div>
	);
}
