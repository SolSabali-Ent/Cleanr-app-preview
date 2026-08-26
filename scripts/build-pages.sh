#!/usr/bin/env bash
set -euo pipefail

export VITE_PUBLIC_HOST_MODE=1

npm run build

rm -rf docs
mkdir -p docs
cp -R dist/. docs/
cp docs/index.html docs/404.html
printf 'go.cleanr.app\n' > docs/CNAME
touch docs/.nojekyll

echo "Cleanr GitHub Pages build prepared in ./docs"
