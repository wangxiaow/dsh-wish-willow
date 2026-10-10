"""Read-only live-domain comparison; never opens a writing Host or edits storage."""
import datetime, hashlib, json, pathlib, sys
root = pathlib.Path(__file__).resolve().parents[3]
output = pathlib.Path(__file__).resolve().parent
live_path = pathlib.Path(r'C:\Users\wangw\.dsh\storages\wish_willow.json')
raw = live_path.read_bytes()
live = json.loads(raw)
historical = json.loads((root / 'docs/evidence/live-reloaded.json').read_text(encoding='utf-8'))['product']
assert live['tables']['products'][historical['id']] == historical, 'Existing historical product changed'
new = [p for p in live['tables']['products'].values() if p['title'].startswith('[P0 ACCEPTANCE TEST]')]
result = {'observedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'storagePath': str(live_path),
          'sha256': hashlib.sha256(raw).hexdigest(), 'historicalProductUnchanged': True,
          'historicalProduct': historical, 'acceptanceProducts': new, 'productCount': len(live['tables']['products'])}
path = output / (sys.argv[1] + '.json')
assert not path.exists(), f'Refuse to overwrite {path}'
path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(result, ensure_ascii=False, indent=2))
