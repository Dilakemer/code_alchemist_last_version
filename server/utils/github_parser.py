import requests
import json
import base64
import os

class GitHubParser:
    """
    Handles fetching repository structure and file contents from GitHub.
    Allows the AI to be context-aware by providing the file tree and specific file contents.
    """
    
    # Files we shouldn't try to parse for context usually
    IGNORED_EXTENSIONS = {
        '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp', '.pdf', '.zip', '.tar', '.gz',
        '.mp4', '.mp3', '.wav', '.pyc', '.pyo', '.pyd', '.so', '.dll', '.dylib', '.class', '.jar',
        '.exe', '.bin', '.lock'
    }
    
    IGNORED_DIRECTORIES = {
        'node_modules', 'venv', '.venv', 'env', '.env', '.git', '__pycache__', 'dist', 'build',
        'idea', '.vscode'
    }

    def __init__(self, github_token=None):
        self.github_token = github_token or os.getenv('GITHUB_TOKEN')
        self.headers = {}
        if self.github_token:
            self.headers['Authorization'] = f"token {self.github_token}"

    def _get_default_branch(self, repo_name: str) -> str:
        """Fetches the default branch name from the GitHub API."""
        url = f"https://api.github.com/repos/{repo_name}"
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            if response.status_code == 200:
                return response.json().get('default_branch', 'main')
        except Exception:
            pass
        return 'main'

    def _clean_repo_name(self, repo_name: str) -> str:
        """Cleans up repository URL to extract owner/repo format."""
        if not repo_name:
            return ""
        repo_name = repo_name.split('?')[0].split('#')[0]
        repo_name = repo_name.replace('https://github.com/', '').replace('http://github.com/', '').strip().strip('/')
        if repo_name.endswith('.git'):
            repo_name = repo_name[:-4]
        return repo_name.strip()

    def get_repo_tree(self, repo_name: str, branch: str = 'main') -> dict:
        """
        Fetches the complete repository tree.
        repo_name format: 'owner/repo' or full URL
        Tries multiple branches (main, master, HEAD) before failing.
        """
        # Clean up URL if user pasted full github link
        repo_name = self._clean_repo_name(repo_name)
        branch = branch.strip() if branch and branch.strip() else 'main'

        # Build list of branches to try: user-specified first, then common defaults
        branches_to_try = [branch]
        for fallback in ['main', 'master', 'HEAD']:
            if fallback not in branches_to_try:
                branches_to_try.append(fallback)

        for current_branch in branches_to_try:
            url = f"https://api.github.com/repos/{repo_name}/git/trees/{current_branch}?recursive=1"
            try:
                response = requests.get(url, headers=self.headers, timeout=10)
                if response.status_code == 404:
                    print(f"Branch '{current_branch}' not found, trying next...")
                    continue
                if response.status_code != 200:
                    print(f"Failed to fetch repo tree for branch '{current_branch}': {response.text}")
                    continue
                
                data = response.json()
                # If tree is truncated, GitHub returns truncated=True — we still proceed with what we have
                tree = data.get('tree', [])
                if not tree:
                    continue
                
                # Filter and structure the tree
                filtered_tree = []
                for item in tree:
                    path = item.get('path', '')
                    item_type = item.get('type', '')
                    
                    # Check ignores
                    skip = False
                    for ignored_dir in self.IGNORED_DIRECTORIES:
                        if path.startswith(f"{ignored_dir}/") or f"/{ignored_dir}/" in path or path == ignored_dir:
                            skip = True
                            break
                    
                    if not skip and item_type == 'blob':
                        ext = os.path.splitext(path)[1].lower()
                        if ext in self.IGNORED_EXTENSIONS:
                            skip = True
                    
                    if not skip:
                        filtered_tree.append({
                            'path': path,
                            'type': item_type,
                            'url': item.get('url'),  # blob url
                            'branch': current_branch
                        })
                        
                print(f"Successfully fetched repo tree for '{repo_name}' on branch '{current_branch}' ({len(filtered_tree)} items)")
                return filtered_tree

            except Exception as e:
                print(f"Error fetching repo tree for branch '{current_branch}': {e}")
                continue

        print(f"All branch attempts failed for repo '{repo_name}'")
        return None

    def get_file_content(self, repo_name: str, path: str, branch: str = 'main') -> str:
        """
        Fetches the raw content of a specific file.
        """
        repo_name = self._clean_repo_name(repo_name)
        url = f"https://raw.githubusercontent.com/{repo_name}/{branch}/{path}"
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            if response.status_code == 200:
                return response.text
            return f"[Error fetching file: HTTP {response.status_code}]"
        except Exception as e:
            return f"[Error fetching file: {e}]"

    def format_tree_for_prompt(self, tree: list) -> str:
        """
        Formats the tree into a readable string representation for the LLM.
        """
        if not tree:
            return ""
        
        output = []
        for item in tree:
            if item['type'] == 'blob':
                output.append(f"- {item['path']}")
            else:
                output.append(f"📁 {item['path']}/")
                
        return "\n".join(output)

    def create_pull_request(self, repo_name: str, base_branch: str, new_branch: str, title: str, body: str, file_changes: list) -> dict:
        """
        Creates a new branch, commits file changes, and opens a Pull Request.
        file_changes should be a list of dicts: [{'path': 'file.js', 'content': 'new content'}]
        """
        if not self.github_token:
            return {'error': 'GitHub token is missing. Please add GITHUB_TOKEN to your .env file.'}
        
        repo_name = self._clean_repo_name(repo_name)
        
        try:
            # 1. Get the SHA of the base branch
            ref_url = f"https://api.github.com/repos/{repo_name}/git/ref/heads/{base_branch}"
            ref_res = requests.get(ref_url, headers=self.headers)
            if ref_res.status_code != 200:
                print(f"Failed to get base branch SHA: {ref_res.text}")
                return {'error': f"Could not find base branch '{base_branch}'"}
            base_sha = ref_res.json()['object']['sha']

            # 2. Create new branch
            create_ref_url = f"https://api.github.com/repos/{repo_name}/git/refs"
            create_ref_data = {
                "ref": f"refs/heads/{new_branch}",
                "sha": base_sha
            }
            new_ref_res = requests.post(create_ref_url, headers=self.headers, json=create_ref_data)
            
            # 422 usually means branch already exists, we'll try to append a random number
            if new_ref_res.status_code == 422:
                import random
                new_branch = f"{new_branch}-{random.randint(100, 999)}"
                create_ref_data["ref"] = f"refs/heads/{new_branch}"
                new_ref_res = requests.post(create_ref_url, headers=self.headers, json=create_ref_data)
                
            if new_ref_res.status_code != 201:
                return {'error': f"Failed to create new branch: {new_ref_res.text}"}

            # 3. Commit files
            for change in file_changes:
                path = change['path']
                content = change['content']
                
                # Check if file exists to get its SHA (needed for updates, not creations)
                file_url = f"https://api.github.com/repos/{repo_name}/contents/{path}?ref={new_branch}"
                file_res = requests.get(file_url, headers=self.headers)
                
                commit_data = {
                    "message": f"🤖 Code Alchemist: Update {path}",
                    "content": base64.b64encode(content.encode('utf-8')).decode('utf-8'),
                    "branch": new_branch
                }
                
                if file_res.status_code == 200:
                    # Update existing file
                    commit_data["sha"] = file_res.json()['sha']
                
                put_url = f"https://api.github.com/repos/{repo_name}/contents/{path}"
                put_res = requests.put(put_url, headers=self.headers, json=commit_data)
                if put_res.status_code not in [200, 201]:
                    return {'error': f"Failed to commit {path}: {put_res.text}"}

            # 4. Create Pull Request
            pr_url = f"https://api.github.com/repos/{repo_name}/pulls"
            pr_data = {
                "title": f"🪄 Code Alchemist: {title}",
                "body": f"{body}\n\n---\n*This Pull Request was autonomously generated by Code Alchemist Advanced IDE Features.*",
                "head": new_branch,
                "base": base_branch
            }
            pr_res = requests.post(pr_url, headers=self.headers, json=pr_data)
            
            if pr_res.status_code == 201:
                return {'success': True, 'pr_url': pr_res.json()['html_url']}
            else:
                return {'error': f"Failed to create Pull Request: {pr_res.text}"}
                
        except Exception as e:
            return {'error': str(e)}
