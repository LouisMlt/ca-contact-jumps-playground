"""Vendor a pinned KaTeX release, or check the committed local assets offline."""
import argparse
import base64
import hashlib
import io
import json
from pathlib import Path
import tarfile
import urllib.request

VERSION = '0.19.1'
ROOT = Path(__file__).resolve().parents[1] / 'src' / 'vendor' / 'katex'


def check():
    manifest = json.loads((ROOT / 'MANIFEST.json').read_text())
    assert manifest['version'] == VERSION
    for name, expected in manifest['sha256'].items():
        assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == expected, name
    print(f'KaTeX {VERSION}: all {len(manifest["sha256"])} vendored assets match their manifest.')


def fetch():
    url = f'https://registry.npmjs.org/katex/{VERSION}'
    with urllib.request.urlopen(url) as response:
        metadata = json.load(response)
    with urllib.request.urlopen(metadata['dist']['tarball']) as response:
        archive = response.read()
    digest = 'sha512-' + base64.b64encode(hashlib.sha512(archive).digest()).decode()
    assert digest == metadata['dist']['integrity'], 'npm integrity mismatch'
    hashes = {}
    with tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz') as tar:
        for entry in tar.getmembers():
            if not entry.isfile():
                continue
            name = entry.name.removeprefix('package/')
            if name in ('dist/katex.mjs', 'dist/katex.min.css', 'LICENSE') or name.startswith('dist/fonts/'):
                relative = name.removeprefix('dist/')
                target = ROOT / relative
                if not target.resolve().is_relative_to(ROOT.resolve()):
                    raise ValueError('Unsafe package path')
                target.parent.mkdir(parents=True, exist_ok=True)
                content = tar.extractfile(entry).read()
                target.write_bytes(content)
                hashes[relative] = hashlib.sha256(content).hexdigest()
    manifest = {'name': 'KaTeX', 'version': VERSION, 'source': url,
                'integrity': digest, 'sha256': dict(sorted(hashes.items()))}
    (ROOT / 'MANIFEST.json').write_text(json.dumps(manifest, indent=2) + '\n')
    check()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    check() if args.check else fetch()
