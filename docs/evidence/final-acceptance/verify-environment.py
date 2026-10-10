"""Read-only fingerprints of the installed runtime and plugin. No credentials or sessions read."""
import datetime, hashlib, json, pathlib, struct
root = pathlib.Path(__file__).resolve().parents[3]
out = pathlib.Path(__file__).resolve().parent
archive = pathlib.Path(r'D:\Program Files\DeepSeek Harness\resources\app.asar')
with archive.open('rb') as f:
    prefix = f.read(16)
    header = json.loads(f.read(struct.unpack_from('<I', prefix, 12)[0]))
    start = 8 + struct.unpack_from('<I', prefix, 4)[0]
    def read_entry(path):
        node = header
        for name in path.split('/'):
            node = node['files'][name]
        assert not node.get('unpacked') and 'offset' in node
        f.seek(start + int(node['offset']))
        return json.loads(f.read(node['size']))
    versions = {p: read_entry(p).get('version') for p in ['package.json','dsh/package.json','dsh/node_modules/@deepseek-ai/dsh/package.json','dsh/node_modules/@deepseek-ai/cordis/package.json']}
profile = pathlib.Path(r'C:\Users\wangw\.dsh\profiles\desktop')
manifest = json.loads((profile/'package.json').read_text(encoding='utf-8'))
installed = profile/'node_modules/dsh-wish-willow'
plugin_manifest = json.loads((installed/'package.json').read_text(encoding='utf-8'))
hashes = {}
for path in ['src/host.js','src/model.js','client.js','cordis.patch.yml','locale/en.json','locale/zh.json']:
    data = (installed/path).read_bytes()
    assert data == (root/path).read_bytes(), path
    hashes[path] = hashlib.sha256(data).hexdigest()
assert 'dsh-wish-willow' in manifest['dsh']['profile']['bundles']
before = json.loads((out/'live-reloaded.json').read_text(encoding='utf-8'))
after = json.loads((out/'after-restart.json').read_text(encoding='utf-8'))
assert before['sha256'] == after['sha256']
assert before['acceptanceProducts'] == after['acceptanceProducts']
assert before['historicalProduct'] == after['historicalProduct']
result = {'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(), 'versionsReadFromCurrentAsar':versions,
          'asarSha256':hashlib.sha256(archive.read_bytes()).hexdigest(),
          'desktopBundleSelected':True,'desktopInstalledVersion':plugin_manifest['version'],
          'desktopInstallSource':manifest['dependencies']['dsh-wish-willow'],
          'installedRuntimeFilesEqualWorkspace':True,'runtimeHashes':hashes,
          'storageBeforeAfterRestartBytesEqual':True,'storageSha256':after['sha256'],
          'acceptanceProductUnchangedAcrossRestart':True,'historicalProductUnchangedAcrossRestart':True,
          'note':'Installed manifest predates metadata/license update; only runtime source equality is asserted, not manifest equality.'}
(out/'verified-environment.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result,indent=2))
