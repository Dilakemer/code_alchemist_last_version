#!/usr/bin/env bash
set -euo pipefail

echo "Installing backend dependencies..."
cd server
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

echo "Building frontend..."
cd ../client
npm install
npm run build

echo "Copying frontend build to backend static directory..."
cd ../server
mkdir -p static
rm -rf static/assets static/index.html static/vite.svg
cp -R ../client/dist/. static/

echo "Render build completed."
