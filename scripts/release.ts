/**
 * Works out the next release from the Conventional Commits merged since the last v* tag.
 *
 *   feat                         -> minor
 *   fix, perf, revert            -> patch
 *   type! or BREAKING CHANGE     -> major
 *   anything else (chore, ci...) -> no release
 *
 * Run by .github/workflows/release.yml: `node scripts/release.ts` writes `version`, `tag` and
 * `notes_file` to $GITHUB_OUTPUT (all empty when nothing needs releasing) and the release
 * notes to release-notes.md. Only the subject line decides the type: PRs are squash-merged,
 * so the subject is the PR title that CI already checks.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export type Bump = 'major' | 'minor' | 'patch';

export interface Commit {
	sha: string;
	subject: string;
	body: string;
}

const SUBJECT = /^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/;
const RANK: Record<Bump, number> = { patch: 1, minor: 2, major: 3 };

const SECTIONS: { types: string[]; title: string }[] = [
	{ types: ['feat'], title: 'Features' },
	{ types: ['fix'], title: 'Bug Fixes' },
	{ types: ['perf'], title: 'Performance' },
	{ types: ['revert'], title: 'Reverts' },
];

export function bumpFor(commit: Pick<Commit, 'subject' | 'body'>): Bump | null {
	const m = SUBJECT.exec(commit.subject);
	if (!m) return null;
	const [, type, , bang] = m;
	if (bang || /^BREAKING[ -]CHANGE:/m.test(commit.body)) return 'major';
	if (type === 'feat') return 'minor';
	if (type === 'fix' || type === 'perf' || type === 'revert') return 'patch';
	return null;
}

/** The biggest bump among the commits, or null when none of them changes behaviour. */
export function releaseBump(commits: Commit[]): Bump | null {
	let best: Bump | null = null;
	for (const c of commits) {
		const b = bumpFor(c);
		if (b && (!best || RANK[b] > RANK[best])) best = b;
	}
	return best;
}

export function nextVersion(current: string, bump: Bump): string {
	const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(current);
	if (!m) throw new Error(`Not a version: ${current}`);
	const [major, minor, patch] = m.slice(1).map(Number);
	if (bump === 'major') return `${major + 1}.0.0`;
	if (bump === 'minor') return `${major}.${minor + 1}.0`;
	return `${major}.${minor}.${patch + 1}`;
}

/** Markdown notes: releasing commits grouped by type, breaking changes first. */
export function releaseNotes(commits: Commit[], repoUrl?: string): string {
	const line = (c: Commit) => {
		const m = SUBJECT.exec(c.subject)!;
		const scope = m[2] ? `**${m[2]}:** ` : '';
		let text = m[4];
		if (repoUrl) text = text.replace(/\(#(\d+)\)$/, `([#$1](${repoUrl}/pull/$1))`);
		return `- ${scope}${text}`;
	};
	const releasing = commits.filter((c) => bumpFor(c));
	const out: string[] = [];
	const breaking = releasing.filter((c) => bumpFor(c) === 'major');
	if (breaking.length) out.push('### Breaking Changes', '', ...breaking.map(line), '');
	for (const { types, title } of SECTIONS) {
		const items = releasing.filter(
			(c) => bumpFor(c) !== 'major' && types.includes(SUBJECT.exec(c.subject)![1]),
		);
		if (items.length) out.push(`### ${title}`, '', ...items.map(line), '');
	}
	return out.join('\n').trim() + '\n';
}

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf-8' }).trim();

function main() {
	const lastTag = git('tag', '--list', 'v*', '--sort=-v:refname').split('\n')[0] || '';
	const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';
	const log = git('log', range, '--format=%H%x1f%s%x1f%b%x1e');
	const commits: Commit[] = log
		.split('\x1e')
		.map((r) => r.trim())
		.filter(Boolean)
		.map((r) => {
			const [sha, subject, body = ''] = r.split('\x1f');
			return { sha, subject, body };
		});

	const bump = releaseBump(commits);
	const version = bump ? nextVersion(lastTag || 'v0.0.0', bump) : '';
	const repoUrl = process.env.GITHUB_REPOSITORY
		? `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${process.env.GITHUB_REPOSITORY}`
		: undefined;

	console.log(`Last tag: ${lastTag || '(none)'}, ${commits.length} commit(s) since`);
	console.log(version ? `Next release: v${version} (${bump})` : 'Nothing to release');

	if (version) writeFileSync('release-notes.md', releaseNotes(commits, repoUrl));
	if (process.env.GITHUB_OUTPUT) {
		appendFileSync(
			process.env.GITHUB_OUTPUT,
			`version=${version}\ntag=${version ? `v${version}` : ''}\nnotes_file=${version ? 'release-notes.md' : ''}\n`,
		);
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
