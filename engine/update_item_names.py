"""Download the Chrome extension's original item-names.json without executing it."""
from pathlib import Path
from datetime import datetime, timezone
import argparse
import hashlib
import io
import json
import struct
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
EXTENSION_ID = 'adnbmnecjmhfgapdmibbhoopibpbaoia'
STORE_URL = ('https://chromewebstore.google.com/detail/raidbots-'
             '%E8%A3%85%E5%A4%87%E4%B8%AD%E6%96%87%E7%BF%BB%E8%AF%91/' + EXTENSION_ID)
DOWNLOAD_URL = ('https://clients2.google.com/service/update2/crx?response=redirect'
                '&prodversion=142.0.0.0&acceptformat=crx2,crx3&x=id%3D' + EXTENSION_ID + '%26uc')


def from_store():
    request = urllib.request.Request(DOWNLOAD_URL, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(request, timeout=40) as response:
        crx = response.read()
    start = 0
    if crx[:4] == b'Cr24':
        version = struct.unpack_from('<I', crx, 4)[0]
        if version == 3:
            start = 12 + struct.unpack_from('<I', crx, 8)[0]
        elif version == 2:
            key_length, signature_length = struct.unpack_from('<II', crx, 8)
            start = 16 + key_length + signature_length
        else:
            raise ValueError(f'Unsupported CRX version {version}')
    elif crx[:2] != b'PK':
        raise ValueError('The store did not return a CRX/ZIP package')
    with zipfile.ZipFile(io.BytesIO(crx[start:])) as archive:
        manifest = json.loads(archive.read('manifest.json'))
        return archive.read('data/item-names.json'), manifest['version']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fallback', type=Path, help='Local extension directory, used only if the store request fails')
    args = parser.parse_args()
    source = 'chrome-web-store'
    failure = None
    try:
        raw, version = from_store()
    except Exception as error:
        if not args.fallback:
            raise
        failure = str(error)
        folder = args.fallback.resolve()
        raw = (folder / 'data/item-names.json').read_bytes()
        version = json.loads((folder / 'manifest.json').read_text(encoding='utf8'))['version']
        source = 'user-provided-extension'
    dictionary = json.loads(raw)
    names = dictionary.get('byId')
    if not isinstance(names, dict) or not names or not all(
            key.isdigit() and isinstance(value, str) and value.strip() for key, value in names.items()):
        raise ValueError('Invalid item name dictionary')
    metadata = {
        'extensionId': EXTENSION_ID, 'extensionVersion': version, 'source': source,
        'storeUrl': STORE_URL, 'downloadUrl': DOWNLOAD_URL,
        'retrievedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw), 'uniqueItemIds': len(names),
        'format': 'Unmodified extension data/item-names.json; only byId is used for item display names',
        'license': 'No explicit redistribution license found in the extension package or linked source repository'
    }
    if failure:
        metadata['storeFetchError'] = failure
    target = ROOT / 'data'
    target.mkdir(exist_ok=True)
    (target / 'item-names.json').write_bytes(raw)
    (target / 'item-names.source.json').write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
