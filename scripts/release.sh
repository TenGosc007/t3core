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
step()  { echo -e "\n${CYAN}━━━ [KROK $1/8] $2 ━━━${NC}"; }

# ─── Rollback ───────────────────────────────────────────
rollback() {
  echo ""
  err "Błąd w kroku — wycofywanie zmian..."

  if [[ -n "$CHANGELOG_CREATED" && -f "$CHANGELOG_CREATED" ]]; then
    rm -f "$CHANGELOG_CREATED"
    info "Usunięto changelog: $CHANGELOG_CREATED"
  fi

  if [[ -n "$VERSION_BUMPED" ]]; then
    git checkout -- package.json 2>/dev/null || true
    info "Przywrócono package.json do wersji $CURRENT_VERSION"
  fi

  if [[ -n "$BRANCH_CREATED" ]]; then
    git checkout "$ORIGINAL_BRANCH" 2>/dev/null || true
    git branch -D "$BRANCH_CREATED" 2>/dev/null || true
    info "Usunięto branch $BRANCH_CREATED, powrót na $ORIGINAL_BRANCH"
  fi

  err "Release przerwany. Wszystkie zmiany zostały cofnięte."
  exit 1
}

trap rollback ERR

# ─── Step 1: Pre-flight checks ──────────────────────────
step 1 "Pre-flight checks"

CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  warn "Nie jesteś na branch 'main' (jesteś na '$CURRENT_BRANCH')."
  read -p "Kontynuować? (y/N): " -n 1 -r
  echo
  [[ ! $REPLY =~ ^[Yy]$ ]] && { err "Anulowano."; exit 1; }
fi

if [[ -n $(git status --porcelain) ]]; then
  warn "Masz niezatwierdzone zmiany:"
  git status --short
  read -p "Kontynuować mimo to? (y/N): " -n 1 -r
  echo
  [[ ! $REPLY =~ ^[Yy]$ ]] && { err "Anulowano."; exit 1; }
fi

info "Sprawdzanie logowania do npm..."
if ! npm whoami &>/dev/null; then
  warn "Nie jesteś zalogowany do npm."
  read -p "Zalogować się teraz? (Y/n): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Nn]$ ]]; then
    err "Anulowano. Zaloguj się ręcznie: npm login"
    exit 1
  fi
  npm login
  if ! npm whoami &>/dev/null; then
    err "Logowanie nie powiodło się."
    exit 1
  fi
fi
NPM_USER=$(npm whoami)
ok "Zalogowany jako: $NPM_USER"

ok "Pre-flight checks passed"

# ─── Step 2: Quality checks ─────────────────────────────
step 2 "Quality checks (zanim cokolwiek zmienimy)"

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

ok "Wszystkie quality checks passed"

# ─── Step 3: Version selection ──────────────────────────
step 3 "Wybór wersji"

BUMP_TYPE="${1:-}"

if [[ -z "$BUMP_TYPE" ]]; then
  echo "Aktualna wersja: $CURRENT_VERSION"
  echo "Dostępne opcje: patch | minor | major | <specific version (np. 1.2.3)>"
  read -p "Wybierz typ bumpa: " BUMP_TYPE
fi

if [[ -z "$BUMP_TYPE" ]]; then
  err "Nie podano typu bumpa."
  exit 1
fi

# Validate
if [[ "$BUMP_TYPE" != "patch" && "$BUMP_TYPE" != "minor" && "$BUMP_TYPE" != "major" ]]; then
  if [[ ! "$BUMP_TYPE" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    err "Nieprawidłowy typ bumpa lub wersja: '$BUMP_TYPE'"
    echo "Oczekiwane: patch | minor | major | <semver (np. 1.2.3)>"
    exit 1
  fi
fi

info "Wybrano: $BUMP_TYPE"

# ─── Step 4: npm version availability ───────────────────
step 4 "Sprawdzenie dostępności wersji na npm"

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

info "Sprawdzanie czy $PACKAGE_NAME@$NEW_VERSION już istnieje na npm..."
if npm view "$PACKAGE_NAME@$NEW_VERSION" version &>/dev/null; then
  err "Wersja $NEW_VERSION już istnieje na npm. Wybierz inną."
  exit 1
fi

# Also check if git tag exists
if git tag -l "$TAG" | grep -q "$TAG"; then
  err "Git tag $TAG już istnieje. Wybierz inną wersję."
  exit 1
fi

ok "Wersja $NEW_VERSION jest dostępna"

# ─── Step 5: Release branch ─────────────────────────────
step 5 "Utworzenie release branch"

BRANCH_NAME="release/v$NEW_VERSION"
git checkout -b "$BRANCH_NAME"
BRANCH_CREATED="$BRANCH_NAME"

ok "Utworzono branch: $BRANCH_NAME"

# ─── Step 6: Version bump ───────────────────────────────
step 6 "Version bump"

npm version "$BUMP_TYPE" --no-git-tag-version
VERSION_BUMPED="1"

ok "Wersja podniesiona: $CURRENT_VERSION → $NEW_VERSION"

# ─── Step 7: Changelog ──────────────────────────────────
step 7 "Utworzenie changelog"

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
ok "Utworzono: $RELEASE_FILE"

echo ""
info "Edytuj release notes. Otwieram edytor..."

if [[ -n "${EDITOR:-}" ]]; then
  "$EDITOR" "$RELEASE_FILE"
elif command -v code &> /dev/null; then
  code "$RELEASE_FILE"
elif command -v vim &> /dev/null; then
  vim "$RELEASE_FILE"
fi

read -p "Naciśnij Enter gdy skończysz edytować release notes..."

ok "Changelog gotowy"

# ─── Step 8: Summary + confirm ──────────────────────────
step 8 "Podsumowanie i potwierdzenie"

echo ""
echo "  Pakiet:      $PACKAGE_NAME"
echo "  Wersja:      $CURRENT_VERSION → $NEW_VERSION"
echo "  Branch:      $BRANCH_NAME"
echo "  Tag:         $TAG"
echo "  Changelog:   $RELEASE_FILE"
echo ""

read -p "Czy chcesz commitować, utworzyć tag i pushować? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo ""
  warn "Zmiany nie zostały commitowane. Zostały na branchu $BRANCH_NAME."
  echo ""
  echo "Ręczne kroki:"
  echo "  1. Sprawdź zmiany:  git diff"
  echo "  2. Commit:          git add . && git commit -m 'release: v$NEW_VERSION'"
  echo "  3. Tag:             git tag $TAG"
  echo "  4. Push:            git push origin $BRANCH_NAME --tags"
  exit 0
fi

git add .
git commit -m "release: v$NEW_VERSION"
git tag "$TAG"

info "Pushowanie brancha i tagu..."
git push origin "$BRANCH_NAME" --tags

echo ""
ok "Release v$NEW_VERSION przygotowany!"
echo ""
echo "Następne kroki:"
echo "  1. Utwórz PR na GitHub: base=main, compare=$BRANCH_NAME"
echo "  2. Po merge utwórz GitHub Release z tagiem $TAG"
echo "  3. GitHub Actions automatycznie opublikuje na npm"
echo ""
