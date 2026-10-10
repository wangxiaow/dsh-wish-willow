"""Read-only isolated product and production-byte assertions, never direct data edits."""
import argparse,datetime,hashlib,json,pathlib,re
p=argparse.ArgumentParser();p.add_argument('label');p.add_argument('revision',type=int);p.add_argument('--title');p.add_argument('--status');a=p.parse_args()
assert re.fullmatch('[a-z0-9-]+',a.label)
evidence=pathlib.Path(__file__).resolve().parent;root=evidence.parents[2]
storage=root/'.test-data/final-github-home-20261009/storages/wish_willow.json'
production=pathlib.Path(r'C:\Users\wangw\.dsh\storages\wish_willow.json')
prodhash=hashlib.sha256(production.read_bytes()).hexdigest()
assert prodhash=='dbbb88bfb5c4d723f6803f63f8f942ef0b48a22dd4238c0ecec0362c9b9ecbcc','Production data unexpectedly changed'
raw=storage.read_bytes() if storage.exists() else None
record=json.loads(raw) if raw is not None else None
products=list(record['tables']['products'].values()) if record is not None else []
assert len(products)==(0 if a.revision==0 else 1),products
if a.revision:
 row=products[0];assert row['revision']==a.revision,row
 assert row['title'].startswith('[P0 ACCEPTANCE TEST]')
 if a.title is not None:assert row['title']==a.title,row
 if a.status is not None:assert row['status']==a.status,row
result={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'storage':str(storage),'exists':raw is not None,'sha256':hashlib.sha256(raw).hexdigest() if raw else None,'products':products,'expectedRevision':a.revision,'productionSha256':prodhash,'productionUnchanged':True}
out=evidence/(a.label+'.json');assert not out.exists(),'Do not overwrite evidence'
out.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'snapshot':out.name,'revision':a.revision,'count':len(products),'productionUnchanged':True}))
