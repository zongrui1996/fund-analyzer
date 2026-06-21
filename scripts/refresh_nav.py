#!/usr/bin/env python3
"""历史净值数据刷新脚本（每周运行一次，约3分钟）"""
import subprocess, re, json, os, time, concurrent.futures

PROJ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(PROJ, 'fund-data.js')

with open(DATA_FILE) as fh:
    raw = fh.read()
funds = json.loads(raw[15:-1])
codes = [f[0] for f in funds]

nav_data = {}
done = 0
t0 = time.time()

def fetch(code):
    try:
        r = subprocess.run(['curl', '-sL', '--max-time', '10',
            '-H', 'User-Agent: Mozilla/5.0',
            '-H', 'Referer: https://fund.eastmoney.com/',
            f'https://api.fund.eastmoney.com/f10/lsjz?callback=jq&fundCode={code}&pageIndex=1&pageSize=20'],
            capture_output=True, text=True, timeout=15)
        m = re.search(r'jq\((.*)\)', r.stdout, re.DOTALL)
        if not m: return code, None
        data = json.loads(m.group(1))
        lst = data.get('Data',{}).get('LSJZList',[])
        if not lst: return code, None
        return code, [[i['FSRQ'],float(i['DWJZ']),float(i['LJJZ']),float(i['JZZZL']) if i['JZZZL'] else 0] for i in lst]
    except:
        return code, None

for start in range(0, len(codes), 500):
    batch = codes[start:start+500]
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        fut = {ex.submit(fetch, c): c for c in batch}
        for f in concurrent.futures.as_completed(fut):
            c, d = f.result()
            if d: nav_data[c] = d
    done += len(batch)
    elapsed = time.time() - t0
    rate = done / elapsed if elapsed > 0 else 0
    eta = (len(codes) - done) / rate if rate > 0 else 0
    if done % 1000 == 0:
        print(f'  [{done}/{len(codes)}] {elapsed:.0f}s, ETA={eta:.0f}s')

out = 'var NAV_HISTORY = ' + json.dumps(nav_data, ensure_ascii=False) + ';\n'
with open(os.path.join(PROJ, 'nav-history-data.js'), 'w', encoding='utf-8') as fh:
    fh.write(out)
print(f'Done: {len(nav_data)} funds, {time.time()-t0:.0f}s')
