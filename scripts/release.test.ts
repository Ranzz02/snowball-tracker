import { describe, expect, it } from 'vitest';
import { bumpFor, nextVersion, releaseBump, releaseNotes, type Commit } from './release';

const c = (subject: string, body = ''): Commit => ({ sha: subject, subject, body });

describe('bumpFor', () => {
	it.each([
		['feat: add stats', 'minor'],
		['feat(ledger): settle all (#4)', 'minor'],
		['fix: save on close', 'patch'],
		['perf: faster ledger', 'patch'],
		['revert: undo stats', 'patch'],
		['feat!: new save format', 'major'],
		['fix(store)!: drop v1 data', 'major'],
		['refactor: tidy store', null],
		['chore: bump deps', null],
		['docs: readme', null],
		['ci: new workflow', null],
		['build(deps-dev): Bump @types/node (#2)', null],
		['test: more cases', null],
		['style: format', null],
		['Merge branch main', null],
	])('%s -> %s', (subject, bump) => {
		expect(bumpFor(c(subject))).toBe(bump);
	});

	it('treats a BREAKING CHANGE footer as major', () => {
		expect(bumpFor(c('refactor: rename fields', 'BREAKING CHANGE: old saves fail'))).toBe(
			'major',
		);
	});

	it('ignores feat lines inside a squash body', () => {
		expect(bumpFor(c('chore: tidy', '* feat: something'))).toBeNull();
	});
});

describe('releaseBump', () => {
	it('takes the biggest bump', () => {
		expect(releaseBump([c('fix: a'), c('feat: b'), c('chore: c')])).toBe('minor');
	});

	it('is null when nothing changes behaviour', () => {
		expect(releaseBump([c('chore: a'), c('ci: b')])).toBeNull();
		expect(releaseBump([])).toBeNull();
	});
});

describe('nextVersion', () => {
	it('bumps each part', () => {
		expect(nextVersion('v1.2.3', 'patch')).toBe('1.2.4');
		expect(nextVersion('v1.2.3', 'minor')).toBe('1.3.0');
		expect(nextVersion('1.2.3', 'major')).toBe('2.0.0');
	});

	it('rejects junk', () => {
		expect(() => nextVersion('latest', 'patch')).toThrow();
	});
});

describe('releaseNotes', () => {
	it('groups releasing commits and links PRs', () => {
		const notes = releaseNotes(
			[
				c('feat(ledger): settle all (#4)'),
				c('fix: save on close'),
				c('chore: deps'),
				c('feat!: new format'),
			],
			'https://github.com/o/r',
		);
		expect(notes).toBe(
			[
				'### Breaking Changes',
				'',
				'- new format',
				'',
				'### Features',
				'',
				'- **ledger:** settle all ([#4](https://github.com/o/r/pull/4))',
				'',
				'### Bug Fixes',
				'',
				'- save on close',
				'',
			].join('\n'),
		);
	});
});
