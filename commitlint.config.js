/** Conventional Commits: https://www.conventionalcommits.org */
export default {
	extends: ['@commitlint/config-conventional'],
	rules: {
		// Allow longer bodies (e.g. lists of changes) without failing the hook
		'body-max-line-length': [0],
	},
};
