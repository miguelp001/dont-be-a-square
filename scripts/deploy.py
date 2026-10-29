import os
import sys
import paramiko
from pathlib import Path

# Load local .env.deploy or .env if present (for local CLI runs)
env_file = Path(__file__).resolve().parent.parent / '.env.deploy'
if not env_file.exists():
    env_file = Path(__file__).resolve().parent.parent / '.env'

if env_file.exists():
    with open(env_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, val = line.split('=', 1)
                os.environ.setdefault(key.strip(), val.strip())

HOST = os.environ.get('SSH_HOST')
USER = os.environ.get('SSH_USER')
PASS = os.environ.get('SSH_PASSWORD')
PORT = int(os.environ.get('SSH_PORT', 22))
REMOTE_DIR = os.environ.get('SSH_TARGET', '/home/dh_8jvcwd/dbas.aredpanic.com')
LOCAL_DIR = Path(__file__).resolve().parent.parent / 'dist'

def deploy():
    if not HOST or not USER or not PASS:
        print("Error: Missing deployment credentials. Set SSH_HOST, SSH_USER, and SSH_PASSWORD via environment variables or .env.deploy.")
        sys.exit(1)

    if not LOCAL_DIR.exists():
        print(f"Error: Local dist directory not found at {LOCAL_DIR}. Run 'npm run build' first.")
        sys.exit(1)

    print(f"Connecting to {HOST}:{PORT} as {USER}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, port=PORT, username=USER, password=PASS, timeout=20)

    sftp = ssh.open_sftp()
    print(f"Connected. Deploying {LOCAL_DIR} -> {REMOTE_DIR}...")

    # Upload files recursively
    upload_count = 0
    for root, dirs, files in os.walk(LOCAL_DIR):
        rel_path = os.path.relpath(root, LOCAL_DIR)
        remote_root = REMOTE_DIR if rel_path == '.' else f"{REMOTE_DIR}/{rel_path.replace(os.sep, '/')}"

        # Ensure remote dir exists
        try:
            sftp.stat(remote_root)
        except IOError:
            print(f"Creating directory: {remote_root}")
            parts = remote_root.strip('/').split('/')
            cur = ''
            for part in parts:
                cur += '/' + part
                try:
                    sftp.stat(cur)
                except IOError:
                    sftp.mkdir(cur)

        for file in files:
            local_file = os.path.join(root, file)
            remote_file = f"{remote_root}/{file}"
            print(f"  Uploading: {file}", flush=True)
            sftp.put(local_file, remote_file)
            upload_count += 1

    # Upload assets/ directory (audio, character sprites) to remote assets/
    assets_dir = Path(__file__).resolve().parent.parent / 'assets'
    if assets_dir.exists():
        print(f"\nDeploying assets {assets_dir} -> {REMOTE_DIR}/assets...", flush=True)
        for root, dirs, files in os.walk(assets_dir):
            rel_path = os.path.relpath(root, assets_dir)
            remote_root = f"{REMOTE_DIR}/assets" if rel_path == '.' else f"{REMOTE_DIR}/assets/{rel_path.replace(os.sep, '/')}"

            parts = remote_root.strip('/').split('/')
            cur = ''
            for part in parts:
                cur += '/' + part
                try:
                    sftp.stat(cur)
                except IOError:
                    sftp.mkdir(cur)

            for file in files:
                local_file = os.path.join(root, file)
                remote_file = f"{remote_root}/{file}"
                print(f"  Uploading asset: {file}", flush=True)
                sftp.put(local_file, remote_file)
                upload_count += 1

    sftp.close()
    ssh.close()
    print(f"\nDeployment complete! Successfully uploaded {upload_count} files to {REMOTE_DIR}.", flush=True)
    print(f"Site is live at: https://dbas.aredpanic.com")

if __name__ == '__main__':
    deploy()
