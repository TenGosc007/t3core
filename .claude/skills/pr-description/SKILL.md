---
name: pr-description
description: Generate an English pull request title and description for the current branch from the repository's PR template (.github/PULL_REQUEST_TEMPLATE.md). Use when asked to write, draft, or update a PR description or PR title.
argument-hint: "[base-branch] [--run-checks]"
allowed-tools: Bash(git *), Bash(yarn lint), Bash(yarn ts:check), Bash(yarn test *), Bash(yarn build), Bash(yarn package:check), Bash(yarn commitlint:pr), Bash(printf *), Read
---

# Pull request description

Draft a PR title and description for the current branch. The description is
always in English, regardless of the language of the conversation.

The structure comes only from
[`.github/PULL_REQUEST_TEMPLATE.md`](../../../.github/PULL_REQUEST_TEMPLATE.md).
Read it every time; do not rely on a remembered copy. Keep its headings in
the same order, replace each instructional HTML comment with real content,
and leave no template comments in the output.

## Arguments

- First argument: base branch. Default: `main`.
- `--run-checks`: run the verification commands before writing the
  Verification section. Without it, do not run them.

## 1. Collect branch context

Run these (replace `BASE` with the base branch):

```bash
git rev-parse --abbrev-ref HEAD
git merge-base BASE HEAD
git log --no-merges --format='%h %s%n%b' BASE..HEAD
git diff --stat BASE...HEAD
git diff BASE...HEAD
git status --short
```

- If `BASE..HEAD` has no commits, stop and say there is nothing to describe.
- If the diff is large, read `--stat` first, then the full diff per area
  (`src/`, `tests`, docs, config) instead of loading everything at once.
- Uncommitted changes from `git status` are **not** part of the PR. List
  them to the user as a warning; do not describe them as included.

Also read, when relevant to the diff:

- `src/index.ts` diff — public API boundary.
- [CONTRIBUTING.md](../../../CONTRIBUTING.md#public-api-and-compatibility) —
  the API change checklist that the template's Checklist section mirrors.

## 2. Propose the title

- Conventional Commit format: `type(scope): summary`, lowercase summary,
  no trailing period, imperative mood. Scopes follow module names
  (`game`, `strategies`, `ai`, `sessions`, `facade`, `docs`, `ci`, ...).
- Pick the type and scope that cover the whole branch, not just the last
  commit. If the branch mixes several types, use the one with the highest
  user impact (`feat` > `fix` > `refactor` > `docs`/`chore`).
- Add `!` if any change is breaking (see step 3).
- Validate it: `printf '%s\n' '<title>' | yarn commitlint:pr`. Fix and
  re-run on failure.

## 3. Fill the template sections

**Summary** — the problem, the change, and the effect on library users, in
a short paragraph plus a bullet list of notable changes grouped by module.
Describe behavior, not file names. Mention linked issues only if they appear
in commit messages or the branch name (`#123`, `fixes #123`); never invent
issue numbers.

**Compatibility and migration** — decide breaking vs. non-breaking from the
diff, not from commit types alone. Treat as breaking: removed or renamed
exports in `src/index.ts`, changed exported types or signatures, changed
defaults, event payloads or ordering, snapshot semantics, or session
lifecycle. Start the section with **Breaking change: yes** or
**Breaking change: no**. For breaking changes, show previous and
replacement usage in code blocks and list migration steps, or link the
migration notes added in the branch.

**Verification** — keep every checkbox line from the template.

- Check a box (`- [x]`) only for a command that was actually run in this
  session and passed. Never check a box based on assumption.
- With `--run-checks`, run the commands the change needs, following the
  rules in the template comment: docs-only changes need `git diff --check`
  plus a link/accuracy review; code changes need lint, `ts:check`, tests and
  build; exports, declarations, dependencies, or packaging changes need
  `yarn package:check`. Record failures honestly.
- Under the boxes, replace the results comment with a short note: results
  (e.g. test counts), targeted commands, and a reason for each unchecked box
  (`not run`, `not needed: docs-only`, or the failure).

**Checklist** — check an item only when the diff shows it is satisfied
(e.g. tests changed alongside behavior, README/JSDoc updated with API,
ARCHITECTURE.md updated with responsibilities). Leave the rest unchecked
and, if one clearly applies but is missing, tell the user in the chat.

## 4. Output

Reply in the chat only; do not write any files. Use exactly this layout so
each part can be copied separately:

1. `**Title**`, followed by the title in its own fenced `text` block.
2. `**Description**`, followed by the full description in one fenced
   `markdown` block. If the description itself contains fenced code blocks,
   wrap it in a four-backtick fence (````` ````markdown `````) so the inner
   fences survive copying.
3. After the blocks, a short list of notes: uncommitted changes not
   included, missing docs/tests found in step 3, and unchecked verification
   items. Omit the list if there is nothing to report.

This skill only drafts text. Never push, create, or edit branches or pull
requests, and do not use `gh` or the GitHub API, even if they are available.
