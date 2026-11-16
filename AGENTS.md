# Agent guide

`t3core` is a TypeScript npm library for Tic Tac Toe. Read
[ARCHITECTURE.md](ARCHITECTURE.md) for module responsibilities and contracts,
and [CONTRIBUTING.md](CONTRIBUTING.md) for setup and verification.

## Working rules

- Use the Node version in `.nvmrc` and Yarn from `packageManager`. Keep the
  Yarn Classic lockfile; use `yarn install --frozen-lockfile` for setup.
- Run `yarn hooks:install` for local Git checks. Use Conventional Commit
  messages and PR titles; see [the commit guide](CONTRIBUTING.md#local-git-checks-and-commit-messages).
  Pre-commit lints staged paths; full checks remain required in CI.
- Write code comments and new developer documentation in English. Preserve
  the language and conventions of existing documents; follow
  [`.editorconfig`](.editorconfig) for whitespace and line endings.
- Keep rules and state in `game`/`strategies`, move selection in `ai`,
  lifecycle and cancellation in `sessions`, and mode construction in `facade`.
  Keep UI dependencies outside the runtime library.
- Treat `src/index.ts` as the public API boundary. Internal barrels and
  source paths are not consumer imports. Edit sources, not generated `dist`.
- Preserve snapshot reference stability, frozen board arrays, notification
  ordering, and subscription cleanup. Check session generations after
  awaited work and callbacks; stale results must not mutate a reset game.
- Fix TypeScript errors with validation and narrowing instead of adding
  unchecked casts or non-null assertions.
- Follow the [API change checklist](CONTRIBUTING.md#public-api-and-compatibility)
  when changing exports, types, behavior, or event contracts. Update the
  architecture document when responsibilities or dependencies change.

## Verification

For code changes, run `yarn lint`, `yarn ts:check`, and the relevant tests
(`yarn test --run` for the full suite). Check the build with `yarn build`;
for exports, declarations, dependencies, or packaging changes use
`yarn package:check`, which also builds. `yarn release:check` runs the full
quality gate without creating a release.

For documentation-only changes, check accuracy against the implementation,
relative links, and `git diff --check`; add tests when behavior changes.
Release commands and publication are described in
[Publishing to npm](.github/PUBLISHING.md).
