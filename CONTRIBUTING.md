# Contributing

Thanks for helping out. Bug reports, ideas for new bonus or penalty rules, and pull requests are all welcome.

## Setup

1. Install Node.js 22.12 or newer.
2. Run `corepack enable` once. This lets the repo's `packageManager` field pick Yarn 4. Don't use npm, because it creates a conflicting `package-lock.json`.
3. Run `yarn install`, then `yarn dev`.

Yarn refuses package versions published less than a day ago. If an install fails with "quarantined", use a slightly older version.

## Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org), because the changelog and version numbers are generated from them:

```
feat: add a "carried hunter" bonus preset
fix(ledger): count payments made before the first run
docs: explain the hunter-death rule
```

| Type                                                        | Effect on the next release              |
| ----------------------------------------------------------- | --------------------------------------- |
| `feat`                                                      | Minor version bump, listed in CHANGELOG |
| `fix`, `perf`                                               | Patch version bump, listed in CHANGELOG |
| `feat!` / `BREAKING CHANGE:` footer                         | Major version bump                      |
| `docs`, `refactor`, `test`, `build`, `ci`, `chore`, `style` | No release on their own, not listed     |

A git hook (husky + commitlint, installed by `yarn install`) rejects messages that don't follow the format. Pull requests are squash-merged, so CI checks the **PR title** the same way.

## Before opening a pull request

```sh
yarn format     # Prettier: tabs, single quotes, 100 columns
yarn lint
yarn tsc --noEmit
yarn test
```

CI runs the same checks on every pull request.

## Where things live

| Path                 | What                                                                    |
| -------------------- | ----------------------------------------------------------------------- |
| `src/lib/payouts.ts` | All payout math, as pure functions. Add new rules here, with tests.     |
| `src/lib/migrate.ts` | Converts older save files to the current format. Keep old data loading. |
| `src/models.ts`      | Data types and default rates                                            |
| `src/store.ts`       | Zustand store and its actions. Saving happens automatically.            |
| `src/components/`    | Screens, plus shared UI pieces in `ui/`                                 |
| `src/data/`          | Boss and map lists                                                      |
| `electron/`          | Main process (file storage, dialogs) and the preload bridge             |

Never store payout totals. The UI always computes them from raids through `src/lib/payouts.ts`. If you change the save format, update `migrate.ts` and add a test with the old shape.

## Releasing

Releases are automated with [release-please](https://github.com/googleapis/release-please):

1. Merge `feat`/`fix` commits into `main`. release-please opens or updates a **release PR** (`chore(main): release x.y.z`) that bumps `package.json` and adds the new section to `CHANGELOG.md`.
2. Merge the release PR when you want to ship. That creates the `vX.Y.Z` tag and GitHub release, then builds the Windows installer and attaches it.

To rebuild the installer for an existing tag, run the **Release** workflow manually from the Actions tab.
