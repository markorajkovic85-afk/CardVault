#!/bin/bash
# CardVault — Deploy to GitHub Pages
# Usage: bash execution/deploy.sh

set -e

echo "Building CardVault for GitHub Pages..."

# Ensure we're in the project root
if [ ! -f "src/index.html" ]; then
  echo "Error: Run this script from the CardVault project root"
  exit 1
fi

# Create a clean dist directory
rm -rf dist
mkdir -p dist

# Copy source files
cp -r src/* dist/
cp -r assets dist/

echo "Build complete! Files in dist/"
echo ""
echo "To deploy to GitHub Pages:"
echo "  1. git add dist/"
echo "  2. git commit -m 'Deploy CardVault'"
echo "  3. git subtree push --prefix dist origin gh-pages"
echo ""
echo "Or use GitHub Actions with the dist/ folder as the source."
