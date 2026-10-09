"""Verify actual deliverables against source without modifying either archive."""
import hashlib, json, pathlib, sys, tarfile, zipfile
root = pathlib.Path(__file__).resolve().parents[1]
bundle, source_zip = map(pathlib.Path, sys.argv[1:3])
required = ['src/host.js', 'src/model.js', 'client.js', 'cordis.patch.yml', 'package.json',
            'LICENSE', 'README.md', 'docs/P0-REPORT.md', 'docs/COMPATIBILITY.md', 'tests/model.test.mjs']
with tarfile.open(bundle, 'r:gz') as archive:
    names = archive.getnames()
    assert all(not any(segment in {'.research', 'node_modules', '.git'} for segment in name.split('/')) for name in names)
    assert all('package/' + name in names for name in required)
    for name in ['src/host.js', 'src/model.js', 'client.js', 'cordis.patch.yml', 'LICENSE']:
        assert archive.extractfile('package/' + name).read() == (root / name).read_bytes(), name
    assert json.load(archive.extractfile('package/package.json')) == json.loads((root / 'package.json').read_text(encoding='utf-8'))
with zipfile.ZipFile(source_zip) as archive:
    names = archive.namelist()
    for name in required + ['AGENTS.md', 'tasks/P0.md', 'pnpm-lock.yaml']:
        assert 'wish-willow-p0/' + name in names, name
    assert not any('/.research/' in name or '/node_modules/' in name or '/.git/' in name for name in names)
    for name in ['src/host.js', 'src/model.js', 'client.js', 'cordis.patch.yml', 'LICENSE']:
        assert archive.read('wish-willow-p0/' + name) == (root / name).read_bytes(), name
print(json.dumps({'status': 'PASS', 'archives': [
    {'name': p.name, 'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in [bundle, source_zip]]}, indent=2))
