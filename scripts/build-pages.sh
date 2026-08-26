#!/usr/bin/env bash
set -euo pipefail

rm -rf dist docs
VITE_PUBLIC_HOST_MODE=1 npm run build

mkdir -p docs
cp -R dist/. docs/
cp docs/index.html docs/404.html
printf 'go.cleanr.app\n' > docs/CNAME
touch docs/.nojekyll

# GitHub Pages serves static files directly. Add route entry shells so
# BrowserRouter URLs work on first load as well as client-side navigation.
routes=(
  app
  app/bookings
  app/provider
  app/profile
  app/payments
  book
  signin
  dashboard
  csp
  csp/login
  csp/signup
  csp/dashboard
  csp/dashboard/growth
  trust-safety
  booking-confirmed
)

for route in "${routes[@]}"; do
  mkdir -p "docs/$route"
  cp docs/index.html "docs/$route/index.html"
done

echo "Built GitHub Pages output in ./docs"
