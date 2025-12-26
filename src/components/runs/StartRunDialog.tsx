import { useState } from 'react';
import { useGameStore } from '../../store';
import { Modal } from '../ui/Overlays';
import { Button, FriendChip, Toggle } from '../ui/ui';

export default function StartRunDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
	const friends = useGameStore((s) => s.friends).filter((f) => !f.archived);
	const startRun = useGameStore((s) => s.startRun);
	const [hunterId, setHunterId] = useState('');
	const [squad, setSquad] = useState<string[]>([]);

	const helpers = friends.filter((f) => f.id !== hunterId);
	const activeSquad = squad.filter((id) => id !== hunterId);

	const start = () => {
		startRun(hunterId, activeSquad);
		setHunterId('');
		setSquad([]);
		onClose();
	};

	return (
		<Modal
			open={open}
			onClose={onClose}
			title="Start new run"
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button variant="primary" onClick={start} disabled={!hunterId}>
						Start run
					</Button>
				</>
			}
		>
			{friends.length === 0 ? (
				<p className="text-mute">Add friends on the Friends tab first.</p>
			) : (
				<div className="space-y-5">
					<div>
						<div className="label-caps mb-2 text-xs text-mute">
							Hunter (the one doing the achievement)
						</div>
						<div className="flex flex-wrap gap-2">
							{friends.map((f) => (
								<Toggle
									key={f.id}
									checked={hunterId === f.id}
									onChange={() => setHunterId(f.id)}
								>
									<FriendChip friend={f} size={18} />
									{f.name}
								</Toggle>
							))}
						</div>
					</div>
					<div>
						<div className="label-caps mb-2 text-xs text-mute">
							Helpers (paid for their work)
						</div>
						<div className="flex flex-wrap gap-2">
							{helpers.map((f) => (
								<Toggle
									key={f.id}
									checked={activeSquad.includes(f.id)}
									onChange={(on) =>
										setSquad((prev) =>
											on
												? [...prev.filter((x) => x !== f.id), f.id]
												: prev.filter((x) => x !== f.id),
										)
									}
								>
									<FriendChip friend={f} size={18} />
									{f.name}
								</Toggle>
							))}
							{helpers.length === 0 && (
								<span className="text-mute">Pick a hunter first.</span>
							)}
						</div>
					</div>
				</div>
			)}
		</Modal>
	);
}
