#!/usr/bin/env bash
set -euo pipefail

# Release script for t3core
# Usage: yarn release [patch|minor|major|VERSION]
#
# Steps:
#   1. Pre-flight checks (git state, npm auth)
#   2. Quality checks (lint, ts:check, test, fallow, build)
#   3. Version selection
#   4. npm version availability check
#   5. Release branch
#   6. Version bump
#   7. Changelog
#   8. Confirm: commit, tag, push

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

PACKAGE_NAME=$(node -p "require('./package.json').name")
CURRENT_VERSION=$(node -p "require('./package.json').version")
ORIGINAL_BRANCH=$(git branch --show-current)

# State for rollback
BRANCH_CREATED=""
VERSION_BUMPED=""
CHANGELOG_CREATED=""
NEW_VERSION=""
TAG=""

# ─── Colors ─────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()  { echo -e "${CYAN}▶  $1${NC}"; }
ok()    { echo -e "${GREEN}✅  $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠   $1${NC}"; }
err()   { echo -e "${RED}❌  $1${NC}"; }
step()  { echo -e "\n${CYAN}━━━ [STEP $1/8] $2 ━━━${NC}"; }

# ─── Rollback ───────────────────────────────────────────
rollback() {
  echo ""
  err "Step failed — rolling back changes..."

  if [[ -n "$CHANGELOG_CREATED" && -f "$CHANGELOG_CREATED" ]]; then
    rm -f "$CHANGELOG_CREATED"
    info "Removed changelog: $CHANGELOG_CREATED"
  fi

  if [[ -n "$VERSION_BUMPED" ]]; then
    git checkout -- package.json 2>/dev/null || true
    info "Restored package.json to version $CURRENT_VERSION"
  fi

  if [[ -n "$BRANCH_CREATED" ]]; then
    git checkout "$ORIGINAL_BRANCH" 2>/dev/null || true
    git branch -D "$BRANCH_CREATED" 2>/dev/null || true
    info "Deleted branch $BRANCH_CREATED, switched back to $ORIGINAL_BRANCH"
  fi

  err "Release aborted. All changes have been rolled back."
  exit 1
}

trap rollback ERR

# ─── Step 1: Pre-flight checks ──────────────────────────
step 1 "Pre-flight checks"

CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  warn "Not on branch 'main' (currently on '$CURRENT_BRANCH')."
  read -p "Continue? (y/N): " -n 1 -r
  echo
  [[ ! $REPLY =~ ^[Yy]$ ]] && { err "Aborted."; exit 1; }
fi

if [[ -n $(git status --porcelain) ]]; then
  warn "You have uncommitted changes:"
  git status --short
  read -p "Continue anyway? (y/N): " -n 1 -r
  echo
  [[ ! $REPLY =~ ^[Yy]$ ]] && { err "Aborted."; exit 1; }
fi

info "Checking npm authentication..."
if ! npm whoami &>/dev/null; then
  warn "Not logged in to npm."
  read -p "Log in now? (Y/n): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Nn]$ ]]; then
    err "Aborted. Log in manually: npm login"
    exit 1
  fi
  npm login
  if ! npm whoami &>/dev/null; then
    err "Login failed."
    exit 1
  fi
fi
NPM_USER=$(npm whoami)
ok "Logged in as: $NPM_USER"

ok "Pre-flight checks passed"

# ─── Step 2: Quality checks ─────────────────────────────
step 2 "Quality checks (before any changes)"

info "Lint..."
yarn lint

info "TypeScript check..."
yarn ts:check

info "Tests..."
yarn test --run

info "Fallow..."
yarn fallow

info "Build..."
yarn build

ok "All quality checks passed"

# ─── Step 3: Version selection ──────────────────────────
step 3 "Version selection"

BUMP_TYPE="${1:-}"

if [[ -z "$BUMP_TYPE" ]]; then
  echo "Current version: $CURRENT_VERSION"
  echo "Available options: patch | minor | major | <specific version (e.g. 1.2.3)>"
  read -p "Select bump type: " BUMP_TYPE
fi

if [[ -z "$BUMP_TYPE" ]]; then
  err "No bump type provided."
  exit 1
fi

# Validate
if [[ "$BUMP_TYPE" != "patch" && "$BUMP_TYPE" != "minor" && "$BUMP_TYPE" != "major" ]]; then
  if [[ ! "$BUMP_TYPE" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    err "Invalid bump type or version: '$BUMP_TYPE'"
    echo "Expected: patch | minor | major | <semver (e.g. 1.2.3)>"
    exit 1
  fi
fi

info "Selected: $BUMP_TYPE"

# ─── Step 4: npm version availability ───────────────────
step 4 "npm version availability check"

# Compute the new version
if [[ "$BUMP_TYPE" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  NEW_VERSION="$BUMP_TYPE"
else
  NEW_VERSION=$(node -p "require('semver').inc('$CURRENT_VERSION', '$BUMP_TYPE')" 2>/dev/null || \
    node -e "
      const pkg = require('./package.json');
      const v = pkg.version.split('.').map(Number);
      if ('$BUMP_TYPE' === 'major') { v[0]++; v[1]=0; v[2]=0; }
      else if ('$BUMP_TYPE' === 'minor') { v[1]++; v[2]=0; }
      else if ('$BUMP_TYPE' === 'patch') { v[2]++; }
      console.log(v.join('.'));
    ")
fi

TAG="v$NEW_VERSION"

info "Checking if $PACKAGE_NAME@$NEW_VERSION already exists on npm..."
if npm view "$PACKAGE_NAME@$NEW_VERSION" version &>/dev/null; then
  err "Version $NEW_VERSION already exists on npm. Choose a different one."
  exit 1
fi

# Also check if git tag exists
if git tag -l "$TAG" | grep -q "$TAG"; then
  err "Git tag $TAG already exists. Choose a different version."
  exit 1
fi

ok "Version $NEW_VERSION is available"

# ─── Step 5: Release branch ─────────────────────────────
step 5 "Create release branch"

BRANCH_NAME="release/v$NEW_VERSION"
git checkout -b "$BRANCH_NAME"
BRANCH_CREATED="$BRANCH_NAME"

ok "Created branch: $BRANCH_NAME"

# ─── Step 6: Version bump ───────────────────────────────
step 6 "Version bump"

npm version "$BUMP_TYPE" --no-git-tag-version
VERSION_BUMPED="1"

ok "Version bumped: $CURRENT_VERSION → $NEW_VERSION"

# ─── Step 7: Changelog ──────────────────────────────────
step 7 "Create changelog"

RELEASES_DIR=".github/releases"
mkdir -p "$RELEASES_DIR"

RELEASE_FILE="$RELEASES_DIR/v$NEW_VERSION.md"
TODAY=$(date +%Y-%m-%d)
PREV_TAG="v$CURRENT_VERSION"

cat > "$RELEASE_FILE" << EOF
# Release v$NEW_VERSION

Brief description of the release.

---

## Changelog

## [$NEW_VERSION] - $TODAY

### Added
- 

### Fixed
- 

### Changed
- 

[$NEW_VERSION]: https://github.com/TenGosc007/t3core/compare/$PREV_TAG...v$NEW_VERSION
EOF

CHANGELOG_CREATED="$RELEASE_FILE"
ok "Created: $RELEASE_FILE"

echo ""
info "Edit release notes. Opening editor..."

if [[ -n "${EDITOR:-}" ]]; then
  "$EDITOR" "$RELEASE_FILE"
elif command -v windsurf &> /dev/null; then
  windsurf "$RELEASE_FILE"
elif command -v devin-desktop &> /dev/null; then
  devin-desktop "$RELEASE_FILE"
elif command -v cursor &> /dev/null; then
  cursor "$RELEASE_FILE"
elif command -v code &> /dev/null; then
  code "$RELEASE_FILE"
elif command -v vim &> /dev/null; then
  vim "$RELEASE_FILE"
fi

read -p "Press Enter when done editing release notes..."

ok "Changelog ready"

# ─── Step 8: Summary + confirm ──────────────────────────
step 8 "Summary and confirmation"

echo ""
echo "  Package:     $PACKAGE_NAME"
echo "  Version:     $CURRENT_VERSION → $NEW_VERSION"
echo "  Branch:      $BRANCH_NAME"
echo "  Tag:         $TAG"
echo "  Changelog:   $RELEASE_FILE"
echo ""

read -p "Commit, create tag, and push? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo ""
  warn "Changes not committed. Left on branch $BRANCH_NAME."
  echo ""
  echo "Manual steps:"
  echo "  1. Review changes:  git diff"
  echo "  2. Commit:          git add . && git commit -m 'release: v$NEW_VERSION'"
  echo "  3. Tag:             git tag $TAG"
  echo "  4. Push:            git push origin $BRANCH_NAME --tags"
  exit 0
fi

git add .
git commit -m "release: v$NEW_VERSION"
git tag "$TAG"

info "Pushing branch and tags..."
git push origin "$BRANCH_NAME" --tags

echo ""
ok "Release v$NEW_VERSION prepared!"
echo ""
echo "Next steps:"
echo "  1. Create a PR on GitHub: base=main, compare=$BRANCH_NAME"
echo "  2. After merge, create a GitHub Release with tag $TAG"
echo "  3. GitHub Actions will automatically publish to npm"
echo ""
