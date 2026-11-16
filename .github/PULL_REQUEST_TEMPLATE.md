<!-- Use a Conventional Commit title, e.g. "fix(game): reject invalid indices".
CI validates the title; preserve it when squash merging. -->

## Summary

<!-- Describe the problem, the change, and its effect on library users.
Link related issues where applicable. -->

## Compatibility and migration

<!-- State whether this is a breaking change. Describe changes to public API,
types, defaults, events, snapshots, or session lifecycle. For breaking changes,
include previous/replacement usage and required migration steps, or link to
the migration instructions added in this PR. -->

## Verification

<!-- Check only the commands you ran and record results or reasons for skipping.
For documentation-only changes, verify accuracy, links, and git diff --check.
package:check includes a build and is needed for exports, declarations,
dependencies, or packaging changes. -->

- [ ] `git diff --check`
- [ ] `yarn lint`
- [ ] `yarn ts:check`
- [ ] `yarn test --run` (or targeted tests described below)
- [ ] `yarn build` (also covered by `yarn package:check`)
- [ ] `yarn package:check`

<!-- Results, targeted test commands, manual checks, or skipped-check reasons: -->

## Checklist

- [ ] The PR title follows Conventional Commits, including `!` for a breaking change when applicable.
- [ ] Changed behavior has regression coverage where appropriate.
- [ ] Public API changes include updated JSDoc, README examples, and migration instructions where applicable.
- [ ] Changes to module responsibilities or contracts are reflected in ARCHITECTURE.md where applicable.

<!-- See https://github.com/TenGosc007/t3core/blob/main/CONTRIBUTING.md for contribution guidelines. -->
