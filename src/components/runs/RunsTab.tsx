import { useGameStore } from '../../store';
import RunDashboard from './RunDashboard';
import RunList from './RunList';

export default function RunsTab() {
	const run = useGameStore((s) => (s.activeRunId ? s.runs[s.activeRunId] : null));
	return run ? <RunDashboard run={run} /> : <RunList />;
}
