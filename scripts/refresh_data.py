#!/usr/bin/env python3
"""基金数据每日自动刷新脚本 - 由 cron/launchd 定时执行"""
import subprocess, re, json, os, sys
from datetime import datetime

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG_FILE = os.path.join(PROJECT, 'scripts', 'refresh.log')

def log(msg):
    ts = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    line = f'[{ts}] {msg}'
    print(line)
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(line + '\n')

def safe_float(v):
    try: return float(v) if v else 0.0
    except: return 0.0

def hash_code(code):
    h = 0
    for c in code: h = ((h << 5) - h) + ord(c); h &= 0xFFFFFFFF
    return h

def seeded_rand(seed, idx):
    t = (seed + idx * 2654435761) & 0xFFFFFFFF
    t = ((t ^ (t >> 15)) * 2246822519) & 0xFFFFFFFF
    t = ((t ^ (t >> 13)) * 3266489917) & 0xFFFFFFFF
    return ((t ^ (t >> 16)) & 0xFFFFFFFF) / 0x100000000

def sector_for_name(name):
    sector_map = [
        (['pcb','印制电路','电路板'], 'PCB/电子电路'), (['mlcc','陶瓷电容','片式电容','电容器'], 'MLCC/电子元件'),
        (['半导体','芯片','集成电路','光刻','晶圆','封测'], '半导体'), (['电子','元器件','元件','传感器'], '电子元器件'),
        (['人工智能','AI','大模型','机器视觉','人脸识别','NLP'], '人工智能'), (['机器人','机器','自动化','机器臂'], '机器人'),
        (['云计算','云服务','SaaS','PaaS'], '云计算'), (['信创','信息安全','网安','网络安全','国产化','自主可控'], '信创'),
        (['大数据','数据要素','数据库'], '大数据'), (['量子','量子计算'], '量子科技'),
        (['5G','通信','电信','6G','光通信','光纤'], '5G/通信'), (['数字经济','数字化','数字'], '数字经济'),
        (['创新药','生物药','靶向药','抗体'], '创新药'), (['医疗器械','医疗设备','医疗耗材','体外诊断','IVD'], '医疗器械'),
        (['CXO','CRO','CMO','CDMO','医药研发'], '医药CXO'), (['中药','中医药'], '中药'),
        (['医药','医疗','健康','医美','药','生物','疫苗','基因','养老','康养'], '医药'),
        (['光伏','逆变器','硅片','电池片','HJT','TOPCon'], '光伏'), (['风电','海上风电','风机'], '风电'),
        (['锂电池','锂电','正极','负极','电解液','隔膜','碳酸锂'], '锂电池'), (['氢能','燃料电池','氢燃料'], '氢能'),
        (['储能','储能系统','电力储能'], '储能'), (['新能源车','电动汽车','充电桩','智能驾驶','自动驾驶','汽车电子'], '新能源汽车'),
        (['新能源','碳中和','碳交易','节能减排'], '新能源'), (['白酒','酒'], '白酒'),
        (['食品','饮料','乳业','调味品','预制菜'], '食品饮料'), (['家电','家居','家具'], '家电/家居'),
        (['旅游','免税','航空','酒店','餐饮'], '旅游/免税'), (['消费','零售','商贸','电商','直播'], '消费'),
        (['黄金','贵金属'], '黄金/贵金属'), (['有色','稀土','钨','锂','钴','镍','铜','铝'], '有色金属'),
        (['煤炭','焦煤','动力煤'], '煤炭'), (['钢铁','特钢'], '钢铁'),
        (['化工','石化','化学','新材料','涂料','化纤'], '化工/新材料'), (['建材','水泥','玻璃','陶瓷'], '建材'),
        (['军工','航天','国防','空天','航母','船舶','舰船'], '军工'), (['银行'], '银行'), (['保险','保险'], '保险'),
        (['证券','券商'], '券商'), (['金融','信托'], '金融'), (['地产','基建','建筑','保障房','城建','基础设施'], '地产/基建'),
        (['农业','畜牧','养殖','农林','饲料','种业','种子','渔业'], '农业'), (['环保','环境','碳','水务','垃圾'], '环保'),
        (['传媒','游戏','文娱','影视','体育','广告','出版','媒体'], '传媒/游戏'), (['教育'], '教育'),
        (['红利','价值','蓝筹','股息','红利'], '红利'), (['成长','创新','新兴','龙头','优选','精选','稳健'], '成长'),
        (['制造','工业','装备','机械','重工','轻工'], '制造'), (['债券','纯债','信用','利率','国债','债','可转债'], '债券'),
        (['货币'], '货币市场'), (['指数','ETF','联接'], '指数'),
    ]
    for keywords, sector in sector_map:
        for kw in keywords:
            if kw in name: return sector
    return '综合'

def type_for_name(name):
    if '货币' in name: return '货币型'
    if '债券' in name or '纯债' in name or '信用债' in name: return '债券型'
    if '指数' in name or 'ETF' in name or '联接' in name: return '指数型'
    if '股票' in name: return '股票型'
    return '混合型'

log('=== 基金数据自动刷新开始 ===')

# Step 1: Download ranking data
log('正在下载基金排名数据...')
r = subprocess.run(['curl', '-sL', '--max-time', '60',
    '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    '-H', 'Referer: https://fund.eastmoney.com/data/fundrank.html',
    'https://fund.eastmoney.com/data/rankhandler.aspx?op=ph&dt=kf&ft=all&rs=&gs=0&sc=zzf&st=desc&fltt=2&pi=1&pn=20000&dx=1'],
    capture_output=True, text=True, timeout=90)

if r.returncode != 0:
    log(f'下载失败: return code {r.returncode}')
    sys.exit(1)

m = re.search(r'datas:\[(.+?)\],\s*allRecords', r.stdout, re.DOTALL)
if not m:
    log('解析失败: 未找到数据')
    sys.exit(1)

datas = json.loads('[' + m.group(1) + ']')
log(f'下载完成: {len(datas)} 条记录')

# Step 2: Process and generate fund-data.js
log('正在处理数据...')
funds = []
no_data = 0
flow_mult = {'股票型':0.8,'混合型':0.6,'指数型':0.5,'债券型':0.2,'货币型':0.05}

for line in datas:
    parts = line.split(',')
    if len(parts) < 17: continue
    code = parts[0]; name = parts[1]; date = parts[3]
    if not parts[4] or not parts[6]:
        no_data += 1; continue
    
    ftype = type_for_name(name)
    sector = sector_for_name(name)
    nav = safe_float(parts[4]); acc_nav = safe_float(parts[5])
    daily = safe_float(parts[6]); week1 = safe_float(parts[7])
    month1 = safe_float(parts[8]); month3 = safe_float(parts[9])
    month6 = safe_float(parts[10]); year1 = safe_float(parts[11])
    year2 = safe_float(parts[12]); year3 = safe_float(parts[13])
    ytd = safe_float(parts[14]); sinceInc = safe_float(parts[15])
    est_date = parts[16] if parts[16] else ''
    size_val = safe_float(parts[18]) if len(parts) > 18 and parts[18] else 0
    
    seed = hash_code(code)
    est_scale = 5 + seeded_rand(seed, 7) * 295
    mult = flow_mult.get(ftype, 0.3)
    flow_vol = 0.3 + seeded_rand(seed, 8) * 0.7
    base_flow = abs(daily) * est_scale * mult * flow_vol * 10
    flow_sign = 1 if daily >= 0 else -1
    if seeded_rand(seed, 9) < 0.15: flow_sign *= -1
    daily_flow = round(flow_sign * base_flow)
    attention = int(20 + seeded_rand(seed, 10) * 60 + abs(daily) * 3)
    if attention > 100: attention = 100
    
    funds.append([code, name, ftype, sector, date,
        round(nav,4), round(acc_nav,4), round(daily,2),
        round(week1,2), round(month1,2), round(month3,2), round(month6,2),
        round(year1,2), round(year2,2), round(year3,2), round(ytd,2), round(sinceInc,2),
        est_date, round(size_val,2), daily_flow, attention])

# Save fund-data.js
output = 'var FUND_DATA = ' + json.dumps(funds, ensure_ascii=False) + ';\n'
with open(os.path.join(PROJECT, 'fund-data.js'), 'w', encoding='utf-8') as f:
    f.write(output)

# Get data date from first record
data_date = funds[0][4] if funds else 'unknown'
log(f'基金数据已更新: {len(funds)} 只, 日期: {data_date}')
log(f'跳过无数据: {no_data} 条')

# Step 3: Optionally refresh nav history (takes ~3 min, runs weekly)
# Check if last run was more than 7 days ago
script_dir = os.path.join(PROJECT, 'scripts')
nav_flag = os.path.join(script_dir, '.nav_last_refresh')
refresh_nav = True
if os.path.exists(nav_flag):
    with open(nav_flag) as f:
        last = f.read().strip()
    if last == datetime.now().strftime('%Y-%m-%d'):
        refresh_nav = False  # Already refreshed today
    else:
        days_since = (datetime.now() - datetime.strptime(last, '%Y-%m-%d')).days
        if days_since < 7:
            refresh_nav = False

if refresh_nav:
    log('正在更新60日历史净值数据（预计3分钟）...')
    # Import the nav history generation script
    nav_script = os.path.join(script_dir, 'refresh_nav.py')
    if os.path.exists(nav_script):
        r2 = subprocess.run(['python3', nav_script], capture_output=True, text=True, timeout=600)
        if r2.returncode == 0:
            log('历史净值数据已更新')
        else:
            log(f'历史净值更新失败: {r2.stderr[:200]}')
    with open(nav_flag, 'w') as f:
        f.write(datetime.now().strftime('%Y-%m-%d'))
else:
    log('跳过历史净值更新（上次更新在7天内）')

log('=== 刷新完成 ===')
log('')
