import { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { Crosshair, Redo2, Settings, Undo2, Users, Wallet, type LucideIcon } from 'lucide-react';
import { initializeStore, redo, undo, useGameStore } from './store';
import { useBossContext, useFriendMap } from './lib/hooks';
import { bossProgress, runBreakdown } from './lib/payouts';
import RunsTab from './components/runs/RunsTab';
import LedgerTab from './components/ledger/LedgerTab';
import FriendsTab from './components/FriendsTab';
import SettingsTab from './components/SettingsTab';
import { FeedbackHost } from './components/ui/Overlays';
import { FriendChip, ProgressBar, Rub } from './components/ui/ui';
import './index.css';

type TabId = 'runs' | 'ledger' | 'friends' | 'settings';

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
	{ id: 'runs', label: 'Run', icon: Crosshair },
	{ id: 'ledger', label: 'Ledger', icon: Wallet },
	{ id: 'friends', label: 'Friends', icon: Users },
	{ id: 'settings', label: 'Settings', icon: Settings },
];

function TopBar({ title }: { title: string }) {
	const run = useGameStore((s) => (s.activeRunId ? s.runs[s.activeRunId] : null));
	const ctx = useBossContext();
	const friends = useFriendMap();
	const stats = useMemo(
		() =>
			run
				? { progress: bossProgress(run, ctx), total: runBreakdown(run, ctx).grandTotal }
				: null,
		[run, ctx],
	);

	return (
		<header className="flex h-16 shrink-0 items-center justify-between gap-6 border-b bg-panel px-6">
			<h1 className="label-caps text-2xl text-ink">{title}</h1>
			{run && stats && (
				<div className="flex items-center gap-6">
					<div className="flex items-center gap-2">
						<FriendChip friend={friends[run.hunterId]} />
						<div className="leading-tight">
							<div className="label-caps text-[10px] text-mute">Hunter</div>
							<div className="text-sm">
								{friends[run.hunterId]?.name ?? 'Not set'}
							</div>
						</div>
					</div>
					<div className="w-48">
						<div className="mb-1 flex justify-between text-xs">
							<span className="label-caps text-mute">Bosses</span>
							<span className="font-display font-semibold">
								{stats.progress.killed.length} / {stats.progress.required.length}
							</span>
						</div>
						<ProgressBar
							value={stats.progress.killed.length}
							max={stats.progress.required.length}
						/>
					</div>
					<div className="text-right leading-tight">
						<div className="label-caps text-[10px] text-mute">Run payout</div>
						<Rub
							amount={stats.total}
							className="font-display text-xl font-semibold text-ok"
						/>
					</div>
				</div>
			)}
		</header>
	);
}

function UndoButtons() {
	const canUndo = useStore(useGameStore.temporal, (s) => s.pastStates.length > 0);
	const canRedo = useStore(useGameStore.temporal, (s) => s.futureStates.length > 0);
	const button =
		'flex flex-1 items-center justify-center gap-1.5 rounded-sm border px-2 py-1.5 text-xs text-mute transition hover:bg-raised hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-mute';
	return (
		<div className="flex gap-2 border-t p-3">
			<button className={button} onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
				<Undo2 size={14} /> Undo
			</button>
			<button className={button} onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">
				<Redo2 size={14} /> Redo
			</button>
		</div>
	);
}

// Ctrl+Z / Ctrl+Y (or Ctrl+Shift+Z) outside text fields, which keep their own undo
function useUndoShortcuts() {
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
			const target = e.target as HTMLElement | null;
			if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
			const key = e.key.toLowerCase();
			const isRedo = key === 'y' || (key === 'z' && e.shiftKey);
			if (key !== 'z' && !isRedo) return;
			e.preventDefault();
			if (isRedo) redo();
			else undo();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, []);
}

function App() {
	const [tab, setTab] = useState<TabId>('runs');
	const ready = useGameStore((s) => s.ready);

	useEffect(() => {
		initializeStore();
	}, []);
	useUndoShortcuts();

	if (!ready) {
		return (
			<div className="flex h-full items-center justify-center text-mute">
				<span className="label-caps tracking-widest">Loading…</span>
			</div>
		);
	}

	return (
		<div className="flex h-full">
			<nav className="flex w-52 shrink-0 flex-col border-r bg-panel">
				<div className="border-b px-5 py-4">
					<div className="label-caps text-lg leading-tight text-accent">
						Snowball
						<br />
						Tracker
					</div>
					<div className="mt-1 text-[11px] text-mute">EFT achievement ledger</div>
				</div>
				<ul className="flex-1 space-y-1 p-3">
					{TABS.map(({ id, label, icon: Icon }) => (
						<li key={id}>
							<button
								onClick={() => setTab(id)}
								aria-current={tab === id ? 'page' : undefined}
								className={`flex w-full items-center gap-3 rounded-sm border-l-2 px-3 py-2 text-left font-display text-base uppercase tracking-wider transition ${
									tab === id
										? 'border-accent bg-raised text-accent'
										: 'border-transparent text-mute hover:bg-raised hover:text-ink'
								}`}
							>
								<Icon size={18} />
								{label}
							</button>
						</li>
					))}
				</ul>
				<UndoButtons />
			</nav>

			<div className="flex min-w-0 flex-1 flex-col">
				<TopBar title={TABS.find((t) => t.id === tab)!.label} />
				<main className="flex-1 overflow-y-auto p-6">
					<div className="mx-auto max-w-6xl">
						{tab === 'runs' && <RunsTab />}
						{tab === 'ledger' && <LedgerTab />}
						{tab === 'friends' && <FriendsTab />}
						{tab === 'settings' && <SettingsTab />}
					</div>
				</main>
			</div>
			<FeedbackHost />
		</div>
	);
}

export default App;
