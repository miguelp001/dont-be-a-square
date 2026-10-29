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

def upload_file_if_changed(sftp, local_file, remote_file, prefix=""):
    fname = os.path.basename(local_file)
    local_size = os.path.getsize(local_file)

    # Always upload entry points, service worker, web app manifests, and server configs
    always_upload = fname.endswith('.html') or fname.endswith('.js') or fname.endswith('.webmanifest') or fname == 'sw.js' or fname == '.htaccess'

    if not always_upload:
        try:
            r_stat = sftp.stat(remote_file)
            if r_stat.st_size == local_size:
                return False
        except IOError:
            pass

    print(f"  Uploading {prefix}{fname} ({local_size} bytes)...", flush=True)
    try:
        sftp.put(local_file, remote_file)
    except Exception as e:
        import time
        time.sleep(1.5)
        sftp.put(local_file, remote_file)
    return True

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
            if upload_file_if_changed(sftp, local_file, remote_file):
                upload_count += 1

    # Upload assets/ directory (audio, character sprites, slime sprites) to remote assets/
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
                if upload_file_if_changed(sftp, local_file, remote_file, prefix="asset: "):
                    upload_count += 1

    # Deploy backend server bundle if present
    server_bundle = Path(__file__).resolve().parent.parent / 'dist-server' / 'index.cjs'
    if server_bundle.exists():
        print(f"\nDeploying backend server {server_bundle}...", flush=True)
        try:
            sftp.mkdir('/home/dh_8jvcwd/server')
        except IOError:
            pass
        if upload_file_if_changed(sftp, str(server_bundle), '/home/dh_8jvcwd/server/index.cjs', prefix="server: "):
            upload_count += 1
        # Restart or keepalive server
        stdin, stdout, stderr = ssh.exec_command('pkill -f "node /home/dh_8jvcwd/server/index.cjs"; sleep 1; /home/dh_8jvcwd/server/keepalive.sh; sleep 1')
        stdout.read()

    sftp.close()
    ssh.close()
    print(f"\nDeployment complete! Uploaded/updated {upload_count} files in {REMOTE_DIR}.", flush=True)
    print(f"Site is live at: https://dbas.aredpanic.com")

if __name__ == '__main__':
    deploy()
