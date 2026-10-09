"""Install a staged static release on NAS; run only as part of an authorized deployment."""
from pathlib import Path
import hashlib
import os
import re
import shutil
import subprocess
import sys

root = Path('/vol2/docker/ink-loom')
gateway = Path('/vol2/docker/gitea/Caddyfile')
stage = Path(sys.argv[1])
release_id = sys.argv[2]
if not re.fullmatch(r'\d{8}T\d{6}Z-[a-f0-9]{10}', release_id):
    raise SystemExit('Invalid release ID')
if stage.parent != root / 'staging':
    raise SystemExit('Invalid staging directory')

def run(*args):
    subprocess.run(args, check=True, timeout=55)

site = stage / 'site'
html = (site / 'index.html').read_text()
if '/ink/assets/' not in html or 'href="/ink/favicon.svg"' not in html:
    raise SystemExit('Build must use the /ink/ public base path')

www = root / 'www'
releases = www / 'releases'
releases.mkdir(parents=True, exist_ok=True)
current = www / 'current'
previous = os.readlink(current) if current.is_symlink() else None
release = releases / release_id
if release.exists():
    # Resume a failed activation only when the immutable build already matches.
    for source in site.rglob('*'):
        if source.is_file():
            target = release / source.relative_to(site)
            if not target.is_file() or target.read_bytes() != source.read_bytes():
                raise SystemExit('Release already exists with different content')
else:
    shutil.copytree(site, release)

# Keep hashed assets available for visitors who still have the previous page open.
if previous and (current / 'assets').is_dir():
    for asset in (current / 'assets').iterdir():
        if asset.is_file() and not (release / 'assets' / asset.name).exists():
            shutil.copy2(asset, release / 'assets' / asset.name)

for filename in ('Caddyfile', 'compose.yaml'):
    target = root / filename
    if target.exists():
        backup = root / 'configuration-backups' / release_id
        backup.mkdir(parents=True, exist_ok=True)
        shutil.copy2(target, backup / filename)
    shutil.copyfile(stage / filename, target)

run('docker', 'run', '--rm', '--network', 'none',
    '--mount', f'type=bind,source={root / "Caddyfile"},target=/etc/caddy/Caddyfile,readonly',
    'caddy:2.10.2-alpine', 'caddy', 'validate', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile')

pending = www / 'current.pending'
pending.unlink(missing_ok=True)
pending.symlink_to('releases/' + release_id)
pending.replace(current)
try:
    run('docker', 'compose', '-f', str(root / 'compose.yaml'), 'up', '-d', '--wait', '--wait-timeout', '30')
    run('docker', 'exec', 'gitea-caddy', 'wget', '-q', '-O', '/dev/null', 'http://ink-loom-web:8080/')
except Exception:
    if previous:
        pending.symlink_to(previous)
        pending.replace(current)
    else:
        current.unlink(missing_ok=True)
    raise

original = gateway.read_text()
marker = '# ink-loom:begin'
route = '''    # ink-loom:begin
    redir /ink /ink/ 308
    handle_path /ink/* {
        reverse_proxy ink-loom-web:8080
    }
    handle {
        reverse_proxy server:3000
    }
    # ink-loom:end
'''
if marker in original:
    if route not in original:
        raise SystemExit('Existing Ink Loom route differs; inspect it before changing shared configuration')
else:
    old = '    reverse_proxy server:3000\n'
    if not original.startswith('https://git.freshli4.com:10443 {\n') or original.count(old) != 1 or '/ink' in original:
        raise SystemExit('Gateway configuration differs from the inspected configuration')
    proposed = original.replace(old, route, 1)
    candidate = root / ('gateway-candidate-' + release_id + '.caddy')
    candidate.write_text(proposed)
    container_candidate = '/tmp/ink-loom-' + release_id + '.caddy'
    run('docker', 'cp', str(candidate), 'gitea-caddy:' + container_candidate)
    run('docker', 'exec', 'gitea-caddy', 'caddy', 'validate', '--config', container_candidate, '--adapter', 'caddyfile')

    if gateway.read_text() != original:
        raise SystemExit('Gateway changed during deployment; aborting shared configuration update')
    backups = root / 'gateway-backups'
    backups.mkdir(exist_ok=True)
    (backups / ('Caddyfile.' + release_id)).write_text(original)
    # Preserve the inode used by the existing single-file bind mount.
    with gateway.open('r+') as file:
        file.write(proposed)
        file.truncate()
        file.flush()
        os.fsync(file.fileno())
    try:
        expected = hashlib.sha256(proposed.encode()).hexdigest()
        actual = subprocess.check_output(['docker', 'exec', 'gitea-caddy', 'sha256sum', '/etc/caddy/Caddyfile'], text=True).split()[0]
        if actual != expected:
            raise RuntimeError('Mounted gateway configuration does not match the proposed file')
        run('docker', 'exec', 'gitea-caddy', 'caddy', 'reload', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile')
    except Exception:
        with gateway.open('r+') as file:
            file.write(original)
            file.truncate()
            file.flush()
            os.fsync(file.fileno())
        run('docker', 'exec', 'gitea-caddy', 'caddy', 'reload', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile')
        raise

(root / 'current-release').write_text(release_id + '\n')
print('Installed release:', release_id, flush=True)
print('https://git.freshli4.com:10443/ink/', flush=True)
