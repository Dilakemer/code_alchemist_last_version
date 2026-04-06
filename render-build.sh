#!/bin/bash
set -e

# Build Frontend
echo "Building Frontend..."
cd client
# Run ci instead of install, and limit memory to avoid OOM
npm ci || npm install
NODE_OPTIONS=--max_old_space_size=400 npm run build

# If build succeeded, copy to static folder
if [ -d "dist" ]; then
    echo "Copying built assets to Flask..."
    cd ..
    mkdir -p server/static
    # Only remove index.html and assets directory to not break generated/
    rm -rf server/static/assets
    rm -f server/static/index.html
    cp -r client/dist/* server/static/
else
    echo "Frontend build skipped or failed to output to dist."
    cd ..
fi

# Install Backend Dependencies
echo "Installing Backend Dependencies..."
cd server
pip install -r requirements.txt
cd ..

echo "Build complete!"
