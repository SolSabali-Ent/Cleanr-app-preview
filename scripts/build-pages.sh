#!/usr/bin/env bash
set -euo pipefail

rm -rf dist docs
VITE_PUBLIC_HOST_MODE=1 npm run build

mkdir -p docs
cp -R dist/. docs/
cp docs/index.html docs/404.html
printf 'cleanr.app\n' > docs/CNAME
touch docs/.nojekyll

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
  csp/growth
  csp/growth/milestones
  csp/growth/capabilities
  csp/growth/opportunities
  csp/growth/fit
  csp/growth/network
  csp/growth/contributions
  csp/dashboard/growth
  csp/dashboard/growth/milestones
  csp/dashboard/growth/capabilities
  csp/dashboard/growth/opportunities
  csp/dashboard/growth/opportunities/fit
  csp/dashboard/growth/network
  csp/dashboard/growth/contributions
  trust-safety
  booking-confirmed
)

for route in "${routes[@]}"; do
  mkdir -p "docs/$route"
  cp docs/index.html "docs/$route/index.html"
done

echo "Built GitHub Pages output in ./docs"
