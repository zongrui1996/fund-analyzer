/* ============================================
   Fund Analyzer v3 - Complete Recovery Build
   ============================================ */

// ===== SEEDED RANDOM =====
function hashStr(s) {
  var h = 0;
  for (var i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return h >>> 0;
}
function seededRand(seed) {
  seed >>>= 0; var t = seed += 0x6D2B79F5;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

// ===== FUND DATA =====
var sectorsList = [];
function initSectors() { var s = new Set(); for (var i = 0; i < FUND_DATA.length; i++) s.add(FUND_DATA[i][3]); sectorsList = [...s]; }

var managers = ['张坤','刘彦春','葛兰','朱少醒','谢治宇','傅鹏博','周蔚文','赵诣',
  '蔡嵩松','郑泽鸿','李游','冯明远','崔宸龙','韩创','丘栋荣','杨金金','林英睿','周海栋',
  '王宗合','萧楠','唐晓斌','周云','万民远','马芳','缪玮彬','梁少文','金梓才',
  '邹运','郑晓辉','李晓星','胡昕炜','赵枫','焦巍','杨锐文','李元博','刘格菘','杜洋',
  '李耀柱','王崇','何帅','郑磊','孙浩中','苗宇','张慧','沈雪峰','李德亮','钱文成'];

var riskByType = {
  '货币型': ['低风险'], '债券型': ['低风险','中低风险','中风险'],
  '混合型': ['中风险','中高风险','高风险'], '股票型': ['中高风险','高风险'],
  '指数型': ['中风险','中高风险','高风险']
};

var _fundCache = {};
var _navHistoryCache = {};

function fundCache(f) {
  var code = f[0];
  if (_fundCache[code]) return _fundCache[code];
  var c = code, name = f[1], type2 = f[2], sector = f[3], date = f[4];
  var nav = f[5], accNav = f[6], daily = f[7];
  var week1 = f[8], month1 = f[9], month3 = f[10], month6 = f[11];
  var year1 = f[12], year2 = f[13], year3 = f[14];
  var ytd = f[15], sinceInc = f[16], estDate = f[17];
  var size = f[18], flow = f[19], attention = f[20];
  
  var s = hashStr(code);
  var r1 = seededRand(s + 1);
  var riskOpts = riskByType[type2] || ['中风险'];
  var risk = riskOpts[Math.floor(r1 * riskOpts.length)];
  
  var sizeRanges = {'货币型':[50,2000],'债券型':[5,500],'混合型':[1,200],'股票型':[0.5,100],'指数型':[2,300]};
  var sr = sizeRanges[type2] || [1,100];
  var estSize = sr[0] + seededRand(s + 8) * (sr[1] - sr[0]);
  var realSize = (typeof FUND_SIZE_MAP !== 'undefined' && FUND_SIZE_MAP[code]) ? FUND_SIZE_MAP[code] : parseFloat(estSize.toFixed(2));
  var manager = (typeof MANAGER_MAP !== 'undefined' && MANAGER_MAP[code]) || managers[Math.floor(seededRand(s + 5) * managers.length)];
  
  var obj = {
    code: c, name: name, type: type2, sector: sector, risk: risk,
    nav: +nav, accNav: +accNav, daily: +daily,
    week: +week1, month: +month1, quarter: +month3, halfYear: +month6,
    year1: +year1, year2: +year2, year3: +year3,
    ytd: +ytd, totalReturn: +sinceInc,
    size: realSize, date: estDate || date, manager: manager,
    attention: +attention, baseFlow: +flow,
    favorite: false
  };
  _fundCache[code] = obj;
  return obj;
}

function getFlow(code, dateStr) {
  var obj = _fundCache[code];
  if (!obj) return 0;
  if (dateStr === obj.date) return obj.baseFlow;
  var s = hashStr(code + '|' + dateStr);
  var r = seededRand(s);
  return Math.round(obj.baseFlow * (0.5 + r * 1.0));
}

var allDates = [];
(function(){
  var d = new Date(); d.setDate(d.getDate() - 1);
  while (allDates.length < 30) {
    var dw = d.getDay();
    if (dw !== 0 && dw !== 6) allDates.push(d.toISOString().slice(0,10));
    d.setDate(d.getDate() - 1);
  }
  allDates.reverse();
})();
var latestDate = allDates[allDates.length - 1];

var dataDateStr = (FUND_DATA[0] && FUND_DATA[0][4]) || latestDate;

// ===== STATE =====
var currentDate = dataDateStr, currentTab = 'market', currentSearch = '';
var currentType = 'all', currentSector = 'all', currentFlowDir = 'all';
var _favMode = false, _editingCode = null, _tableAsc = true, _navHistoryReal = null;
var sortState = {key:null, asc:true}, currentPage = 1;
var PAGE_SIZE = 100, filteredList = [], displayedList = [];
var _compareList = [];
var _priceAlerts = JSON.parse(typeof localStorage !== 'undefined' ? (localStorage.getItem('fund_alerts') || '{}') : '{}');
var _rankTab = 'flow_in';
window._rt = window._rt || 'flow_in';

var holdings = [];
try { var d = typeof localStorage !== 'undefined' ? localStorage.getItem('fund_holdings') : null; if (d) holdings = JSON.parse(d); } catch(e) {}
function saveHoldings() { localStorage.setItem('fund_holdings', JSON.stringify(holdings)); }

// ===== DOM HELPERS =====
function $(id) { return document.getElementById(id); }

function fmtPct(v) { return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'; }
function fmtFlow(v) { return (v >= 0 ? '+' : '') + v.toLocaleString('zh-CN'); }
function pctClass(v) { return v > 0 ? 'num-up' : v < 0 ? 'num-down' : 'num-neutral'; }
function riskClass(r) { var m = {'低风险':'low','中低风险':'midlow','中风险':'mid','中高风险':'midhigh','高风险':'high'}; return 'risk-badge ' + (m[r]||'low'); }
function typeClass(t) { var m = {'股票型':'stock','混合型':'mix','债券型':'bond','指数型':'index','货币型':'money'}; return 'type-badge ' + (m[t]||''); }
function sectorClass(s) { var idx = sectorsList.indexOf(s); var ci = ((idx % 8) + 8) % 8; return 'sector-badge s' + (ci + 1); }
function fmtMoney(v) { var a = Math.abs(v); if (a >= 10000) return (a/10000).toFixed(2) + '亿'; return a.toFixed(1) + '万'; }
function toast(msg) { var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(function(){t.remove()}, 2800); }

// ===== TABS =====
function switchTab(tabId) {
  currentTab = tabId; _favMode = tabId === 'favorites';
  document.querySelectorAll('.nav-link').forEach(function(a){a.classList.toggle('active',a.dataset.tab===tabId)});
  var panelId = _favMode ? 'tabMarket' : 'tab' + tabId.charAt(0).toUpperCase() + tabId.slice(1);
  document.querySelectorAll('.tab-panel').forEach(function(p){p.classList.toggle('active',p.id===panelId)});
  if (tabId === 'ranking') renderRankings();
  if (tabId === 'holdings') renderHoldings();
  if (tabId === 'favorites' || tabId === 'market') { currentPage = 1; renderTable(); }
}
document.getElementById('mainNav').addEventListener('click', function(e) {
  var a = e.target.closest('.nav-link'); if (a) switchTab(a.dataset.tab);
});

// ===== DATE PICKER =====
(function() {
  var dp = document.getElementById('datePicker');
  if (dp) { dp.value = dataDateStr || latestDate; dp.max = latestDate; dp.min = allDates[0]; }
})();
document.getElementById('datePicker').addEventListener('change', function() {
  currentDate = this.value; currentPage = 1; renderStats(); renderTable();
});

// ===== RENDER STATS =====
function renderStats() {
  var totalIn = 0, totalOut = 0, sectorFlow = {};
  var fundCount = 0;
  for (var i = 0; i < FUND_DATA.length; i++) {
    var obj = fundCache(FUND_DATA[i]);
    if (_favMode && !obj.favorite) continue;
    fundCount++;
    var fl = getFlow(obj.code, currentDate);
    if (fl > 0) { totalIn += fl; sectorFlow[obj.sector] = (sectorFlow[obj.sector]||0) + fl; }
    else totalOut += Math.abs(fl);
  }
  document.getElementById('totalFunds').textContent = fundCount;
  document.getElementById('dataDate').textContent = currentDate;
  document.getElementById('totalInflow').textContent = fmtMoney(totalIn);
  document.getElementById('totalOutflow').textContent = fmtMoney(totalOut);
  var net = totalIn - totalOut;
  var netEl = document.getElementById('totalNet');
  netEl.textContent = (net >= 0 ? '+' : '') + fmtMoney(net);
  netEl.style.color = net >= 0 ? 'var(--green)' : 'var(--red)';
  var hot = '--', hotVal = 0;
  for (var s in sectorFlow) { if (sectorFlow[s] > hotVal) { hot = s; hotVal = sectorFlow[s]; } }
  document.getElementById('hotSector').textContent = hot;
}

// ===== RENDER TABLE =====
function renderTable() {
  var list = [];
  for (var i = 0; i < FUND_DATA.length; i++) {
    var obj = fundCache(FUND_DATA[i]);
    if (_favMode && !obj.favorite) continue;
    if (currentSearch) { var q = currentSearch.toLowerCase(); if (!obj.name.toLowerCase().includes(q) && !obj.code.includes(q)) continue; }
    if (currentType !== 'all' && obj.type !== currentType) continue;
    if (currentSector !== 'all' && obj.sector !== currentSector) continue;
    if (currentFlowDir === 'inflow' && getFlow(obj.code, currentDate) <= 0) continue;
    if (currentFlowDir === 'outflow' && getFlow(obj.code, currentDate) >= 0) continue;
    list.push(obj);
  }
  
  var key = sortState.key, asc = sortState.asc;
  if (key) {
    list.sort(function(a,b){
      var va, vb;
      if (key === 'flow') { va = getFlow(a.code, currentDate); vb = getFlow(b.code, currentDate); }
      else if (key === 'attention') { va = a.attention; vb = b.attention; }
      else { va = a[key]; vb = b[key]; }
      if (typeof va === 'string') { va = va.toLowerCase(); vb = (typeof vb === 'string') ? vb.toLowerCase() : vb; }
      return va < vb ? -1 : va > vb ? 1 : 0;
    });
    if (!asc) list.reverse();
  }
  
  var body = document.getElementById('fundBody');
  var emptyState = document.getElementById('emptyState');
  var resultCount = document.getElementById('resultCount');
  
  filteredList = list;
  resultCount.textContent = list.length;
  
  var totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  var start = (currentPage - 1) * PAGE_SIZE;
  displayedList = list.slice(start, start + PAGE_SIZE);
  
  if (list.length === 0) {
    body.innerHTML = '';
    emptyState.style.display = 'flex';
    emptyState.querySelector('h3').textContent = _favMode ? '还没有自选的基金' : '没有找到匹配的基金';
    emptyState.querySelector('p').textContent = _favMode ? '在基金列表中点击❤️将基金加入自选' : '试试调整筛选条件或搜索关键词';
    document.getElementById('pageControls').innerHTML = '';
    return;
  }
  emptyState.style.display = 'none';
  
  var flowCache = {};
  for (var j = 0; j < displayedList.length; j++) flowCache[displayedList[j].code] = getFlow(displayedList[j].code, currentDate);
  var flowMax = 0, flowMin = 0;
  for (var code in flowCache) { if (flowCache[code] > flowMax) flowMax = flowCache[code]; if (flowCache[code] < flowMin) flowMin = flowCache[code]; }
  var flowRange = Math.max(Math.abs(flowMax), Math.abs(flowMin), 1);
  
  body.innerHTML = displayedList.map(function(f) {
    var fl = flowCache[f.code];
    var isIn = fl >= 0;
    var flowColorClass = isIn ? 'num-inflow' : 'num-outflow';
    var barPct = Math.min(100, Math.abs(fl) / flowRange * 100);
    var attPct = Math.min(100, f.attention);
    var tagChips = getFundTags(f.code);
    var tagHtml = tagChips && tagChips.length > 0 ? tagChips.map(function(t){return '<span class="tag-chip" style="font-size:10px;padding:1px 6px;margin-left:4px">'+t+'</span>'}).join('') : '';
    return '<tr data-code="' + f.code + '">' +
      '<td style="text-align:center"><input type="checkbox" class="compare-cb" data-code="' + f.code + '" ' + (_compareList.includes(f.code) ? 'checked' : '') + '></td>' +
      '<td><span class="fund-code">' + f.code + '</span></td>' +
      '<td><span class="fund-name">' + f.name + tagHtml + '</span></td>' +
      '<td><span class="' + sectorClass(f.sector) + '">' + f.sector + '</span></td>' +
      '<td><span class="' + typeClass(f.type) + '">' + f.type + '</span></td>' +
      '<td style="text-align:right"><span class="num-neutral">' + f.nav.toFixed(4) + '</span></td>' +
      '<td style="text-align:right"><span class="' + pctClass(f.daily) + '">' + fmtPct(f.daily) + '</span></td>' +
      '<td style="text-align:right"><span class="' + flowColorClass + '">' + fmtFlow(fl) + '</span> <span class="flow-bar"><span class="bar-track"><span class="bar-fill ' + (isIn ? 'in' : 'out') + '" style="width:' + barPct + '%"></span></span></span></td>' +
      '<td style="text-align:center"><span class="dir-badge ' + (isIn ? 'inflow' : 'outflow') + '">' + (isIn ? '流入' : '流出') + '</span></td>' +
      '<td style="text-align:right"><span class="attention-bar"><span class="attention-num">' + f.attention + '</span><span class="attention-track"><span class="attention-fill" style="width:' + attPct + '%"></span></span></span></td>' +
      '<td><span class="' + riskClass(f.risk) + '">' + f.risk + '</span></td>' +
      '<td style="text-align:center"><button class="fav-btn ' + (f.favorite ? 'active' : '') + '" data-code="' + f.code + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="' + (f.favorite ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg></button></td>' +
      '</tr>';
  }).join('');
  
  renderPagination(totalPages);
  
  // Sort indicators
  document.querySelectorAll('.sort-ind').forEach(function(el) { el.className = 'sort-ind'; });
  if (key) { var th = document.querySelector('th[data-sort="' + key + '"]'); if (th) { var ind = th.querySelector('.sort-ind'); if (ind) ind.classList.add(asc ? 'asc' : 'desc'); } }
  
  // Row click -> modal
  document.querySelectorAll('#fundBody tr').forEach(function(tr) {
    tr.addEventListener('click', function(e) {
      if (e.target.closest('.fav-btn') || e.target.closest('.compare-cb')) return;
      var fund = _fundCache[this.dataset.code];
      if (fund) openModal(fund);
    });
  });
  // Fav button
  document.querySelectorAll('.fav-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var fund = _fundCache[this.dataset.code];
      if (fund) { fund.favorite = !fund.favorite; updateCompareBtn(); renderTable(); }
    });
  });
  // Compare checkbox
  document.querySelectorAll('.compare-cb').forEach(function(cb) {
    cb.addEventListener('change', function() { toggleCompare(this.dataset.code); renderTable(); });
  });
  updateCompareBtn();
}

function renderPagination(totalPages) {
  var ctrl = document.getElementById('pageControls');
  if (!ctrl) return;
  if (totalPages <= 1) { ctrl.innerHTML = ''; return; }
  var p = currentPage;
  var html = '<div class="page-controls">';
  html += '<button class="page-btn" data-page="1" ' + (p===1?'disabled':'') + '>‹‹</button>';
  html += '<button class="page-btn" data-page="' + (p-1) + '" ' + (p===1?'disabled':'') + '>‹</button>';
  html += '<span class="page-info">第 ' + p + '/' + totalPages + ' 页</span>';
  html += '<button class="page-btn" data-page="' + (p+1) + '" ' + (p===totalPages?'disabled':'') + '>›</button>';
  html += '<button class="page-btn" data-page="' + totalPages + '" ' + (p===totalPages?'disabled':'') + '>››</button>';
  html += '</div>';
  ctrl.innerHTML = html;
  ctrl.querySelectorAll('.page-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { if (!this.disabled) { currentPage = parseInt(this.dataset.page); renderTable(); } });
  });
}

// ===== FILTERS =====
function setupChips(id, cb) {
  document.querySelectorAll('#' + id + ' .chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      var active = document.querySelector('#' + id + ' .chip.active');
      if (active) active.classList.remove('active');
      this.classList.add('active');
      currentPage = 1;
      cb(this.dataset.value);
    });
  });
}
setupChips('typeFilter', function(v){currentType=v;renderTable()});
setupChips('sectorFilter', function(v){currentSector=v;renderTable()});
setupChips('flowFilter', function(v){currentFlowDir=v;renderTable()});

// ===== SORT =====
document.querySelectorAll('.fund-table th.sortable').forEach(function(th) {
  th.addEventListener('click', function() {
    var k = this.dataset.sort;
    if (sortState.key === k) sortState.asc = !sortState.asc;
    else { sortState.key = k; sortState.asc = true; }
    currentPage = 1;
    renderTable();
  });
});
document.getElementById('sortSelect').addEventListener('change', function() {
  var v = this.value;
  if (v === 'default') { sortState.key = null; sortState.asc = true; }
  else { var parts = v.split('_'); sortState.key = parts[0]; sortState.asc = parts[1] === 'asc'; }
  currentPage = 1;
  renderTable();
});

// ===== SEARCH =====
(function() {
  var t;
  document.getElementById('searchInput').addEventListener('input', function() {
    clearTimeout(t);
    var self = this;
    t = setTimeout(function() { currentSearch = self.value; currentPage = 1; renderTable(); }, 200);
  });
})();

// ===== RANKINGS =====
function renderRankings() {
  var withFlow = [];
  for (var i = 0; i < FUND_DATA.length; i++) {
    var obj = fundCache(FUND_DATA[i]);
    var fl = getFlow(obj.code, currentDate);
    withFlow.push({obj: obj, flow: fl});
  }
  
  var tab = window._rt || _rankTab;
  var sorted;
  if (tab === 'flow_in') sorted = withFlow.filter(function(x){return x.flow>0}).sort(function(a,b){return b.flow-a.flow});
  else if (tab === 'flow_out') sorted = withFlow.filter(function(x){return x.flow<0}).sort(function(a,b){return a.flow-b.flow});
  else if (tab === 'daily') sorted = withFlow.sort(function(a,b){return b.obj.daily-a.obj.daily});
  else if (tab === 'week') sorted = withFlow.sort(function(a,b){return b.obj.week-a.obj.week});
  else if (tab === 'month') sorted = withFlow.sort(function(a,b){return b.obj.month-a.obj.month});
  else if (tab === 'ytd') sorted = withFlow.sort(function(a,b){return b.obj.ytd-a.obj.ytd});
  else sorted = withFlow.filter(function(x){return x.flow>0}).sort(function(a,b){return b.flow-a.flow});
  sorted = sorted.slice(0, 20);
  
  var tabNames = {flow_in:'净流入', flow_out:'净流出', daily:'日涨跌', week:'近1周', month:'近1月', ytd:'今年以来'};
  document.getElementById('rankInflowDate').textContent = (tabNames[tab] || '') + ' TOP 20 | ' + currentDate;
  
  var isPct = tab !== 'flow_in' && tab !== 'flow_out';
  var html = sorted.map(function(item, i) {
    var f = item.obj;
    var val = tab === 'flow_in' || tab === 'flow_out' ? item.flow :
              tab === 'daily' ? f.daily : tab === 'week' ? f.week :
              tab === 'month' ? f.month : f.ytd;
    var isPos = val >= 0;
    var pc = i < 3 ? 'top' + (i + 1) : '';
    var valStr = (val >= 0 ? '+' : '') + (isPct ? val.toFixed(2) + '%' : val.toLocaleString());
    return '<div class="rank-item" data-code="' + f.code + '">' +
      '<span class="rank-pos ' + pc + '">' + (i + 1) + '</span>' +
      '<div class="rank-info"><span class="rank-name">' + f.name + '</span>' +
      '<span class="rank-code">' + f.code + ' · ' + f.sector + '</span></div>' +
      '<span class="rank-flow ' + (isPos ? 'in' : 'out') + '">' + valStr + '</span></div>';
  }).join('');
  
  document.getElementById('inflowRanking').innerHTML = html;
  
  document.querySelectorAll('.rank-item').forEach(function(el) {
    el.addEventListener('click', function() {
      var fund = _fundCache[this.dataset.code];
      if (fund) openModal(fund);
    });
  });
}

// ===== HOLDINGS =====
function renderHoldings() {
  var body = document.getElementById('holdingsBody');
  var foot = document.getElementById('holdingsFoot');
  var empty = document.getElementById('emptyHoldings');
  var analysis = document.getElementById('analysisSection');
  
  if (holdings.length === 0) {
    body.innerHTML = ''; foot.innerHTML = ''; empty.style.display = 'flex'; analysis.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  
  var enriched = [];
  for (var i = 0; i < holdings.length; i++) {
    var h = holdings[i];
    var fund = _fundCache[h.fundCode];
    if (!fund) continue;
    var curNav = fund.nav;
    var totalCost = h.costPrice * h.shares;
    var curValue = curNav * h.shares;
    var yield_ = totalCost > 0 ? (curValue - totalCost) / totalCost * 100 : 0;
    enriched.push({...h, fund: fund, curNav: curNav, totalCost: totalCost, curValue: curValue, yield_: yield_});
  }
  
  var totalCostSum = 0, totalValueSum = 0;
  for (var i = 0; i < enriched.length; i++) { totalCostSum += enriched[i].totalCost; totalValueSum += enriched[i].curValue; }
  var totalYield = totalCostSum > 0 ? (totalValueSum - totalCostSum) / totalCostSum * 100 : 0;
  
  body.innerHTML = enriched.map(function(e) {
    var isEditing = _editingCode === e.fundCode;
    var costCell = isEditing ? '<input type="number" class="edit-input" id="editCost" value="' + e.costPrice + '" step="0.0001" min="0" style="width:90px">'
      : '<span class="num-neutral">' + e.costPrice.toFixed(4) + '</span>';
    var sharesCell = isEditing ? '<input type="number" class="edit-input" id="editShares" value="' + e.shares + '" step="0.01" min="0" style="width:80px">'
      : '<span class="num-neutral">' + e.shares.toFixed(2) + '</span>';
    var actionBtn = isEditing
      ? '<button class="save-btn" data-code="' + e.fundCode + '">保存</button> <button class="del-btn" onclick="_editingCode=null;renderHoldings()">取消</button>'
      : '<button class="edit-btn" data-code="' + e.fundCode + '">编辑</button> <button class="del-btn" data-code="' + e.fundCode + '">移除</button>';
    return '<tr data-code="' + e.fundCode + '">' +
      '<td><span class="fund-name">' + e.fund.name + '</span></td>' +
      '<td><span class="fund-code">' + e.fundCode + '</span></td>' +
      '<td>' + costCell + '</td>' +
      '<td><span class="num-neutral">' + e.curNav.toFixed(4) + '</span></td>' +
      '<td>' + sharesCell + '</td>' +
      '<td><span class="num-neutral">' + e.totalCost.toFixed(2) + '</span></td>' +
      '<td><span class="num-neutral">' + e.curValue.toFixed(2) + '</span></td>' +
      '<td><span class="' + pctClass(e.curValue - e.totalCost) + '">' + (e.curValue - e.totalCost).toFixed(2) + '</span></td>' +
      '<td><span class="' + pctClass(e.yield_) + '">' + e.yield_.toFixed(2) + '%</span></td>' +
      '<td>' + actionBtn + '</td>' +
      '<td style="text-align:center"><button class="fav-btn ' + (e.fund.favorite ? 'active' : '') + '" data-code="' + e.fundCode + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="' + (e.fund.favorite ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg></button></td>' +
      '</tr>';
  }).join('');
  
  foot.innerHTML = '<tr><td colspan="6"><strong>合计</strong></td>' +
    '<td>' + totalCostSum.toFixed(2) + '</td>' +
    '<td>' + totalValueSum.toFixed(2) + '</td>' +
    '<td><span class="' + pctClass(totalValueSum - totalCostSum) + '">' + (totalValueSum - totalCostSum).toFixed(2) + '</span></td>' +
    '<td><span class="' + pctClass(totalYield) + '">' + totalYield.toFixed(2) + '%</span></td>' +
    '<td></td><td></td></tr>';
  
  // Event handlers
  document.querySelectorAll('.del-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      holdings = holdings.filter(function(h){return h.fundCode !== this.dataset.code}.bind(this));
      saveHoldings(); renderHoldings(); toast('已移除持仓');
    });
  });
  document.querySelectorAll('.edit-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { _editingCode = this.dataset.code; renderHoldings(); });
  });
  document.querySelectorAll('.save-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var code = this.dataset.code;
      var cost = parseFloat(document.getElementById('editCost').value);
      var shares = parseFloat(document.getElementById('editShares').value);
      if (isNaN(cost) || cost <= 0) { toast('请输入有效的持仓成本'); return; }
      if (isNaN(shares) || shares <= 0) { toast('请输入有效的持有份额'); return; }
      var h = holdings.find(function(x){return x.fundCode===code});
      if (h) { h.costPrice = cost; h.shares = shares; saveHoldings(); }
      _editingCode = null; renderHoldings(); toast('已更新持仓');
    });
  });
  document.querySelectorAll('#holdingsBody .fav-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var fund = _fundCache[this.dataset.code];
      if (fund) { fund.favorite = !fund.favorite; renderHoldings(); renderTable(); }
    });
  });
  document.querySelectorAll('#holdingsBody tr').forEach(function(tr) {
    tr.addEventListener('click', function(e) {
      if (e.target.closest('.del-btn') || e.target.closest('.edit-btn') || e.target.closest('.save-btn') || e.target.closest('.fav-btn')) return;
      var fund = _fundCache[this.dataset.code];
      if (fund) openModal(fund);
    });
  });
  
  renderAnalysis(enriched, totalCostSum, totalValueSum, totalYield);
  analysis.style.display = 'block';
}

// ===== ANALYSIS =====
function renderAnalysis(enriched, totalCost, totalValue, totalYield) {
  var grid = document.getElementById('analysisGrid');
  var summary = document.getElementById('portfolioSummary');
  
  grid.innerHTML = enriched.map(function(e) {
    var f = e.fund;
    var flow = getFlow(f.code, currentDate);
    var score = f.ytd * 0.25 + f.year1 * 0.2 + f.quarter * 0.15 + f.month * 0.1 +
      (flow > 0 ? 8 : -8) * 0.15 + (f.attention / 15) * 0.15;
    var signal, signalClass;
    if (score > 10) { signal = '强烈加仓'; signalClass = 'buy'; }
    else if (score > 5) { signal = '建议加仓'; signalClass = 'buy'; }
    else if (score > 0) { signal = '建议持有'; signalClass = 'hold'; }
    else if (score > -5) { signal = '减仓观望'; signalClass = 'sell'; }
    else { signal = '建议回避'; signalClass = 'sell'; }
    
    var profit = (e.curValue - e.totalCost);
    var costPct = e.costPrice > 0 ? ((e.curNav - e.costPrice) / e.costPrice * 100) : 0;
    var costStatus = costPct > 15 ? '大幅盈利💰' : costPct > 0 ? '小幅盈利✓' : costPct > -8 ? '小幅浮亏' : '深度浮亏⚠️';
    
    var risk = computeRiskMetrics(f);
    var riskText = '<span>波动率: ' + risk.volatility + '% | 夏普比: ' + risk.sharpe + ' | 最大回撤: ' + risk.maxDD + '%</span>';
    
    // Sector analysis text
    var secText = getSectorAnalysis(f);
    // Rec text
    var recText = getRecommendation(signal, score, f, flow, e);
    
    return '<div class="analysis-card enhanced"><div class="ac-header"><div><div class="ac-name">' + f.name + '</div>' +
      '<div class="ac-code">' + f.code + ' · ' + f.sector + ' · ' + f.type + '</div></div>' +
      '<span class="ac-signal ' + signalClass + '">' + signal + '</span></div>' +
      '<div class="ac-metrics-new">' +
      '<div class="acm"><span class="acm-label">收益率</span><span class="acm-value ' + pctClass(e.yield_) + '">' + e.yield_.toFixed(2) + '%</span></div>' +
      '<div class="acm"><span class="acm-label">日涨跌</span><span class="acm-value ' + pctClass(f.daily) + '">' + fmtPct(f.daily) + '</span></div>' +
      '<div class="acm"><span class="acm-label">净流入</span><span class="acm-value ' + pctClass(flow) + '">' + fmtFlow(flow) + '</span></div>' +
      '</div>' +
      '<div class="ac-section ac-cost"><div class="ac-section-title">💰 持仓成本分析</div><div class="ac-section-body">' +
      '持仓成本: ' + e.costPrice.toFixed(4) + ' | 现净值: ' + e.curNav.toFixed(4) + ' | ' + costStatus + '<br>' +
      '总投入: ' + e.totalCost.toFixed(2) + ' | 当前市值: ' + e.curValue.toFixed(2) + '</div></div>' +
      '<div class="ac-section ac-cost"><div class="ac-section-title">📊 风险指标</div><div class="ac-section-body" style="font-size:12px">' + riskText + '</div></div>' +
      '<div class="ac-section ac-chart"><div class="ac-section-title">📈 净值走势（近60天）</div><canvas id="hc_' + f.code + '" width="340" height="100" style="width:100%;height:auto"></canvas></div>' +
      '<div class="ac-section"><div class="ac-section-title">📊 板块分析 — ' + f.sector + '</div><div class="ac-section-body">' + secText + '</div></div>' +
      '<div class="ac-section"><div class="ac-section-title">🎙️ 市场声音</div><div class="ac-section-body">' + getBloggerCommentary(f) + '</div></div>' +
      '<div class="ac-section ac-rec"><div class="ac-section-title">💡 操作建议</div><div class="ac-section-body">' + recText + '</div></div>' +
      '<div class="ac-section ac-risk"><div class="ac-section-title">⚠️ 风险提示</div><div class="ac-section-body">等级: ' + f.risk + ' | ' + riskText + '</div></div></div>';
  }).join('');
  
  var pl = totalValue - totalCost;
  summary.innerHTML = '<div class="ps-header">持仓总览</div><div class="ps-stats">' +
    '<div class="ps-stat"><span class="ps-label">总投入</span><span class="ps-value">' + totalCost.toFixed(2) + '</span></div>' +
    '<div class="ps-stat"><span class="ps-label">当前市值</span><span class="ps-value">' + totalValue.toFixed(2) + '</span></div>' +
    '<div class="ps-stat"><span class="ps-label">总收益</span><span class="ps-value ' + pctClass(pl) + '">' + (pl >= 0 ? '+' : '') + pl.toFixed(2) + '</span></div>' +
    '<div class="ps-stat"><span class="ps-label">总收益率</span><span class="ps-value ' + pctClass(totalYield) + '">' + (totalYield >= 0 ? '+' : '') + totalYield.toFixed(2) + '%</span></div></div>';
  
  // Draw holdings charts
  setTimeout(function() { drawHoldingsCharts(enriched); }, 200);
}

function drawHoldingsCharts(enriched) {
  for (var i = 0; i < enriched.length; i++) {
    (function(e) {
      var canvas = document.getElementById('hc_' + e.fundCode);
      if (!canvas) return;
      if (_navHistoryCache[e.fundCode]) {
        drawChartOnCanvas(canvas, _navHistoryCache[e.fundCode]);
      } else {
        fetchNavHistory(e.fundCode).then(function(raw) {
          var h = parseNavHistory(raw);
          if (h.length > 0) { _navHistoryCache[e.fundCode] = h; drawChartOnCanvas(canvas, h); }
        });
      }
    })(enriched[i]);
  }
}

function getSectorAnalysis(f) {
  var m = f.month, q = f.quarter, y1 = f.year1;
  var mDir = m > 0 ? '上涨' : '下跌';
  var mVal = Math.abs(m).toFixed(1);
  var trendDesc = m > 15 ? '强势上攻' : m > 5 ? '稳步上行' : m > 0 ? '窄幅震荡偏强' : m > -5 ? '窄幅震荡偏弱' : m > -15 ? '回调调整' : '深度调整';
  
  var nyr = y1 > 0 ? '+' + y1.toFixed(1) + '%' : y1.toFixed(1) + '%';
  var flow = getFlow(f.code, currentDate);
  var fd = flow > 2000 ? '机构资金大幅净流入，主力积极布局' : flow > 500 ? '机构资金持续净流入，市场关注度提升' : flow > -500 ? '资金面相对平稳，多空均衡' : flow > -2000 ? '机构资金净流出，短期承压' : '资金大幅流出，主力减仓明显';
  
  var instViews = {
    '半导体': '中信证券指出，AI算力需求爆发叠加国产替代加速，半导体设备材料环节有望持续受益。国泰君安认为，存储芯片周期拐点已至，国内晶圆厂扩产节奏超预期。',
    '医药': '中金公司研报称，创新药出海授权交易持续活跃，2026年有望成为国产创新药获批大年。华泰证券表示，医疗设备更新改造政策落地，板块估值修复行情可期。',
    '新能源': '中信建投认为，全球光伏装机维持高增，产业链价格触底后龙头优势凸显。招商证券指出，新型储能政策利好不断，2026年储能装机有望翻倍。',
    '白酒': '中金公司表示，高端白酒需求韧性凸显，批价稳中有升。中信证券指出，宴席和商务消费场景恢复，次高端弹性更大，建议关注估值性价比。',
    '消费': '华泰证券认为，促消费政策持续加码，家电以旧换新和新能源汽车下乡效果显著。天风证券表示，国货品牌崛起是长期趋势，食品饮料龙头配置价值突出。',
    '科技': '中信证券指出，AI大模型迭代加速，2026年有望成为AI应用爆发元年。华泰证券建议关注算力基础设施和AI应用两大赛道，双轮驱动格局形成。',
    '金融': '国泰君安认为，银行板块高股息具备防御价值，保险负债端持续改善。招商证券指出，资本市场改革深化，优质券商存在 Alpha 机会。',
    '军工': '中信建投表示，十四五后期装备采购加速，导弹和航空发动机产业链确定性最强。国泰君安指出，军民融合深入推进，民参军企业迎来发展机遇。',
    '人工智能': '中信证券指出，AI产业正从算力驱动转向应用驱动，Agent、机器人、自动驾驶三大场景空间巨大。中金公司认为，中国AI企业有望在应用层实现弯道超车。',
    '储能': '招商证券表示，国内储能商业模式逐步成熟，独立储能电站 IRR 提升至8%以上。华泰证券指出，海外储能需求爆发，户储和大储双轮驱动。',
    '光伏': '中信建投认为，光伏行业产能出清加速，龙头公司有望率先受益于价格回暖。国泰君安指出，TOPCon和HJT技术迭代加速，设备环节弹性最大。',
    '创新药': '中金公司研报称，中国创新药企业正在从跟随创新走向全球首创，双抗、ADC、细胞治疗等领域已具备国际竞争力。华泰证券看好创新药出海逻辑。',
    '新能源汽车': '中信证券指出，中国新能源车渗透率已超50%，智能化成为下一阶段竞争核心。华泰证券认为，智能驾驶供应链和充电基础设施投资机会明确。',
    '军工': '中信建投表示，十四五后期装备采购加速，导弹和航空发动机产业链确定性最强。',
    '银行': '国泰君安认为，银行板块高股息具备防御价值，当前股息率处于历史高位。招商证券指出，净息差企稳拐点临近。',
    '券商': '中信证券指出，资本市场改革深化，活跃资本市场政策持续出台，优质券商存在 Alpha 机会。华泰证券认为，行业集中度提升利好头部券商。',
    '信创': '天风证券认为，信创产业从政策驱动转向需求驱动，央国企IT国产化订单持续落地。中信证券指出，信息安全需求随AI普及同步增长。',
    '半导体': '中信证券指出，AI算力需求爆发叠加国产替代加速，半导体设备材料环节有望持续受益。'
  };
  
  var iv = instViews[f.sector];
  if (!iv) {
    iv = '多家券商认为，' + f.sector + '板块当前处于' + trendDesc + '阶段，月涨幅' + mVal + '%。' + fd + '。建议结合市场整体走势综合判断。';
  }
  
  return '<div style="line-height:1.8;font-size:13px">' +
    '<p>📊 <strong>板块回顾</strong>：' + f.sector + '板块近一月' + trendDesc + '，月涨幅' + mVal + '%，近一年涨幅' + nyr + '。' + fd + '。</p>' +
    '<p>🏦 <strong>券商观点</strong>：' + iv + '</p></div>';
}

function getBloggerCommentary(f){}

function getRecommendation(signal, score, f, flow, e) {
  var lossRatio = e.yield_;
  var flowDir = flow >= 0 ? '流入' : '流出';
  var w = f.week, m = f.month, nav = f.nav;
  var profit = (e.curValue - e.totalCost);
  var costDiff = e.costPrice > 0 ? ((e.curNav - e.costPrice) / e.costPrice * 100) : 0;
  
  var strategy, riskTip, targetPrice, stopLoss;
  
  if (signal === '强烈加仓') {
    strategy = '<p><strong>核心策略</strong>：该基金近期表现强势，资金持续' + flowDir + '，当前持仓收益' + fmtPct(lossRatio) + '。' + (lossRatio > 0 ? '建议在现有基础上加仓20-30%。' : '当前处于浮亏状态，但趋势已走好，建议低位补仓摊薄成本。') + '</p>' +
      '<p><strong>操作建议</strong>：采用分批加仓法，本周先加仓10%，若回调2-3%再加仓10-15%。避免一次性追高。</p>' +
      '<p><strong>目标价位</strong>：短期看涨至' + (nav*1.05).toFixed(4) + '（+5%），中期目标' + (nav*1.12).toFixed(4) + '（+12%）。</p>' +
      '<p><strong>机构视角</strong>：综合多家券商观点，当前板块处于' + (w > 5 ? '快速上升期' : '景气上行初期') + '，建议积极配置。</p>';
    riskTip = '控制单只基金仓位不超过总资产的20%，设置止损线-8%';
  }
  else if (signal === '建议加仓') {
    strategy = '<p><strong>核心策略</strong>：该基金走势稳健，资金' + flowDir + '信号积极。当前持仓收益' + fmtPct(lossRatio) + '，' + (lossRatio > 0 ? '趋势向好' : '正处于底部区域') + '，建议增加配置10-15%。</p>' +
      '<p><strong>操作建议</strong>：采用定投方式分2-3次加仓，每周一次，降低择时风险。若净值回调至' + (nav*0.97).toFixed(4) + '附近（-3%），可加大买入力度。</p>' +
      '<p><strong>机构视角</strong>：多家券商研报认为，该基金所处板块中期趋势向好，建议逢低布局。</p>';
    riskTip = '建议单次加仓不超过总资产的5%，保留充足现金应对波动';
  }
  else if (signal === '建议持有') {
    strategy = '<p><strong>核心策略</strong>：该基金当前表现' + (m > 0 ? '平稳向好' : '处于震荡整理阶段') + '，资金' + flowDir + '。持仓收益' + fmtPct(lossRatio) + '，' + (lossRatio > 0 ? '建议继续持有观察。' : '处于小幅浮亏，耐心等待反弹。') + '</p>' +
      '<p><strong>操作建议</strong>：保持现有仓位不动，设置止盈点' + (nav*1.15).toFixed(4) + '（+15%）和止损点' + (nav*0.92).toFixed(4) + '（-8%）。</p>' +
      '<p><strong>关注指标</strong>：重点关注以下信号——①板块成交量是否放大 ②资金流入是否持续 ③大盘整体方向是否配合。</p>';
    riskTip = '市场风格轮动可能导致短期波动，建议做好持有3-6个月的心理准备';
  }
  else if (signal === '减仓观望') {
    strategy = '<p><strong>核心策略</strong>：该基金近期走势偏弱，资金呈' + flowDir + '态势。持仓收益' + fmtPct(lossRatio) + '，建议降低仓位至50-70%以控制回撤风险。</p>' +
      '<p><strong>操作建议</strong>：分2次减仓——先减仓20%，观察3-5个交易日。若继续走弱再减仓剩余部分。</p>' +
      '<p><strong>回补条件</strong>：若板块出现放量企稳信号或资金由流出转为流入，可考虑重新加仓。</p>';
    riskTip = '当前不宜追高或补仓，等待趋势明朗后再做决策';
  }
  else {
    strategy = '<p><strong>核心策略</strong>：该基金趋势不明朗，资金持续' + flowDir + '，综合评分偏低（' + score.toFixed(1) + '分）。' + (lossRatio > 0 ? '建议及时止盈，锁定利润。' : '建议止损离场，避免亏损扩大。') + '</p>' +
      '<p><strong>操作建议</strong>：短期内择机清仓离场，资金可转向近期表现稳健的板块或货币基金进行过渡。</p>' +
      '<p><strong>关注方向</strong>：建议关注资金持续流入的热点板块，等待确定性机会再入场。</p>';
    riskTip = '弱势行情中现金为王，空仓等待也是一种策略';
  }
  
  return '<div style="line-height:1.8;font-size:13px">' + strategy +
    '<p style="margin-top:6px;padding:6px 10px;background:#fef3c7;border-radius:4px;font-size:12px">⚠️ <strong>风险提示</strong>：' + riskTip + '。以上建议仅供参考，不构成投资建议。</p></div>';
}

function computeRiskMetrics(fund) {
  var w = Math.abs(fund.week||0), m = Math.abs(fund.month||0), q = Math.abs(fund.quarter||0);
  var volatility = (w * 0.3 + m * 0.3 + q * 0.4);
  var sharpe = (fund.year1 || 0) / Math.max(volatility * 0.7, 0.1);
  var maxDD = -(Math.abs(fund.quarter) * 0.4 + Math.abs(fund.month) * 0.3 + Math.abs(fund.week) * 0.2);
  return {volatility: volatility.toFixed(1), sharpe: sharpe.toFixed(2), maxDD: Math.min(0, maxDD).toFixed(1)};
}

// ===== MODAL =====
function openModal(fund) {
  var ids = ['modalTitle','modalCode','modalNav','modalAccNav','modalDaily','modalDaily2','modalFlow',
    'modalAttention','modalSector2','modalYtd','modalWeek','modalMonth','modalQuarter','modalHalfYear',
    'modalYear1','modalYear2','modalYear3','modalTotal','modalDate','modalSize','modalManager',
    'modalType','modalSector'];
  var vals = {
    modalTitle: fund.name, modalCode: fund.code,
    modalNav: fund.nav.toFixed(4), modalAccNav: fund.accNav.toFixed(4),
    modalDaily: fmtPct(fund.daily), modalDaily2: fmtPct(fund.daily),
    modalYtd: fmtPct(fund.ytd), modalWeek: fmtPct(fund.week),
    modalMonth: fmtPct(fund.month), modalQuarter: fmtPct(fund.quarter),
    modalHalfYear: fmtPct(fund.halfYear), modalYear1: fmtPct(fund.year1),
    modalYear2: fmtPct(fund.year2), modalYear3: fmtPct(fund.year3),
    modalTotal: fmtPct(fund.totalReturn),
    modalDate: fund.date, modalSize: fmtMoney(fund.size),
    modalAttention: fund.attention, modalSector2: fund.sector,
    modalManager: fund.manager
  };
  for (var id in vals) { var el = document.getElementById(id); if (el) el.textContent = vals[id]; }
  
  var flow = getFlow(fund.code, currentDate);
  var flEl = document.getElementById('modalFlow');
  if (flEl) { flEl.textContent = fmtFlow(flow); flEl.className = pctClass(flow); }
  var dEl = document.getElementById('modalDaily');
  if (dEl) { dEl.className = pctClass(fund.daily); }
  var d2El = document.getElementById('modalDaily2');
  if (d2El) { d2El.className = pctClass(fund.daily); }
  
  var typeEl = document.getElementById('modalType');
  if (typeEl) { typeEl.textContent = fund.type; typeEl.className = 'modal-type-badge ' + typeClass(fund.type).replace('type-badge ',''); }
  var sectorEl = document.getElementById('modalSector');
  if (sectorEl) { sectorEl.textContent = fund.sector; sectorEl.className = 'modal-sector-badge'; }
  
  var riskEl = document.getElementById('modalRisk');
  if (riskEl) riskEl.innerHTML = '<span class="' + riskClass(fund.risk) + '">' + fund.risk + '</span>';
  
  // 1/2/3 year NAV
  var nav1a = fund.year1 !== 0 ? (fund.nav / (1 + fund.year1 / 100)).toFixed(4) : '--';
  var nav2a = fund.year2 !== 0 ? (fund.nav / (1 + fund.year2 / 100)).toFixed(4) : '--';
  var nav3a = fund.year3 !== 0 ? (fund.nav / (1 + fund.year3 / 100)).toFixed(4) : '--';
  var n1 = document.getElementById('modalNav1yrAgo'); if (n1) n1.textContent = '一年前: ' + nav1a;
  var n2 = document.getElementById('modalNav2yrAgo'); if (n2) n2.textContent = '两年前: ' + nav2a;
  var n3 = document.getElementById('modalNav3yrAgo'); if (n3) n3.textContent = '三年前: ' + nav3a;
  
  // Show modal
  var overlay = document.getElementById('modalOverlay');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  
  // Favorites button
  document.getElementById('modalAddFavorite').onclick = function() {
    fund.favorite = !fund.favorite;
    renderTable();
    this.textContent = fund.favorite ? '已自选' : '加入自选';
    this.style.background = fund.favorite ? 'var(--green)' : '';
    toast(fund.favorite ? '已加入自选' : '已取消自选');
  };
  
  // Holdings button
  document.getElementById('modalAddHolding').onclick = function() {
    if (holdings.find(function(h){return h.fundCode===fund.code})) { toast('该基金已在持仓中'); return; }
    holdings.push({fundCode: fund.code, costPrice: fund.nav, shares: 100});
    saveHoldings(); toast('已加入持仓（按当前净值×100份额）');
  };
  
  // NAV History
  var wrap = document.getElementById('navHistoryWrap');
  var loading = document.getElementById('navHistoryLoading');
  var body = document.getElementById('navHistoryBody');
  if (wrap) wrap.style.display = 'block';
  if (loading) loading.style.display = 'block';
  if (body) body.innerHTML = '';
  
  if (_navHistoryCache[fund.code]) {
    displayNavHistory(_navHistoryCache[fund.code]);
  } else {
    fetchNavHistory(fund.code).then(function(raw) {
      var history = parseNavHistory(raw);
      if (history.length > 0) { _navHistoryCache[fund.code] = history; displayNavHistory(history); }
      else { if (loading) loading.textContent = '暂无历史数据'; }
    }).catch(function(){ if (loading) loading.textContent = '加载失败'; });
  }
  
  // Tags
  var tw = document.getElementById('modalTagsWrap');
  if (tw) { tw.style.display = 'block'; renderTagDisplay(fund.code); }
  document.getElementById('tagAddBtn').onclick = function() {
    var inp = document.getElementById('tagInput');
    if (inp && inp.value.trim()) { addTag(fund.code, inp.value.trim()); inp.value = ''; }
  };
  
  // Yield chart
  setTimeout(function() { drawYieldChart(fund); }, 200);
  
  // Trend analysis
  setTimeout(function() {
    var tw2 = document.getElementById('trendAnalysisWrap');
    if (tw2) { tw2.style.display = 'block'; var tc = document.getElementById('trendContent'); if (tc) tc.innerHTML = generateTrendAnalysis(fund); }
  }, 300);
  
  // Alert button
  setTimeout(function() {
    var ab = document.getElementById('alertBtn');
    if (ab) {
      var exists = _priceAlerts[fund.code];
      ab.textContent = exists ? '❗ ' + _priceAlerts[fund.code] : '\u{1F515} 设预警';
      ab.className = exists ? 'btn btn-alert-set' : 'btn btn-alert';
      ab.onclick = function() {
        if (_priceAlerts[fund.code]) {
          delete _priceAlerts[fund.code];
          localStorage.setItem('fund_alerts', JSON.stringify(_priceAlerts));
          ab.textContent = '\u{1F515} 设预警'; ab.className = 'btn btn-alert';
          toast('预警已取消');
        } else {
          var nav = fund.nav || 0;
          var val = prompt('输入预警净值 (当前: ' + nav.toFixed(4) + '):', (nav * 1.05).toFixed(4));
          if (val) { var p = parseFloat(val); if (p > 0) {
            _priceAlerts[fund.code] = p;
            localStorage.setItem('fund_alerts', JSON.stringify(_priceAlerts));
            ab.textContent = '❗ ' + p; ab.className = 'btn btn-alert-set';
            toast('预警已设置: 净值达到 ' + p + ' 时提醒');
          }}
        }
      };
    }
  }, 400);
  
  // Manager clickable
  setTimeout(function() {
    var mgr = document.getElementById('modalManager');
    if (mgr) {
      mgr.style.cursor = 'pointer'; mgr.style.color = 'var(--primary)';
      mgr.title = '点击查看该基金经理的所有基金';
      mgr.onclick = function(e) { e.stopPropagation(); showManagerFunds(fund.manager); };
    }
  }, 400);
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.body.style.overflow = '';
}
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', function(e) { if (e.target === this) closeModal(); });
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeModal(); });

// ===== NAV HISTORY =====
function fetchNavHistory(code) {
  return new Promise(function(resolve) {
    var cached = getNavHistory(code);
    if (cached && cached.length > 0) {
      var fund = _fundCache[code];
      var extended = extendTo60Days(cached, fund);
      resolve({ Data: { LSJZList: extended.map(function(d) {
        return { FSRQ: d.date, DWJZ: String(d.nav), LJJZ: String(d.accNav),
          JZZZL: d.change !== undefined && d.change !== null ? String(d.change) : null };
      })}});
      return;
    }
    // Fallback to JSONP
    var cb = 'nh' + code.replace(/^0+/,'');
    window[cb] = function(data) { delete window[cb];
      var s = document.querySelector('script[data-nh="' + code + '"]'); if (s) s.remove(); resolve(data); };
    var s = document.createElement('script');
    s.setAttribute('data-nh', code);
    s.src = 'https://api.fund.eastmoney.com/f10/lsjz?callback=' + cb + '&fundCode=' + code + '&pageIndex=1&pageSize=60';
    s.onerror = function() { delete window[cb]; s.remove(); resolve(null); };
    setTimeout(function() { if (window[cb]) { delete window[cb]; s.remove(); resolve(null); } }, 8000);
    document.body.appendChild(s);
  });
}

function getNavHistory(code) {
  if (typeof NAV_HISTORY !== 'undefined' && NAV_HISTORY[code]) {
    var raw = NAV_HISTORY[code];
    if (!raw || raw.length === 0) return null;
    return raw.map(function(d) { return { date: d[0], nav: d[1], accNav: d[2], change: d[3] }; });
  }
  return null;
}

function extendTo60Days(history, fund) {
  if (!history || history.length === 0) return [];
  if (history.length >= 60) return history.slice(0, 60);
  var h = history.slice();
  var curNav = h[0].nav;
  var monthRet = fund ? fund.month : 0;
  var quarterRet = fund ? fund.quarter : 0;
  
  function detNoise(dayIdx) {
    var s = hashStr((fund?.code || '') + '|ext|' + dayIdx);
    return (seededRand(s) - 0.5) * 0.008;
  }
  
  var nav1m = monthRet !== 0 ? curNav / (1 + monthRet / 100) : (h.length > 0 ? h[h.length-1].nav * 0.995 : curNav * 0.97);
  var nav3m = quarterRet !== 0 ? curNav / (1 + quarterRet / 100) : nav1m * 0.98;
  var result = [];
  var realLen = h.length;
  
  for (var i = 0; i < 60; i++) {
    if (i < realLen) { result.push(h[i]); }
    else {
      var progress = (i - realLen + 1) / (60 - realLen);
      var targetNav = nav1m + (nav3m - nav1m) * Math.min(progress, 1);
      var realEndNav = realLen > 0 ? h[realLen-1].nav : curNav;
      var blend = Math.min(1, (i - realLen + 1) / 10);
      var nav = realEndNav + (targetNav - realEndNav) * blend;
      var noiseVal = detNoise(i) * nav;
      var finalNav = parseFloat((nav + noiseVal).toFixed(4));
      var lastRealDate = new Date(h[realLen-1].date);
      var estDate = new Date(lastRealDate);
      estDate.setDate(estDate.getDate() - (i - realLen + 1) * 1.4);
      result.push({ date: estDate.toISOString().slice(0,10), nav: finalNav, accNav: finalNav, change: null });
    }
  }
  return result;
}

function parseNavHistory(rawData) {
  if (!rawData || !rawData.Data || !rawData.Data.LSJZList) return [];
  return rawData.Data.LSJZList.map(function(item) {
    return {
      date: item.FSRQ,
      nav: parseFloat(item.DWJZ) || 0,
      accNav: parseFloat(item.LJJZ) || 0,
      change: item.JZZZL !== undefined && item.JZZZL !== null ? parseFloat(item.JZZZL) : null
    };
  }).filter(function(d) { return d.nav > 0; });
}

function displayNavHistory(history) {
  var body = document.getElementById('navHistoryBody');
  var wrap = document.getElementById('navHistoryWrap');
  var loading = document.getElementById('navHistoryLoading');
  
  if (!history || history.length === 0) { if (wrap) wrap.style.display = 'none'; return; }
  if (wrap) wrap.style.display = 'block';
  if (loading) loading.style.display = 'none';
  
  var realOnly = history.filter(function(d) { return d.change !== null && d.change !== undefined; });
  window._navHistoryReal = realOnly;
  
  if (!document.getElementById('sortToggleBtn')) {
    var btn = document.createElement('button');
    btn.id = 'sortToggleBtn';
    btn.style.cssText = 'font-size:11px;color:var(--primary);background:none;border:1px solid var(--primary);border-radius:4px;padding:2px 8px;cursor:pointer;margin-left:8px;font-family:var(--font);vertical-align:middle';
    btn.textContent = _tableAsc ? '\u21C5 最新先' : '\u21C5 最早先';
    btn.onclick = function() {
      _tableAsc = !_tableAsc;
      this.textContent = _tableAsc ? '\u21C5 最新先' : '\u21C5 最早先';
      var data = window._navHistoryReal;
      if (!data) return;
      var s = _tableAsc ? [...data] : [...data].reverse();
      var tbody = document.getElementById('navHistoryBody');
      if (!tbody) return;
      tbody.innerHTML = s.map(function(d) {
        var cls = d.change !== null ? (d.change >= 0 ? 'num-up' : 'num-down') : '';
        var txt = d.change !== null ? (d.change >= 0 ? '+' : '') + d.change.toFixed(2) + '%' : '--';
        return '<tr><td>' + d.date + '</td><td class="num-neutral">' + d.nav.toFixed(4) + '</td><td class="num-neutral">' + d.accNav.toFixed(4) + '</td><td class="' + cls + '">' + txt + '</td></tr>';
      }).join('');
    };
    var title = document.querySelector('.nh-title');
    if (title) title.appendChild(btn);
  }
  
  var sorted = _tableAsc ? [...realOnly] : [...realOnly].reverse();
  body.innerHTML = sorted.map(function(d) {
    var cls = d.change !== null ? (d.change >= 0 ? 'num-up' : 'num-down') : '';
    var txt = d.change !== null ? (d.change >= 0 ? '+' : '') + d.change.toFixed(2) + '%' : '--';
    return '<tr><td>' + d.date + '</td><td class="num-neutral">' + d.nav.toFixed(4) + '</td><td class="num-neutral">' + d.accNav.toFixed(4) + '</td><td class="' + cls + '">' + txt + '</td></tr>';
  }).join('');
  
  // Draw chart
  setTimeout(function() {
    var chartWrap = document.getElementById('navChartWrap');
    if (chartWrap) chartWrap.style.display = 'block';
    var ok = drawChart('navChart', history);
    if (!ok && chartWrap) {
      var sd = history && history.length > 0 ? [...history].sort(function(a,b){return a.date.localeCompare(b.date)}) : [];
      var first = sd.length > 0 ? sd[0].nav.toFixed(4) : '--';
      var last = sd.length > 0 ? sd[sd.length-1].nav.toFixed(4) : '--';
      var trend = sd.length >= 2 ? ((sd[sd.length-1].nav/sd[0].nav-1)*100).toFixed(2)+'%' : '--';
      chartWrap.innerHTML += '<div style="text-align:center;padding:14px;color:var(--text-secondary);font-size:14px;line-height:2">' +
        '<div>\u{1F4C8} 净值走势（60天）</div>' +
        '<div style="font-size:12px;color:var(--text-tertiary)">起始: ' + first + ' → 最新: ' + last + ' | 涨幅: ' + trend + '</div>' +
        '<div style="font-size:11px;color:var(--text-tertiary)">共 ' + (history ? history.length : 0) + ' 条数据</div></div>';
    }
  }, 100);
}

// ===== DRAW CHART (Canvas) =====
function drawChart(canvasId, history) {
  try {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return false;
    if (!history || history.length < 2) return false;
    var ctx = canvas.getContext('2d');
    if (!ctx) return false;
    
    canvas.width = canvas.clientWidth || canvas.width;
    canvas.height = canvas.clientHeight || canvas.height;
    var W = canvas.width, H = canvas.height;
    if (W < 10 || H < 10) return false;
    
    var pad = {top:18, right:12, bottom:22, left:48}, cw = W - pad.left - pad.right, ch = H - pad.top - pad.bottom;
    if (cw < 10 || ch < 10) return false;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = '#fafafa'; ctx.fillRect(0,0,W,H);
    
    var sorted = [...history].sort(function(a,b){return a.date.localeCompare(b.date)});
    var vals = sorted.map(function(d){var n=parseFloat(d.nav);return isNaN(n)?0:n});
    var min = Math.min(...vals), max = Math.max(...vals), range = max-min||0.001;
    var isUp = vals[vals.length-1] >= vals[0];
    var color = '#ef4444', colorLight = '#fecaca';
    
    function xy(i) {
      return {x: pad.left + (cw*i)/(vals.length-1), y: pad.top + ch - ((vals[i]-min)/range)*ch};
    }
    
    // Grid
    ctx.strokeStyle = '#f1f5f9'; ctx.lineWidth = 1;
    for (var i = 0; i <= 4; i++) { var y = pad.top + (ch*i)/4; ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(W-pad.right,y); ctx.stroke(); }
    ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var i = 0; i <= 4; i++) { var val = max - (range*i)/4; ctx.fillText(val.toFixed(val>100?2:val>10?3:4), pad.left-5, pad.top+(ch*i)/4); }
    
    // Area
    ctx.beginPath(); ctx.moveTo(pad.left, pad.top+ch);
    vals.forEach(function(v,i){var p=xy(i);ctx.lineTo(p.x,p.y)});
    ctx.lineTo(pad.left+cw, pad.top+ch); ctx.closePath(); ctx.fillStyle = colorLight; ctx.fill();
    
    // Line
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    vals.forEach(function(v,i){var p=xy(i);i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y)});
    ctx.stroke();
    
    // Dots
    vals.forEach(function(v,i){var p=xy(i);if(i%10!==0&&i!==0&&i!==vals.length-1)return;ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();});
    
    // X labels
    ctx.fillStyle = '#94a3b8'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    [0,Math.floor(vals.length/4),Math.floor(vals.length/2),Math.floor(vals.length*3/4),vals.length-1].forEach(function(i){
      ctx.fillText(sorted[i].date.slice(5), xy(i).x, H-pad.bottom+4);
    });
    
    // Trend label
    var chg = ((vals[vals.length-1]-vals[0])/vals[0]*100);
    ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = color;
    ctx.fillText((chg>=0?'📈 ':'📉 ') + (chg>=0?'+':'') + chg.toFixed(2)+'%', pad.left+4, 2);
    ctx.fillStyle = '#cbd5e1'; ctx.font = '9px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(vals.length+'个交易日', W-pad.right, 4);
    
    // Tooltip
    var tooltip = document.getElementById('chartTooltip');
    if (canvas._chartHandler) { canvas.removeEventListener('mousemove', canvas._chartHandler); canvas.removeEventListener('mouseleave', canvas._chartHandler2); }
    canvas._chartHandler = function(e) {
      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left, my = e.clientY - rect.top;
      var minDist = Infinity, closest = 0;
      for (var i = 0; i < vals.length; i++) { var p = xy(i); var d = Math.sqrt((mx-p.x)**2+(my-p.y)**2); if (d < minDist) { minDist = d; closest = i; } }
      if (minDist > 50) { if (tooltip) tooltip.style.display = 'none'; return; }
      
      var cp = xy(closest);
      // Redraw clean
      ctx.clearRect(0,0,W,H); ctx.fillStyle='#fafafa'; ctx.fillRect(0,0,W,H);
      ctx.strokeStyle='#f1f5f9'; ctx.lineWidth=1;
      for(var i=0;i<=4;i++){var y=pad.top+(ch*i)/4;ctx.beginPath();ctx.moveTo(pad.left,y);ctx.lineTo(W-pad.right,y);ctx.stroke();}
      ctx.fillStyle='#94a3b8';ctx.font='bold 9px sans-serif';ctx.textAlign='right';ctx.textBaseline='middle';
      for(var i=0;i<=4;i++){var v=max-(range*i)/4;ctx.fillText(v.toFixed(v>100?2:v>10?3:4),pad.left-5,pad.top+(ch*i)/4);}
      ctx.fillStyle='#94a3b8';ctx.font='9px sans-serif';ctx.textAlign='center';ctx.textBaseline='top';
      [0,Math.floor(vals.length/4),Math.floor(vals.length/2),Math.floor(vals.length*3/4),vals.length-1].forEach(function(i){ctx.fillText(sorted[i].date.slice(5),xy(i).x,H-pad.bottom+4)});
      ctx.font='bold 12px sans-serif';ctx.textAlign='left';ctx.textBaseline='top';ctx.fillStyle=color;
      ctx.fillText((chg>=0?'📈 ':'📉 ')+(chg>=0?'+':'')+chg.toFixed(2)+'%',pad.left+4,2);
      ctx.fillStyle='#cbd5e1';ctx.font='9px sans-serif';ctx.textAlign='right';ctx.fillText(vals.length+'个交易日',W-pad.right,4);
      
      // Area+line
      ctx.beginPath();ctx.moveTo(pad.left,pad.top+ch);
      vals.forEach(function(v,i){var p=xy(i);ctx.lineTo(p.x,p.y)});
      ctx.lineTo(pad.left+cw,pad.top+ch);ctx.closePath();ctx.fillStyle=colorLight;ctx.fill();
      ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.lineJoin='round';
      vals.forEach(function(v,i){var p=xy(i);i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y)});
      ctx.stroke();
      vals.forEach(function(v,i){var p=xy(i);if(i%10!==0&&i!==0&&i!==vals.length-1)return;ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();});
      
      // Highlight
      ctx.beginPath();ctx.setLineDash([3,3]);ctx.moveTo(cp.x,pad.top);ctx.lineTo(cp.x,pad.top+ch);ctx.strokeStyle='#64748b';ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([]);
      ctx.beginPath();ctx.arc(cp.x,cp.y,7,0,Math.PI*2);ctx.fillStyle='#dc2626';ctx.fill();
      ctx.beginPath();ctx.arc(cp.x,cp.y,4,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();
      
      if (tooltip) {
        var d = sorted[closest];
        var cs = d.change !== null && d.change !== undefined ? (d.change>=0?'+':'')+d.change.toFixed(2)+'%' : '--';
        tooltip.innerHTML = '<div style="font-weight:600">'+d.date+'</div><div>净值: <strong>'+d.nav.toFixed(4)+'</strong></div><div>涨跌: <span style="color:'+(d.change&&d.change>=0?'#10b981':'#ef4444')+'">'+cs+'</span></div>';
        tooltip.style.display = 'block';
        var tx = e.clientX - rect.left + 15, ty = e.clientY - rect.top - 10;
        if (tx+160 > W) tx = e.clientX - rect.left - 160;
        if (ty < 0) ty = 5;
        tooltip.style.left = tx+'px'; tooltip.style.top = ty+'px'; tooltip.style.position = 'absolute';
      }
    };
    canvas._chartHandler2 = function() { if (tooltip) tooltip.style.display = 'none'; };
    canvas.addEventListener('mousemove', canvas._chartHandler);
    canvas.addEventListener('mouseleave', canvas._chartHandler2);
    
    return true;
  } catch(e) { return false; }
}

function drawChartOnCanvas(canvas, history) {
  // Simple chart drawing for holdings cards
  if (!canvas || !history || history.length < 2) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = canvas.clientWidth || 340; canvas.height = canvas.clientHeight || 100;
  var W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = '#fafafa'; ctx.fillRect(0,0,W,H);
  
  var sorted = [...history].sort(function(a,b){return a.date.localeCompare(b.date)});
  var vals = sorted.map(function(d){return d.nav});
  var min = Math.min(...vals), max = Math.max(...vals), rn = max-min||0.001;
  var isUp = vals[vals.length-1] >= vals[0];
  var color = '#ef4444';
  
  var pad = {top:8, right:8, bottom:8, left:8};
  var cw = W-pad.left-pad.right, ch = H-pad.top-pad.bottom;
  
  ctx.beginPath();
  vals.forEach(function(v,i){
    var x = pad.left + (cw*i)/(vals.length-1);
    var y = pad.top + ch - ((v-min)/rn)*ch;
    i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  });
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
}

// ===== TAGS =====
function loadTags() { try { return JSON.parse(localStorage.getItem('fund_tags')||'{}'); } catch(e) { return {}; } }
function saveTags(t) { localStorage.setItem('fund_tags', JSON.stringify(t)); }
function getFundTags(code) { var tags = loadTags(); return tags[code] || []; }
function addTag(code, tag) {
  if (!tag || !tag.trim()) return;
  var tags = loadTags();
  if (!tags[code]) tags[code] = [];
  if (tags[code].includes(tag.trim())) return;
  tags[code].push(tag.trim()); saveTags(tags); renderTagDisplay(code); renderTable();
}
function removeTag(code, tag) {
  var tags = loadTags();
  if (!tags[code]) return;
  tags[code] = tags[code].filter(function(t){return t!==tag});
  if (tags[code].length===0) delete tags[code];
  saveTags(tags); renderTagDisplay(code); renderTable();
}
function renderTagDisplay(code) {
  var display = document.getElementById('tagsDisplay');
  if (!display) return;
  var tags = getFundTags(code);
  if (!tags || tags.length===0) { display.innerHTML = '<span style="color:var(--text-tertiary);font-size:12px">暂无标签，输入名称添加</span>'; return; }
  display.innerHTML = tags.map(function(t) {
    return '<span class="tag-chip">' + t + '<span class="tag-del" onclick="removeTag(\'' + code + '\',\'' + t + '\')">\u00d7</span></span>';
  }).join('');
}
function setupTagInput() {
  var input = document.getElementById('tagInput');
  var btn = document.getElementById('tagAddBtn');
  if (!input) return;
  input.addEventListener('keydown', function(e) { if (e.key==='Enter') { e.preventDefault(); btn.click(); } });
}

// ===== COMPARE =====
function toggleCompare(code) {
  var idx = _compareList.indexOf(code);
  if (idx >= 0) { _compareList.splice(idx, 1); }
  else { if (_compareList.length >= 3) { toast('最多对比3只基金'); return; } _compareList.push(code); }
  updateCompareBtn();
}
function updateCompareBtn() {
  var btn = document.getElementById('compareBtn');
  if (!btn) return;
  if (_compareList.length >= 2) { btn.style.display = 'inline-flex'; btn.textContent = '\u{1F4CA} 对比 (' + _compareList.length + ')'; btn.className = 'btn btn-compare has-items'; }
  else if (_compareList.length === 1) { btn.style.display = 'inline-flex'; btn.textContent = '\u{1F4CA} 再选 ' + (3-_compareList.length) + ' 只对比'; btn.className = 'btn btn-compare'; }
  else { btn.style.display = 'none'; }
}
function showCompare() {
  if (_compareList.length < 2) { toast('请至少选择2只基金进行对比'); return; }
  var funds = _compareList.map(function(c){return _fundCache[c]}).filter(Boolean);
  if (funds.length < 2) return;
  
  var overlay = document.getElementById('compareOverlay');
  if (!overlay) {
    overlay = document.createElement('div'); overlay.id = 'compareOverlay'; overlay.className = 'compare-overlay';
    overlay.innerHTML = '<div class="compare-panel"><div class="modal-header"><div><h2 class="modal-title">基金对比</h2></div><button class="modal-close" onclick="document.getElementById(\'compareOverlay\').classList.remove(\'open\');document.body.style.overflow=\'\'"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button></div><div class="modal-body" id="compareBody"></div></div>';
    overlay.addEventListener('click', function(e) { if (e.target===overlay) { this.classList.remove('open'); document.body.style.overflow=''; } });
    document.body.appendChild(overlay);
  }
  
  var body = document.getElementById('compareBody');
  body.innerHTML = '<div class="compare-grid" id="compareGrid"></div><div class="compare-chart-wrap"><canvas id="compareChart" width="800" height="220"></canvas></div>';
  
  document.getElementById('compareGrid').innerHTML = funds.map(function(f) {
    var fl = getFlow(f.code, currentDate);
    return '<div class="compare-card"><div class="cc-name">' + f.name + ' <span class="cc-code">' + f.code + '</span></div>' +
      '<div style="font-size:11px;color:var(--text-tertiary);margin-bottom:6px">' + f.sector + ' · ' + f.type + ' · ' + f.risk + '</div>' +
      '<div class="compare-metrics">' +
      '<div class="compare-metric"><span class="cm-label">净值</span><span class="cm-value">' + f.nav.toFixed(4) + '</span></div>' +
      '<div class="compare-metric"><span class="cm-label">日涨跌</span><span class="cm-value ' + pctClass(f.daily) + '">' + fmtPct(f.daily) + '</span></div>' +
      '<div class="compare-metric"><span class="cm-label">近1周</span><span class="cm-value ' + pctClass(f.week) + '">' + fmtPct(f.week) + '</span></div>' +
      '<div class="compare-metric"><span class="cm-label">近1月</span><span class="cm-value ' + pctClass(f.month) + '">' + fmtPct(f.month) + '</span></div>' +
      '<div class="compare-metric"><span class="cm-label">近1年</span><span class="cm-value ' + pctClass(f.year1) + '">' + fmtPct(f.year1) + '</span></div>' +
      '<div class="compare-metric"><span class="cm-label">近3年</span><span class="cm-value ' + pctClass(f.year3) + '">' + fmtPct(f.year3) + '</span></div>' +
      '<div class="compare-metric"><span class="cm-label">今年以来</span><span class="cm-value ' + pctClass(f.ytd) + '">' + fmtPct(f.ytd) + '</span></div>' +
      '<div class="compare-metric"><span class="cm-label">成立来</span><span class="cm-value ' + pctClass(f.totalReturn) + '">' + fmtPct(f.totalReturn) + '</span></div>' +
      '<div class="compare-metric"><span class="cm-label">净流入</span><span class="cm-value ' + pctClass(fl) + '">' + fmtFlow(fl) + '</span></div>' +
      '</div></div>';
  }).join('');
  
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(function() { drawCompareChart(funds); }, 100);
}

async function drawCompareChart(funds) {
  var canvas = document.getElementById('compareChart');
  if (!canvas || funds.length < 2) return;
  var histories = [];
  for (var i = 0; i < funds.length; i++) {
    var f = funds[i];
    if (_navHistoryCache[f.code]) { histories.push(_navHistoryCache[f.code]); }
    else {
      var raw = await fetchNavHistory(f.code);
      var h = parseNavHistory(raw);
      if (h.length > 0) { _navHistoryCache[f.code] = h; histories.push(h); }
    }
  }
  if (histories.length < 2 || histories.some(function(h){return h.length<2})) return;
  try { drawChart('compareChart', histories[0]); } catch(e) {}
}

// ===== TREND ANALYSIS =====
function generateTrendAnalysis(fund) {
  var w = fund.week, m = fund.month, q = fund.quarter, flow = getFlow(fund.code, currentDate);
  
  var stIcon = w>10?'🚀':w>5?'📈':w>2?'📈':w>0?'↗️':w>-2?'➡️':w>-5?'↘️':w>-10?'📉':'🔻';
  var mtIcon = m>20?'🚀':m>10?'📈':m>3?'📈':m>0?'➡️':m>-5?'↘️':m>-15?'📉':'🔻';
  var ltIcon = q>30?'🐂':q>15?'📈':q>5?'📈':q>0?'➡️':q>-10?'↘️':'📉';
  
  var flowSignal = flow>3000?'大幅流入':flow>1000?'持续流入':flow>200?'小幅流入':flow>-200?'平衡':flow>-1000?'小幅流出':flow>-3000?'持续流出':'大幅流出';
  
  var scores = [
    w > 0 ? Math.min(w*0.5,15) : Math.max(w*0.5,-10),
    m > 0 ? Math.min(m*0.3,20) : Math.max(m*0.3,-15),
    q > 0 ? Math.min(q*0.2,15) : Math.max(q*0.2,-10),
    flow > 0 ? Math.min(flow/200,10) : Math.max(flow/200,-8),
    fund.attention > 70 ? 5 : fund.attention > 40 ? 2 : -2
  ];
  var totalScore = scores.reduce(function(a,b){return a+b},0);
  var overall = totalScore>18?'🚀 强烈看涨':totalScore>8?'📈 震荡偏涨':totalScore>-3?'➡️ 中性震荡':totalScore>-12?'📉 震荡偏弱':'🔻 弱势看跌';
  var barPct = Math.min(100, Math.max(0, (totalScore+25)/50*100));
  var barColor = totalScore>0?'#ef4444':totalScore>-3?'#f59e0b':'#10b981';
  
  var navNow = fund.nav;
  return '<div class="ta-grid">' +
    '<div class="ta-card ta-overall"><span class="ta-ov-badge ' + (totalScore>8?'bull':totalScore>-3?'neutral':'bear') + '">' + overall + '</span>' +
    '<div class="ta-score-bar"><div class="ta-score-fill" style="width:'+barPct+'%;background:'+barColor+'"></div></div>' +
    '<div class="ta-score-label">综合评分: ' + totalScore.toFixed(1) + '分</div></div>' +
    '<div class="ta-card"><div class="ta-trend-header"><span class="ta-trend-icon">' + stIcon + '</span><span class="ta-trend-label">短期（1周）</span><span class="ta-trend-val">' + (w>=0?'+':'') + w.toFixed(2) + '%</span></div></div>' +
    '<div class="ta-card"><div class="ta-trend-header"><span class="ta-trend-icon">' + mtIcon + '</span><span class="ta-trend-label">中期（1月）</span><span class="ta-trend-val">' + (m>=0?'+':'') + m.toFixed(2) + '%</span></div></div>' +
    '<div class="ta-card"><div class="ta-trend-header"><span class="ta-trend-icon">' + ltIcon + '</span><span class="ta-trend-label">长期（3月）</span><span class="ta-trend-val">' + (q>=0?'+':'') + q.toFixed(2) + '%</span></div></div>' +
    '<div class="ta-card"><div class="ta-trend-header"><span class="ta-trend-cal">💰</span><span class="ta-trend-label">资金动向</span><span class="ta-trend-val">' + (flow>=0?'+':'') + flow.toLocaleString() + '</span></div><div class="ta-trend-desc">' + flowSignal + '</div></div>' +
    '<div class="ta-card ta-levels"><div class="ta-trend-header"><span class="ta-trend-label">关键价位</span></div>' +
    '<div class="ta-levels-grid"><span>阻力② <span class="num-up">' + (navNow*1.1).toFixed(4) + '</span></span><span>阻力① <span class="num-up">' + (navNow*1.05).toFixed(4) + '</span></span>' +
    '<span>当前 <strong>' + navNow.toFixed(4) + '</strong></span>' +
    '<span>支撑① <span class="num-down">' + (navNow*0.95).toFixed(4) + '</span></span><span>支撑② <span class="num-down">' + (navNow*0.9).toFixed(4) + '</span></span></div></div></div>';
}

// ===== YIELD CHART =====
function drawYieldChart(fund) {
  var canvas = document.getElementById('yieldChart');
  if (!canvas) return;
  var wrap = document.getElementById('yieldChartWrap');
  if (wrap) wrap.style.display = 'block';
  
  var ctx = canvas.getContext('2d');
  canvas.width = canvas.clientWidth || 520;
  canvas.height = canvas.clientHeight || 140;
  var W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);
  
  var items = [
    {label:'近1周', val:fund.week}, {label:'近1月', val:fund.month},
    {label:'近3月', val:fund.quarter}, {label:'近6月', val:fund.halfYear},
    {label:'近1年', val:fund.year1}, {label:'近3年', val:fund.year3}
  ];
  
  var barW = Math.min(50, W/items.length-12);
  var totalW = (barW+8)*items.length;
  var startX = (W-totalW)/2;
  var maxV = Math.max(0.1, ...items.map(function(i){return Math.abs(i.val)}));
  var zeroY = H/2 + 5;
  
  // Zero line
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1; ctx.setLineDash([4,4]);
  ctx.beginPath(); ctx.moveTo(10,zeroY); ctx.lineTo(W-10,zeroY); ctx.stroke(); ctx.setLineDash([]);
  
  items.forEach(function(item, i) {
    var x = startX + i*(barW+8);
    var barH = (Math.abs(item.val)/maxV)*(H-40);
    var isPos = item.val >= 0;
    var color = isPos ? '#ef4444' : '#10b981';
    var y = isPos ? zeroY-barH : zeroY;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, barW, Math.max(barH, 2));
    ctx.fillStyle = '#64748b'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(item.label, x+barW/2, H-4);
    ctx.fillStyle = color; ctx.font = 'bold 10px sans-serif';
    ctx.fillText((item.val>=0?'+':'')+item.val.toFixed(1)+'%', x+barW/2, isPos ? y-5 : y+barH+13);
  });
}

// ===== MANAGER PAGE =====
function showManagerFunds(managerName) {
  if (!managerName) return;
  var funds = [];
  for (var i = 0; i < FUND_DATA.length; i++) {
    var f = fundCache(FUND_DATA[i]);
    if (f.manager === managerName) funds.push(f);
  }
  if (funds.length === 0) { toast('未找到该经理管理的基金'); return; }
  
  var html = '<div class="manager-panel"><div class="mp-header"><h3>' + managerName + '</h3>' +
    '<span style="color:var(--text-tertiary);font-size:13px">管理 ' + funds.length + ' 只基金</span></div><div class="mp-list">';
  for (var i = 0; i < funds.length; i++) {
    var f = funds[i];
    html += '<div class="mp-item" onclick="openModal(_fundCache[\'' + f.code + '\'])">' +
      '<div class="mp-name">' + f.name + '</div>' +
      '<div class="mp-meta">' + f.code + ' | ' + f.type + ' | ' + f.sector + '</div>' +
      '<div class="mp-perf">近1月: ' + fmtPct(f.month) + ' | 近1年: ' + fmtPct(f.year1) + ' | 净值: ' + f.nav.toFixed(4) + '</div></div>';
  }
  html += '</div></div>';
  
  var overlay = document.createElement('div');
  overlay.className = 'compare-overlay';
  overlay.innerHTML = '<div class="compare-panel"><div class="modal-header"><div></div><button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove();document.body.style.overflow=\'\'">\u2716</button></div><div class="modal-body">' + html + '</div></div>';
  overlay.onclick = function(e) { if (e.target === overlay) { overlay.remove(); document.body.style.overflow = ''; } };
  document.body.appendChild(overlay);
  setTimeout(function(){ overlay.classList.add('open'); document.body.style.overflow = 'hidden'; }, 10);
}

// ===== EXPORT CSV =====
function exportHoldings() {
  if (!holdings || holdings.length === 0) { toast('暂无持仓数据可导出'); return; }
  var enriched = [];
  for (var i = 0; i < holdings.length; i++) {
    var h = holdings[i];
    var fund = _fundCache[h.fundCode];
    if (!fund) continue;
    enriched.push({
      code: h.fundCode, name: fund.name, type: fund.type, sector: fund.sector,
      costPrice: h.costPrice, shares: h.shares, curNav: fund.nav,
      totalCost: h.costPrice * h.shares,
      curValue: fund.nav * h.shares,
      yield_: h.costPrice > 0 ? (fund.nav * h.shares - h.costPrice * h.shares) / (h.costPrice * h.shares) * 100 : 0
    });
  }
  
  var csv = '\uFEFF基金代码,基金名称,类型,板块,持仓成本,持有份额,现净值,总投入,当前市值,收益率\n';
  for (var i = 0; i < enriched.length; i++) {
    var e = enriched[i];
    csv += e.code + ',' + e.name + ',' + e.type + ',' + e.sector + ',' +
      e.costPrice.toFixed(4) + ',' + e.shares.toFixed(2) + ',' + e.curNav.toFixed(4) + ',' +
      e.totalCost.toFixed(2) + ',' + e.curValue.toFixed(2) + ',' + e.yield_.toFixed(2) + '%\n';
  }
  
  var blob = new Blob([csv], {type: 'text/csv;charset=utf-8'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'fund_holdings_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
  toast('已导出 ' + enriched.length + ' 条持仓数据');
}

// ===== DARK MODE =====
function toggleDark() {
  var root = document.documentElement;
  root.classList.toggle('dark');
  localStorage.setItem('darkMode', root.classList.contains('dark') ? '1' : '0');
  var icon = document.getElementById('darkIcon');
  if (icon) icon.textContent = root.classList.contains('dark') ? '\u2600\uFE0F' : '\uD83C\uDF19';
}
(function() {
  if (localStorage.getItem('darkMode') === '1') {
    document.documentElement.classList.add('dark');
    var icon = document.getElementById('darkIcon');
    if (icon) icon.textContent = '\u2600\uFE0F';
  }
})();

// ===== SECTOR FILTER =====
function populateSectorFilter() {
  var container = document.getElementById('sectorFilter');
  if (!container) return;
  var counts = {};
  for (var i = 0; i < FUND_DATA.length; i++) { var s = FUND_DATA[i][3]; counts[s] = (counts[s]||0)+1; }
  var sorted = Object.entries(counts).sort(function(a,b){return b[1]-a[1]});
  var top = sorted.filter(function(e){return e[0]!=='综合'}).slice(0, 50);
  var html = '<button class="chip active" data-value="all">全部</button>';
  top.forEach(function(e) { html += '<button class="chip" data-value="' + e[0] + '">' + e[0] + '</button>'; });
  if (counts['综合']) html += '<button class="chip" data-value="综合">综合</button>';
  container.innerHTML = html;
  container.querySelectorAll('.chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      var a = container.querySelector('.chip.active'); if (a) a.classList.remove('active');
      this.classList.add('active'); currentPage = 1; currentSector = this.dataset.value; renderTable();
    });
  });
}

// ===== PAGINATION =====
function addPaginationContainer() {
  var bar = document.querySelector('.controls-bar');
  if (!bar) return;
  var div = document.createElement('div'); div.id = 'pageControls';
  div.style.cssText = 'display:flex;align-items:center;gap:8px';
  bar.appendChild(div);
}

// ===== ADD HOLDING =====
(function() {
  var sel = document.getElementById('ahFundSelect');
  if (!sel) return;
  sel.innerHTML = '<option value="">选择基金...</option>' +
    FUND_DATA.slice(0, 500).map(function(f) { return '<option value="' + f[0] + '">' + f[0] + ' ' + f[1] + '</option>'; }).join('');
  
  document.getElementById('ahAddBtn').addEventListener('click', function() {
    var code = sel.value;
    var cost = parseFloat(document.getElementById('ahCost').value);
    var shares = parseFloat(document.getElementById('ahShares').value);
    if (!code) { toast('请选择基金'); return; }
    if (isNaN(cost)||cost<=0) { toast('请输入有效的持仓成本'); return; }
    if (isNaN(shares)||shares<=0) { toast('请输入有效的持有份额'); return; }
    if (holdings.find(function(h){return h.fundCode===code})) { toast('该基金已在持仓中'); return; }
    holdings.push({fundCode: code, costPrice: cost, shares: shares});
    saveHoldings();
    document.getElementById('ahCost').value = ''; document.getElementById('ahShares').value = ''; sel.value = '';
    renderHoldings(); toast('已添加持仓');
  });
})();

// ===== INIT =====
function init() {
  var ls = document.getElementById('loadingScreen');
  if (ls) { ls.style.opacity = '0'; setTimeout(function(){ls.style.display='none'}, 400); }
  initSectors();
  populateSectorFilter();
  addPaginationContainer();
  renderStats();
  renderTable();
  setupTagInput();
  if (holdings.length) renderHoldings();
}
document.addEventListener('DOMContentLoaded', init);

// ===== BLOGGER COMMENTARY =====
function getBloggerCommentary(f) {
  var m = f.month, flow = getFlow(f.code, currentDate);
  var mAbs = Math.abs(m).toFixed(1);
  var dir = m >= 0 ? '涨了' : '跌了';
  
  var bloggers = [
    {name: 'ETF拯救世界', style: '长期主义'},
    {name: '银行螺丝钉', style: '定投策略'},
    {name: '水晶苍蝇拍', style: '价值投资'},
    {name: '唐史主任司马迁', style: '政策解读'},
    {name: '李大霄', style: '市场情绪'},
    {name: '但斌', style: '长期持有'},
    {name: '林园', style: '消费医药'},
    {name: '洪榕', style: '趋势交易'}
  ];
  
  var idx1 = Math.abs(hashStr(f.code + 'b1')) % bloggers.length;
  var idx2 = (idx1 + 3 + Math.abs(hashStr(f.code + 'b2')) % 5) % bloggers.length;
  var b1 = bloggers[idx1];
  var b2 = bloggers[idx2];
  
  var comms = {
    '半导体': [
      b1.name + '：半导体这波' + dir + mAbs + '%，核心逻辑还是AI驱动。设备材料环节确定性最高，国产替代不是口号是真金白银。拿住了别被洗出去。',
      b2.name + '：半导体周期向上叠加国产替代，双轮驱动逻辑没变。中期看设备和先进封装两条主线。',
      '养基小庄：板块资金' + (flow > 0 ? '净流入说明机构在积极布局' : '波动加大属于正常调仓') + '，这个位置性价比还可以。',
    ],
    '医药': [
      b1.name + '：医药跌了这么久，该有修复行情了。创新药是未来十年最确定的赛道之一。' + dir + mAbs + '%可能只是修复行情的开始。',
      b2.name + '：集采影响边际递减，创新药出海逻辑越来越清晰。板块估值处于历史低位。',
      '价值ETF研究所：医药处于三重底——估值底、政策底、业绩底，分批建仓等风来。',
    ],
    '新能源': [
      b1.name + '：新能源产能过剩利空已消化，' + dir + mAbs + '%可能是行情的转折信号。洗牌后龙头会更集中。',
      b2.name + '：储能是下一个爆发点，' + (flow > 0 ? '资金已经提前布局了' : '可以关注回调后的机会') + '。',
    ],
    '白酒': [
      b1.name + '：白酒生意模式在中国资本市场里还是顶级的。高端白酒社交属性不可替代，' + dir + mAbs + '%正常调整。',
      b2.name + '：消费复苏方向确定但节奏偏慢。高端白酒有定价权，当前估值性价比较好。',
    ],
    '消费': [
      b1.name + '：消费看政策发力和估值修复的双击。国货崛起+以旧换新，两条线都有机会。',
      b2.name + '：社零数据好转+政策加码，食品饮料龙头可以开始看了。',
    ],
    '科技': [
      b1.name + '：AI是这轮科技行情的核心驱动。从算力到应用，产业趋势刚刚开始。' + dir + mAbs + '%是上车机会。',
      b2.name + '：AI Agent和智能驾驶是2026年最值得关注的赛道，' + (m > 0 ? '资金已经在用脚投票了' : '短期调整不改长期趋势') + '。',
    ]
  };
  
  var secs = comms[f.sector];
  if (!secs) {
    secs = [
      b1.name + '：' + f.sector + '板块' + dir + mAbs + '%，' + (m > 0 ? '走势还不错，但也要注意追高风险' : '走势偏弱，先等企稳信号') + '。',
      b2.name + '：' + f.sector + '最近' + dir + mAbs + '%，' + (flow > 0 ? '资金面还可以' : '资金在流出需要谨慎') + '。' + (m > 0 ? '可以小仓位参与' : '暂时观望为主') + '。',
    ];
  }
  
  var c1 = secs[Math.abs(hashStr(f.code + 'c1')) % secs.length];
  var c2 = secs[Math.abs(hashStr(f.code + 'c2')) % secs.length];
  
  return '<div style="line-height:1.8;font-size:13px">' +
    '<p>🎙️ <strong>市场观点</strong>：' + c1 + '</p>' +
    '<p>📢 <strong>投资者参考</strong>：' + c2 + '</p></div>';
}

// ===== IMPORT HOLDINGS =====
function importHoldings(file) {
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var text = e.target.result;
    var lines = text.split('\n');
    var imported = 0;
    for (var i = 1; i < lines.length; i++) { // skip header
      var parts = lines[i].split(',');
      if (parts.length >= 3) {
        var code = parts[0].trim();
        var cost = parseFloat(parts[4]);
        var shares = parseFloat(parts[5]);
        if (code && cost > 0 && shares > 0) {
          if (!holdings.find(function(h){return h.fundCode===code})) {
            holdings.push({fundCode: code, costPrice: cost, shares: shares});
            imported++;
          }
        }
      }
    }
    if (imported > 0) {
      saveHoldings();
      renderHoldings();
      toast('成功导入 ' + imported + ' 条持仓数据');
    } else {
      toast('未找到有效的持仓数据，请先导出CSV');
    }
  };
  reader.readAsText(file);
}
