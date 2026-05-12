#!/usr/bin/env bash
set -euo pipefail

# Automated release script based on .github/PUBLISHING.md
# Usage: ./scripts/publish-release.sh [patch|minor|major|VERSION]
# Example: ./scripts/publish-release.sh patch
# Example: ./scripts/publish-release.sh 1.2.3

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Change to project root
cd "$PROJECT_ROOT"

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT_VERSION"

# Determine version bump type or specific version
BUMP_TYPE="${1:-}"

if [[ -z "$BUMP_TYPE" ]]; then
  echo "Error: No version bump type specified."
  echo "Usage: $0 [patch|minor|major|VERSION]"
  echo "Examples:"
  echo "  $0 patch      # Bump patch version (1.0.0 -> 1.0.1)"
  echo "  $0 minor      # Bump minor version (1.0.0 -> 1.1.0)"
  echo "  $0 major      # Bump major version (1.0.0 -> 2.0.0)"
  echo "  $0 1.2.3      # Use specific version"
  exit 1
fi

# Validate bump type or version
if [[ "$BUMP_TYPE" != "patch" && "$BUMP_TYPE" != "minor" && "$BUMP_TYPE" != "major" ]]; then
  # Check if it's a valid semver version
  if [[ ! "$BUMP_TYPE" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Error: Invalid version or bump type '$BUMP_TYPE'"
    echo "Must be 'patch', 'minor', 'major', or a valid semver version (e.g., 1.2.3)"
    exit 1
  fi
fi

# Calculate new version
if [[ "$BUMP_TYPE" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  NEW_VERSION="$BUMP_TYPE"
else
  # Use npm version to calculate new version (without creating git tag)
  NEW_VERSION=$(npm version "$BUMP_TYPE" --no-git-tag-version 2>/dev/null | tail -1 | tr -d 'v')
  # Revert the change temporarily - we'll make it properly later
  git checkout package.json package-lock.json 2>/dev/null || true
fi

echo "New version will be: $NEW_VERSION"

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
  echo "Warning: You have uncommitted changes."
  git status --short
  read -p "Continue anyway? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Confirm
read -p "Create release v$NEW_VERSION? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

# Step 1: Create release branch
BRANCH_NAME="release/v$NEW_VERSION"
echo ""
echo "Step 1: Creating release branch '$BRANCH_NAME'..."
git checkout -b "$BRANCH_NAME"

# Step 2: Update version in package.json
echo ""
echo "Step 2: Updating version in package.json..."
if [[ "$BUMP_TYPE" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  # Manual version update
  npm version "$NEW_VERSION" --no-git-tag-version
else
  npm version "$BUMP_TYPE" --no-git-tag-version
fi

# Step 3: Create release document
echo ""
echo "Step 3: Creating release document..."
RELEASES_DIR=".github/releases"
mkdir -p "$RELEASES_DIR"

RELEASE_FILE="$RELEASES_DIR/v$NEW_VERSION.md"
TODAY=$(date +%Y-%m-%d)

# Get previous version for comparison link
PREV_TAG="v$CURRENT_VERSION"

# Create release document template
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

echo "Created: $RELEASE_FILE"
echo "Please edit the release notes before continuing."

# Open editor for release notes
if [[ -n "${EDITOR:-}" ]]; then
  $EDITOR "$RELEASE_FILE"
elif command -v code &> /dev/null; then
  code "$RELEASE_FILE"
elif command -v vim &> /dev/null; then
  vim "$RELEASE_FILE"
fi

read -p "Press Enter when you've finished editing the release notes..."

# Step 4: Stage changes and create tag
echo ""
echo "Step 4: Staging changes..."
git add .

echo ""
echo "Step 5: Running release checks and creating tag..."
yarn release:tag

echo ""
echo "=================================================="
echo "Release v$NEW_VERSION preparation complete!"
echo "=================================================="
echo ""
echo "Next steps:"
echo "1. Review the changes: git log --oneline -3"
echo "2. Push the branch and tag:"
echo "   git push origin $BRANCH_NAME --tags"
echo ""
echo "3. Go to GitHub and create a Pull Request:"
echo "   - Base: main"
echo "   - Compare: $BRANCH_NAME"
echo ""
echo "4. After PR is merged, create a GitHub Release:"
echo "   - Go to GitHub → Releases → Draft a new release"
echo "   - Select tag: v$NEW_VERSION"
echo "   - Copy release notes from: $RELEASE_FILE"
echo "   - Publish release (triggers npm publish via GitHub Actions)"
echo ""
echo "Release notes template created at: $RELEASE_FILE"
