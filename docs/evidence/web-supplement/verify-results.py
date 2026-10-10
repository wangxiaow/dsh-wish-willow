"""Verify captured real-browser UI and disk evidence; does not simulate the product."""
import datetime,json,pathlib
p=pathlib.Path(__file__).resolve().parent
load=lambda n:json.loads((p/(n+'.json')).read_text(encoding='utf-8-sig'))
rows=lambda n:load(n)['elements']
field=lambda n,i:next(e for e in rows(n) if e['id']==i)
button=lambda n,t:next(e for e in rows(n) if e['type']=='ControlType.Button' and e['name']==t)
texts=lambda n:[e['name'] for e in rows(n) if e['type']=='ControlType.Text']
def revision(n):
 ts=texts(n);i=next(i for i,t in enumerate(ts) if t in ['修订号','Revision']);return int(ts[i+1])
def product(n):return load(n)['products'][0]
checks=[]
def check(name,condition,scope):checks.append({'scope':scope,'name':name,'pass':bool(condition)})
created=product('created');edited=product('edited');winner=product('winner-a');after=product('after-b-conflict')
check('Actual browser A is on isolated authenticated Web origin',load('browser-targets')['BrowserA']['origin']=='http://127.0.0.1:3081','T4')
check('Empty and whitespace-only title disable Save',not button('a-empty','保存')['enabled'] and not button('a-whitespace','保存')['enabled'],'T4')
check('Browser create durably stored labelled UUID/revision 1',created['revision']==1 and created['id'] in texts('a-created') and revision('a-created')==1,'T4')
check('Edit and status saved with stable UUID and incremented revision',created['id']==edited['id'] and edited['revision']==2 and edited['status']=='confirmed' and edited['createdAt']==created['createdAt'] and edited['updatedAt']>created['updatedAt'],'T4')
check('Full browser refresh recovered saved text/status/revision',field('a-refreshed','ww-title')['value']==edited['title'] and field('a-refreshed','ww-wish')['value']==edited['wish'] and field('a-refreshed','ww-status')['value']=='已确认' and revision('a-refreshed')==2,'T4')
check('Actual Chinese and English labelled controls rendered',field('a-refreshed','ww-title')['name']=='产品名称' and field('a-english','ww-title')['name']=='Product name' and field('a-english','ww-wish')['name']=='Software wish' and field('a-english','ww-status')['name']=='Manual product status','T4')
win=list(map(float,load('a-narrow')['bounds'].split(',')));inp=list(map(float,field('a-narrow','ww-title')['bounds'].split(',')));nav=list(map(float,button('a-narrow','新建产品')['bounds'].split(',')))
check('640px window uses stacked list/form within horizontal viewport',win[2]==640 and abs(inp[0]-nav[0])<2 and inp[1]>nav[1]+nav[3] and inp[0]+inp[2]<=win[0]+win[2] and not field('a-narrow','ww-wish')['offscreen'],'T4')
invalid='Check the name (1–120 characters) and wish (up to 10000 characters).'
check('Oversized title gives actual UI error and retains rejected draft',len(field('a-invalid-title','ww-title')['value'])>120 and invalid in texts('a-invalid-title'),'T4')
# UIA ValuePattern exposes 10000 visible characters for the 10001-character input.
# Compare actual visible state before/after Save rather than assuming lossless UIA serialization.
# Initial incorrect assumption and its failed results remain archived; validation is not waived.
check('Oversized wish gives actual UI error and retains visible draft',invalid in texts('a-invalid-wish') and '请检查名称（1–120 字符）与愿望（最多 10000 字符）。' in texts('a-wish-after-save') and len(field('a-wish-before-save','ww-wish')['value'])==10000 and field('a-wish-before-save','ww-wish')['value']==field('a-wish-after-save','ww-wish')['value'] and load('wish-boundary-rejected')['sha256']==load('winner-a')['sha256'],'T4')
check('Invalid input attempts leave committed disk bytes unchanged',load('edited')['sha256']==load('invalid-title-rejected')['sha256']==load('invalid-wish-rejected')['sha256'],'T4')
targets=load('browser-targets')
check('Two distinct real browser windows use the same single Host origin',targets['BrowserA']['handle']!=targets['BrowserB']['handle'] and targets['BrowserA']['origin']==targets['BrowserB']['origin']==load('isolated-host')['origin'],'T5')
check('Both clients loaded the same UUID at revision 2',revision('a-before-conflict')==revision('b-before-conflict')==2 and edited['id'] in texts('a-before-conflict') and edited['id'] in texts('b-before-conflict'),'T5')
check('A save durably commits revision 3',winner['revision']==3 and winner['title']=='[P0 ACCEPTANCE TEST] Web winner A' and revision('a-winner')==3,'T5')
check('B remained on old revision before attempting save',revision('b-stale-draft')==2 and field('b-stale-draft','ww-title')['value']=='[P0 ACCEPTANCE TEST] Web losing draft B','T5')
check('Actual B UI reports conflict', 'Another page changed this product. Your draft is preserved; reload before editing again.' in texts('b-conflict'),'T5')
check('B losing title and wish are preserved after conflict',field('b-conflict','ww-title')['value']==field('b-stale-draft','ww-title')['value'] and field('b-conflict','ww-wish')['value']==field('b-stale-draft','ww-wish')['value'] and revision('b-conflict')==2,'T5')
check('Rejected B request cannot overwrite winner in durable storage',after==winner and load('after-b-conflict')['sha256']==load('winner-a')['sha256'],'T5')
check('Explicit B reload retrieves A and discards draft only on request',revision('b-reloaded')==3 and field('b-reloaded','ww-title')['value']==winner['title'] and field('b-reloaded','ww-wish')['value']==winner['wish'],'T5')
check('Production bytes remain unchanged throughout supplemental writes',all(load(n)['productionUnchanged'] for n in ['baseline','created','edited','invalid-title-rejected','invalid-wish-rejected','winner-a','after-b-conflict','final-data']),'safety')
check('Original Chinese locale restored in isolated browser',field('a-restored','ww-title')['name']=='产品名称','safety')
result={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'Assertions over real Chrome UIA snapshots and actual JSON disk records; not mocked UI or API substitution','checks':checks,'passed':sum(c['pass'] for c in checks),'failed':sum(not c['pass'] for c in checks),'T4':'PASS' if all(c['pass'] for c in checks if c['scope']=='T4') else 'FAIL','T5':'PASS' if all(c['pass'] for c in checks if c['scope']=='T5') else 'FAIL','uuid':created['id']}
(p/'results-final.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
for c in checks:print(('PASS' if c['pass'] else 'FAIL')+' '+c['scope']+' '+c['name'])
print(json.dumps({k:result[k] for k in ['passed','failed','T4','T5','uuid']}))
raise SystemExit(0 if not result['failed'] else 1)
