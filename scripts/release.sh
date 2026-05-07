#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   Before running this script, bump the version first:
#
#     npm version patch   # bug fixes
#     npm version minor   # new features
#     npm version major   # breaking changes
#
#   Then run:
#     yarn release:tag
#
#   If the script fails, fix the reported error, re-bump if needed, and run again.

PACKAGE_NAME=$(node -p "require('./package.json').name")
VERSION=$(node -p "require('./package.json').version")
TAG="v$VERSION"

git tag "$TAG"

echo "🔍  Pre-release checks for $PACKAGE_NAME@$VERSION"
echo "---------------------------------------------------"

echo "▶  [1/7] Lint..."
yarn lint

echo "▶  [2/7] TypeScript check..."
yarn ts:check

echo "▶  [3/7] Tests..."
yarn test --run

echo "▶  [4/7] Build..."
yarn build

echo "▶  [5/7] npm whoami..."
npm whoami

echo "▶  [6/7] npm view $PACKAGE_NAME..."
npm view "$PACKAGE_NAME"

echo "▶  [7/7] Publish dry-run..."
npm publish --dry-run

echo ""
echo "✅  All checks passed. Creating git tag $TAG..."
echo ""
echo "Push it with:"
echo "  git push origin main --tags"
