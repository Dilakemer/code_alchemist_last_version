# Build Frontend
echo "Building Frontend..."
cd client
npm install
npm run build
cd ..

# Ensure server/static exists and is clean
echo "Cleaning existing static files..."
mkdir -p server/static
rm -rf server/static/*

# Copy built assets to Flask static folder
echo "Copying built assets to Flask..."
cp -r client/dist/* server/static/

# Install Backend Dependencies
echo "Installing Backend Dependencies..."
cd server
pip install -r requirements.txt
cd ..

echo "Build complete!"
