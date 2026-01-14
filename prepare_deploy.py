import os
import shutil
import subprocess
import sys

def main():
    print("🚀 Deployment Preparation Sequence Initiated...")
    
    # Paths
    root_dir = os.path.dirname(os.path.abspath(__file__))
    client_dir = os.path.join(root_dir, 'client')
    server_dir = os.path.join(root_dir, 'server')
    static_dir = os.path.join(server_dir, 'static')
    dist_dir = os.path.join(client_dir, 'dist')
    
    # 1. Build Client
    print("\n📦 Building Frontend (React/Vite)...")
    try:
        # Check if npm is installed
        subprocess.run(['npm', '--version'], check=True, stdout=subprocess.DEVNULL, shell=True)
        
        # Run build
        subprocess.run(['npm', 'install'], cwd=client_dir, check=True, shell=True)
        subprocess.run(['npm', 'run', 'build'], cwd=client_dir, check=True, shell=True)
        print("✅ Frontend build successful.")
    except Exception as e:
        print(f"❌ Frontend build failed: {e}")
        print("Please run 'cd client && npm run build' manually if needed.")
        # We continue assuming dist might exist from previous run
    
    # 2. Move Files to Server/Static
    print("\n🚚 Moving assets to Server/Static...")
    if not os.path.exists(dist_dir):
        print(f"❌ Error: {dist_dir} does not exist. Build failed?")
        return

    # Create static if not exists
    if not os.path.exists(static_dir):
        os.makedirs(static_dir)
        
    # Clean static BUT keep 'generated' folder (important for user images)
    for item in os.listdir(static_dir):
        if item == 'generated':
            continue
        item_path = os.path.join(static_dir, item)
        if os.path.isdir(item_path):
            shutil.rmtree(item_path)
        else:
            os.remove(item_path)
            
    # Copy dist content
    for item in os.listdir(dist_dir):
        s = os.path.join(dist_dir, item)
        d = os.path.join(static_dir, item)
        if os.path.isdir(s):
            shutil.copytree(s, d)
        else:
            shutil.copy2(s, d)
            
    print(f"✅ Assets moved to {static_dir}")
    
    # 3. Add gunicorn to requirements.txt
    print("\n🐍 Updating requirements.txt...")
    req_path = os.path.join(server_dir, 'requirements.txt')
    with open(req_path, 'r') as f:
        content = f.read()
    
    if 'gunicorn' not in content:
        with open(req_path, 'a') as f:
            f.write('\ngunicorn>=20.1.0\n')
        print("✅ Added gunicorn.")
    else:
        print("✅ gunicorn already present.")

    # 4. Create Procfile
    print("\n📄 Creating Procfile for Render...")
    procfile_path = os.path.join(root_dir, 'Procfile')
    with open(procfile_path, 'w') as f:
        # We assume the root dir for Render is the repo root.
        # We need to install python deps and run gunicorn in server dir
        # Render automatic python build installs requirements.txt if found.
        # But our requirements are in server/requirements.txt.
        # We might need to help Render find them.
        # But simplest: Command line does everything.
        f.write('web: cd server && gunicorn app:app')
    print("✅ Procfile created.")
    
    # 5. Create render.yaml (Optional Blueprint)
    
    print("\n✨ Preparation Complete!")
    print("NEXT STEPS FOR YOU:")
    print("1. Commit all these changes to GitHub.")
    print("   git add .")
    print("   git commit -m 'Prepare for deployment'")
    print("   git push")
    print("2. Go to Render.com -> New Web Service.")
    print("3. Connect your repo.")
    print("4. Settings:")
    print("   - Root Directory: . (default)")
    print("   - Build Command: pip install -r server/requirements.txt")
    print("   - Start Command: cd server && gunicorn app:app")
    print("   - Environment Variables: Add GEMINI_API_KEY, JWT_SECRET_KEY, etc.")

if __name__ == "__main__":
    main()
