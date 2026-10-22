# Contributing

Thanks for helping out. Bug reports, ideas for new bonus or penalty rules, and pull requests are all welcome.

## Setup

1. Install Node.js 22.12 or newer.
2. Run `corepack enable` once. This lets the repo's `packageManager` field pick Yarn 4. Don't use npm, because it creates a conflicting `package-lock.json`.
3. Run `yarn install`, then `yarn dev`.

Yarn refuses package versions published less than a day ago. If an install fails with "quarantined", use a slightly older version.

## Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org), because releases, version numbers and release notes are generated from them:

```
feat: add a "carried hunter" bonus preset
fix(ledger): count payments made before the first run
docs: explain the hunter-death rule
```

| Type                                                        | When merged into `main`                       |
| ----------------------------------------------------------- | --------------------------------------------- |
| `feat`                                                      | Releases a minor version, listed in the notes |
| `fix`, `perf`, `revert`                                     | Releases a patch version, listed in the notes |
| `feat!` / `BREAKING CHANGE:` footer                         | Releases a major version                      |
| `docs`, `refactor`, `test`, `build`, `ci`, `chore`, `style` | No release                                    |

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

Releases are automatic. Merging a pull request whose title releases (see the table above) into `main` runs the **Release** workflow. It works out the next version from the commits since the last tag, runs the tests, builds the Windows installer, and publishes the `vX.Y.Z` tag and GitHub release with the installer and grouped release notes. A failed build creates no tag, so the next merge picks the same changes up again.

There is no release PR, and the version in `package.json` isn't bumped in the repo, because the tags are the source of truth. Run `node scripts/release.ts` to see what the next release would be.

To rebuild the installer for an existing tag, run the **Release** workflow manually from the Actions tab and enter the tag.
