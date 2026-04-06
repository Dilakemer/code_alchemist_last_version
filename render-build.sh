#!/bin/bash
# set -e # Derleme hatasında durmasını istemiyoruz çünkü hazır dosyaları kullanacağız

# Build Frontend - Render Ücretsiz Sürümde Hafıza Yetersizliği Nedeniyle Devre Dışı Bırakıldı
# Biz yerelde derleyip (prepare_deploy.py) Github'a gönderdiğimiz için burada derlemeye gerek yok.
echo "Skipping Frontend Build on Render (Using pre-built assets from repository)..."

# cd client
# npm ci || npm install
# NODE_OPTIONS=--max_old_space_size=400 npm run build
# cd ..

# Install Backend Dependencies
echo "Installing Backend Dependencies..."
cd server
pip install -r requirements.txt
cd ..

echo "Build complete using pre-built assets!"
