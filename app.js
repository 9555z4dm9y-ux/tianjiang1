/* ========= 甜酱日常 - 数据与逻辑 ========= */

// ---------- 存储辅助 ----------
const DB = {
  get(key, def = null) {
    try {
      const v = localStorage.getItem('tj_' + key);
      return v ? JSON.parse(v) : def;
    } catch (e) { return def; }
  },
  set(key, val) {
    localStorage.setItem('tj_' + key, JSON.stringify(val));
  }
};

// ---------- 日期工具 ----------
const D = {
  today() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },
  fmt(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr.replace(/-/g, '/'));
    const w = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 周' + w;
  },
  fmtShort(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${parseInt(m)}月${parseInt(d)}日`;
  },
  now() { return new Date().toISOString().slice(0, 16).replace('T', ' '); },
  // 取相对某天 offset 天的日期字符串
  offsetFrom(dateStr, offset) {
    const d = new Date(dateStr.replace(/-/g, '/'));
    d.setDate(d.getDate() + offset);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },
  // 取相对今天 offset 天的日期字符串 (0=今天, -1=昨天, 1=明天)
  offset(offset) {
    return D.offsetFrom(D.today(), offset);
  },
  // 取某天是周几(数字 0=周日~6=周六)
  wdNum(dateStr) {
    const d = new Date(dateStr.replace(/-/g, '/'));
    return d.getDay();
  },
  // 取某天是周几(中文)
  wd(dateStr) {
    return ['日', '一', '二', '三', '四', '五', '六'][D.wdNum(dateStr)];
  },
  // 获取日期所在周的 key(以周一为起始, 格式 YYYY-Www 或用周一日期)
  weekKey(dateStr) {
    const dates = getWeekDates(dateStr);
    return dates[0].date; // 用周一日期作为周 key
  },
  // 获取日期所在月的 key YYYY-MM
  monthKey(dateStr) {
    const [y, m] = dateStr.split('-');
    return `${y}-${m}`;
  },
  // 月份偏移: 2026-01 + (-1) = 2025-12
  monthOffset(monthKey, delta) {
    const [y, m] = monthKey.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
};

// ---------- 数据模型 ----------
const Store = {
  // 每日数据: { '2026-01-01': { todos:[{id,text,done}], meds:{name:bool}, routine:{rid:bool}, calories:{records:[]}, notes:[{id,text,time}] } }
  getDay(date) {
    const days = DB.get('days', {});
    return days[date] || { todos: [], meds: {}, routine: {}, calories: { records: [] }, notes: [] };
  },
  setDay(date, data) {
    const days = DB.get('days', {});
    days[date] = data;
    DB.set('days', days);
  },
  // 每周代办: { '2026-01-05(周一周key)': [{id, text, done}] }
  getWeeklyAll() {
    const raw = DB.get('weekly', {});
    // 旧数据迁移: 数组 → 按周对象
    if (Array.isArray(raw)) {
      const wk = D.weekKey(D.today());
      const migrated = { [wk]: raw };
      DB.set('weekly', migrated);
      return migrated;
    }
    return raw || {};
  },
  getWeeklyByWeek(weekKey) {
    const all = Store.getWeeklyAll();
    return all[weekKey] || [];
  },
  setWeeklyByWeek(weekKey, list) {
    const all = Store.getWeeklyAll();
    all[weekKey] = list;
    DB.set('weekly', all);
  },
  // 每月计划: { '2026-01': [{id, text, done}] }
  getMonthlyAll() {
    const raw = DB.get('monthly', {});
    if (Array.isArray(raw)) {
      const mk = D.monthKey(D.today());
      const migrated = { [mk]: raw };
      DB.set('monthly', migrated);
      return migrated;
    }
    return raw || {};
  },
  getMonthlyByMonth(monthKey) {
    const all = Store.getMonthlyAll();
    return all[monthKey] || [];
  },
  setMonthlyByMonth(monthKey, list) {
    const all = Store.getMonthlyAll();
    all[monthKey] = list;
    DB.set('monthly', all);
  },
  // 每日计划查看时选中的日期(今日待办翻页)
  getPlanDailyDate() { return DB.get('planDailyDate', D.today()); },
  setPlanDailyDate(v) { DB.set('planDailyDate', v); },
  // 每周计划查看选中的周 key(周一日期)
  getPlanWeekKey() { return DB.get('planWeekKey', D.weekKey(D.today())); },
  setPlanWeekKey(v) { DB.set('planWeekKey', v); },
  // 每月计划查看选中的月 key
  getPlanMonthKey() { return DB.get('planMonthKey', D.monthKey(D.today())); },
  setPlanMonthKey(v) { DB.set('planMonthKey', v); },
  // 首页当前查看的日期(补打卡用)
  getHomeDate() { return DB.get('homeDate', D.today()); },
  setHomeDate(v) { DB.set('homeDate', v); },
  // 用药清单设置（对象数组：[{id, name, weekDays:[0..6]}]，空 weekDays 表示每天吃）
  getMedList() {
    const raw = DB.get('medList', ['维生素', '钙片']);
    // 旧数据迁移：字符串数组 → 对象数组
    if (raw.length && typeof raw[0] === 'string') {
      const migrated = raw.map(n => ({ id: uid(), name: n, weekDays: [0,1,2,3,4,5,6] }));
      DB.set('medList', migrated);
      return migrated;
    }
    return raw || [];
  },
  setMedList(v) { DB.set('medList', v); },
  // 记账
  getAccounts() { return DB.get('accounts', []); },
  setAccounts(v) { DB.set('accounts', v); },
  // 买卖差价
  getTrades() { return DB.get('trades', []); },
  setTrades(v) { DB.set('trades', v); },
  // 宝宝成长
  getBaby() { return DB.get('baby', []); },
  setBaby(v) { DB.set('baby', v); },
  // 宝宝成长-分类相册 [{id, name, icon, images:[{id, type, data}], createTime}]
  getBabyCats() { return DB.get('babyCats', []); },
  setBabyCats(v) { DB.set('babyCats', v); },
  // 体重: [{id, date, weight, timeOfDay:'morning'|'evening', note, bodyFat, waist, arm, thigh}]
  getWeights() { return DB.get('weights', []); },
  setWeights(v) { DB.set('weights', v); },
  getWeightsByDate(date) {
    const list = Store.getWeights().filter(w => w.date === date);
    return {
      morning: list.find(w => w.timeOfDay === 'morning'),
      evening: list.find(w => w.timeOfDay === 'evening'),
      any: list[0]
    };
  },
  // 出门清单 { name: [items] }
  getBags() { return DB.get('bags', {}); },
  setBags(v) { DB.set('bags', v); },
  // 分享
  getShares() { return DB.get('shares', []); },
  setShares(v) { DB.set('shares', v); },
  // 衣物
  getClothes() { return DB.get('clothes', []); },
  setClothes(v) { DB.set('clothes', v); },
  // 行程日程: [{id, title, startDate, endDate, startTime, endTime, note, color}]
  getTrips() { return DB.get('trips', []); },
  setTrips(v) { DB.set('trips', v); },
  // 消耗品
  getConsumables() { return DB.get('consumables', []); },
  setConsumables(v) { DB.set('consumables', v); },
  // 每日固定例行事项 (要完成计划)  [{id, text, weekDays:[0..6]}]
  getRoutine() {
    const raw = DB.get('routine', []);
    // 旧数据迁移: [{id,text}] → [{id,text,weekDays:[0..6]}]
    if (raw.length && raw[0] && !Array.isArray(raw[0].weekDays)) {
      const migrated = raw.map(r => ({ id: r.id, text: r.text, weekDays: [0,1,2,3,4,5,6] }));
      DB.set('routine', migrated);
      return migrated;
    }
    return raw || [];
  },
  setRoutine(v) { DB.set('routine', v); },
  // 早睡目标时间 "HH:MM"，默认 23:00
  getSleepTarget() { return DB.get('sleepTarget', '23:00'); },
  setSleepTarget(v) { DB.set('sleepTarget', v); },
  // 早睡记录: [{id, date, time(入睡), wake(起床), target, achieved, duration}] 每天一条
  getSleepList() { return DB.get('sleepList', []); },
  setSleepList(v) { DB.set('sleepList', v); },
  getSleepBy(date) { return Store.getSleepList().find(s => s.date === date) || null; },
  setSleepOne(rec) {
    const list = Store.getSleepList();
    const i = list.findIndex(s => s.date === rec.date);
    if (i >= 0) list[i] = rec; else list.push(rec);
    Store.setSleepList(list);
  },
  // 宝宝睡眠: [{id, date, sleep(入睡), wake(起床), duration, note}]
  getBabySleep() { return DB.get('babySleep', []); },
  setBabySleep(v) { DB.set('babySleep', v); },
  getBabySleepBy(date) { return Store.getBabySleep().find(s => s.date === date) || null; },
  setBabySleepOne(rec) {
    const list = Store.getBabySleep();
    const i = list.findIndex(s => s.date === rec.date);
    if (i >= 0) list[i] = rec; else list.push(rec);
    Store.setBabySleep(list);
  },
  // 账本管理: [{id, name, type:'total'|'sub'}] 总账本只能一个
  getLedgers() { return DB.get('ledgers', [{ id: 'total', name: '总账本', type: 'total' }]); },
  setLedgers(v) { DB.set('ledgers', v); },
  // 拉屎记录: [{id, date, count, time, shape, color, note}] shape:1硬/2正常/3软/4稀 color:1棕/2深/3黑/4黄
  getPoops() { return DB.get('poops', []); },
  setPoops(v) { DB.set('poops', v); },
  getPoopBy(date) { return Store.getPoops().find(p => p.date === date) || null; },
  setPoopOne(rec) {
    const list = Store.getPoops();
    const i = list.findIndex(p => p.date === rec.date);
    if (i >= 0) list[i] = rec; else list.push(rec);
    Store.setPoops(list);
  },
  // 突发奇想小tips
  getTipsSudden() { return DB.get('tipsSudden', []); },
  setTipsSudden(v) { DB.set('tipsSudden', v); },
  // 生活小tips
  getTipsLife() { return DB.get('tipsLife', []); },
  setTipsLife(v) { DB.set('tipsLife', v); },
  // 待购物清单
  getShop() { return DB.get('shop', []); },
  setShop(v) { DB.set('shop', v); },
  // 待购物分类（预设 + 自定义）
  getShopCats() { return DB.get('shopCats', ['生鲜果蔬', '日用百货', '零食饮料', '服饰美妆', '母婴用品', '数码家电', '其他']); },
  setShopCats(v) { DB.set('shopCats', v); },
  // 待购物折叠状态（展开的分类名集合，字符串数组）
  getShopCollapsed() { return DB.get('shopCollapsed', []); },
  setShopCollapsed(v) { DB.set('shopCollapsed', v); },
  getShopCollapsedDone() { return DB.get('shopCollapsedDone', []); },
  setShopCollapsedDone(v) { DB.set('shopCollapsedDone', v); },
  // 账本历史查询: { month: 'YYYY-MM', year: 'YYYY' }
  getLedgerQuery() { return DB.get('ledgerQuery', { month: '', year: '' }); },
  setLedgerQuery(v) { DB.set('ledgerQuery', v); }
};

// ---------- 早睡辅助 ----------
// 判断实际睡觉时间 HH:MM 是否早于目标；凌晨0:00~6:00视为前一晚的延伸（即>目标通常意味着熬夜）
function isEarlySleep(targetHHMM, actualHHMM) {
  if (!actualHHMM) return false;
  const [th, tm] = targetHHMM.split(':').map(Number);
  const [ah, am] = actualHHMM.split(':').map(Number);
  const tMin = th * 60 + tm;
  let aMin = ah * 60 + am;
  // 如果实际时间在 00:00~06:00 之间，等价于前一晚的 +1440 分钟
  if (aMin < 6 * 60) aMin += 24 * 60;
  return aMin <= tMin;
}
// 连续早睡天数（从昨天开始往前数，今天可能还没睡，不算）
function sleepStreakDays() {
  const list = Store.getSleepList();
  const map = {};
  list.forEach(s => { if (s.achieved) map[s.date] = true; });
  let streak = 0;
  for (let i = -1; i > -366; i--) {
    const ds = D.offset(i);
    if (map[ds]) streak++;
    else break;
  }
  return streak;
}
// 生成默认早睡时间：如果当前时<6，那应该是昨天的记录（凌晨打卡），否则今天
function sleepDateForNow() {
  const n = new Date();
  const h = n.getHours();
  if (h < 6) return D.offset(-1); // 凌晨=前一晚
  return D.today();
}
// 当前时间 HH:MM
function nowHHMM() {
  const n = new Date();
  return String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
}
// 计算入睡时间 sleepHHMM -> 起床时间 wakeHHMM 的睡眠时长（小时，0.5 步进）
// 假设跨夜：sleep > wake 表示跨天（例如 23:00 -> 06:30）
function sleepDurationHours(sleepHHMM, wakeHHMM) {
  if (!sleepHHMM || !wakeHHMM) return 0;
  let [sh, sm] = sleepHHMM.split(':').map(Number);
  let [wh, wm] = wakeHHMM.split(':').map(Number);
  let sMin = sh * 60 + sm;
  let wMin = wh * 60 + wm;
  // 若起床早于入睡，假设跨夜
  if (wMin <= sMin) wMin += 24 * 60;
  const mins = wMin - sMin;
  return Math.round(mins / 30 * 0.5 * 10) / 10; // 0.5 步进
}
// 睡眠时长格式化 7.5 -> "7时30分"
function fmtDuration(hours) {
  if (!hours && hours !== 0) return '--';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return h + '时';
  return h + '时' + m + '分';
}

// ---------- 当前状态 ----------
let currentTab = 'home';
let subTab = {};
let chartRange = 7;       // 周图表范围
let reminderShown = null; // 今日提醒是否展示过的日期
let notifyTimer = null;   // 定时提醒定时器

// ---------- 统计工具 ----------
// 某药品在某日期/周几是否要吃
// wd: 0..6 (周日..周六)；weekDays 为 undefined/null/空数组 视为每天
function medDueOn(med, wd) {
  if (!med || !med.weekDays || !med.weekDays.length) return true;
  return med.weekDays.includes(wd);
}
// 根据日期串返回周几数字 0..6
function dateWd(dateStr) {
  return new Date(dateStr.replace(/-/g, '/')).getDay();
}
// 计算某天三模块的完成率 {medPct, routinePct, todoPct, overall, tasksTotal, tasksDone}
// routine 空的话不算
function dailyStats(dateStr) {
  const day = Store.getDay(dateStr);
  const medList = Store.getMedList();
  const routine = Store.getRoutine();
  const meds = day.meds || {};
  const rMap = day.routine || {};
  const todos = day.todos || [];
  const wd = dateWd(dateStr);
  // 今日需服药的药品列表
  const todaysMeds = medList.filter(m => medDueOn(m, wd));
  const medDone = todaysMeds.filter(m => meds[m.id] || meds[m.name]).length;
  // 今日应该做的每日计划(按周几筛选)
  const todaysRoutine = routine.filter(r => routineDueOn(r, wd));
  const rDone = todaysRoutine.filter(r => rMap[r.id]).length;
  const tDone = todos.filter(t => t.done).length;
  // 早睡：若当天有记录则算一项
  const sleepRec = Store.getSleepBy(dateStr);
  const sleepHas = !!sleepRec;
  const sleepOK = sleepHas ? (sleepRec.achieved ? 1 : 0) : 0;
  let sleepTotal = sleepHas ? 1 : 0;
  // 如果是今天，还没到18点且没打卡，不计入分母（还没到睡的时候）
  if (dateStr === D.today() && !sleepHas && new Date().getHours() < 18) sleepTotal = 0;

  const tasksTotal = todaysMeds.length + todaysRoutine.length + todos.length + sleepTotal;
  const tasksDone = medDone + rDone + tDone + sleepOK;
  return {
    medPct: todaysMeds.length ? medDone / todaysMeds.length : null,
    routinePct: todaysRoutine.length ? rDone / todaysRoutine.length : null,
    todoPct: todos.length ? tDone / todos.length : null,
    sleepPct: sleepHas ? (sleepOK ? 100 : 0) : null,
    overall: tasksTotal ? tasksDone / tasksTotal : 0,
    tasksTotal, tasksDone,
    medDone, rDone, tDone
  };
}
// 计算连续完成天数（从今天往前数，routine 全勤天数；today 不完整也视为算）
// 另外返回各单项的连续天数
function streakStats() {
  const routine = Store.getRoutine();
  const medList = Store.getMedList();
  const result = {
    routineFull: 0,   // 例行全勤连续天数
    medFull: 0,       // 用药全勤连续
    overallFull: 0,   // 当天有设置的三模块全部完成
    perRoutine: {}    // 每个例行单项连续: {id: days}
  };
  if (routine.length) {
    routine.forEach(r => result.perRoutine[r.id] = 0);
  }
  // 往回最多查 365 天
  for (let i = 0; i < 365; i++) {
    const ds = D.offset(-i);
    const s = dailyStats(ds);
    // 例行全勤
    if (routine.length && s.routinePct !== null) {
      if (s.routinePct >= 1) result.routineFull++;
      else break;
    }
  }
  // 单项连续（仅例行）：跳过该事项不用做的日子
  if (routine.length) {
    routine.forEach(r => {
      for (let i = 0; i < 365; i++) {
        const ds = D.offset(-i);
        const wd = dateWd(ds);
        // 若这天不用做，跳过不计入也不中断
        if (!routineDueOn(r, wd)) continue;
        const day = Store.getDay(ds);
        if ((day.routine || {})[r.id]) result.perRoutine[r.id]++;
        else break;
      }
    });
  }
  // 用药全勤连续
  if (medList.length) {
    for (let i = 0; i < 365; i++) {
      const ds = D.offset(-i);
      const s = dailyStats(ds);
      if (s.medPct !== null && s.medPct >= 1) result.medFull++;
      else break;
    }
  }
  // overall 全勤：当天有任何任务项 + 全部完成
  for (let i = 0; i < 365; i++) {
    const ds = D.offset(-i);
    const s = dailyStats(ds);
    if (s.tasksTotal > 0 && s.overall >= 1) result.overallFull++;
    else break;
  }
  return result;
}
// 近 N 天每日完成率列表，[{date, medPct, routinePct, todoPct, overall}]
function weekStats(days = 7) {
  const list = [];
  for (let i = days - 1; i >= 0; i--) {
    const ds = D.offset(-i);
    const s = dailyStats(ds);
    list.push({
      date: ds,
      wd: D.wd(ds),
      md: Number(ds.slice(-2)),
      medPct: s.medPct == null ? null : Math.round(s.medPct * 100),
      routinePct: s.routinePct == null ? null : Math.round(s.routinePct * 100),
      todoPct: s.todoPct == null ? null : Math.round(s.todoPct * 100),
      sleepPct: s.sleepPct,
      overall: Math.round(s.overall * 100),
      tasksTotal: s.tasksTotal,
      tasksDone: s.tasksDone
    });
  }
  return list;
}

// ---------- 工具函数 ----------
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function $(sel) { return document.querySelector(sel); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function escapeAttr(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// 读取图片为base64
function readImg(file) {
  return new Promise(resolve => {
    if (!file) return resolve('');
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(file);
  });
}

// ---------- 弹窗 ----------
function openModal(html) {
  const root = $('#modalRoot');
  root.innerHTML = `<div class="modal-mask"><div class="modal">${html}</div></div>`;
  root.querySelector('.modal-mask').addEventListener('click', e => {
    if (e.target.classList.contains('modal-mask')) closeModal();
  });
}
function closeModal() { $('#modalRoot').innerHTML = ''; }

// ---------- 主渲染 ----------
// 各主tab的子目录配置 { tab: [{key, icon, label}] }
const SUB_NAVS = {
  plan: [
    { key: 'daily', icon: '📌', label: '今日代办' },
    { key: 'weekly', icon: '🗓️', label: '每周代办' },
    { key: 'monthly', icon: '📅', label: '每月计划' },
    { key: 'calendar', icon: '📆', label: '月历' }
  ],
  account: [
    { key: 'expense', icon: '💸', label: '支出' },
    { key: 'income', icon: '💰', label: '收入' },
    { key: 'reimburse', icon: '🧾', label: '待报销' },
    { key: 'trade', icon: '📦', label: '买卖' },
    { key: 'ledger', icon: '📚', label: '账本' }
  ],
  growth: [
    { key: 'baby', icon: '👶', label: '宝宝成长' },
    { key: 'weight', icon: '⚖️', label: '体重' },
    { key: 'babysleep', icon: '😴', label: '宝宝睡眠' }
  ],
  more: [
    { key: 'bag', icon: '🎒', label: '出门清单' },
    { key: 'share', icon: '💄', label: '好物分享' },
    { key: 'cloth', icon: '👕', label: '衣物' },
    { key: 'consumable', icon: '🧴', label: '消耗品' },
    { key: 'shop', icon: '🛒', label: '待购物' },
    { key: 'poop', icon: '💩', label: '拉屎月历' },
    { key: 'sudden', icon: '💡', label: '突发奇想' },
    { key: 'life', icon: '🌱', label: '生活tips' },
    { key: 'data', icon: '💾', label: '数据管理' }
  ]
};
function renderSubNav() {
  const wrap = $('#subNav');
  if (!wrap) return;
  const subs = SUB_NAVS[currentTab];
  if (!subs || !subs.length) { wrap.innerHTML = ''; return; }
  const cur = subTab[currentTab] || subs[0].key;
  let h = `<div class="sub-nav-title">子目录</div>`;
  subs.forEach(s => {
    h += `<button class="sub-nav-item ${cur === s.key ? 'active' : ''}" onclick="setSubTab('${currentTab}','${s.key}')">
      <span class="sn-icon">${s.icon}</span><span>${s.label}</span></button>`;
  });
  wrap.innerHTML = h;
}
function render() {
  const titles = { home: '甜酱日常', plan: '计划与打卡', account: '账本', growth: '成长记录', more: '更多' };
  $('#pageTitle').textContent = titles[currentTab];
  $('#todayDate').textContent = D.fmt(D.today());
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === currentTab);
  });
  renderSubNav();
  const fn = { home: renderHome, plan: renderPlan, account: renderAccount, growth: renderGrowth, more: renderMore }[currentTab];
  $('#content').innerHTML = fn ? fn() : '';
  // 隐藏fab默认
  const fab = $('#fab');
  if (fab) fab.remove();
}

// 切换tab
document.querySelectorAll('.nav-item').forEach(b => {
  b.addEventListener('click', () => {
    currentTab = b.dataset.tab;
    render();
  });
});

/* ========= 首页/打卡 ========= */
function renderHome() {
  const cur = Store.getHomeDate() || D.today();
  const today = D.today();
  const isToday = cur === today;
  const day = Store.getDay(cur);
  const medList = Store.getMedList();
  const routine = Store.getRoutine();
  const wd = dateWd(cur);
  // 今日需服药
  const todaysMeds = medList.filter(m => medDueOn(m, wd));
  // 用药打卡
  const meds = day.meds || {};
  const medDone = todaysMeds.filter(m => meds[m.id] || meds[m.name]).length;
  // 今日应该做的每日计划(按周几筛选)
  const todaysRoutine = routine.filter(r => routineDueOn(r, wd));
  const restRoutine = routine.filter(r => !routineDueOn(r, wd));
  const routineMap = day.routine || {};
  const routineDone = todaysRoutine.filter(r => routineMap[r.id]).length;
  // 代办
  const todos = day.todos || [];
  const todoDone = todos.filter(t => t.done).length;
  // 卡路里
  const calRecords = day.calories?.records || [];
  const calIn = calRecords.filter(r => r.type === 'in').reduce((s, r) => s + Number(r.cal || 0), 0);
  const calOut = calRecords.filter(r => r.type === 'out').reduce((s, r) => s + Number(r.cal || 0), 0);
  // 早睡
  const sleepTarget = Store.getSleepTarget();
  const todaySleep = Store.getSleepBy(cur);
  const sleepAchieved = todaySleep ? !!todaySleep.achieved : false;

  // 总完成度（早睡纳入考核条件：已打卡 或 所选日期=今天且晚6点后）
  const isLate = isToday ? (new Date().getHours() >= 18 || !!todaySleep) : true;
  const sleepTotal = isLate ? 1 : 0;
  const sleepDone = sleepAchieved ? 1 : 0;
  const totalTasks = todaysMeds.length + todaysRoutine.length + todos.length + sleepTotal;
  const totalDone = medDone + routineDone + todoDone + sleepDone;
  const totalPct = totalTasks ? Math.round(totalDone / totalTasks * 100) : 0;

  // 日期导航 HTML
  const navHTML = `
    <div class="plan-nav" style="margin:4px 0 10px;padding:8px 10px;background:linear-gradient(135deg,#ffe9f3,#fff4f9);border-radius:12px">
      <button class="cal-nav" onclick="homeMove(-1)" title="前一天">‹</button>
      <div class="plan-nav-mid" style="text-align:center">
        <div style="font-weight:600;color:var(--pink-deep);font-size:15px">🌸 ${D.fmt(cur)} · 周${D.wd(cur)}${!isToday ? ' <span style="font-size:11px;color:#b34b7c;background:#fff;padding:1px 6px;border-radius:999px;border:1px solid #ffc6de;margin-left:4px">补打卡模式</span>' : ' <span style="font-size:11px;color:#41aa6c;background:#fff;padding:1px 6px;border-radius:999px;border:1px solid #b9ecca;margin-left:4px">今天</span>'}</div>
        <input type="date" class="plan-date-input" style="margin-top:4px" value="${cur}" onchange="homeSet(this.value)">
      </div>
      <button class="cal-nav" onclick="homeMove(1)" title="后一天">›</button>
    </div>
    ${!isToday ? `<div style="display:flex;gap:6px;margin-bottom:10px;justify-content:flex-end"><button class="btn btn-ghost btn-sm" onclick="homeGoToday()">🏠 回到今天</button></div>` : ''}`;

  // 提前计算所有统计变量（与卡片顺序无关）
  const streak = streakStats();
  const sleepStreak = sleepStreakDays();
  const ws = weekStats(chartRange);
  const maxPct = Math.max(...ws.map(w => w.overall), 10);
  const crLabel = chartRange === 7 ? '近7天' : chartRange === 14 ? '近14天' : '近30天';

  let h = navHTML;
  h += reminderBanner();

  // 📝 今日代办（放最上面）
  h += `<div class="card">
    <div class="card-title"><span class="title-left">📝 ${isToday ? '今日' : D.fmtShort(cur)} 代办</span><button class="btn btn-ghost btn-sm" onclick="addTodo('daily')">+添加</button></div>`;
  if (todos.length === 0) {
    h += `<div class="empty"><span class="emoji">📋</span>${isToday ? '今天还没有代办，添加一个吧' : D.fmtShort(cur) + ' 还没有代办，添加一个吧'}</div>`;
  } else {
    todos.forEach(t => {
      h += `<div class="todo-item ${t.done ? 'done' : ''}">
        <div class="checkbox" onclick="toggleTodo('${t.id}','${cur}')">${t.done ? '✓' : ''}</div>
        <div class="todo-text" onclick="toggleTodo('${t.id}','${cur}')">${esc(t.text)}</div>
        <button class="del-btn" onclick="delTodo('${t.id}','${cur}')">×</button>
      </div>`;
    });
  }
  h += `</div>`;

  // 💊 用药打卡
  h += `<div class="card">
    <div class="card-title"><span class="title-left">💊 用药打卡</span><button class="btn btn-ghost btn-sm" onclick="editMedList()">设置</button></div>`;
  if (medList.length === 0) {
    h += `<div class="empty"><span class="emoji">💊</span>还没有添加药品，点击右上角设置</div>`;
  } else {
    const dueToday = medList.filter(m => medDueOn(m, wd));
    const restToday = medList.filter(m => !medDueOn(m, wd));
    // 辅助：渲染一周7天的小徽章
    const renderWD = (m) => {
      const full = (!m.weekDays || !m.weekDays.length);
      return ['一','二','三','四','五','六','日'].map((ch, i) => {
        // Monday = 0 of index here -> JS wd 1..6, then Sunday = 6 -> JS wd 0
        const jsWd = i === 6 ? 0 : i + 1;
        const on = full || (m.weekDays || []).includes(jsWd);
        const isToday = jsWd === wd;
        return `<span class="wd-pill ${on ? 'on' : 'off'} ${isToday ? 'today' : ''}">${ch}</span>`;
      }).join('');
    };
    const dueKey = (m) => (m.id || m.name);
    if (dueToday.length) {
      h += `<div class="med-section-title">📍 ${isToday ? '今日' : D.fmtShort(cur)} 服用（${dueToday.length} 种）</div>`;
      h += `<div class="med-grid">`;
      dueToday.forEach(m => {
        const key = dueKey(m);
        const done = !!meds[key] || !!meds[m.name];
        h += `<div class="med-item ${done ? 'done' : ''}" onclick="toggleMed('${escapeAttr(key)}')">
          <div class="check-circle">${done ? '✓' : ''}</div>
          <div class="med-info">
            <div class="med-name">${escapeHtml(m.name)}</div>
            <div class="med-wd-row">${renderWD(m)}</div>
          </div>
        </div>`;
      });
      h += `</div>`;
    }
    if (restToday.length) {
      h += `<div class="med-section-title dim">💤 ${isToday ? '今日' : D.fmtShort(cur)} 不用吃（${restToday.length} 种）</div>`;
      h += `<div class="med-grid">`;
      restToday.forEach(m => {
        const key = dueKey(m);
        const done = !!meds[key] || !!meds[m.name];
        h += `<div class="med-item is-rest ${done ? 'done' : ''}" onclick="toggleMed('${escapeAttr(key)}')">
          <div class="check-circle">${done ? '✓' : ''}</div>
          <div class="med-info">
            <div class="med-name">${escapeHtml(m.name)} <span class="med-rest-tag">${isToday ? '今日' : ''}休息</span></div>
            <div class="med-wd-row">${renderWD(m)}</div>
          </div>
        </div>`;
      });
      h += `</div>`;
    }
  }
  h += `</div>`;

  // 每日要完成计划（固定例行事项，按选中日期打卡）
  h += `<div class="card">
    <div class="card-title"><span class="title-left">⭐ ${isToday ? '今日' : D.fmtShort(cur)} 要完成计划</span><button class="btn btn-ghost btn-sm" onclick="editRoutine()">设置</button></div>`;
  if (todaysRoutine.length === 0 && restRoutine.length === 0) {
    h += `<div class="empty"><span class="emoji">⭐</span>还没有每日例行事项<br><span style="font-size:12px">如：喝水2L / 运动30分 / 阅读 / 早睡</span></div>`;
  } else {
    if (todaysRoutine.length) {
      h += `<div class="check-grid">`;
      todaysRoutine.forEach(r => {
        const done = !!routineMap[r.id];
        const wdTag = (r.weekDays && r.weekDays.length && r.weekDays.length < 7)
          ? `<div class="med-wd-row">${r.weekDays.map(w => ['日','一','二','三','四','五','六'][w]).map(x => `<span class="wd-pill on" style="font-size:10px;padding:0 4px">${x}</span>`).join('')}</div>`
          : '';
        h += `<div class="check-item ${done ? 'done' : ''}" onclick="toggleRoutine('${r.id}')">
          <div class="check-circle">${done ? '✓' : ''}</div>
          <div class="check-text">${esc(r.text)}${wdTag}</div></div>`;
      });
      h += `</div>`;
    }
    if (restRoutine.length) {
      h += `<div class="section-head" style="color:var(--text-light);font-size:12px;margin-top:8px">💤 ${isToday ? '今日' : D.fmtShort(cur)} 休息（${restRoutine.length} 项）</div>`;
      h += `<div class="check-grid" style="opacity:.55">`;
      restRoutine.forEach(r => {
        const done = !!routineMap[r.id];
        const wdTag = (r.weekDays && r.weekDays.length)
          ? `<div class="med-wd-row">${r.weekDays.map(w => ['日','一','二','三','四','五','六'][w]).map(x => `<span class="wd-pill on" style="font-size:10px;padding:0 4px">${x}</span>`).join('')}</div>`
          : '';
        h += `<div class="check-item ${done ? 'done' : ''}">
          <div class="check-circle">${done ? '✓' : ''}</div>
          <div class="check-text">${esc(r.text)}${wdTag}</div></div>`;
      });
      h += `</div>`;
    }
    if (todaysRoutine.length && routineDone === todaysRoutine.length) {
      h += `<div style="text-align:center;color:var(--green);font-size:13px;margin-top:10px">🎉 ${isToday ? '今日' : D.fmtShort(cur)} 全部完成，太棒了！</div>`;
    }
  }
  h += `</div>`;

  // 🌙 睡眠记录（早睡 + 时长）
  const todayWake = todaySleep?.wake || '';
  const todayDur = todaySleep?.duration || (todaySleep && todayWake ? sleepDurationHours(todaySleep.time, todayWake) : 0);
  const hasWake = !!todayWake;
  // 近7天平均时长
  let avgDur7 = 0, avgCnt = 0;
  for (let i = 1; i <= 7; i++) {
    const ds = D.offset(-i);
    const s = Store.getSleepBy(ds);
    if (s && s.duration) { avgDur7 += s.duration; avgCnt++; }
  }
  const avgDur = avgCnt ? (avgDur7 / avgCnt) : 0;
  h += `<div class="card sleep-card">
    <div class="card-title">
      <span class="title-left">🌙 睡眠记录</span>
      <button class="btn btn-ghost btn-sm" onclick="openSleepSettings()">⚙️ 目标</button>
    </div>
    <div class="sleep-row">
      <div class="sleep-box">
        <div class="sleep-label">目标就寝</div>
        <div class="sleep-time">${esc(sleepTarget)}</div>
        <div class="sleep-sub">⏰ 截止时间</div>
      </div>
      <div class="sleep-arrow">→</div>
      <div class="sleep-box ${todaySleep ? (sleepAchieved ? 'sleep-good' : 'sleep-bad') : 'sleep-empty'}">
        <div class="sleep-label">实际就寝</div>
        <div class="sleep-time">${todaySleep ? esc(todaySleep.time) : '未打卡'}</div>
        <div class="sleep-sub">
          ${todaySleep ? (sleepAchieved ? '<span style="color:var(--green)">✓ 达标</span>' : '<span style="color:var(--red)">✗ 晚睡</span>') : '🌙 今晚加油'}
        </div>
      </div>
      <div class="sleep-arrow">→</div>
      <div class="sleep-box ${hasWake ? 'sleep-good' : 'sleep-empty'}">
        <div class="sleep-label">起床 / 时长</div>
        <div class="sleep-time">${hasWake ? esc(todayWake) : '--'}</div>
        <div class="sleep-sub">${hasWake ? '<span style="color:var(--pink)">💤 ' + fmtDuration(todayDur) + '</span>' : '🌅 待起床'}</div>
      </div>
    </div>
    <div class="sleep-actions">
      <button class="btn btn-sm" onclick="sleepCheckNow()">🌙 现在入睡(${nowHHMM()})${!isToday ? '<br><span style="font-size:10px;opacity:.85">记到 '+D.fmtShort(cur)+'</span>' : ''}</button>
      <button class="btn btn-sm" style="background:var(--orange);color:#fff" onclick="sleepWakeNow()">☀️ 现在起床${!isToday ? '<br><span style="font-size:10px;opacity:.85">记到 '+D.fmtShort(cur)+'</span>' : ''}</button>
      <button class="btn btn-ghost btn-sm" onclick="sleepCheckCustom()">选择时间</button>
      ${todaySleep ? `<button class="btn btn-ghost btn-sm" onclick="sleepDelete('${todaySleep.date}')">🗑</button>` : ''}
    </div>
    ${avgCnt > 0 ? `<div class="sleep-streak">📊 近7天平均 ${fmtDuration(avgDur)} · 🌙 已连续早睡 ${sleepStreak} 天</div>` : (sleepStreak > 0 ? `<div class="sleep-streak">🌙 已连续早睡 ${sleepStreak} 天，继续保持！</div>` : '')}
  </div>`;

  // 卡路里
  h += `<div class="card">
    <div class="card-title"><span class="title-left">🔥 卡路里</span><button class="btn btn-ghost btn-sm" onclick="addCalorie()">+记录</button></div>
    <div class="stat-row">
      <div class="stat-box"><div class="num" style="color:var(--orange)">${calIn}</div><div class="label">摄入</div></div>
      <div class="stat-box"><div class="num" style="color:var(--green)">${calOut}</div><div class="label">消耗</div></div>
      <div class="stat-box"><div class="num">${calIn - calOut}</div><div class="label">净值</div></div>
    </div>`;
  if (calRecords.length) {
    calRecords.forEach(r => {
      h += `<div class="list-item">
        <div class="item-main"><div class="item-title">${esc(r.name)}</div><div class="item-sub">${r.type === 'in' ? '摄入' : '消耗'}</div></div>
        <div class="item-right ${r.type === 'in' ? 'profit-neg' : 'profit-pos'}">${r.type === 'in' ? '+' : '-'}${r.cal}</div>
        <button class="del-btn" onclick="delCalorie('${r.id}')">×</button>
      </div>`;
    });
  }
  h += `</div>`;

  // 🌸 打卡总结（移到卡路里下方）
  h += `<div class="card">
    <div class="card-title">
      <span class="title-left">🌸 ${isToday ? '今日打卡' : D.fmtShort(cur) + ' 打卡'}</span>
      <div style="display:flex;align-items:center;gap:4px">
        <span style="font-size:12px;color:var(--text-light)">完成度 ${totalPct}%</span>
        <button class="btn btn-ghost btn-sm" title="打卡提醒设置" onclick="openReminderSettings()" style="padding:3px 8px;font-size:12px">🔔</button>
      </div>
    </div>
    <div class="stat-row">
      <div class="stat-box"><div class="num">${medDone}/${todaysMeds.length}</div><div class="label">用药</div></div>
      <div class="stat-box"><div class="num">${routineDone}/${todaysRoutine.length}</div><div class="label">每日计划</div></div>
      <div class="stat-box"><div class="num">${todoDone}/${todos.length || 0}</div><div class="label">代办</div></div>
      <div class="stat-box"><div class="num">${isLate ? (sleepDone ? '✓' : '✗') : '⏰'}</div><div class="label">早睡</div></div>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${totalPct}%"></div></div>
  </div>`;

  // 🔥 连续打卡统计
  h += `<div class="card">
    <div class="card-title"><span class="title-left">${isToday ? '🔥 连续打卡' : '📈 打卡统计'}</span></div>
    <div class="stat-row">
      <div class="stat-box"><div class="num">${streak.overallFull}</div><div class="label">全勤天</div></div>
      <div class="stat-box"><div class="num">${isToday ? streak.routineFull : routineDone + '/' + todaysRoutine.length}</div><div class="label">${isToday ? '每日计划连续' : '当日计划进度'}</div></div>
      <div class="stat-box"><div class="num">${isToday ? streak.medFull : medDone + '/' + todaysMeds.length}</div><div class="label">${isToday ? '用药连续' : '当日用药进度'}</div></div>
      <div class="stat-box"><div class="num">${sleepStreak}</div><div class="label">🌙 早睡连续</div></div>
    </div>`;
  if (routine && routine.length) {
    h += `<div class="section-head">${isToday ? '单项连续天数' : '当前日期单项状态'}</div><div class="check-grid">`;
    routine.forEach(r => {
      const due = routineDueOn(r, wd);
      const done = !!routineMap[r.id];
      let label;
      if (!due) label = '休息';
      else if (isToday) label = `连续${streak.perRoutine[r.id] || 0}天`;
      else label = done ? '✓ 已完成' : '待完成';
      h += `<div class="check-item ${done ? 'done' : (!due ? 'is-rest' : '')}">
        <div class="check-circle" style="${done ? 'background:var(--pink);border-color:var(--pink)' : ''};font-size:11px;width:22px;height:22px">${due ? (done ? '✓' : (isToday ? (streak.perRoutine[r.id] || 0) : '')) : '休'}</div>
        <div class="check-text">${esc(r.text)}<span style="color:var(--text-light);font-size:11px"> · ${label}</span></div></div>`;
    });
    h += `</div>`;
  }
  h += `</div>`;

  // 📋 周总结卡片
  h += renderWeekSummary();

  // 📊 近N天完成率图表
  h += `<div class="card">
    <div class="card-title"><span class="title-left">📊 ${crLabel}完成率</span>
      <button class="btn btn-ghost btn-sm" onclick="toggleChartRange(this)">${crLabel} ▾</button>
    </div>
    <div class="week-chart">
      <div class="chart-grid">
        ${ws.map(w => `
          <div class="chart-col">
            <div class="chart-bar-wrap">
              <div class="chart-bar" style="height:${(w.overall / maxPct * 100).toFixed(1)}%"></div>
            </div>
            <div class="chart-pct" style="color:${w.overall>=100?'var(--green)':w.overall>=60?'var(--pink)':'var(--text-light)'}">${w.overall}%</div>
            <div class="chart-label">${w.md}<br><span>周${w.wd}</span></div>
          </div>
        `).join('')}
      </div>
      <div class="chart-legend">
        <div class="legend-item"><i style="background:var(--pink)"></i>总完成率</div>
        <div class="legend-item"><i style="background:var(--orange)"></i>用药</div>
        <div class="legend-item"><i style="background:var(--green)"></i>每日计划</div>
        <div class="legend-item"><i style="background:#a3d9ff"></i>代办</div>
        <div class="legend-item"><i style="background:#b7a6ff"></i>早睡</div>
      </div>
    </div>
    <div class="week-detail">
      ${ws.map(w => `
        <div class="wd-row">
          <div class="wd-date">${w.md}日 周${w.wd}</div>
          <div class="wd-bars">
            ${w.medPct !== null ? `<div class="wd-seg" title="用药${w.medPct}%"><i style="width:${w.medPct}%;background:var(--orange)"></i><span>药${w.medPct}%</span></div>` : ''}
            ${w.routinePct !== null ? `<div class="wd-seg" title="每日计划${w.routinePct}%"><i style="width:${w.routinePct}%;background:var(--green)"></i><span>例${w.routinePct}%</span></div>` : ''}
            ${w.todoPct !== null ? `<div class="wd-seg" title="代办${w.todoPct}%"><i style="width:${w.todoPct}%;background:#a3d9ff"></i><span>代${w.todoPct}%</span></div>` : ''}
            ${w.sleepPct !== null ? `<div class="wd-seg" title="早睡${w.sleepPct}%"><i style="width:${Math.max(w.sleepPct,5)}%;background:#b7a6ff"></i><span>${w.sleepPct?'🌙'+w.sleepPct+'%':'🌙未达标'}</span></div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  </div>`;

  // 快捷入口
  h += `<div class="card">
    <div class="card-title"><span class="title-left">⚡ 快捷入口</span></div>
    <div class="check-grid">
      <div class="check-item" onclick="navTo('plan')"><div class="check-circle" style="border-color:var(--orange)">📋</div><div class="check-text">计划</div></div>
      <div class="check-item" onclick="navTo('account')"><div class="check-circle" style="border-color:var(--green)">💰</div><div class="check-text">记账</div></div>
      <div class="check-item" onclick="navTo('growth')"><div class="check-circle" style="border-color:var(--pink)">🌱</div><div class="check-text">宝宝</div></div>
      <div class="check-item" onclick="navTo('more')"><div class="check-circle" style="border-color:var(--pink)">✨</div><div class="check-text">更多</div></div>
    </div>
  </div>`;

  return h;
}

function navTo(tab) { currentTab = tab; render(); }

function toggleMed(key) { toggleMedAt(key, Store.getHomeDate() || D.today()); }
function toggleMedAt(key, dateStr) {
  const day = Store.getDay(dateStr);
  day.meds = day.meds || {};
  const list = Store.getMedList();
  const med = list.find(m => m.id === key || m.name === key);
  if (!med) return;
  const wd = dateWd(dateStr);
  const willTurnOn = !(day.meds[med.id] || day.meds[med.name]);
  if (willTurnOn && !medDueOn(med, wd)) {
    if (!confirm(`${med.name} 在 ${D.fmt(dateStr)}（周${D.wd(dateStr)}）本来不用吃，确定要记一笔吗？`)) return;
  }
  day.meds[med.id] = !day.meds[med.id] && !day.meds[med.name];
  delete day.meds[med.name];
  Store.setDay(dateStr, day);
  toast(day.meds[med.id] ? `✅ 已记一笔：${D.fmtShort(dateStr)} 吃过啦` : `🔄 已取消：${D.fmtShort(dateStr)} 还没吃哦`);
  render();
}

function editMedList() {
  const medList = Store.getMedList();
  // 拷贝一份到临时变量防止直接修改
  const wdLabels = ['一','二','三','四','五','六','日'];
  const wdValues = [1,2,3,4,5,6,0]; // JS getDay
  let rows = '';
  medList.forEach((m, idx) => {
    const wds = m.weekDays && m.weekDays.length ? m.weekDays : [0,1,2,3,4,5,6];
    const pill = wdLabels.map((ch, i) => {
      const v = wdValues[i];
      const on = wds.includes(v);
      return `<label class="wd-check ${on ? 'on' : ''}" onclick="this.classList.toggle('on');const inp=this.querySelector('input');inp.checked=!inp.checked">
        <input type="checkbox" ${on ? 'checked' : ''} value="${v}" style="display:none"/>${ch}</label>`;
    }).join('');
    rows += `<div class="med-edit-row" data-idx="${idx}">
      <button class="btn btn-xs btn-danger" onclick="medEditDel(this)" title="删除">×</button>
      <input class="input med-edit-name" placeholder="药品名称" value="${escapeAttr(m.name)}"/>
      <div class="wd-check-row">${pill}
        <button class="btn btn-xs btn-ghost" onclick="medEditAllWeek(this)" title="全选一周">全</button>
        <button class="btn btn-xs btn-ghost" onclick="medEditWeekday(this)" title="仅工作日">工</button>
      </div>
    </div>`;
  });
  openModal(`
    <div class="modal-head"><h3>💊 用药清单 & 每周安排</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="med-edit-tip">每行一种药，勾选周几需要吃（工 = 周一~周五，全 = 一~日）</div>
    <div id="medEditRows">${rows}</div>
    <button class="btn btn-block btn-ghost" onclick="medEditAddRow()">+ 添加一种药</button>
    <button class="btn btn-block" onclick="saveMedList()">保存</button>
  `);
}
function medEditDel(btn) {
  const row = btn.closest('.med-edit-row');
  if (!row) return;
  const name = row.querySelector('.med-edit-name')?.value || '';
  if (name && !confirm(`删除「${name}」？`)) return;
  row.remove();
}
function medEditAddRow() {
  const wdLabels = ['一','二','三','四','五','六','日'];
  const wdValues = [1,2,3,4,5,6,0];
  const pill = wdLabels.map((ch, i) => {
    const v = wdValues[i];
    const on = true; // 默认全选
    return `<label class="wd-check ${on ? 'on' : ''}" onclick="this.classList.toggle('on');const inp=this.querySelector('input');inp.checked=!inp.checked">
      <input type="checkbox" ${on ? 'checked' : ''} value="${v}" style="display:none"/>${ch}</label>`;
  }).join('');
  const row = document.createElement('div');
  row.className = 'med-edit-row';
  row.innerHTML = `<button class="btn btn-xs btn-danger" onclick="medEditDel(this)" title="删除">×</button>
    <input class="input med-edit-name" placeholder="药品名称"/>
    <div class="wd-check-row">${pill}
      <button class="btn btn-xs btn-ghost" onclick="medEditAllWeek(this)" title="全选一周">全</button>
      <button class="btn btn-xs btn-ghost" onclick="medEditWeekday(this)" title="仅工作日">工</button>
    </div>`;
  $('#medEditRows').appendChild(row);
}
function medEditAllWeek(btn) {
  const row = btn.closest('.wd-check-row');
  if (!row) return;
  row.querySelectorAll('.wd-check').forEach(el => {
    el.classList.add('on');
    const inp = el.querySelector('input');
    if (inp) inp.checked = true;
  });
}
function medEditWeekday(btn) {
  const row = btn.closest('.wd-check-row');
  if (!row) return;
  row.querySelectorAll('.wd-check').forEach((el, i) => {
    const on = i < 5; // 一 二 三 四 五
    el.classList.toggle('on', on);
    const inp = el.querySelector('input');
    if (inp) inp.checked = on;
  });
}
function saveMedList() {
  const oldList = Store.getMedList();
  const result = [];
  const rows = document.querySelectorAll('#medEditRows .med-edit-row');
  rows.forEach((row, idx) => {
    const nameInput = row.querySelector('.med-edit-name');
    const name = (nameInput?.value || '').trim();
    if (!name) return;
    const wdVals = [];
    row.querySelectorAll('.wd-check input:checked').forEach(cb => wdVals.push(Number(cb.value)));
    // 保留原来的 id，避免旧数据脱节（按名字匹配优先，否则按顺序）
    let id;
    const found = oldList.find(m => m.name === name);
    id = found ? found.id : (oldList[idx]?.id || uid());
    result.push({
      id,
      name,
      weekDays: wdVals.length === 7 || !wdVals.length ? [0,1,2,3,4,5,6] : wdVals.sort()
    });
  });
  Store.setMedList(result);
  closeModal();
  toast('✅ 已保存用药安排');
  render();
}

// 判断某例行事项在某天是否要做(基于 weekDays)
function routineDueOn(r, wdNum) {
  if (!r.weekDays || !r.weekDays.length) return true;
  return r.weekDays.includes(wdNum);
}
// 渲染周几选择 pill(用于 routine 设置页)
function renderRoutineWD(r, idx) {
  const wds = ['日','一','二','三','四','五','六'];
  return wds.map((w, i) => {
    const active = r.weekDays && r.weekDays.includes(i);
    return `<span class="wd-pill ${active?'on':''}" onclick="toggleRoutineWD(${idx},${i})">${w}</span>`;
  }).join('');
}
function toggleRoutineWD(idx, wd) {
  const list = window._editingRoutine || [];
  if (!list[idx]) return;
  list[idx].weekDays = list[idx].weekDays || [];
  const i = list[idx].weekDays.indexOf(wd);
  if (i >= 0) list[idx].weekDays.splice(i, 1);
  else list[idx].weekDays.push(wd);
  list[idx].weekDays.sort();
  // 重新渲染编辑内容
  let h = '';
  list.forEach((r, k) => {
    h += `<div class="routine-edit-row">
      <input class="input" value="${esc(r.text)}" oninput="window._editingRoutine[${k}].text=this.value" placeholder="事项内容">
      <div class="wd-row">${renderRoutineWD(r, k)}</div>
      <button class="del-btn" onclick="removeRoutineEdit(${k})">×</button>
    </div>`;
  });
  $('#routineEditList').innerHTML = h;
}
function removeRoutineEdit(idx) {
  window._editingRoutine.splice(idx, 1);
  // 重新渲染
  let h = '';
  (window._editingRoutine || []).forEach((r, k) => {
    h += `<div class="routine-edit-row">
      <input class="input" value="${esc(r.text)}" oninput="window._editingRoutine[${k}].text=this.value" placeholder="事项内容">
      <div class="wd-row">${renderRoutineWD(r, k)}</div>
      <button class="del-btn" onclick="removeRoutineEdit(${k})">×</button>
    </div>`;
  });
  $('#routineEditList').innerHTML = h;
}
function addRoutineEdit() {
  window._editingRoutine.push({ id: uid(), text: '', weekDays: [0,1,2,3,4,5,6] });
  const k = window._editingRoutine.length - 1;
  const r = window._editingRoutine[k];
  const div = document.createElement('div');
  div.className = 'routine-edit-row';
  div.innerHTML = `<input class="input" value="${esc(r.text)}" oninput="window._editingRoutine[${k}].text=this.value" placeholder="事项内容">
    <div class="wd-row">${renderRoutineWD(r, k)}</div>
    <button class="del-btn" onclick="removeRoutineEdit(${k})">×</button>`;
  $('#routineEditList').appendChild(div);
}

// 每日要完成计划（固定例行事项）
function editRoutine() {
  const routine = Store.getRoutine();
  // 深拷贝一份到临时变量
  window._editingRoutine = routine.map(r => ({ id: r.id, text: r.text, weekDays: [...(r.weekDays || [0,1,2,3,4,5,6])] }));
  let listHtml = '';
  window._editingRoutine.forEach((r, k) => {
    listHtml += `<div class="routine-edit-row">
      <input class="input" value="${esc(r.text)}" oninput="window._editingRoutine[${k}].text=this.value" placeholder="事项内容">
      <div class="wd-row">${renderRoutineWD(r, k)}</div>
      <button class="del-btn" onclick="removeRoutineEdit(${k})">×</button>
    </div>`;
  });
  openModal(`
    <div class="modal-head"><h3>⭐ 每日要完成计划</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="field">
      <label>设置每项计划每周哪几天要做（点周几按钮切换）</label>
      <div id="routineEditList">${listHtml}</div>
      <button class="btn btn-ghost btn-sm btn-block" style="margin-top:8px" onclick="addRoutineEdit()">+ 添加一项</button>
      <div style="font-size:12px;color:var(--text-light);margin-top:8px">提示：周几按钮高亮 = 那天要做；全部不选 = 每天都做</div>
    </div>
    <button class="btn btn-block" onclick="saveRoutine()">保存</button>
  `);
}
function saveRoutine() {
  const list = (window._editingRoutine || [])
    .map(r => ({ id: r.id, text: (r.text || '').trim(), weekDays: r.weekDays || [] }))
    .filter(r => r.text);
  // 保留已有 id 已完成打卡数据(其实不影响,因为打卡是按天存的 id->bool)
  Store.setRoutine(list);
  window._editingRoutine = null;
  closeModal();
  render();
}
function toggleRoutine(id) { toggleRoutineAt(id, Store.getHomeDate() || D.today()); }
function toggleRoutineAt(id, dateStr) {
  const day = Store.getDay(dateStr);
  day.routine = day.routine || {};
  const wasOn = !!day.routine[id];
  day.routine[id] = !wasOn;
  Store.setDay(dateStr, day);
  toast(day.routine[id] ? `🎉 ${D.fmtShort(dateStr)} 已完成一项` : `↩️ ${D.fmtShort(dateStr)} 已取消`);
  if ($('#dayNoteList')) openDay(dateStr);
  else render();
}

// 代办
function addTodo(type) {
  const placeholder = type === 'weekly' ? '每周代办事项' : type === 'monthly' ? '每月计划' : '代办内容';
  const titleText = type === 'weekly' ? '添加每周代办' : type === 'monthly' ? '添加每月计划' : '添加今日代办';
  // daily 可以选日期
  let dateField = '';
  if (type === 'daily') {
    const curDate = Store.getPlanDailyDate();
    dateField = `<div class="field"><label>日期</label><input class="input" type="date" id="todoDate" value="${curDate}"></div>`;
  } else if (type === 'weekly') {
    const wk = Store.getPlanWeekKey();
    const weekDates = getWeekDates(wk);
    const rangeLabel = `${D.fmtShort(weekDates[0].date)} ~ ${D.fmtShort(weekDates[6].date)}`;
    dateField = `<div class="field" style="font-size:13px;color:var(--text-light)">当前周：${rangeLabel}</div>`;
  } else if (type === 'monthly') {
    const mk = Store.getPlanMonthKey();
    const [y, m] = mk.split('-');
    dateField = `<div class="field" style="font-size:13px;color:var(--text-light)">当前月份：${y}年${parseInt(m)}月</div>`;
  }
  openModal(`
    <div class="modal-head"><h3>${titleText}</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    ${dateField}
    <div class="field"><label>${placeholder}</label><textarea class="textarea" id="todoText" rows="3"></textarea></div>
    <button class="btn btn-block" onclick="saveTodo('${type}')">保存</button>
  `);
  setTimeout(() => $('#todoText').focus(), 100);
}
function saveTodo(type) {
  const text = $('#todoText').value.trim();
  if (!text) return;
  if (type === 'daily') {
    const dateStr = $('#todoDate')?.value || D.today();
    const day = Store.getDay(dateStr);
    day.todos = day.todos || [];
    day.todos.push({ id: uid(), text, done: false });
    Store.setDay(dateStr, day);
    Store.setPlanDailyDate(dateStr); // 保存完视图切到该天
  } else if (type === 'weekly') {
    const wk = Store.getPlanWeekKey();
    const w = Store.getWeeklyByWeek(wk);
    w.push({ id: uid(), text, done: false });
    Store.setWeeklyByWeek(wk, w);
  } else if (type === 'monthly') {
    const mk = Store.getPlanMonthKey();
    const m = Store.getMonthlyByMonth(mk);
    m.push({ id: uid(), text, done: false });
    Store.setMonthlyByMonth(mk, m);
  }
  closeModal();
  render();
}
// toggleTodo/delTodo: 由于待办实际存在 days[date].todos 里，查找时要从当前视图日期开始找，找不到再全局搜(防止切日期后点不动)
function _findTodoDateById(id) {
  // 先查计划页选中的天
  const pdate = Store.getPlanDailyDate();
  const pday = Store.getDay(pdate);
  if ((pday.todos || []).find(t => t.id === id)) return pdate;
  // 再查今天
  const today = D.today();
  if (pdate !== today) {
    const tday = Store.getDay(today);
    if ((tday.todos || []).find(t => t.id === id)) return today;
  }
  // 最后全局扫 days(兜底)
  const days = DB.get('days', {});
  for (const ds in days) {
    if ((days[ds].todos || []).find(t => t.id === id)) return ds;
  }
  return null;
}
function toggleTodo(id, dateStr) {
  const ds = dateStr || _findTodoDateById(id);
  if (!ds) return;
  const day = Store.getDay(ds);
  day.todos = day.todos || [];
  const t = day.todos.find(x => x.id === id);
  if (t) {
    t.done = !t.done;
    Store.setDay(ds, day);
    toast(t.done ? `✅ ${D.fmtShort(ds)} 代办完成啦` : `↩️ ${D.fmtShort(ds)} 代办回到未完成`);
    render();
  }
}
function delTodo(id, dateStr) {
  const ds = dateStr || _findTodoDateById(id);
  if (!ds) return;
  const day = Store.getDay(ds);
  day.todos = (day.todos || []).filter(x => x.id !== id);
  Store.setDay(ds, day);
  render();
}

// ---------- 早睡打卡 ----------
function openSleepSettings() {
  const t = Store.getSleepTarget();
  openModal(`
    <div class="modal-head"><h3>⚙️ 早睡目标设置</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="field"><label>目标就寝时间（HH:MM）</label>
      <input class="input" id="sleepTargetIn" type="time" value="${esc(t)}">
      <div style="font-size:12px;color:var(--text-light);margin-top:6px">建议设置 22:00~24:00 之间，00:00 之后视为前一晚，不判定为早睡</div>
    </div>
    <button class="btn btn-block" onclick="saveSleepTarget()">保存</button>
  `);
}
function saveSleepTarget() {
  const t = $('#sleepTargetIn').value;
  if (!t) return alert('请选择目标时间');
  Store.setSleepTarget(t);
  closeModal();
  render();
}
function sleepCheckNow() { sleepCheckNowAt(Store.getHomeDate() || sleepDateForNow()); }
function sleepCheckNowAt(dateStr) {
  const target = Store.getSleepTarget();
  const time = nowHHMM();
  const achieved = isEarlySleep(target, time);
  const old = Store.getSleepBy(dateStr) || {};
  Store.setSleepOne({
    id: old.id || uid(),
    date: dateStr, time,
    wake: old.wake || '',
    target, achieved
  });
  if (achieved) toast(`🌙 ${D.fmtShort(dateStr)} 早睡达标啦！晚安～`);
  else toast(`💤 ${D.fmtShort(dateStr)} 入睡时间已记录，下次早点睡哦`);
  render();
}
function sleepWakeNow() { sleepWakeNowAt(Store.getHomeDate() || D.today()); }
function sleepWakeNowAt(dateStr) {
  const time = nowHHMM();
  const old = Store.getSleepBy(dateStr) || {};
  if (!old.time && !old.wake) old.time = time;
  const duration = sleepDurationHours(old.time, time);
  Store.setSleepOne({
    id: old.id || uid(),
    date: dateStr, time: old.time || time, wake: time,
    target: old.target || Store.getSleepTarget(),
    achieved: old.achieved !== undefined ? old.achieved : isEarlySleep(Store.getSleepTarget(), old.time || time),
    duration
  });
  toast(`☀️ ${D.fmtShort(dateStr)} 起床啦！本次睡眠 ` + fmtDuration(duration));
  render();
}
function sleepCheckCustom() { sleepCheckCustomAt(Store.getHomeDate() || sleepDateForNow()); }
function sleepCheckCustomAt(dateStr) {
  const target = Store.getSleepTarget();
  const defDate = dateStr;
  const defTime = nowHHMM();
  const old = Store.getSleepBy(dateStr) || {};
  openModal(`
    <div class="modal-head"><h3>🌙 睡眠记录</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="field"><label>日期（归属哪天的睡眠）</label>
      <input class="input" id="sleepDateIn" type="date" value="${old.date || defDate}">
      <div style="font-size:12px;color:var(--text-light);margin-top:4px">凌晨自动归到前一天</div>
    </div>
    <div class="field"><label>入睡时间（就寝）</label>
      <input class="input" id="sleepTimeIn" type="time" value="${old.time || defTime}">
    </div>
    <div class="field"><label>起床时间（可选，填了算时长）</label>
      <input class="input" id="sleepWakeIn" type="time" value="${old.wake || ''}">
    </div>
    <div style="padding:10px 12px;background:var(--pink-soft);border-radius:8px;margin-bottom:12px">
      🎯 目标 <b>${esc(target)}</b> · 判定：<b id="sleepJudge">…</b><br>
      💤 睡眠时长：<b id="sleepDur">--</b>
    </div>
    <button class="btn btn-block" onclick="saveSleepCustom()">保存</button>
  `);
  const judge = () => {
    const t = $('#sleepTimeIn').value;
    const w = $('#sleepWakeIn').value;
    if (!t) { $('#sleepJudge').textContent = '请选择入睡'; $('#sleepDur').textContent = '--'; return; }
    $('#sleepJudge').innerHTML = isEarlySleep(target, t)
      ? '<span style="color:var(--green)">✓ 早睡达标</span>'
      : '<span style="color:var(--red)">✗ 晚睡</span>';
    if (w) {
      const d = sleepDurationHours(t, w);
      $('#sleepDur').innerHTML = '<span style="color:var(--pink)">' + fmtDuration(d) + '</span>';
    } else {
      $('#sleepDur').textContent = '未填起床';
    }
  };
  setTimeout(() => {
    judge();
    $('#sleepTimeIn').addEventListener('change', judge);
    $('#sleepWakeIn').addEventListener('change', judge);
  }, 50);
}
function saveSleepCustom() {
  const date = $('#sleepDateIn').value;
  const time = $('#sleepTimeIn').value;
  const wake = $('#sleepWakeIn').value;
  if (!date || !time) return alert('请选择日期和入睡时间');
  const target = Store.getSleepTarget();
  const achieved = isEarlySleep(target, time);
  const duration = wake ? sleepDurationHours(time, wake) : 0;
  Store.setSleepOne({ id: uid(), date, time, wake, target, achieved, duration });
  closeModal();
  toast(achieved ? '🌙 早睡达标！' : '💤 已记录，下次加油');
  render();
}
function sleepDelete(date) {
  if (!confirm('删除这一天的早睡记录？')) return;
  const list = Store.getSleepList().filter(s => s.date !== date);
  Store.setSleepList(list);
  render();
}
// 轻量 Toast
function toast(msg) {
  let el = document.getElementById('toastBox');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toastBox';
    document.body.appendChild(el);
  }
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  el.appendChild(t);
  setTimeout(() => { t.classList.add('toast-out'); setTimeout(() => t.remove(), 300); }, 1800);
}

// 卡路里
function addCalorie() {
  openModal(`
    <div class="modal-head"><h3>记录卡路里</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="field"><label>名称</label><input class="input" id="calName" placeholder="如 米饭/跑步"></div>
    <div class="field"><label>类型</label>
      <select class="select" id="calType"><option value="in">摄入(吃)</option><option value="out">消耗(运动)</option></select>
    </div>
    <div class="field"><label>卡路里数值</label><input class="input" id="calVal" type="number" placeholder="如 200"></div>
    <button class="btn btn-block" onclick="saveCalorie()">保存</button>
  `);
}
function saveCalorie() {
  const name = $('#calName').value.trim();
  const type = $('#calType').value;
  const cal = Number($('#calVal').value);
  if (!name || !cal) return;
  const today = D.today();
  const day = Store.getDay(today);
  day.calories = day.calories || { records: [] };
  day.calories.records = day.calories.records || [];
  day.calories.records.push({ id: uid(), name, type, cal });
  Store.setDay(today, day);
  closeModal();
  render();
}
function delCalorie(id) {
  const today = D.today();
  const day = Store.getDay(today);
  day.calories.records = (day.calories.records || []).filter(r => r.id !== id);
  Store.setDay(today, day);
  render();
}

/* ========= 计划页 ========= */
function renderPlan() {
  const sub = subTab.plan || 'daily';
  let tabs = `<div class="sub-tabs">
    <button class="sub-tab ${sub === 'daily' ? 'active' : ''}" onclick="setSubTab('plan','daily')">今日代办</button>
    <button class="sub-tab ${sub === 'weekly' ? 'active' : ''}" onclick="setSubTab('plan','weekly')">每周代办</button>
    <button class="sub-tab ${sub === 'monthly' ? 'active' : ''}" onclick="setSubTab('plan','monthly')">每月计划</button>
    <button class="sub-tab ${sub === 'calendar' ? 'active' : ''}" onclick="setSubTab('plan','calendar')">🗓️ 月历</button>
  </div>`;
  let body = '';
  if (sub === 'daily') {
    const cur = Store.getPlanDailyDate();
    const isToday = cur === D.today();
    const day = Store.getDay(cur);
    const todos = day.todos || [];
    body = `<div class="card">
      <div class="plan-nav">
        <button class="cal-nav" onclick="planDailyMove(-1)">‹</button>
        <div class="plan-nav-mid">
          <div class="cal-title">📝 ${D.fmt(cur)}</div>
          <input type="date" class="plan-date-input" value="${cur}" onchange="planDailySet(this.value)">
        </div>
        <button class="cal-nav" onclick="planDailyMove(1)">›</button>
      </div>
      ${!isToday ? `<button class="btn btn-ghost btn-sm" style="margin:6px 0 10px" onclick="planDailyGoToday()">回到今天</button>` : ''}
      <div class="card-title" style="padding-top:0"><span class="title-left">代办列表</span><button class="btn btn-ghost btn-sm" onclick="addTodo('daily')">+添加</button></div>`;
    if (!todos.length) body += `<div class="empty"><span class="emoji">📋</span>暂无代办</div>`;
    else todos.forEach(t => {
      body += `<div class="todo-item ${t.done ? 'done' : ''}">
        <div class="checkbox" onclick="toggleTodo('${t.id}','${cur}')">${t.done ? '✓' : ''}</div>
        <div class="todo-text" onclick="toggleTodo('${t.id}','${cur}')">${esc(t.text)}</div>
        <button class="del-btn" onclick="delTodo('${t.id}','${cur}')">×</button></div>`;
    });
    body += `</div>`;
  } else if (sub === 'weekly') {
    const wk = Store.getPlanWeekKey();
    const weekDates = getWeekDates(wk);
    const todayWk = D.weekKey(D.today());
    const isCurWeek = wk === todayWk;
    const w = Store.getWeeklyByWeek(wk);
    const done = w.filter(x => x.done).length;
    const rangeLabel = `${D.fmtShort(weekDates[0].date)} ~ ${D.fmtShort(weekDates[6].date)}`;
    body = `<div class="card">
      <div class="plan-nav">
        <button class="cal-nav" onclick="planWeekMove(-1)">‹</button>
        <div class="plan-nav-mid">
          <div class="cal-title">📅 每周代办</div>
          <div style="font-size:13px;color:var(--text-light);margin-top:2px">${rangeLabel}</div>
        </div>
        <button class="cal-nav" onclick="planWeekMove(1)">›</button>
      </div>
      ${!isCurWeek ? `<button class="btn btn-ghost btn-sm" style="margin:6px 0 10px" onclick="planWeekGoToday()">回到本周</button>` : ''}
      <div class="stat-row"><div class="stat-box"><div class="num">${done}</div><div class="label">已完成</div></div><div class="stat-box"><div class="num">${w.length - done}</div><div class="label">待完成</div></div></div>
      <div class="card-title" style="padding-top:0"><span class="title-left">本周代办</span><button class="btn btn-ghost btn-sm" onclick="addTodo('weekly')">+添加</button></div>`;
    if (!w.length) body += `<div class="empty"><span class="emoji">📅</span>暂无每周代办</div>`;
    else w.forEach(t => {
      body += `<div class="todo-item ${t.done ? 'done' : ''}">
        <div class="checkbox" onclick="toggleWeekly('${t.id}')">${t.done ? '✓' : ''}</div>
        <div class="todo-text" onclick="toggleWeekly('${t.id}')">${esc(t.text)}</div>
        <button class="del-btn" onclick="delWeekly('${t.id}')">×</button></div>`;
    });
    body += `</div>`;
  } else if (sub === 'monthly') {
    const mk = Store.getPlanMonthKey();
    const [y, m] = mk.split('-').map(Number);
    const curMk = D.monthKey(D.today());
    const isCurMonth = mk === curMk;
    const list = Store.getMonthlyByMonth(mk);
    const done = list.filter(x => x.done).length;
    body = `<div class="card">
      <div class="plan-nav">
        <button class="cal-nav" onclick="planMonthMove(-1)">‹</button>
        <div class="plan-nav-mid">
          <div class="cal-title">🗓️ ${y}年${m}月计划</div>
        </div>
        <button class="cal-nav" onclick="planMonthMove(1)">›</button>
      </div>
      ${!isCurMonth ? `<button class="btn btn-ghost btn-sm" style="margin:6px 0 10px" onclick="planMonthGoToday()">回到本月</button>` : ''}
      <div class="stat-row"><div class="stat-box"><div class="num">${done}</div><div class="label">已完成</div></div><div class="stat-box"><div class="num">${list.length - done}</div><div class="label">待完成</div></div></div>
      <div class="card-title" style="padding-top:0"><span class="title-left">本月计划</span><button class="btn btn-ghost btn-sm" onclick="addTodo('monthly')">+添加</button></div>`;
    if (!list.length) body += `<div class="empty"><span class="emoji">🗓️</span>暂无每月计划</div>`;
    else list.forEach(t => {
      body += `<div class="todo-item ${t.done ? 'done' : ''}">
        <div class="checkbox" onclick="toggleMonthly('${t.id}')">${t.done ? '✓' : ''}</div>
        <div class="todo-text" onclick="toggleMonthly('${t.id}')">${esc(t.text)}</div>
        <button class="del-btn" onclick="delMonthly('${t.id}')">×</button></div>`;
    });
    body += `</div>`;
  } else if (sub === 'calendar') {
    body = renderCalendar();
  }
  return tabs + body;
}

// 计划页导航
function planDailyMove(delta) {
  const cur = Store.getPlanDailyDate();
  Store.setPlanDailyDate(D.offsetFrom(cur, delta));
  render();
}
function planDailySet(dateStr) {
  if (dateStr) { Store.setPlanDailyDate(dateStr); render(); }
}
function planDailyGoToday() { Store.setPlanDailyDate(D.today()); render(); }
// 首页日期导航（补打卡）
function homeMove(delta) {
  const cur = Store.getHomeDate() || D.today();
  Store.setHomeDate(D.offsetFrom(cur, delta));
  render();
}
function homeSet(dateStr) {
  if (!dateStr) return;
  Store.setHomeDate(dateStr);
  render();
}
function homeGoToday() {
  Store.setHomeDate(D.today());
  render();
}
function planWeekMove(delta) {
  const wk = Store.getPlanWeekKey();
  // 从周一偏移 delta*7 天得到新周一
  const newWk = D.offsetFrom(wk, delta * 7);
  Store.setPlanWeekKey(D.weekKey(newWk));
  render();
}
function planWeekGoToday() { Store.setPlanWeekKey(D.weekKey(D.today())); render(); }
function planMonthMove(delta) {
  const mk = Store.getPlanMonthKey();
  Store.setPlanMonthKey(D.monthOffset(mk, delta));
  render();
}
function planMonthGoToday() { Store.setPlanMonthKey(D.monthKey(D.today())); render(); }

/* ========= 月历视图 ========= */
let calYM = null; // {y, m} 当前查看的月份
function renderCalendar() {
  const now = new Date();
  if (!calYM) calYM = { y: now.getFullYear(), m: now.getMonth() };
  const { y, m } = calYM;
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  const startWeekday = first.getDay(); // 0=周日
  const daysInMonth = last.getDate();
  const todayStr = D.today();
  const todayDate = new Date();
  const isCurMonth = y === todayDate.getFullYear() && m === todayDate.getMonth();

  // 统计本月有记录的天数
  const days = DB.get('days', {});
  let recordedCount = 0;
  let noteCount = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dd = days[ds];
    if (dd && ((dd.notes && dd.notes.length) || (dd.todos && dd.todos.length) || (dd.routine && Object.values(dd.routine).some(Boolean)))) {
      recordedCount++;
      if (dd.notes) noteCount += dd.notes.length;
    }
  }

  let h = `<div class="card">
    <div class="cal-head">
      <button class="cal-nav" onclick="calMove(-1)">‹</button>
      <div class="cal-title">${y}年${m + 1}月${isCurMonth ? '<span class="tag tag-green" style="margin-left:6px">本月</span>' : ''}</div>
      <button class="cal-nav" onclick="calMove(1)">›</button>
    </div>
    <div class="stat-row">
      <div class="stat-box"><div class="num">${recordedCount}</div><div class="label">有记录天数</div></div>
      <div class="stat-box"><div class="num">${noteCount}</div><div class="label">日记条数</div></div>
    </div>
    ${!isCurMonth ? `<button class="btn btn-ghost btn-sm" onclick="calGoToday()" style="margin-bottom:8px">回到今天</button>` : ''}
    <div class="cal-grid">
      <div class="cal-wk">日</div><div class="cal-wk">一</div><div class="cal-wk">二</div><div class="cal-wk">三</div><div class="cal-wk">四</div><div class="cal-wk">五</div><div class="cal-wk">六</div>`;
  // 前置空白
  for (let i = 0; i < startWeekday; i++) h += `<div class="cal-cell empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dd = days[ds];
    const notes = (dd && dd.notes) || [];
    const todos = (dd && dd.todos) || [];
    const routineMap = (dd && dd.routine) || {};
    const routineDoneCnt = Object.values(routineMap).filter(Boolean).length;
    const hasRecord = notes.length > 0 || todos.length > 0 || routineDoneCnt > 0;
    const isToday = ds === todayStr;
    const preview = notes[0] ? esc(notes[0].text) : (todos[0] ? esc(todos[0].text) : '');
    h += `<div class="cal-cell ${isToday ? 'today' : ''} ${hasRecord ? 'has-rec' : ''}" onclick="openDay('${ds}')">
      <div class="cal-date">${d}</div>
      ${preview ? `<div class="cal-preview">${preview.length > 20 ? preview.slice(0, 20) + '…' : preview}</div>` : ''}
      ${notes.length > 1 ? `<div class="cal-count">+${notes.length - 1}</div>` : ''}
      ${todos.length && !notes.length ? `<div class="cal-count todo">代办${todos.length}</div>` : ''}
    </div>`;
  }
  h += `</div></div>`;
  // 当月所有记录列表（一目了然）
  const monthList = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dd = days[ds];
    if (dd && dd.notes && dd.notes.length) {
      dd.notes.forEach(n => monthList.push({ ds, d, ...n }));
    }
  }
  h += `<div class="card"><div class="card-title"><span class="title-left">📜 ${m + 1}月日记一览</span></div>`;
  if (!monthList.length) h += `<div class="empty"><span class="emoji">📜</span>本月还没有日记，点格子记录每天的小事吧</div>`;
  else monthList.slice().reverse().forEach(n => {
    h += `<div class="list-item" onclick="openDay('${n.ds}')">
      <div class="cal-day-badge">${n.d}</div>
      <div class="item-main"><div class="item-title">${esc(n.text)}</div><div class="item-sub">${D.fmt(n.ds)} ${n.time ? '· ' + esc(n.time) : ''}</div></div>
      <button class="del-btn" onclick="event.stopPropagation();delDayNote('${n.ds}','${n.id}')">×</button>
    </div>`;
  });
  h += `</div>`;
  return h;
}
function calMove(delta) {
  calYM.m += delta;
  if (calYM.m < 0) { calYM.m = 11; calYM.y--; }
  else if (calYM.m > 11) { calYM.m = 0; calYM.y++; }
  render();
}
function calGoToday() {
  const d = new Date();
  calYM = { y: d.getFullYear(), m: d.getMonth() };
  render();
}
function openDay(dateStr) {
  const day = Store.getDay(dateStr);
  const notes = day.notes || [];
  const todos = day.todos || [];
  const medList = Store.getMedList();
  const meds = day.meds || {};
  const wd = dateWd(dateStr);
  const todaysMeds = medList.filter(m => medDueOn(m, wd));
  const calRecords = day.calories?.records || [];
  let h = `<div class="modal-head"><h3>${D.fmt(dateStr)}</h3><button class="modal-close" onclick="closeModal();render()">×</button></div>`;
  // 日记输入
  h += `<div class="field"><label>写下今天干了什么</label>
    <div class="row"><input class="input" id="noteIn" placeholder="如 带娃逛公园 / 看完了一本书" onkeydown="if(event.key==='Enter')addDayNote('${dateStr}')">
    <button class="btn btn-sm" onclick="addDayNote('${dateStr}')">+</button></div></div>`;
  h += `<div id="dayNoteList">`;
  if (!notes.length) h += `<div class="empty" style="padding:14px 0"><span class="emoji">📝</span>这一天还没有日记</div>`;
  else notes.slice().reverse().forEach(n => {
    h += `<div class="todo-item"><div class="checkbox" style="border-color:var(--pink);background:var(--pink-soft);color:var(--pink)">●</div>
      <div class="todo-text">${esc(n.text)}<div class="item-sub" style="margin-top:2px">${n.time || ''}</div></div>
      <button class="del-btn" onclick="delDayNote('${dateStr}','${n.id}')">×</button></div>`;
  });
  h += `</div>`;
  // 每日要完成计划（例行）按周几筛选
  const routine = Store.getRoutine();
  const routineMap = day.routine || {};
  const todaysRoutine = routine.filter(r => routineDueOn(r, wd));
  const restRoutine = routine.filter(r => !routineDueOn(r, wd));
  const routineDone = todaysRoutine.filter(r => routineMap[r.id]).length;
  if (routine.length) {
    h += `<div class="section-head">⭐ 每日计划 ${routineDone}/${todaysRoutine.length}</div><div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">`;
    todaysRoutine.forEach(r => {
      h += `<span class="tag ${routineMap[r.id] ? 'tag-green' : ''}" style="cursor:pointer" onclick="toggleRoutineAt('${r.id}','${dateStr}')">${esc(r.text)}${routineMap[r.id] ? '✓' : ''}</span>`;
    });
    h += `</div>`;
    if (restRoutine.length) {
      h += `<div style="font-size:12px;color:var(--text-light);margin-bottom:4px">💤 今日休息（${restRoutine.length} 项）</div>`;
      h += `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;opacity:.55">`;
      restRoutine.forEach(r => {
        h += `<span class="tag">${esc(r.text)}${routineMap[r.id] ? '✓' : ''}</span>`;
      });
      h += `</div>`;
    }
  }
  // 当日代办
  if (todos.length) {
    h += `<div class="section-head">📝 代办</div>`;
    todos.forEach(t => {
      h += `<div class="todo-item ${t.done ? 'done' : ''}" style="padding:6px 0">
        <div class="checkbox">${t.done ? '✓' : ''}</div>
        <div class="todo-text">${esc(t.text)}</div></div>`;
    });
  }
  // 用药打卡
  const done = (m) => !!(meds[m.id] || meds[m.name]);
  const medDone = todaysMeds.filter(done).length;
  if (todaysMeds.length) {
    h += `<div class="section-head">💊 用药 ${medDone}/${todaysMeds.length}</div><div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">`;
    todaysMeds.forEach(m => {
      h += `<span class="tag ${done(m) ? 'tag-green' : ''}">${escapeHtml(m.name)}${done(m) ? '✓' : ''}</span>`;
    });
    h += `</div>`;
  }
  // 今日不用吃的药（灰字显示也一起给用户参考）
  const restMeds = medList.filter(m => !medDueOn(m, wd));
  if (restMeds.length) {
    h += `<div class="section-head" style="color:var(--text-light);font-size:12px">💤 今日休息（${restMeds.length} 种）</div><div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">`;
    restMeds.forEach(m => {
      h += `<span class="tag" style="opacity:.55">${escapeHtml(m.name)}${done(m) ? '✓' : ''}</span>`;
    });
    h += `</div>`;
  }
  // 卡路里
  if (calRecords.length) {
    const calIn = calRecords.filter(r => r.type === 'in').reduce((s, r) => s + Number(r.cal), 0);
    const calOut = calRecords.filter(r => r.type === 'out').reduce((s, r) => s + Number(r.cal), 0);
    h += `<div class="section-head">🔥 卡路里 摄入${calIn}/消耗${calOut}</div>`;
    calRecords.forEach(r => {
      h += `<div class="list-item" style="padding:6px 0"><div class="item-main"><div class="item-title" style="font-size:13px">${esc(r.name)}</div></div><div class="item-right ${r.type === 'in' ? 'profit-neg' : 'profit-pos'}" style="font-size:12px">${r.type === 'in' ? '+' : '-'}${r.cal}</div></div>`;
    });
  }
  openModal(h);
  setTimeout(() => $('#noteIn')?.focus(), 100);
}
function addDayNote(dateStr) {
  const text = $('#noteIn').value.trim();
  if (!text) return;
  const day = Store.getDay(dateStr);
  day.notes = day.notes || [];
  day.notes.push({ id: uid(), text, time: D.now().slice(11) });
  Store.setDay(dateStr, day);
  openDay(dateStr);
}
function delDayNote(dateStr, id) {
  const day = Store.getDay(dateStr);
  day.notes = (day.notes || []).filter(n => n.id !== id);
  Store.setDay(dateStr, day);
  // 如果是弹窗里删除，刷新弹窗；如果是月历一览删除，刷新整页
  if ($('#dayNoteList')) openDay(dateStr);
  else render();
}
// ---------- 周总结 ----------
// 周一: 0=周日 1=周一 ... 6=周六
// 取得本周(以周一为起始)的 7 天日期数组 [{date, wd}]
function getWeekDates(refDate) {
  const ref = refDate ? new Date(refDate.replace(/-/g, '/')) : new Date();
  const cur = new Date(ref);
  const wd = cur.getDay();
  // 周日=0 转为 6（让周一为 0）
  const offsetFromMon = (wd === 0 ? 6 : wd - 1);
  const monday = new Date(cur);
  monday.setDate(cur.getDate() - offsetFromMon);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    dates.push({ date: ds, wd: ['一', '二', '三', '四', '五', '六', '日'][i] });
  }
  return dates;
}
function renderWeekSummary() {
  const today = new Date();
  const wd = today.getDay(); // 0=周日
  const todayDS = D.today();
  const weekDates = getWeekDates(todayDS);
  // 是否周一：显示上周总结
  // 是否周日：显示本周已完成度
  // 其它天：显示本周进度
  const isMonday = wd === 1;
  const isSunday = wd === 0;
  // 周一 = 总结上周(7天到昨天为止的完成度)
  let summaryDates;
  if (isMonday) {
    // 上周一到上周日
    summaryDates = getWeekDates(D.offset(-1)).map(d => d.date);
  } else {
    // 本周一到今天
    const idx = (wd === 0 ? 6 : wd - 1); // 今天在本周的索引(周一为0)
    summaryDates = weekDates.slice(0, idx + 1).map(d => d.date);
  }
  // 计算这几天的各项数据
  const days = summaryDates.map(ds => ({ ds, ...dailyStats(ds) }));
  const totalDone = days.reduce((s, d) => s + d.tasksDone, 0);
  const totalTasks = days.reduce((s, d) => s + d.tasksTotal, 0);
  const overallPct = totalTasks ? Math.round(totalDone / totalTasks * 100) : 0;
  // 每天完成度排行
  const ranked = days.map((d, i) => ({
    ds: d.ds,
    wd: weekDates[i]?.wd || ['一','二','三','四','五','六','日'][i],
    pct: d.tasksTotal ? Math.round(d.tasksDone / d.tasksTotal * 100) : 0,
    tasksDone: d.tasksDone, tasksTotal: d.tasksTotal
  })).sort((a, b) => b.pct - a.pct);
  // 早睡统计
  const sleepList = Store.getSleepList();
  const sleepMap = {}; sleepList.forEach(s => sleepMap[s.date] = s);
  const sleepDays = summaryDates.map(ds => sleepMap[ds]).filter(Boolean);
  const earlyDays = sleepDays.filter(s => s.achieved).length;
  const totalDur = sleepDays.reduce((s, r) => s + (r.duration || 0), 0);
  const avgDur = sleepDays.length ? totalDur / sleepDays.length : 0;
  // 月历日记
  const allDays = DB.get('days', {});
  let noteCnt = 0;
  summaryDates.forEach(ds => {
    const dd = allDays[ds];
    if (dd && dd.notes) noteCnt += dd.notes.length;
  });

  const titleText = isMonday
    ? '📋 上周总结'
    : isSunday
    ? '📋 本周总结（今日截止）'
    : '📋 本周进度';
  const subText = isMonday
    ? '上周完整 7 天数据'
    : `本周已完成 ${summaryDates.length} 天`;

  // 找最高/最低日
  const bestDay = ranked[0];
  const worstDay = ranked[ranked.length - 1];

  // 综合评语
  let praise = '';
  if (overallPct >= 90) praise = '太棒了，近乎完美一周！🌸';
  else if (overallPct >= 75) praise = '坚持得很不错，继续保持 💪';
  else if (overallPct >= 50) praise = '已过半，下周可以再加把劲～';
  else praise = '这周有些松懈，下周调整一下 💗';

  return `<div class="card week-summary-card">
    <div class="card-title">
      <span class="title-left">${titleText}</span>
      <span style="font-size:12px;color:var(--text-light)">${subText}</span>
    </div>
    <div class="stat-row">
      <div class="stat-box"><div class="num" style="color:var(--pink)">${overallPct}%</div><div class="label">总完成度</div></div>
      <div class="stat-box"><div class="num" style="color:var(--green)">${earlyDays}/${sleepDays.length || '-'}</div><div class="label">🌙 早睡达标</div></div>
      <div class="stat-box"><div class="num" style="color:#7a5cff">${fmtDuration(avgDur)}</div><div class="label">💤 平均睡眠</div></div>
      <div class="stat-box"><div class="num">${noteCnt}</div><div class="label">日记条数</div></div>
    </div>
    <div class="week-praise">${praise}</div>
    ${bestDay ? `<div class="week-best"><span class="tag tag-green">🏆 最佳 ${bestDay.wd}</span> ${bestDay.pct}% (${bestDay.tasksDone}/${bestDay.tasksTotal})</div>` : ''}
    ${worstDay && worstDay !== bestDay ? `<div class="week-worst"><span class="tag tag-orange">💤 待加强 ${worstDay.wd}</span> ${worstDay.pct}%</div>` : ''}
    <div class="week-rank-list">
      ${ranked.map(r => `
        <div class="wr-item">
          <span class="wr-wd">周${r.wd}</span>
          <div class="wr-bar-wrap"><div class="wr-bar" style="width:${r.pct}%;background:${r.pct>=90?'var(--green)':r.pct>=60?'var(--pink)':'var(--orange)'}"></div></div>
          <span class="wr-pct">${r.pct}%</span>
        </div>
      `).join('')}
    </div>
  </div>`;
}

// 切换图表范围 7/14/30
function toggleChartRange(btn) {
  chartRange = chartRange === 7 ? 14 : chartRange === 14 ? 30 : 7;
  render();
}

// ---------- 打卡提醒 ----------
// 1. 首页打开时，如果还有未完成的打卡项，顶部弹出提醒条
// 2. 请求系统通知权限
// 3. 定时检查：中午12点和晚上20点，若还有未完成项则推送通知
// 4. 允许自定义提醒时间（存在 DB.notifyTimes 数组，默认[12,20]）

Store._nt = Store._nt || {};
Store.getNotifyTimes = () => DB.get('notifyTimes', [9, 12, 20]);
Store.setNotifyTimes = (v) => DB.set('notifyTimes', v);
Store.getNotifyEnabled = () => DB.get('notifyEnabled', true);
Store.setNotifyEnabled = (v) => DB.set('notifyEnabled', v);

function askNotifyPermission() {
  if (!('Notification' in window)) return Promise.resolve('unsupported');
  if (Notification.permission === 'granted') return Promise.resolve('granted');
  return Notification.requestPermission();
}

// 发送系统通知
function sendNotify(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try { new Notification(title, { body, icon: 'icon-192.png', badge: 'icon-192.png', tag: 'tianjiang-' + Date.now() }); } catch (e) {}
}

// 检查今日未完成项，返回 {summary, tasks:[{type,text,count,done,total}]}
function pendingSummary() {
  const today = D.today();
  const day = Store.getDay(today);
  const medList = Store.getMedList();
  const routine = Store.getRoutine();
  const meds = day.meds || {};
  const rMap = day.routine || {};
  const todos = day.todos || [];
  const tasks = [];
  const wd = dateWd(today);
  const todaysMeds = medList.filter(m => medDueOn(m, wd));
  const done = (m) => !!(meds[m.id] || meds[m.name]);
  const medDone = todaysMeds.filter(done).length;
  if (todaysMeds.length && medDone < todaysMeds.length) {
    tasks.push({ type: '用药', text: `还剩 ${todaysMeds.length - medDone} 项`, count: todaysMeds.length - medDone });
  }
  const rDone = routine.filter(r => rMap[r.id]).length;
  if (routine.length && rDone < routine.length) {
    const missed = routine.filter(r => !rMap[r.id]).slice(0, 3).map(r => r.text).join('、');
    tasks.push({ type: '每日计划', text: missed + (routine.length - rDone > 3 ? ` 等${routine.length - rDone}项` : ''), count: routine.length - rDone });
  }
  const tUndone = todos.filter(t => !t.done);
  if (tUndone.length) {
    tasks.push({ type: '代办', text: tUndone.slice(0, 3).map(t => t.text).join('、') + (tUndone.length > 3 ? ` 等${tUndone.length}项` : ''), count: tUndone.length });
  }
  return tasks;
}

// 每日待办提醒条（页面顶部）——首页打开时渲染
function reminderBanner() {
  // 如果今天已经点过"我知道了"，不弹
  if (reminderShown === D.today()) return '';
  const tasks = pendingSummary();
  if (tasks.length === 0) return '';
  const total = tasks.reduce((s, t) => s + t.count, 0);
  const text = tasks.map(t => `<span class="tag ${t.count>2?'tag-orange':''}">${t.type}${t.count}</span>`).join(' ');
  return `<div class="remind-banner" id="remindBanner">
    <div class="remind-head">
      <span class="remind-icon">🔔</span>
      <div class="remind-txt">
        <b>今天还有 ${total} 项待打卡</b>
        <div style="margin-top:2px">${text}</div>
      </div>
      <button class="btn btn-sm" onclick="goCheck()">去打卡</button>
      <button class="modal-close" style="font-size:18px;padding:0 4px" onclick="dismissReminder()">×</button>
    </div>
  </div>`;
}
function dismissReminder() {
  reminderShown = D.today();
  render();
}
function goCheck() {
  // 滚动到今日要完成计划卡片
  dismissReminder();
  setTimeout(() => {
    const el = Array.from(document.querySelectorAll('.card-title .title-left')).find(c => c.textContent.includes('每日要完成计划'));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 50);
}

// 定时检查：如果当前小时是提醒点且用户启用了提醒，检查并通知
function startNotifyTimer() {
  if (notifyTimer) clearInterval(notifyTimer);
  const check = () => {
    if (!Store.getNotifyEnabled()) return;
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    // 只有在每个提醒小时的前 30 分钟内才会触发一次（避免重复）
    const times = Store.getNotifyTimes();
    if (!times.includes(h) || m > 30) return;
    const lastSent = DB.get('notifyLastSent', {});
    const key = D.today() + '-' + h;
    if (lastSent[key]) return;
    const tasks = pendingSummary();
    if (!tasks.length) return;
    const total = tasks.reduce((s, t) => s + t.count, 0);
    const summary = tasks.map(t => t.type + '剩' + t.count + '项').join('、');
    sendNotify('甜酱日常 · 别忘了打卡', `还有 ${total} 项：${summary}`);
    lastSent[key] = true;
    DB.set('notifyLastSent', lastSent);
  };
  // 页面加载时先检查一次
  setTimeout(check, 1000);
  notifyTimer = setInterval(check, 3 * 60 * 1000); // 每3分钟检查一次
}

// 打开设置提醒的弹窗
function openReminderSettings() {
  askNotifyPermission();
  const times = Store.getNotifyTimes();
  const on = Store.getNotifyEnabled();
  const options = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
  openModal(`
    <div class="modal-head"><h3>🔔 打卡提醒设置</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="field"><label>系统通知（未完成打卡会推送）</label>
      <select class="select" id="notifPerm">
        <option value="">${Notification.permission || 'default'}</option>
      </select>
      <button class="btn btn-ghost btn-sm" style="margin-top:6px" onclick="askNotifyPermission().then(()=>alert('权限状态：'+Notification.permission));document.querySelector('#notifPerm').value=Notification.permission;">请求授权</button>
    </div>
    <div class="field"><label><input type="checkbox" id="notifOn" ${on?'checked':''} style="width:auto;margin-right:6px">开启提醒</label></div>
    <div class="field"><label>提醒时间点（可多选）</label>
      <div style="display:flex;flex-wrap:wrap;gap:6px" id="timeChips">
        ${options.map(h => `<button type="button" class="sub-tab ${times.includes(h)?'active':''}" onclick="this.classList.toggle('active');this.classList.contains('active')?this.dataset.on='1':this.dataset.on='0'">${h<10?'0'+h:h}:00</button>`).join('')}
      </div>
    </div>
    <button class="btn btn-block" onclick="saveReminderSettings()">保存</button>
  `);
}
function saveReminderSettings() {
  const on = $('#notifOn').checked;
  const ch = Array.from(document.querySelectorAll('#timeChips .sub-tab.active')).map(el => Number(el.textContent.split(':')[0]));
  Store.setNotifyEnabled(on);
  Store.setNotifyTimes(ch);
  closeModal();
  // 开启后立即启动定时器
  if (on) startNotifyTimer();
  render();
}

function setSubTab(tab, s) { subTab[tab] = s; render(); }

// 在所有周中查找 weekly todo 所属的 weekKey
function _findWeeklyKeyById(id) {
  const cur = Store.getPlanWeekKey();
  const curList = Store.getWeeklyByWeek(cur);
  if (curList.find(t => t.id === id)) return cur;
  const all = Store.getWeeklyAll();
  for (const wk in all) if (all[wk].find(t => t.id === id)) return wk;
  return null;
}
function _findMonthlyKeyById(id) {
  const cur = Store.getPlanMonthKey();
  const curList = Store.getMonthlyByMonth(cur);
  if (curList.find(t => t.id === id)) return cur;
  const all = Store.getMonthlyAll();
  for (const mk in all) if (all[mk].find(t => t.id === id)) return mk;
  return null;
}

function toggleWeekly(id) {
  const wk = _findWeeklyKeyById(id);
  if (!wk) return;
  const w = Store.getWeeklyByWeek(wk);
  const t = w.find(x => x.id === id);
  if (t) { t.done = !t.done; Store.setWeeklyByWeek(wk, w); render(); }
}
function delWeekly(id) {
  const wk = _findWeeklyKeyById(id);
  if (!wk) return;
  const w = Store.getWeeklyByWeek(wk).filter(x => x.id !== id);
  Store.setWeeklyByWeek(wk, w); render();
}
function toggleMonthly(id) {
  const mk = _findMonthlyKeyById(id);
  if (!mk) return;
  const m = Store.getMonthlyByMonth(mk);
  const t = m.find(x => x.id === id);
  if (t) { t.done = !t.done; Store.setMonthlyByMonth(mk, m); render(); }
}
function delMonthly(id) {
  const mk = _findMonthlyKeyById(id);
  if (!mk) return;
  const m = Store.getMonthlyByMonth(mk).filter(x => x.id !== id);
  Store.setMonthlyByMonth(mk, m); render();
}

/* ========= 账本页 ========= */
function renderAccount() {
  const sub = subTab.account || 'expense';
  let tabs = `<div class="sub-tabs">
    <button class="sub-tab ${sub === 'expense' ? 'active' : ''}" onclick="setSubTab('account','expense')">💸 支出</button>
    <button class="sub-tab ${sub === 'income' ? 'active' : ''}" onclick="setSubTab('account','income')">💰 收入</button>
    <button class="sub-tab ${sub === 'reimburse' ? 'active' : ''}" onclick="setSubTab('account','reimburse')">🧾 待报销</button>
    <button class="sub-tab ${sub === 'trade' ? 'active' : ''}" onclick="setSubTab('account','trade')">📦 买卖</button>
    <button class="sub-tab ${sub === 'ledger' ? 'active' : ''}" onclick="setSubTab('account','ledger')">📚 账本</button>
  </div>`;
  let body = '';
  const accounts = Store.getAccounts();
  if (sub === 'expense') {
    const list = accounts.filter(a => a.type !== 'income' && !a.reimburse);
    const total = list.reduce((s, a) => s + Number(a.amount), 0);
    body = `<div class="card"><div class="card-title"><span class="title-left">💸 支出</span>
      <button class="btn btn-ghost btn-sm" onclick="ocrExpense()">📷 截图识别</button></div>
      <div class="stat-row"><div class="stat-box"><div class="num">¥${total.toFixed(0)}</div><div class="label">总支出</div></div><div class="stat-box"><div class="num">${list.length}</div><div class="label">笔数</div></div></div>`;
    if (!list.length) body += `<div class="empty"><span class="emoji">💸</span>还没有记录</div>`;
    else list.slice().reverse().forEach(a => {
      const led = ledgerName(a.ledger);
      body += `<div class="list-item">
        <div class="item-main"><div class="item-title">${esc(a.category)} · ${esc(a.note || '')}</div>
          <div class="item-sub">${D.fmt(a.date)} ${led ? '· ' + esc(led) : ''}</div></div>
        <div class="item-right profit-neg">-¥${a.amount}</div>
        ${a.img ? `<button class="btn btn-ghost btn-sm" onclick="viewImg('${a.id}','account')">🖼</button>` : ''}
        <button class="del-btn" onclick="delAccount('${a.id}')">×</button></div>`;
    });
    body += `</div>`;
  } else if (sub === 'income') {
    const list = accounts.filter(a => a.type === 'income');
    const total = list.reduce((s, a) => s + Number(a.amount), 0);
    body = `<div class="card"><div class="card-title"><span class="title-left">💰 收入</span></div>
      <div class="stat-row"><div class="stat-box"><div class="num profit-pos">¥${total.toFixed(0)}</div><div class="label">总收入</div></div><div class="stat-box"><div class="num">${list.length}</div><div class="label">笔数</div></div></div>`;
    if (!list.length) body += `<div class="empty"><span class="emoji">💰</span>还没有记录</div>`;
    else list.slice().reverse().forEach(a => {
      const led = ledgerName(a.ledger);
      body += `<div class="list-item">
        <div class="item-main"><div class="item-title">${esc(a.category)} · ${esc(a.note || '')}</div>
          <div class="item-sub">${D.fmt(a.date)} ${led ? '· ' + esc(led) : ''}</div></div>
        <div class="item-right profit-pos">+¥${a.amount}</div>
        <button class="del-btn" onclick="delAccount('${a.id}')">×</button></div>`;
    });
    body += `</div>`;
  } else if (sub === 'reimburse') {
    const list = accounts.filter(a => a.reimburse);
    const total = list.reduce((s, a) => s + Number(a.amount), 0);
    const claimed = list.filter(a => a.claimed).reduce((s, a) => s + Number(a.amount), 0);
    body = `<div class="card"><div class="card-title"><span class="title-left">🧾 待报销</span></div>
      <div class="stat-row"><div class="stat-box"><div class="num">¥${total.toFixed(0)}</div><div class="label">待报销</div></div><div class="stat-box"><div class="num">¥${claimed.toFixed(0)}</div><div class="label">已报销</div></div></div>`;
    if (!list.length) body += `<div class="empty"><span class="emoji">🧾</span>暂无待报销</div>`;
    else list.slice().reverse().forEach(a => {
      body += `<div class="list-item">
        <div class="item-main"><div class="item-title">${esc(a.category)} · ${esc(a.note || '')}</div><div class="item-sub">${D.fmt(a.date)} ${a.claimed ? '· 已报销' : ''}</div></div>
        <div class="item-right profit-neg">¥${a.amount}</div>
        ${a.claimed ? '' : `<button class="btn btn-ghost btn-sm" onclick="claimAccount('${a.id}')">已报</button>`}
        <button class="del-btn" onclick="delAccount('${a.id}')">×</button></div>`;
    });
    body += `</div>`;
  } else if (sub === 'trade') {
    const trades = Store.getTrades();
    const sold = trades.filter(t => t.sellPrice != null);
    const profit = sold.reduce((s, t) => s + (Number(t.sellPrice) - Number(t.buyPrice)), 0);
    const lossItems = sold.filter(t => Number(t.sellPrice) - Number(t.buyPrice) < 0);
    const lossCnt = lossItems.length;
    const lossAmt = lossItems.reduce((s, t) => s + Math.abs(Number(t.sellPrice) - Number(t.buyPrice)), 0);
    body = `<div class="card"><div class="card-title"><span class="title-left">📦 买卖差价</span></div>
      <div class="stat-row"><div class="stat-box"><div class="num ${profit >= 0 ? 'profit-pos' : 'profit-neg'}">¥${profit.toFixed(0)}</div><div class="label">总利润</div></div>
        <div class="stat-box"><div class="num profit-neg">¥${lossAmt.toFixed(0)}</div><div class="label">总亏损</div></div>
        <div class="stat-box"><div class="num">${lossCnt}</div><div class="label">亏本次数</div></div>
        <div class="stat-box"><div class="num">${sold.length}</div><div class="label">已售出</div></div></div>`;
    if (!trades.length) body += `<div class="empty"><span class="emoji">📦</span>还没有记录</div>`;
    else trades.slice().reverse().forEach(t => {
      const profit = t.sellPrice != null ? Number(t.sellPrice) - Number(t.buyPrice) : null;
      const isLoss = profit != null && profit < 0;
      body += `<div class="list-item">
        <div class="item-main"><div class="item-title">${esc(t.name)}</div>
          <div class="item-sub">买入¥${t.buyPrice}${t.sellPrice != null ? ' → 卖出¥' + t.sellPrice : ' · 未售出'}${isLoss ? ' · 亏本¥' + Math.abs(profit) : ''}</div></div>
        <div class="item-right ${profit == null ? '' : (profit >= 0 ? 'profit-pos' : 'profit-neg')}">${profit == null ? '-' : (profit >= 0 ? '+' : '') + '¥' + profit}</div>
        ${t.sellPrice == null ? `<button class="btn btn-ghost btn-sm" onclick="sellTrade('${t.id}')">售出</button>` : ''}
        <button class="del-btn" onclick="delTrade('${t.id}')">×</button></div>`;
    });
    body += `</div>`;
  } else {
    // 账本管理
    const ledgers = Store.getLedgers();
    const accounts = Store.getAccounts();
    const totalLed = ledgers.find(l => l.type === 'total');
    const subLeds = ledgers.filter(l => l.type === 'sub');
    let sumIn = accounts.filter(a => a.type === 'income').reduce((s, a) => s + Number(a.amount), 0);
    let sumOut = accounts.filter(a => a.type !== 'income').reduce((s, a) => s + Number(a.amount), 0);
    // 日/月/年统计（按交易日期）
    const today = D.today();
    const thisMonth = today.slice(0, 7);
    const thisYear = today.slice(0, 4);
    const sum = (arr, type) => arr.filter(a => type === 'in' ? a.type === 'income' : a.type !== 'income').reduce((s, a) => s + Number(a.amount), 0);
    const dayIn = sum(accounts.filter(a => a.date === today), 'in');
    const dayOut = sum(accounts.filter(a => a.date === today), 'out');
    const monthIn = sum(accounts.filter(a => a.date?.startsWith(thisMonth)), 'in');
    const monthOut = sum(accounts.filter(a => a.date?.startsWith(thisMonth)), 'out');
    const yearIn = sum(accounts.filter(a => a.date?.startsWith(thisYear)), 'in');
    const yearOut = sum(accounts.filter(a => a.date?.startsWith(thisYear)), 'out');
    // 历史查询
    const q = Store.getLedgerQuery();
    const qMonth = q.month || '';
    const qYear = q.year || '';
    const statByPrefix = (accs, prefix) => {
      const filt = accs.filter(a => a.date?.startsWith(prefix));
      return {
        in: sum(filt, 'in'),
        out: sum(filt, 'out'),
        bal: sum(filt, 'in') - sum(filt, 'out')
      };
    };
    const qmStat = qMonth ? statByPrefix(accounts, qMonth) : null;
    const qyStat = qYear ? statByPrefix(accounts, qYear) : null;
    const qmLedgerStat = (ledgerId) => {
      if (!qMonth) return null;
      const la = accounts.filter(a => !ledgerId || a.ledger === ledgerId);
      return statByPrefix(la, qMonth);
    };
    const qyLedgerStat = (ledgerId) => {
      if (!qYear) return null;
      const la = accounts.filter(a => !ledgerId || a.ledger === ledgerId);
      return statByPrefix(la, qYear);
    };
    // 构造年度选项（最早记录年份 ~ 今年）
    const allYears = new Set();
    allYears.add(thisYear);
    accounts.forEach(a => { if (a.date) allYears.add(a.date.slice(0, 4)); });
    const yearOptions = Array.from(allYears).sort().reverse();
    body = `<div class="card"><div class="card-title"><span class="title-left">📚 账本总览</span>
      <button class="btn btn-ghost btn-sm" onclick="addLedger()">+ 分账本</button></div>
      <div class="stat-row"><div class="stat-box"><div class="num profit-pos">¥${sumIn.toFixed(0)}</div><div class="label">累计收入</div></div>
        <div class="stat-box"><div class="num profit-neg">¥${sumOut.toFixed(0)}</div><div class="label">累计支出</div></div>
        <div class="stat-box"><div class="num">¥${(sumIn - sumOut).toFixed(0)}</div><div class="label">累计结余</div></div></div>
      <div class="section-title">📅 今日</div>
      <div class="stat-row"><div class="stat-box"><div class="num profit-pos">¥${dayIn.toFixed(0)}</div><div class="label">今日收入</div></div>
        <div class="stat-box"><div class="num profit-neg">¥${dayOut.toFixed(0)}</div><div class="label">今日支出</div></div>
        <div class="stat-box"><div class="num">¥${(dayIn - dayOut).toFixed(0)}</div><div class="label">今日结余</div></div></div>
      <div class="section-title">📆 本月</div>
      <div class="stat-row"><div class="stat-box"><div class="num profit-pos">¥${monthIn.toFixed(0)}</div><div class="label">本月收入</div></div>
        <div class="stat-box"><div class="num profit-neg">¥${monthOut.toFixed(0)}</div><div class="label">本月支出</div></div>
        <div class="stat-box"><div class="num">¥${(monthIn - monthOut).toFixed(0)}</div><div class="label">本月结余</div></div></div>
      <div class="section-title">🗓 今年</div>
      <div class="stat-row"><div class="stat-box"><div class="num profit-pos">¥${yearIn.toFixed(0)}</div><div class="label">今年收入</div></div>
        <div class="stat-box"><div class="num profit-neg">¥${yearOut.toFixed(0)}</div><div class="label">今年支出</div></div>
        <div class="stat-box"><div class="num">¥${(yearIn - yearOut).toFixed(0)}</div><div class="label">今年结余</div></div></div>
      <div class="section-title">📊 月度查询</div>
      <div class="query-row">
        <input class="input query-input" type="month" id="qMonth" value="${escapeAttr(qMonth)}" onchange="setQueryMonth(this.value)">
        <button class="btn btn-ghost btn-sm" onclick="setQueryMonth('')">清除</button>
      </div>
      ${qmStat ? `<div class="stat-row"><div class="stat-box"><div class="num profit-pos">¥${qmStat.in.toFixed(0)}</div><div class="label">月收入</div></div>
        <div class="stat-box"><div class="num profit-neg">¥${qmStat.out.toFixed(0)}</div><div class="label">月支出</div></div>
        <div class="stat-box"><div class="num">¥${qmStat.bal.toFixed(0)}</div><div class="label">月结余</div></div></div>` : `<div class="empty-sub">请选择月份查看该月收支明细</div>`}
      <div class="section-title">📊 年度查询</div>
      <div class="query-row">
        <select class="select query-input" id="qYear" onchange="setQueryYear(this.value)">
          <option value="">选择年份</option>
          ${yearOptions.map(y => `<option value="${y}" ${qYear === y ? 'selected' : ''}>${y}年</option>`).join('')}
        </select>
        <button class="btn btn-ghost btn-sm" onclick="setQueryYear('')">清除</button>
      </div>
      ${qyStat ? `<div class="stat-row"><div class="stat-box"><div class="num profit-pos">¥${qyStat.in.toFixed(0)}</div><div class="label">年收入</div></div>
        <div class="stat-box"><div class="num profit-neg">¥${qyStat.out.toFixed(0)}</div><div class="label">年支出</div></div>
        <div class="stat-box"><div class="num">¥${qyStat.bal.toFixed(0)}</div><div class="label">年结余</div></div></div>` : `<div class="empty-sub">请选择年份查看该年收支明细</div>`}
      <div class="section-title">🏦 分账本详情</div>`;
    // 总账本（带日历）
    const renderLedStats = (ledgerId) => {
      const la = accounts.filter(a => !ledgerId || a.ledger === ledgerId);
      const laIn = la.filter(a => a.type === 'income');
      const laOut = la.filter(a => a.type !== 'income');
      const lin = laIn.reduce((s,a)=>s+Number(a.amount),0);
      const lout = laOut.reduce((s,a)=>s+Number(a.amount),0);
      const din = laIn.filter(a => a.date === today).reduce((s,a)=>s+Number(a.amount),0);
      const dout = laOut.filter(a => a.date === today).reduce((s,a)=>s+Number(a.amount),0);
      const min = laIn.filter(a => a.date?.startsWith(thisMonth)).reduce((s,a)=>s+Number(a.amount),0);
      const mout = laOut.filter(a => a.date?.startsWith(thisMonth)).reduce((s,a)=>s+Number(a.amount),0);
      const yin = laIn.filter(a => a.date?.startsWith(thisYear)).reduce((s,a)=>s+Number(a.amount),0);
      const yout = laOut.filter(a => a.date?.startsWith(thisYear)).reduce((s,a)=>s+Number(a.amount),0);
      const qmLs = qmLedgerStat(ledgerId);
      const qyLs = qyLedgerStat(ledgerId);
      return `<div class="ledger-detail">
        <div class="stat-row small">
          <div class="stat-box tiny"><div class="num profit-pos">¥${din.toFixed(0)}</div><div class="label">今日收</div></div>
          <div class="stat-box tiny"><div class="num profit-neg">¥${dout.toFixed(0)}</div><div class="label">今日支</div></div>
          <div class="stat-box tiny"><div class="num">¥${(din-dout).toFixed(0)}</div><div class="label">今结</div></div>
        </div>
        <div class="stat-row small">
          <div class="stat-box tiny"><div class="num profit-pos">¥${min.toFixed(0)}</div><div class="label">本月收</div></div>
          <div class="stat-box tiny"><div class="num profit-neg">¥${mout.toFixed(0)}</div><div class="label">本月支</div></div>
          <div class="stat-box tiny"><div class="num">¥${(min-mout).toFixed(0)}</div><div class="label">月结</div></div>
        </div>
        <div class="stat-row small">
          <div class="stat-box tiny"><div class="num profit-pos">¥${yin.toFixed(0)}</div><div class="label">本年收</div></div>
          <div class="stat-box tiny"><div class="num profit-neg">¥${yout.toFixed(0)}</div><div class="label">本年支</div></div>
          <div class="stat-box tiny"><div class="num">¥${(yin-yout).toFixed(0)}</div><div class="label">年结</div></div>
        </div>
        ${qmLs ? `<div class="stat-row small">
          <div class="stat-box tiny"><div class="num profit-pos">¥${qmLs.in.toFixed(0)}</div><div class="label">${qMonth}收</div></div>
          <div class="stat-box tiny"><div class="num profit-neg">¥${qmLs.out.toFixed(0)}</div><div class="label">${qMonth}支</div></div>
          <div class="stat-box tiny"><div class="num">¥${qmLs.bal.toFixed(0)}</div><div class="label">该月结</div></div>
        </div>` : ''}
        ${qyLs ? `<div class="stat-row small">
          <div class="stat-box tiny"><div class="num profit-pos">¥${qyLs.in.toFixed(0)}</div><div class="label">${qYear}收</div></div>
          <div class="stat-box tiny"><div class="num profit-neg">¥${qyLs.out.toFixed(0)}</div><div class="label">${qYear}支</div></div>
          <div class="stat-box tiny"><div class="num">¥${qyLs.bal.toFixed(0)}</div><div class="label">该年结</div></div>
        </div>` : ''}
      </div>`;
    };
    // 总账本
    const totIn = accounts.filter(a => a.type === 'income' && (!a.ledger || a.ledger === 'total')).reduce((s, a) => s + Number(a.amount), 0);
    const totOut = accounts.filter(a => a.type !== 'income' && (!a.ledger || a.ledger === 'total')).reduce((s, a) => s + Number(a.amount), 0);
    body += `<div class="list-item ledger-item">
      <div class="item-main"><div class="item-title">🏦 ${esc(totalLed ? totalLed.name : '总账本')}</div>
        <div class="item-sub">累计 收¥${totIn.toFixed(0)} · 支¥${totOut.toFixed(0)} · 结¥${(totIn - totOut).toFixed(0)}</div></div></div>`;
    body += renderLedStats('total');
    // 分账本
    subLeds.forEach(l => {
      const lIn = accounts.filter(a => a.type === 'income' && a.ledger === l.id).reduce((s, a) => s + Number(a.amount), 0);
      const lOut = accounts.filter(a => a.type !== 'income' && a.ledger === l.id).reduce((s, a) => s + Number(a.amount), 0);
      const bal = lIn - lOut;
      body += `<div class="list-item ledger-item">
        <div class="item-main"><div class="item-title">📒 ${esc(l.name)}</div>
          <div class="item-sub">累计 收¥${lIn.toFixed(0)} · 支¥${lOut.toFixed(0)} · 结<span class="${bal >= 0 ? 'profit-pos' : 'profit-neg'}">¥${bal.toFixed(0)}</span></div></div>
        <button class="del-btn" onclick="delLedger('${l.id}')">×</button></div>`;
      body += renderLedStats(l.id);
    });
    body += `</div>`;
  }
  return tabs + body + `<button class="fab" onclick="addAccount(${sub === 'trade' ? "'trade'" : sub === 'income' ? "'income'" : sub === 'ledger' ? "'ledger'" : "'expense'"})">+</button>`;
}
// 获取账本名称
function ledgerName(id) {
  if (!id) return '';
  const l = Store.getLedgers().find(x => x.id === id);
  return l ? l.name : '';
}
function addAccount(type) {
  if (type === 'trade') {
    openModal(`
      <div class="modal-head"><h3>添加买卖记录</h3><button class="modal-close" onclick="closeModal()">×</button></div>
      <div class="field"><label>物品名称</label><input class="input" id="tName"></div>
      <div class="field"><label>买入价格(¥)</label><input class="input" id="tBuy" type="number"></div>
      <button class="btn btn-block" onclick="saveTrade()">保存</button>
    `);
    setTimeout(() => $('#tName').focus(), 100);
  } else if (type === 'ledger') {
    addLedger();
  } else {
    const isIncome = type === 'income';
    const cats = isIncome ? ['工资', '报销', '红包', '理财', '二手卖出', '其他'] : ['餐饮', '交通', '购物', '日用', '医疗', '宝宝', '其他'];
    const ledgers = Store.getLedgers();
    const subLeds = ledgers.filter(l => l.type === 'sub');
    openModal(`
      <div class="modal-head"><h3>${isIncome ? '添加收入' : '添加支出'}</h3><button class="modal-close" onclick="closeModal()">×</button></div>
      <div class="field"><label>分类</label><select class="select" id="aCat">${cats.map(c => `<option>${c}</option>`).join('')}</select></div>
      <div class="field"><label>金额(¥)</label><input class="input" id="aAmt" type="number"></div>
      <div class="field"><label>备注</label><input class="input" id="aNote"></div>
      <div class="field"><label>所属账本</label><select class="select" id="aLed">
        <option value="total">🏦 总账本</option>
        ${subLeds.map(l => `<option value="${l.id}">📒 ${esc(l.name)}</option>`).join('')}
      </select></div>
      ${isIncome ? '' : `<div class="field"><label><input type="checkbox" id="aReim" style="width:auto;margin-right:6px">需要报销</label></div>`}
      <div class="field"><label>${isIncome ? '收入凭证(可选)' : '小票/凭证截图(可选)'}</label>
        <input type="file" id="aImg" accept="image/*" onchange="previewImg(this,'aImgPrev')"></div>
      <div id="aImgPrev" class="img-preview"></div>
      <button class="btn btn-block" onclick="saveAccount(${isIncome ? 'true' : 'false'})">保存</button>
    `);
    setTimeout(() => $('#aAmt').focus(), 100);
  }
}
function previewImg(input, prevId) {
  const file = input.files[0];
  const prev = $('#' + prevId);
  if (!file || !prev) return;
  const reader = new FileReader();
  reader.onload = e => { prev.innerHTML = `<img src="${e.target.result}" />`; };
  reader.readAsDataURL(file);
}
function saveAccount(isIncome) {
  const cat = $('#aCat').value;
  const amt = Number($('#aAmt').value);
  if (!amt) return;
  const note = $('#aNote').value.trim();
  const ledger = $('#aLed') ? $('#aLed').value : 'total';
  const imgInput = $('#aImg');
  const finish = (imgData) => {
    const a = Store.getAccounts();
    const rec = { id: uid(), date: D.today(), category: cat, amount: amt, note, ledger, img: imgData || '' };
    if (isIncome) rec.type = 'income';
    else { rec.reimburse = $('#aReim') ? $('#aReim').checked : false; rec.claimed = false; }
    a.push(rec);
    Store.setAccounts(a);
    closeModal(); render();
  };
  if (imgInput && imgInput.files && imgInput.files[0]) {
    const reader = new FileReader();
    reader.onload = e => finish(e.target.result);
    reader.readAsDataURL(imgInput.files[0]);
  } else finish('');
}
function viewImg(id, type) {
  const list = type === 'account' ? Store.getAccounts() : type === 'cloth' ? Store.getClothes() : [];
  const item = list.find(x => x.id === id);
  if (item && item.img) {
    openModal(`<div class="modal-head"><h3>图片预览</h3><button class="modal-close" onclick="closeModal()">×</button></div>
      <img src="${item.img}" style="width:100%;border-radius:10px" />`);
  }
}
function delAccount(id) {
  Store.setAccounts(Store.getAccounts().filter(a => a.id !== id));
  render();
}
function claimAccount(id) {
  const a = Store.getAccounts();
  const x = a.find(y => y.id === id);
  if (x) { x.claimed = true; Store.setAccounts(a); render(); }
}
function saveTrade() {
  const name = $('#tName').value.trim();
  const buy = Number($('#tBuy').value);
  if (!name || !buy) return;
  const t = Store.getTrades();
  t.push({ id: uid(), name, buyPrice: buy, sellPrice: null });
  Store.setTrades(t);
  closeModal(); render();
}
function sellTrade(id) {
  openModal(`
    <div class="modal-head"><h3>售出物品</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="field"><label>售出价格(¥)</label><input class="input" id="sPrice" type="number"></div>
    <button class="btn btn-block" onclick="confirmSell('${id}')">确认售出</button>
  `);
  setTimeout(() => $('#sPrice').focus(), 100);
}
function confirmSell(id) {
  const price = Number($('#sPrice').value);
  if (!price && price !== 0) return;
  const t = Store.getTrades();
  const x = t.find(y => y.id === id);
  if (x) { x.sellPrice = price; Store.setTrades(t); }
  closeModal(); render();
}
function delTrade(id) {
  Store.setTrades(Store.getTrades().filter(t => t.id !== id));
  render();
}
// 账本管理
function addLedger() {
  openModal(`
    <div class="modal-head"><h3>添加分账本</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="field"><label>账本名称</label><input class="input" id="lName" placeholder="如 家庭账本/宝宝账本"></div>
    <button class="btn btn-block" onclick="saveLedger()">保存</button>
  `);
  setTimeout(() => $('#lName').focus(), 100);
}
function saveLedger() {
  const name = $('#lName').value.trim();
  if (!name) return;
  const l = Store.getLedgers();
  l.push({ id: uid(), name, type: 'sub' });
  Store.setLedgers(l);
  closeModal(); render();
}
function delLedger(id) {
  if (!confirm('删除该分账本？账本内记录会归到总账本')) return;
  Store.setLedgers(Store.getLedgers().filter(l => l.id !== id));
  // 该账本下的记录归到总账本
  const a = Store.getAccounts();
  a.forEach(x => { if (x.ledger === id) x.ledger = 'total'; });
  Store.setAccounts(a);
  render();
}
// 账本历史查询 - 设置月份
function setQueryMonth(val) {
  const q = Store.getLedgerQuery();
  q.month = val;
  Store.setLedgerQuery(q);
  render();
}
// 账本历史查询 - 设置年份
function setQueryYear(val) {
  const q = Store.getLedgerQuery();
  q.year = val;
  Store.setLedgerQuery(q);
  render();
}
// 截图识别录入支出（基于 Tesseract.js 在线 OCR，离线时降级为图片附件）
let _tessLoaded = false;
function loadTesseract(cb) {
  if (_tessLoaded) return cb(true);
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  s.onload = () => { _tessLoaded = true; cb(true); };
  s.onerror = () => cb(false);
  document.head.appendChild(s);
}
function ocrExpense() {
  openModal(`
    <div class="modal-head"><h3>📷 截图识别支出</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="field"><label>选择小票/账单截图</label>
      <input type="file" id="ocrFile" accept="image/*" onchange="ocrOnPick(this)"></div>
    <div id="ocrPrev" class="img-preview"></div>
    <div id="ocrStatus" style="font-size:13px;color:var(--text-light);margin:6px 0"></div>
    <div id="ocrForm"></div>
  `);
}
function ocrOnPick(input) {
  const file = input.files[0];
  if (!file) return;
  const prev = $('#ocrPrev');
  const reader = new FileReader();
  reader.onload = e => {
    prev.innerHTML = `<img src="${e.target.result}" />`;
    $('#ocrStatus').textContent = '🔍 正在识别文字...';
    loadTesseract(ok => {
      if (!ok) {
        $('#ocrStatus').innerHTML = '⚠️ 离线无法自动识别，请手动填写（图片会自动附上）';
        ocrShowForm(e.target.result, '');
        return;
      }
      Tesseract.recognize(e.target.result, 'chi_sim+eng', { logger: m => {
        if (m.status === 'recognizing text') $('#ocrStatus').textContent = '🔍 识别中 ' + Math.round(m.progress * 100) + '%';
      } }).then(({ data: { text } }) => {
        $('#ocrStatus').innerHTML = '✅ 识别完成，请核对金额和分类';
        ocrShowForm(e.target.result, text);
      }).catch(() => {
        $('#ocrStatus').innerHTML = '⚠️ 识别失败，请手动填写';
        ocrShowForm(e.target.result, '');
      });
    });
  };
  reader.readAsDataURL(file);
}
function ocrShowForm(imgData, ocrText) {
  // 从识别文本里尝试提取金额（¥后或"合计/总计"后的数字）
  let guessAmt = '';
  if (ocrText) {
    const amtMatch = ocrText.match(/(?:合计|总计|总额|实付|实付金额|金额|应付)[^\d]{0,4}(\d+(?:\.\d{1,2})?)/) ||
      ocrText.match(/¥\s*(\d+(?:\.\d{1,2})?)/) || ocrText.match(/(\d+\.\d{2})/);
    if (amtMatch) guessAmt = amtMatch[1];
  }
  const cats = ['餐饮', '交通', '购物', '日用', '医疗', '宝宝', '其他'];
  $('#ocrForm').innerHTML = `
    <div class="field"><label>识别文字（可参考）</label><textarea class="textarea" id="ocrText" rows="2" readonly>${esc(ocrText.slice(0, 200))}</textarea></div>
    <div class="field"><label>金额(¥)</label><input class="input" id="aAmt" type="number" value="${guessAmt}"></div>
    <div class="field"><label>分类</label><select class="select" id="aCat">${cats.map(c => `<option>${c}</option>`).join('')}</select></div>
    <div class="field"><label>备注</label><input class="input" id="aNote" placeholder="可选"></div>
    <div class="field"><label><input type="checkbox" id="aReim" style="width:auto;margin-right:6px">需要报销</label></div>
    <button class="btn btn-block" onclick="ocrSave('${imgData ? 'hasImg' : ''}')">保存</button>`;
  $('#ocrForm')._img = imgData;
  setTimeout(() => $('#aAmt').focus(), 100);
}
function ocrSave() {
  const form = $('#ocrForm');
  const imgData = form._img || '';
  const cat = $('#aCat').value;
  const amt = Number($('#aAmt').value);
  if (!amt) return;
  const note = $('#aNote').value.trim();
  const reim = $('#aReim').checked;
  const a = Store.getAccounts();
  a.push({ id: uid(), date: D.today(), category: cat, amount: amt, note, reimburse: reim, claimed: false, ledger: 'total', img: imgData });
  Store.setAccounts(a);
  closeModal(); toast('📷 已录入支出 ¥' + amt); render();
}

/* ========= 成长记录页(宝宝+体重) ========= */
function renderGrowth() {
  const sub = subTab.growth || 'baby';
  let tabs = `<div class="sub-tabs">
    <button class="sub-tab ${sub === 'baby' ? 'active' : ''}" onclick="setSubTab('growth','baby')">👶 宝宝成长</button>
    <button class="sub-tab ${sub === 'album' ? 'active' : ''}" onclick="setSubTab('growth','album')">📁 相册分类</button>
    <button class="sub-tab ${sub === 'weight' ? 'active' : ''}" onclick="setSubTab('growth','weight')">⚖️ 体重</button>
    <button class="sub-tab ${sub === 'babysleep' ? 'active' : ''}" onclick="setSubTab('growth','babysleep')">😴 宝宝睡眠</button>
  </div>`;
  let body = '';
  if (sub === 'baby') {
    const list = Store.getBaby().slice().reverse();
    body = `<div class="card"><div class="card-title"><span class="title-left">👶 宝宝成长记录</span></div>`;
    if (!list.length) body += `<div class="empty"><span class="emoji">👶</span>还没有记录</div>`;
    else list.forEach(b => {
      let mediaHtml = '';
      if (b.media && b.media.length) {
        mediaHtml = '<div class="baby-media-row">';
        b.media.forEach((m, i) => {
          if (m.type === 'image') {
            mediaHtml += `<div class="baby-media-thumb" onclick="viewMedia('${b.id}',${i})"><img src="${m.data}" alt="" loading="lazy"></div>`;
          } else if (m.type === 'video') {
            mediaHtml += `<div class="baby-media-thumb is-video" onclick="viewMedia('${b.id}',${i})">
              <video src="${m.data}" muted playsinline preload="metadata" onclick="event.stopPropagation();this.paused?this.play():this.pause();"></video>
              <span class="play-overlay">▶</span>
            </div>`;
          }
        });
        mediaHtml += '</div>';
      }
      body += `<div class="list-item baby-item">
        <div class="item-main">
          <div class="item-title">${D.fmt(b.date)}</div>
          <div class="item-sub">${b.height ? '身高' + b.height + 'cm ' : ''}${b.weight ? '体重' + b.weight + 'kg ' : ''}</div>
          <div class="item-sub" style="margin-top:4px">${esc(b.note || '')}</div>
          ${mediaHtml}
        </div>
        <div class="item-col-actions">
          <button class="btn btn-ghost btn-sm" onclick="editGrowthBaby('${b.id}')">✏️</button>
          <button class="del-btn" onclick="delBaby('${b.id}')">×</button>
        </div>
      </div>`;
    });
    body += `</div>`;
  } else if (sub === 'album') {
    const cats = Store.getBabyCats();
    body = `<div class="card"><div class="card-title"><span class="title-left">📁 相册分类</span>
      <button class="btn btn-ghost btn-sm" onclick="openCatModal(null)">+ 新建相册</button></div>`;
    if (!cats.length) {
      body += `<div class="empty"><span class="emoji">📁</span>还没有相册分类<br><span style="font-size:12px;color:var(--text-light)">点击上方按钮创建第一个分类</span></div>`;
    } else {
      body += `<div class="cat-grid">`;
      cats.forEach(cat => {
        const imgCount = cat.images ? cat.images.length : 0;
        const cover = cat.images && cat.images[0] ? cat.images[0].data : '';
        body += `<div class="cat-folder" onclick="openCatDetail('${cat.id}')">
          <div class="cat-cover ${cover ? '' : 'cat-cover-empty'}">
            ${cover ? `<img src="${cover}" alt="" loading="lazy">` : `<span class="cat-emoji">${cat.icon || '📁'}</span>`}
            <span class="cat-count">${imgCount}</span>
          </div>
          <div class="cat-name">${esc(cat.name)}</div>
        </div>`;
      });
      body += `</div>`;
    }
    body += `</div>`;
  } else if (sub === 'babysleep') {
    // 宝宝睡眠记录
    const list = Store.getBabySleep().slice().reverse();
    // 近7天统计
    let totalDur = 0, cnt = 0;
    for (let i = 0; i < 7; i++) {
      const s = Store.getBabySleepBy(D.offset(-i));
      if (s && s.duration) { totalDur += s.duration; cnt++; }
    }
    const avgDur = cnt ? totalDur / cnt : 0;
    const todaySleep = Store.getBabySleepBy(D.today());
    body = `<div class="card sleep-card">
      <div class="card-title"><span class="title-left">😴 宝宝睡眠记录</span>
        <button class="btn btn-ghost btn-sm" onclick="babySleepQuick()">🌙 现在记录</button>
      </div>`;
    // 今日状态
    body += `<div class="sleep-row">
      <div class="sleep-box">
        <div class="sleep-label">入睡</div>
        <div class="sleep-time">${todaySleep?.sleep || '--'}</div>
        <div class="sleep-sub">🍼 时间</div>
      </div>
      <div class="sleep-arrow">→</div>
      <div class="sleep-box ${todaySleep?.wake ? 'sleep-good' : 'sleep-empty'}">
        <div class="sleep-label">起床 / 时长</div>
        <div class="sleep-time">${todaySleep?.wake || '--'}</div>
        <div class="sleep-sub">${todaySleep?.duration ? '<span style="color:var(--pink)">💤 ' + fmtDuration(todaySleep.duration) + '</span>' : '🌅 待起床'}</div>
      </div>
    </div>
    <div class="sleep-actions">
      <button class="btn btn-sm" onclick="babySleepSleep()">🌙 现在入睡(${nowHHMM()})</button>
      <button class="btn btn-sm" style="background:var(--orange);color:#fff" onclick="babySleepWake()">☀️ 现在起床</button>
      <button class="btn btn-ghost btn-sm" onclick="babySleepCustom()">选择时间</button>
      ${todaySleep ? `<button class="btn btn-ghost btn-sm" onclick="babySleepDelete('${todaySleep.date}')">🗑</button>` : ''}
    </div>
    ${cnt > 0 ? `<div class="sleep-streak">📊 近7天宝宝平均睡眠 ${fmtDuration(avgDur)}</div>` : ''}`;
    body += `</div>`;
    // 历史记录
    body += `<div class="card"><div class="card-title"><span class="title-left">📋 历史记录</span></div>`;
    if (!list.length) body += `<div class="empty"><span class="emoji">😴</span>还没有睡眠记录</div>`;
    else list.forEach(s => {
      body += `<div class="list-item">
        <div class="item-main">
          <div class="item-title">${D.fmt(s.date)} ${esc(s.sleep || '')} → ${esc(s.wake || '未起')}</div>
          <div class="item-sub">${s.duration ? '💤 ' + fmtDuration(s.duration) : ''} ${s.note ? '· ' + esc(s.note) : ''}</div>
        </div>
        <button class="del-btn" onclick="babySleepDelete('${s.date}')">×</button></div>`;
    });
    body += `</div>`;
  } else {
    const all = Store.getWeights();
    const list = all.slice().reverse();
    const latest = list[0];
    // 今日早晚记录
    const todayPair = Store.getWeightsByDate(D.today());
    const hasTodayPair = todayPair.morning && todayPair.evening;
    const todayDiff = hasTodayPair ? Number(todayPair.evening.weight) - Number(todayPair.morning.weight) : null;
    body = `<div class="card"><div class="card-title"><span class="title-left">⚖️ 妈妈体重记录</span>
      <button class="btn btn-ghost btn-sm" onclick="addWeightMorning()">🌅 晨重</button>
      <button class="btn btn-ghost btn-sm" onclick="addWeightEvening()">🌙 晚重</button></div>`;
    if (latest) {
      body += `<div class="stat-row"><div class="stat-box"><div class="num">${latest.weight}</div><div class="label">最近(kg)</div></div>
        <div class="stat-box"><div class="num">${list.length}</div><div class="label">记录次数</div></div>
        <div class="stat-box"><div class="num">${list.filter(w => w.timeOfDay === 'morning').length}</div><div class="label">晨重次数</div></div>
        <div class="stat-box"><div class="num">${list.filter(w => w.timeOfDay === 'evening').length}</div><div class="label">晚重次数</div></div></div>`;
    }
    // 今日早晚差值
    if (hasTodayPair) {
      body += `<div class="weight-today-diff">
        <span>📊 今日早晚差值</span>
        <span class="${todayDiff < 0 ? 'profit-pos' : 'profit-neg'}">${todayDiff < 0 ? '' : '+'}${todayDiff} kg</span>
        <span class="diff-hint">（晚 - 晨）</span></div>`;
    } else {
      body += `<div class="weight-today-diff"><span>📅 今日：${todayPair.morning ? '晨重' + todayPair.morning.weight + 'kg' : '未记晨重'} ${todayPair.evening ? '· 晚重' + todayPair.evening.weight + 'kg' : '· 未记晚重'}</span></div>`;
    }
    // 相比上次
    if (list.length >= 2) {
      const diff = Number(list[0].weight) - Number(list[1].weight);
      body += `<div class="list-item"><div class="item-main"><div class="item-title">相比上次记录</div><div class="item-sub">${list[1].weight}kg → ${list[0].weight}kg</div></div><div class="item-right ${diff < 0 ? 'profit-pos' : 'profit-neg'}">${diff < 0 ? '' : '+'}${diff}kg</div></div>`;
    }
    // 曲线图
    if (all.length >= 2) {
      body += renderWeightChart(all);
      body += renderBodyChart(all);
    } else if (all.length === 1) {
      body += `<div class="chart-empty">📈 至少2条记录才能看曲线图</div>`;
    }
    // 体脂/围度最新数据
    const hasBody = all.some(w => w.bodyFat || w.waist || w.arm || w.thigh);
    if (hasBody) {
      const latestBody = all.slice().sort((a,b)=>b.date.localeCompare(a.date))[0];
      body += `<div class="stat-row">
        ${latestBody.bodyFat ? `<div class="stat-box"><div class="num">${latestBody.bodyFat}%</div><div class="label">体脂率</div></div>` : ''}
        ${latestBody.waist ? `<div class="stat-box"><div class="num">${latestBody.waist}</div><div class="label">腰围(cm)</div></div>` : ''}
        ${latestBody.arm ? `<div class="stat-box"><div class="num">${latestBody.arm}</div><div class="label">臂围(cm)</div></div>` : ''}
        ${latestBody.thigh ? `<div class="stat-box"><div class="num">${latestBody.thigh}</div><div class="label">腿围(cm)</div></div>` : ''}
      </div>`;
    }
    // 历史记录列表（按日期分组显示早晚）
    if (!list.length) body += `<div class="empty"><span class="emoji">⚖️</span>还没有记录</div>`;
    else {
      // 按日期分组
      const byDate = {};
      list.forEach(w => { (byDate[w.date] = byDate[w.date] || []).push(w); });
      Object.keys(byDate).sort((a, b) => b.localeCompare(a)).forEach(date => {
        const items = byDate[date];
        const m = items.find(w => w.timeOfDay === 'morning');
        const e = items.find(w => w.timeOfDay === 'evening');
        const diff = (m && e) ? Number(e.weight) - Number(m.weight) : null;
        const anyWithBody = items.find(w => w.bodyFat || w.waist || w.arm || w.thigh);
        body += `<div class="weight-day-row">
          <div class="wd-date">${D.fmt(date)}</div>
          <div class="wd-vals">
            ${m ? `<span class="wd-val morning">🌅 ${m.weight}kg</span>` : ''}
            ${e ? `<span class="wd-val evening">🌙 ${e.weight}kg</span>` : ''}
            ${items.filter(w => !w.timeOfDay).map(w => `<span class="wd-val">⚖️ ${w.weight}kg</span>`).join('')}
            ${diff != null ? `<span class="wd-diff ${diff < 0 ? 'profit-pos' : 'profit-neg'}">${diff < 0 ? '' : '+'}${diff}</span>` : ''}
          </div>
          ${anyWithBody ? `<div class="wd-body">
            ${anyWithBody.bodyFat ? `<span>体脂${anyWithBody.bodyFat}%</span>` : ''}
            ${anyWithBody.waist ? `<span>腰${anyWithBody.waist}cm</span>` : ''}
            ${anyWithBody.arm ? `<span>臂${anyWithBody.arm}cm</span>` : ''}
            ${anyWithBody.thigh ? `<span>腿${anyWithBody.thigh}cm</span>` : ''}
          </div>` : ''}
          ${items[0].note ? `<div class="wd-note">${esc(items[0].note)}</div>` : ''}
          <div class="wd-del">${items.map(w => `<button class="del-btn" onclick="delWeight('${w.id}')">×</button>`).join('')}</div>
        </div>`;
      });
    }
    body += `</div>`;
  }
  // 宝宝睡眠/相册子tab下隐藏默认+号按钮
  if (sub === 'babysleep' || sub === 'album') return tabs + body;
  return tabs + body + `<button class="fab" onclick="addGrowth('${sub}')">+</button>`;
}
// 宝宝成长记录：暂存当前编辑附件（base64），避免多次渲染丢失
let __babyDraft = null;
function addGrowth(sub) {
  if (sub === 'baby') {
    openBabyGrowthModal(null);
  } else {
    openModal(`
      <div class="modal-head"><h3>体重记录</h3><button class="modal-close" onclick="closeModal()">×</button></div>
      <div class="field"><label>日期</label><input class="input" id="wDate" type="date" value="${D.today()}"></div>
      <div class="field"><label>时段</label><select class="select" id="wTime">
        <option value="morning">🌅 晨重（早）</option>
        <option value="evening">🌙 晚重（晚）</option>
        <option value="">⚖️ 通用</option>
      </select></div>
      <div class="field"><label>体重(kg)</label><input class="input" id="wWeight" type="number" step="0.1"></div>
      <div class="row">
        <div class="field"><label>体脂率(%)</label><input class="input" id="wBodyFat" type="number" step="0.1" placeholder="可选"></div>
        <div class="field"><label>腰围(cm)</label><input class="input" id="wWaist" type="number" step="0.1" placeholder="可选"></div>
      </div>
      <div class="row">
        <div class="field"><label>臂围(cm)</label><input class="input" id="wArm" type="number" step="0.1" placeholder="可选"></div>
        <div class="field"><label>腿围(cm)</label><input class="input" id="wThigh" type="number" step="0.1" placeholder="可选"></div>
      </div>
      <div class="field"><label>备注</label><input class="input" id="wNote" placeholder="如:早餐前"></div>
      <button class="btn btn-block" onclick="saveWeight()">保存</button>
    `);
    setTimeout(() => $('#wWeight').focus(), 100);
  }
}
// 晨重/晚重快捷录入
function addWeightMorning() { addWeightQuick('morning', '🌅 晨重'); }
function addWeightEvening() { addWeightQuick('evening', '🌙 晚重'); }
function addWeightQuick(timeOfDay, title) {
  openModal(`
    <div class="modal-head"><h3>${title}</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="field"><label>日期</label><input class="input" id="wDate" type="date" value="${D.today()}"></div>
    <div class="field"><label>体重(kg)</label><input class="input" id="wWeight" type="number" step="0.1" autofocus></div>
    <input type="hidden" id="wTime" value="${timeOfDay}">
    <div class="field"><label>备注</label><input class="input" id="wNote" placeholder="可选"></div>
    <button class="btn btn-block" onclick="saveWeight()">保存</button>
  `);
  setTimeout(() => $('#wWeight').focus(), 100);
}
function openBabyGrowthModal(editId) {
  const list = Store.getBaby();
  const ed = editId ? list.find(x => x.id === editId) : null;
  __babyDraft = {
    id: ed?.id || null,
    media: ed?.media ? [...ed.media] : []
  };
  const body = `
    <div class="modal-head"><h3>${ed ? '✏️ 编辑成长记录' : '👶 宝宝成长记录'}</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="field"><label>日期</label><input class="input" id="bDate" type="date" value="${ed?.date || D.today()}"></div>
    <div class="row">
      <div class="field"><label>身高(cm)</label><input class="input" id="bHeight" type="number" step="0.1" value="${escapeAttr(ed?.height || '')}"></div>
      <div class="field"><label>体重(kg)</label><input class="input" id="bWeight" type="number" step="0.1" value="${escapeAttr(ed?.weight || '')}"></div>
    </div>
    <div class="field"><label>备注(里程碑/趣事)</label><textarea class="textarea" id="bNote" rows="2" placeholder="如:会翻身了">${escapeHtml(ed?.note || '')}</textarea></div>
    <div class="field">
      <label>照片 / 视频</label>
      <div class="media-picker">
        <label class="media-pick-btn">📷 加图片
          <input type="file" accept="image/*" capture="environment" style="display:none" onchange="uploadBabyMedia(this,'image')">
        </label>
        <label class="media-pick-btn">🎥 加视频
          <input type="file" accept="video/*" capture="environment" style="display:none" onchange="uploadBabyMedia(this,'video')">
        </label>
        <span class="media-tip">建议视频 ≤30秒,图片会自动压缩</span>
      </div>
      <div class="media-draft-list" id="babyDraftList"></div>
    </div>
    <button class="btn btn-block" onclick="saveBaby()">保存</button>
  `;
  openModal(body);
  renderBabyDraftList();
  setTimeout(() => $('#bHeight').focus(), 100);
}
function editGrowthBaby(id) { openBabyGrowthModal(id); }
function renderBabyDraftList() {
  const wrap = $('#babyDraftList');
  if (!wrap || !__babyDraft) return;
  if (!__babyDraft.media.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = __babyDraft.media.map((m, i) => `
    <div class="media-draft-item">
      ${m.type === 'image'
        ? `<img src="${m.data}" alt="">`
        : `<div class="media-draft-video-wrap"><video src="${m.data}" muted playsinline preload="metadata"></video><span class="play-overlay small">▶</span></div>`}
      <button class="media-del-btn" onclick="delBabyDraftMedia(${i})">×</button>
    </div>
  `).join('');
}
// 上传 baby 附件：图片转 base64（并压缩到≤1200px），视频也转 base64 但不压缩（注意大小限制）
function uploadBabyMedia(input, type) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file || !__babyDraft) return;
  const kb = file.size / 1024;
  if (type === 'video' && kb > 10240) {
    if (!confirm(`视频约 ${(kb / 1024).toFixed(1)}MB，比较大。\nlocalStorage 总容量约 5MB，可能存不下。\n建议转成短视频/压缩后再传。确定继续上传吗？`)) return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    const base = e.target.result;
    if (type === 'image') {
      // 图片压缩：限制最长边 1200，JPEG 质量 0.8
      const img = new Image();
      img.onload = () => {
        const MAX = 1200;
        let w = img.naturalWidth, h = img.naturalHeight;
        if (w > MAX || h > MAX) {
          const r = Math.min(MAX / w, MAX / h);
          w = Math.round(w * r);
          h = Math.round(h * r);
        }
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        const out = cv.toDataURL('image/jpeg', 0.8);
        __babyDraft.media.push({ type: 'image', data: out });
        renderBabyDraftList();
        toast('📷 已添加图片');
      };
      img.onerror = () => { __babyDraft.media.push({ type: 'image', data: base }); renderBabyDraftList(); toast('📷 已添加图片'); };
      img.src = base;
    } else {
      __babyDraft.media.push({ type: 'video', data: base });
      renderBabyDraftList();
      toast('🎥 已添加视频');
    }
  };
  reader.readAsDataURL(file);
}
function delBabyDraftMedia(i) {
  if (!__babyDraft) return;
  __babyDraft.media.splice(i, 1);
  renderBabyDraftList();
}
function viewMedia(babyId, mediaIdx) {
  const b = Store.getBaby().find(x => x.id === babyId);
  const m = b?.media?.[mediaIdx];
  if (!m) return;
  if (m.type === 'image') {
    openModal(`<div class="media-view">
      <button class="modal-close big-close" onclick="closeModal()">×</button>
      <img src="${m.data}" alt="">
    </div>`);
  } else {
    openModal(`<div class="media-view">
      <button class="modal-close big-close" onclick="closeModal()">×</button>
      <video src="${m.data}" controls playsinline autoplay></video>
    </div>`);
  }
}
function saveBaby() {
  const date = $('#bDate').value || D.today();
  const height = $('#bHeight').value;
  const weight = $('#bWeight').value;
  const note = $('#bNote').value.trim();
  const media = __babyDraft?.media || [];
  if (!height && !weight && !note && !media.length) { toast('至少填一项或加图片/视频'); return; }
  const list = Store.getBaby();
  if (__babyDraft?.id) {
    const x = list.find(y => y.id === __babyDraft.id);
    if (x) Object.assign(x, { date, height, weight, note, media });
  } else {
    list.push({ id: uid(), date, height, weight, note, media });
  }
  // 防 localStorage 溢出：估算当前存储量，超限则提示
  try {
    Store.setBaby(list);
  } catch (e) {
    alert('❌ 保存失败：本地存储已满。\n请在「数据管理」导出备份后，删除一些旧记录或较大视频再试。');
    return;
  }
  __babyDraft = null;
  closeModal(); render();
}
function delBaby(id) { Store.setBaby(Store.getBaby().filter(b => b.id !== id)); render(); }

// ======== 相册分类管理 ========
let __catDraft = null;
function openCatModal(editId) {
  const cats = Store.getBabyCats();
  const cat = editId ? cats.find(c => c.id === editId) : null;
  __catDraft = cat ? { ...cat, images: [...(cat.images || [])] } : { id: null, name: '', icon: '📁', images: [] };
  const body = `
    <div class="modal-head"><h3>${cat ? '✏️ 编辑相册' : '📁 新建相册'}</h3><button class="modal-close" onclick="closeModal();render()">×</button></div>
    <div class="field"><label>相册名称</label><input class="input" id="catName" placeholder="如:满月照、日常..." value="${escapeAttr(__catDraft.name)}"></div>
    <div class="field"><label>选择图标</label>
      <div class="cat-icon-picker">
        ${['📁','📷','🌸','🎀','🧸','🍼','👶','❤️','⭐','🌈','🎂','🌙','☀️','🦋'].map(ic =>
          `<span class="cat-icon ${__catDraft.icon === ic ? 'active' : ''}" onclick="selectCatIcon('${ic}')">${ic}</span>`
        ).join('')}
      </div>
    </div>
    <div class="field">
      <label>添加图片</label>
      <div class="media-picker">
        <label class="media-pick-btn">📷 选图片
          <input type="file" accept="image/*" style="display:none" onchange="uploadCatMedia(this)">
        </label>
        <span class="media-tip">可添加多张图片</span>
      </div>
      <div class="cat-image-list" id="catImageList"></div>
    </div>
    ${cat ? `<button class="btn btn-ghost btn-block" style="color:var(--pink)">🗑 删除此相册</button>` : ''}
    <button class="btn btn-block" onclick="saveCat()">${cat ? '保存修改' : '创建相册'}</button>
  `;
  openModal(body);
  renderCatImageList();
}
function selectCatIcon(ic) {
  if (!__catDraft) return;
  __catDraft.icon = ic;
  document.querySelectorAll('.cat-icon').forEach(el => el.classList.toggle('active', el.textContent === ic));
}
function renderCatImageList() {
  const wrap = $('#catImageList');
  if (!wrap || !__catDraft) return;
  if (!__catDraft.images.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = `<div class="cat-img-grid">` + __catDraft.images.map((m, i) => `
    <div class="cat-img-item">
      <img src="${m.data}" alt="">
      <button class="media-del-btn" onclick="delCatDraftMedia(${i})">×</button>
    </div>
  `).join('') + `</div>`;
}
function delCatDraftMedia(i) {
  if (!__catDraft) return;
  __catDraft.images.splice(i, 1);
  renderCatImageList();
}
function uploadCatMedia(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file || !__catDraft) return;
  const reader = new FileReader();
  reader.onload = e => {
    const base = e.target.result;
    const img = new Image();
    img.onload = () => {
      const MAX = 1200;
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > MAX || h > MAX) {
        const r = Math.min(MAX / w, MAX / h);
        w = Math.round(w * r);
        h = Math.round(h * r);
      }
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      const out = cv.toDataURL('image/jpeg', 0.8);
      __catDraft.images.push({ id: uid(), type: 'image', data: out });
      renderCatImageList();
      toast('📷 已添加图片');
    };
    img.onerror = () => { __catDraft.images.push({ id: uid(), type: 'image', data: base }); renderCatImageList(); };
    img.src = base;
  };
  reader.readAsDataURL(file);
}
function saveCat() {
  const name = $('#catName').value.trim();
  if (!name) { toast('请输入相册名称'); return; }
  if (!__catDraft) return;
  const cats = Store.getBabyCats();
  if (__catDraft.id) {
    const x = cats.find(c => c.id === __catDraft.id);
    if (x) Object.assign(x, { name, icon: __catDraft.icon, images: __catDraft.images });
  } else {
    cats.push({ id: uid(), name, icon: __catDraft.icon, images: __catDraft.images, createTime: Date.now() });
  }
  try {
    Store.setBabyCats(cats);
  } catch (e) {
    alert('❌ 保存失败：本地存储已满。\n请在「数据管理」导出备份后，删除一些旧记录再试。');
    return;
  }
  __catDraft = null;
  closeModal(); render();
}
function delCat(id) {
  if (!confirm('确定删除此相册？')) return;
  Store.setBabyCats(Store.getBabyCats().filter(c => c.id !== id));
  __catDraft = null;
  closeModal(); render();
}
function openCatDetail(catId) {
  const cat = Store.getBabyCats().find(c => c.id === catId);
  if (!cat) return;
  const images = cat.images || [];
  const body = `
    <div class="modal-head"><h3>${esc(cat.icon)} ${esc(cat.name)}</h3><button class="modal-close" onclick="closeModal();render()">×</button></div>
    <div class="cat-detail-actions">
      <label class="media-pick-btn" style="cursor:pointer">📷 添加图片
        <input type="file" accept="image/*" style="display:none" onchange="uploadCatDetailMedia(this,'${catId}')">
      </label>
      <button class="btn btn-ghost btn-sm" onclick="openCatModal('${catId}')">✏️ 编辑信息</button>
      <button class="btn btn-ghost btn-sm" style="color:var(--pink)" onclick="delCat('${catId}')">🗑 删除</button>
    </div>
    <div class="cat-detail-grid" id="catDetailGrid">
      ${images.length ? images.map((m, i) => `
        <div class="cat-detail-item">
          <img src="${m.data}" alt="" onclick="viewCatImage('${catId}',${i})">
          <button class="media-del-btn" onclick="delCatImage('${catId}',${i})">×</button>
        </div>
      `).join('') : `<div class="empty" style="grid-column:1/-1"><span class="emoji">📷</span>还没有图片<br><span style="font-size:12px;color:var(--text-light)">点击上方按钮添加</span></div>`}
    </div>
  `;
  openModal(body);
}
function uploadCatDetailMedia(input, catId) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const base = e.target.result;
    const img = new Image();
    img.onload = () => {
      const MAX = 1200;
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > MAX || h > MAX) {
        const r = Math.min(MAX / w, MAX / h);
        w = Math.round(w * r);
        h = Math.round(h * r);
      }
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      const out = cv.toDataURL('image/jpeg', 0.8);
      const cats = Store.getBabyCats();
      const cat = cats.find(c => c.id === catId);
      if (cat) {
        cat.images = cat.images || [];
        cat.images.push({ id: uid(), type: 'image', data: out });
        Store.setBabyCats(cats);
        openCatDetail(catId);
        toast('📷 已添加图片');
      }
    };
    img.onerror = () => {
      const cats = Store.getBabyCats();
      const cat = cats.find(c => c.id === catId);
      if (cat) {
        cat.images = cat.images || [];
        cat.images.push({ id: uid(), type: 'image', data: base });
        Store.setBabyCats(cats);
        openCatDetail(catId);
      }
    };
    img.src = base;
  };
  reader.readAsDataURL(file);
}
function delCatImage(catId, imgIdx) {
  const cats = Store.getBabyCats();
  const cat = cats.find(c => c.id === catId);
  if (!cat) return;
  cat.images.splice(imgIdx, 1);
  Store.setBabyCats(cats);
  openCatDetail(catId);
}
function viewCatImage(catId, imgIdx) {
  const cat = Store.getBabyCats().find(c => c.id === catId);
  const m = cat?.images?.[imgIdx];
  if (!m) return;
  openModal(`<div class="media-view">
    <button class="modal-close big-close" onclick="closeModal();openCatDetail('${catId}')">×</button>
    <img src="${m.data}" alt="">
  </div>`);
}

function saveWeight() {
  const date = $('#wDate').value || D.today();
  const weight = $('#wWeight').value;
  if (!weight) return;
  const note = $('#wNote') ? $('#wNote').value.trim() : '';
  const timeOfDay = $('#wTime') ? $('#wTime').value : '';
  const bodyFat = $('#wBodyFat') ? $('#wBodyFat').value : '';
  const waist = $('#wWaist') ? $('#wWaist').value : '';
  const arm = $('#wArm') ? $('#wArm').value : '';
  const thigh = $('#wThigh') ? $('#wThigh').value : '';
  const w = Store.getWeights();
  w.push({ id: uid(), date, weight, note, timeOfDay, bodyFat, waist, arm, thigh });
  Store.setWeights(w);
  closeModal(); render();
}
function delWeight(id) { Store.setWeights(Store.getWeights().filter(w => w.id !== id)); render(); }

// ========= 体重曲线图 (纯 SVG) =========
function renderWeightChart(all) {
  // 按日期升序，取最近30条
  const sorted = all.slice().sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
  const W = 320, H = 140, padL = 34, padR = 8, padT = 14, padB = 22;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const weights = sorted.map(w => Number(w.weight)).filter(Boolean);
  if (weights.length < 2) return '';
  const minW = Math.min(...weights), maxW = Math.max(...weights);
  const range = maxW - minW || 1;
  const yMin = minW - range * 0.15, yMax = maxW + range * 0.15;
  const yPad = (yMax - yMin) || 1;
  // 每个点x坐标
  const n = sorted.length;
  const xAt = i => n === 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW;
  const yAt = w => padT + (1 - (w - yMin) / yPad) * plotH;
  // 晨重/晚重分别的折线点
  const mornPts = [], evePts = [], anyPts = [];
  sorted.forEach((w, i) => {
    const p = `${xAt(i).toFixed(1)},${yAt(Number(w.weight)).toFixed(1)}`;
    if (w.timeOfDay === 'morning') mornPts.push(p);
    else if (w.timeOfDay === 'evening') evePts.push(p);
    else anyPts.push(p);
  });
  // 所有点连成主折线（按时间）
  const allPath = sorted.map((w, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(Number(w.weight)).toFixed(1)}`).join(' ');
  // Y轴刻度（3条）
  let grid = '';
  for (let g = 0; g <= 2; g++) {
    const yv = yMin + (yPad * g / 2);
    const y = yAt(yv);
    grid += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--border)" stroke-width="1" stroke-dasharray="3,3"/>`;
    grid += `<text x="${padL - 4}" y="${y + 3}" font-size="9" fill="var(--text-light)" text-anchor="end">${yv.toFixed(1)}</text>`;
  }
  // 点
  let dots = '';
  sorted.forEach((w, i) => {
    const cx = xAt(i), cy = yAt(Number(w.weight));
    const color = w.timeOfDay === 'morning' ? '#ffb84d' : w.timeOfDay === 'evening' ? '#9b6ed9' : 'var(--pink-deep)';
    dots += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="2.5" fill="${color}"/>`;
  });
  // X轴日期标签（首/中/尾）
  let xLabels = '';
  const labelIdx = n <= 3 ? [0] : [0, Math.floor((n - 1) / 2), n - 1];
  labelIdx.forEach(i => {
    const d = sorted[i].date.slice(5).replace('-', '/');
    xLabels += `<text x="${xAt(i).toFixed(1)}" y="${H - 6}" font-size="9" fill="var(--text-light)" text-anchor="middle">${d}</text>`;
  });
  return `<div class="weight-chart">
    <div class="chart-title">📈 体重曲线（近${n}条）</div>
    <div class="chart-legend">
      <span class="lg-item"><span class="lg-dot" style="background:#ffb84d"></span>晨重</span>
      <span class="lg-item"><span class="lg-dot" style="background:#9b6ed9"></span>晚重</span>
      <span class="lg-item"><span class="lg-dot" style="background:var(--pink-deep)"></span>通用</span>
    </div>
    <svg viewBox="0 0 ${W} ${H}" class="chart-svg">
      ${grid}
      <path d="${allPath}" fill="none" stroke="var(--pink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
      ${xLabels}
    </svg>
  </div>`;
}
// 体脂/围度趋势图（多条折线）
function renderBodyChart(all) {
  const sorted = all.slice().sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
  // 按日期聚合（同一天早晚都有的话取平均）
  const byDay = {};
  sorted.forEach(w => {
    if (!byDay[w.date]) byDay[w.date] = { date: w.date, items: [] };
    byDay[w.date].items.push(w);
  });
  const days = Object.values(byDay);
  const avg = (items, key) => {
    const vals = items.map(i => Number(i[key])).filter(v => !isNaN(v) && v > 0);
    if (!vals.length) return null;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  };
  const dataList = days.map(d => ({
    date: d.date,
    bodyFat: avg(d.items, 'bodyFat'),
    waist: avg(d.items, 'waist'),
    arm: avg(d.items, 'arm'),
    thigh: avg(d.items, 'thigh')
  })).filter(d => d.bodyFat != null || d.waist != null || d.arm != null || d.thigh != null);
  if (dataList.length < 2) return '';
  const metrics = [
    { key: 'bodyFat', label: '体脂率', color: '#ff6b9d', unit: '%' },
    { key: 'waist', label: '腰围', color: '#4dabf7', unit: 'cm' },
    { key: 'arm', label: '臂围', color: '#38d9a9', unit: 'cm' },
    { key: 'thigh', label: '腿围', color: '#b980ff', unit: 'cm' }
  ];
  const haveMetrics = metrics.filter(m => dataList.some(d => d[m.key] != null));
  if (haveMetrics.length === 0) return '';
  // 每个指标一张图
  let html = '';
  haveMetrics.forEach(m => {
    const values = dataList.map(d => d[m.key]).filter(v => v != null);
    if (values.length < 2) return;
    const W = 320, H = 110, padL = 34, padR = 8, padT = 14, padB = 22;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const minV = Math.min(...values), maxV = Math.max(...values);
    const range = maxV - minV || 1;
    const yMin = minV - range * 0.15, yMax = maxV + range * 0.15;
    const yPad = (yMax - yMin) || 1;
    const n = dataList.length;
    const xAt = i => n === 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW;
    const yAt = v => padT + (1 - (v - yMin) / yPad) * plotH;
    const pts = [];
    dataList.forEach((d, i) => {
      if (d[m.key] != null) pts.push(`${xAt(i).toFixed(1)},${yAt(d[m.key]).toFixed(1)}`);
    });
    const path = pts.length ? pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p}`).join(' ') : '';
    let grid = '';
    for (let g = 0; g <= 2; g++) {
      const yv = yMin + (yPad * g / 2);
      const y = yAt(yv);
      grid += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--border)" stroke-width="1" stroke-dasharray="3,3"/>`;
      grid += `<text x="${padL - 4}" y="${y + 3}" font-size="9" fill="var(--text-light)" text-anchor="end">${yv.toFixed(1)}</text>`;
    }
    let dots = '';
    dataList.forEach((d, i) => {
      if (d[m.key] != null) {
        dots += `<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(d[m.key]).toFixed(1)}" r="2.5" fill="${m.color}"/>`;
      }
    });
    let xLabels = '';
    const labelIdx = n <= 3 ? [0] : [0, Math.floor((n - 1) / 2), n - 1];
    labelIdx.forEach(i => {
      const dd = dataList[i].date.slice(5).replace('-', '/');
      xLabels += `<text x="${xAt(i).toFixed(1)}" y="${H - 6}" font-size="9" fill="var(--text-light)" text-anchor="middle">${dd}</text>`;
    });
    html += `<div class="weight-chart">
      <div class="chart-title"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${m.color};margin-right:4px"></span>${m.label}趋势（${m.unit}，近${dataList.length}天）</div>
      <svg viewBox="0 0 ${W} ${H}" class="chart-svg">
        ${grid}
        ${path ? `<path d="${path}" fill="none" stroke="${m.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
        ${dots}
        ${xLabels}
      </svg>
    </div>`;
  });
  return html;
}

// ---------- 宝宝睡眠操作 ----------
function babySleepQuick() {
  // 弹一个简单确认：现在入睡还是起床
  const today = Store.getBabySleepBy(D.today());
  openModal(`
    <div class="modal-head"><h3>😴 宝宝睡眠</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div style="padding:8px 0 16px">
      <p style="font-size:13px;color:var(--text-light);margin-bottom:12px">宝宝今天 ${today ? (today.sleep || '—') + ' → ' + (today.wake || '未起') : '还没记录'}</p>
      <div style="display:flex;gap:8px">
        <button class="btn btn-block" onclick="babySleepSleep()">🌙 现在入睡(${nowHHMM()})</button>
        <button class="btn btn-block" style="background:var(--orange)" onclick="babySleepWake()">☀️ 现在起床</button>
      </div>
      <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="babySleepCustom()">选择时间</button>
    </div>
  `);
}
function babySleepSleep() {
  const time = nowHHMM();
  const date = new Date().getHours() < 6 ? D.offset(-1) : D.today();
  const old = Store.getBabySleepBy(date) || {};
  Store.setBabySleepOne({
    id: old.id || uid(),
    date, sleep: time,
    wake: old.wake || '',
    duration: old.wake ? sleepDurationHours(time, old.wake) : 0,
    note: old.note || ''
  });
  toast('🌙 宝宝入睡了，记录时间 ' + time);
  closeModal();
  render();
}
function babySleepWake() {
  const time = nowHHMM();
  const date = new Date().getHours() < 6 ? D.offset(-1) : D.today();
  const old = Store.getBabySleepBy(date) || {};
  if (!old.sleep) old.sleep = time;
  const duration = sleepDurationHours(old.sleep, time);
  Store.setBabySleepOne({
    id: old.id || uid(),
    date, sleep: old.sleep, wake: time,
    duration, note: old.note || ''
  });
  toast('☀️ 宝宝起床啦！本次睡眠 ' + fmtDuration(duration));
  closeModal();
  render();
}
function babySleepCustom() {
  const defDate = D.today();
  const defTime = nowHHMM();
  openModal(`
    <div class="modal-head"><h3>😴 宝宝睡眠</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="field"><label>日期</label>
      <input class="input" id="bsDate" type="date" value="${defDate}">
    </div>
    <div class="field"><label>入睡时间</label>
      <input class="input" id="bsSleep" type="time" value="${defTime}">
    </div>
    <div class="field"><label>起床时间（可选）</label>
      <input class="input" id="bsWake" type="time" value="">
    </div>
    <div class="field"><label>备注（可选）</label>
      <input class="input" id="bsNote" placeholder="如 半夜醒2次 / 睡得不错">
    </div>
    <div style="padding:10px 12px;background:var(--pink-soft);border-radius:8px;margin-bottom:12px">
      💤 睡眠时长：<b id="bsDur">--</b>
    </div>
    <button class="btn btn-block" onclick="babySleepSave()">保存</button>
  `);
  const judge = () => {
    const s = $('#bsSleep').value;
    const w = $('#bsWake').value;
    if (!s || !w) { $('#bsDur').textContent = w ? '未填入睡' : '未填起床'; return; }
    const d = sleepDurationHours(s, w);
    $('#bsDur').innerHTML = '<span style="color:var(--pink)">' + fmtDuration(d) + '</span>';
  };
  setTimeout(() => {
    judge();
    $('#bsSleep').addEventListener('change', judge);
    $('#bsWake').addEventListener('change', judge);
  }, 50);
}
function babySleepSave() {
  const date = $('#bsDate').value;
  const sleep = $('#bsSleep').value;
  const wake = $('#bsWake').value;
  const note = $('#bsNote').value.trim();
  if (!date || !sleep) return alert('请选择日期和入睡时间');
  const duration = wake ? sleepDurationHours(sleep, wake) : 0;
  const old = Store.getBabySleepBy(date) || {};
  Store.setBabySleepOne({ id: old.id || uid(), date, sleep, wake, duration, note });
  closeModal();
  toast('😴 宝宝睡眠已记录');
  render();
}
function babySleepDelete(date) {
  if (!confirm('删除这一天的宝宝睡眠记录？')) return;
  Store.setBabySleep(Store.getBabySleep().filter(s => s.date !== date));
  render();
}

/* ========= 更多页 ========= */
function renderMore() {
  const sub = subTab.more || 'bag';
  let tabs = `<div class="sub-tabs">
    <button class="sub-tab ${sub === 'bag' ? 'active' : ''}" onclick="setSubTab('more','bag')">🎒 出门清单</button>
    <button class="sub-tab ${sub === 'trip' ? 'active' : ''}" onclick="setSubTab('more','trip')">📅 行程日程</button>
    <button class="sub-tab ${sub === 'share' ? 'active' : ''}" onclick="setSubTab('more','share')">💄 好物分享</button>
    <button class="sub-tab ${sub === 'cloth' ? 'active' : ''}" onclick="setSubTab('more','cloth')">👕 衣物</button>
    <button class="sub-tab ${sub === 'consumable' ? 'active' : ''}" onclick="setSubTab('more','consumable')">🧴 消耗品</button>
    <button class="sub-tab ${sub === 'shop' ? 'active' : ''}" onclick="setSubTab('more','shop')">🛒 待购物</button>
    <button class="sub-tab ${sub === 'poop' ? 'active' : ''}" onclick="setSubTab('more','poop')">💩 拉屎月历</button>
    <button class="sub-tab ${sub === 'sudden' ? 'active' : ''}" onclick="setSubTab('more','sudden')">💡 突发奇想</button>
    <button class="sub-tab ${sub === 'life' ? 'active' : ''}" onclick="setSubTab('more','life')">🌱 生活tips</button>
    <button class="sub-tab ${sub === 'data' ? 'active' : ''}" onclick="setSubTab('more','data')">💾 数据</button>
  </div>`;
  let body = '';
  if (sub === 'bag') body = renderBags();
  else if (sub === 'trip') body = renderTrips();
  else if (sub === 'share') body = renderShares();
  else if (sub === 'cloth') body = renderClothes();
  else if (sub === 'consumable') body = renderConsumables();
  else if (sub === 'shop') body = renderShop();
  else if (sub === 'poop') body = renderPoops();
  else if (sub === 'sudden') body = renderTips('sudden');
  else if (sub === 'life') body = renderTips('life');
  else if (sub === 'data') body = renderData();
  // 行程/待购物/tips/拉屎/数据 有自己的按钮，不显示默认+号
  if (sub === 'poop' || sub === 'data' || sub === 'sudden' || sub === 'life' || sub === 'shop') return tabs + body;
  return tabs + body + `<button class="fab" onclick="addMore('${sub}')">+</button>`;
}
function addMore(sub) {
  if (sub === 'bag') addBag();
  else if (sub === 'trip') addTrip();
  else if (sub === 'share') addShare();
  else if (sub === 'cloth') addCloth();
  else if (sub === 'consumable') addConsumable();
}

// ======== 行程日程 ========
function renderTrips() {
  const list = Store.getTrips().slice().sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
  const today = D.today();
  const upcoming = list.filter(t => (t.endDate || t.startDate) >= today);
  const past = list.filter(t => (t.endDate || t.startDate) < today);
  const colors = ['#ffb3ba', '#ffdfba', '#ffffba', '#baffc9', '#bae1ff', '#e0bbff', '#ffc4e0', '#f4d1a8'];
  let h = `<div class="card"><div class="card-title"><span class="title-left">📅 行程日程</span>
    <button class="btn btn-ghost btn-sm" onclick="addTrip()">+ 新行程</button></div>`;
  const renderTripItem = (t) => {
    const cIndex = Math.abs((t.id || '').charCodeAt(0) || 0) % colors.length;
    const color = t.color || colors[cIndex];
    const endDate = t.endDate || t.startDate;
    const dateStr = t.startDate === endDate ? D.fmt(t.startDate) : `${D.fmt(t.startDate)} ~ ${D.fmt(endDate)}`;
    let timeStr = '';
    if (t.startTime || t.endTime) timeStr = ` · ${t.startTime || '--'}${t.endTime ? ' ~ ' + t.endTime : ''}`;
    const isToday = (t.startDate <= today && endDate >= today);
    return `<div class="trip-item" style="border-left:4px solid ${color}">
      <div class="item-main">
        <div class="item-title">${esc(t.title)}${isToday ? ' <span class="tag tag-now">进行中</span>' : ''}</div>
        <div class="item-sub">📆 ${dateStr}${timeStr}</div>
        ${t.note ? `<div class="item-sub">📝 ${esc(t.note)}</div>` : ''}
      </div>
      <button class="btn btn-ghost btn-sm" onclick="editTrip('${t.id}')">编辑</button>
      <button class="del-btn" onclick="delTrip('${t.id}')">×</button>
    </div>`;
  };
  if (upcoming.length) {
    h += `<div class="section-title">🔜 即将到来</div>`;
    upcoming.forEach(t => { h += renderTripItem(t); });
  }
  if (past.length) {
    h += `<div class="section-title">📷 已完成</div>`;
    past.forEach(t => { h += renderTripItem(t); });
  }
  if (!list.length) h += `<div class="empty"><span class="emoji">📅</span>还没有行程，添加一个吧<div class="empty-sub">记录旅行、产检、约会、聚会等提前知道的日程</div></div>`;
  h += `</div>`;
  return h;
}
function addTrip() { openTripModal(null); }
function editTrip(id) { openTripModal(id); }
function openTripModal(id) {
  const list = Store.getTrips();
  const ed = id ? list.find(x => x.id === id) : null;
  const colors = ['#ffb3ba', '#ffdfba', '#ffffba', '#baffc9', '#bae1ff', '#e0bbff', '#ffc4e0', '#f4d1a8'];
  const selColor = ed?.color || colors[0];
  const body = `
    <div class="modal-head"><h3>${ed ? '✏️ 编辑行程' : '📅 新行程'}</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="field"><label>行程名称</label><input class="input" id="tripTitle" placeholder="如：三亚旅行、产检" value="${escapeAttr(ed?.title || '')}"></div>
    <div class="row">
      <div class="field"><label>开始日期</label><input class="input" id="tripSDate" type="date" value="${ed?.startDate || D.today()}"></div>
      <div class="field"><label>开始时间</label><input class="input" id="tripSTime" type="time" value="${escapeAttr(ed?.startTime || '')}"></div>
    </div>
    <div class="row">
      <div class="field"><label>结束日期</label><input class="input" id="tripEDate" type="date" value="${ed?.endDate || ed?.startDate || D.today()}"></div>
      <div class="field"><label>结束时间</label><input class="input" id="tripETime" type="time" value="${escapeAttr(ed?.endTime || '')}"></div>
    </div>
    <div class="field"><label>颜色标签</label>
      <div class="trip-color-picker">${colors.map((c,i) => `<button class="trip-color ${selColor === c ? 'active' : ''}" style="background:${c}" onclick="document.querySelectorAll('.trip-color').forEach(b=>b.classList.remove('active'));this.classList.add('active');this.dataset.color='${c}';document.getElementById('tripColor').value='${c}'">${selColor === c ? '✓' : ''}</button>`).join('')}</div>
      <input type="hidden" id="tripColor" value="${selColor}">
    </div>
    <div class="field"><label>备注</label><textarea class="textarea" id="tripNote" rows="2" placeholder="如：订了XX酒店，带好身份证">${escapeHtml(ed?.note || '')}</textarea></div>
    <button class="btn btn-block" onclick="saveTrip('${escapeAttr(id || '')}')">保存</button>
  `;
  openModal(body);
  setTimeout(() => $('#tripTitle').focus(), 100);
}
function saveTrip(id) {
  const title = $('#tripTitle').value.trim();
  if (!title) return;
  const startDate = $('#tripSDate').value;
  const endDate = $('#tripEDate').value || startDate;
  const startTime = $('#tripSTime').value;
  const endTime = $('#tripETime').value;
  const note = $('#tripNote').value.trim();
  const color = $('#tripColor').value;
  const list = Store.getTrips();
  if (id) {
    const idx = list.findIndex(x => x.id === id);
    if (idx >= 0) Object.assign(list[idx], { title, startDate, endDate, startTime, endTime, note, color });
  } else {
    list.push({ id: uid(), title, startDate, endDate, startTime, endTime, note, color });
  }
  Store.setTrips(list);
  closeModal(); toast('✅ 行程已保存'); render();
}
function delTrip(id) {
  if (!confirm('确定删除这个行程？')) return;
  Store.setTrips(Store.getTrips().filter(t => t.id !== id));
  toast('🗑 已删除'); render();
}

// 出门清单
function renderBags() {
  const bags = Store.getBags();
  const names = Object.keys(bags);
  let h = `<div class="card"><div class="card-title"><span class="title-left">🎒 出门收纳清单</span></div>`;
  if (!names.length) h += `<div class="empty"><span class="emoji">🎒</span>还没有添加包/清单</div>`;
  else names.forEach(name => {
    const items = bags[name] || [];
    const packed = items.filter(i => i.packed).length;
    h += `<div class="list-item">
      <div class="item-main"><div class="item-title">${esc(name)}</div><div class="item-sub">${packed}/${items.length} 已收纳</div></div>
      <button class="btn btn-ghost btn-sm" onclick="openBag('${esc(name)}')">打开</button>
      <button class="del-btn" onclick="delBag('${esc(name)}')">×</button></div>`;
  });
  h += `</div>`;
  return h;
}
function addBag() {
  openModal(`
    <div class="modal-head"><h3>添加出门清单</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="field"><label>包/场景名称</label><input class="input" id="bagName" placeholder="如 妈妈包/出差包/宝宝 diaper包"></div>
    <button class="btn btn-block" onclick="saveBag()">创建</button>
  `);
  setTimeout(() => $('#bagName').focus(), 100);
}
function saveBag() {
  const name = $('#bagName').value.trim();
  if (!name) return;
  const bags = Store.getBags();
  if (!bags[name]) bags[name] = [];
  Store.setBags(bags);
  closeModal();
  openBag(name);
}
function openBag(name) {
  const bags = Store.getBags();
  const items = bags[name] || [];
  let h = `<div class="modal-head"><h3>${esc(name)}</h3><button class="modal-close" onclick="closeModal();render()">×</button></div>`;
  h += `<div class="field"><label>添加收纳品</label>
    <div class="row"><input class="input" id="itemIn" placeholder="如 纸尿裤" onkeydown="if(event.key==='Enter')addItem('${esc(name)}')">
    <button class="btn btn-sm" onclick="addItem('${esc(name)}')">+</button></div></div>`;
  h += `<div id="bagList">`;
  if (!items.length) h += `<div class="empty"><span class="emoji">📭</span>还没有添加收纳品</div>`;
  else items.forEach(it => {
    h += `<div class="todo-item ${it.packed ? 'done' : ''}">
      <div class="checkbox" onclick="toggleItem('${esc(name)}','${it.id}')">${it.packed ? '✓' : ''}</div>
      <div class="todo-text" onclick="toggleItem('${esc(name)}','${it.id}')">${esc(it.text)}</div>
      <button class="del-btn" onclick="delItem('${esc(name)}','${it.id}')">×</button></div>`;
  });
  h += `</div>`;
  openModal(h);
  setTimeout(() => $('#itemIn')?.focus(), 100);
}
function addItem(name) {
  const text = $('#itemIn').value.trim();
  if (!text) return;
  const bags = Store.getBags();
  bags[name] = bags[name] || [];
  bags[name].push({ id: uid(), text, packed: false });
  Store.setBags(bags);
  openBag(name);
}
function toggleItem(name, id) {
  const bags = Store.getBags();
  const it = (bags[name] || []).find(x => x.id === id);
  if (it) { it.packed = !it.packed; Store.setBags(bags); openBag(name); }
}
function delItem(name, id) {
  const bags = Store.getBags();
  bags[name] = (bags[name] || []).filter(x => x.id !== id);
  Store.setBags(bags); openBag(name);
}
function delBag(name) {
  const bags = Store.getBags();
  delete bags[name];
  Store.setBags(bags); render();
}

// 好物分享
function renderShares() {
  const sub = subTab.share || 'good';
  let tabs = `<div class="sub-tabs">
    <button class="sub-tab ${sub === 'good' ? 'active' : ''}" onclick="setSubTab('share','good')">好物分享</button>
    <button class="sub-tab ${sub === 'makeup' ? 'active' : ''}" onclick="setSubTab('share','makeup')">妆容穿搭</button>
  </div>`;
  const list = Store.getShares().filter(s => s.type === sub).slice().reverse();
  let h = `<div class="card">`;
  if (!list.length) h += `<div class="empty"><span class="emoji">💄</span>还没有记录</div>`;
  else list.forEach(s => {
    h += `<div class="list-item">
      <div class="item-main">
        <div class="item-title">${esc(s.title)}</div>
        <div class="item-sub" style="margin-top:4px">${esc(s.content || '')}</div>
        ${s.image ? `<img class="img-preview" style="margin-top:6px" src="${s.image}">` : ''}
        <div class="item-sub" style="margin-top:4px">${D.fmt(s.date)} ${s.source ? '· 来自' + esc(s.source) : ''}</div>
      </div>
      <button class="del-btn" onclick="delShare('${s.id}')">×</button></div>`;
  });
  h += `</div>`;
  return tabs + h + `<button class="fab" onclick="addShare('${sub}')">+</button>`;
}
function addShare(type) {
  openModal(`
    <div class="modal-head"><h3>${type === 'good' ? '好物分享' : '妆容穿搭'}</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="field"><label>标题</label><input class="input" id="sTitle" placeholder="${type === 'good' ? '如 推荐的奶瓶' : '如 春日通勤穿搭'}"></div>
    <div class="field"><label>来源平台(选填)</label><input class="input" id="sSource" placeholder="如 小红书/淘宝"></div>
    <div class="field"><label>描述</label><textarea class="textarea" id="sContent" rows="3"></textarea></div>
    <div class="field"><label>图片(选填)</label><input class="input" id="sImage" type="file" accept="image/*"></div>
    <button class="btn btn-block" onclick="saveShare('${type}')">保存</button>
  `);
  setTimeout(() => $('#sTitle').focus(), 100);
}
async function saveShare(type) {
  const title = $('#sTitle').value.trim();
  if (!title) return;
  const source = $('#sSource').value.trim();
  const content = $('#sContent').value.trim();
  const image = await readImg($('#sImage').files[0]);
  const s = Store.getShares();
  s.push({ id: uid(), type, title, source, content, image, date: D.today() });
  Store.setShares(s);
  closeModal(); render();
}
function delShare(id) { Store.setShares(Store.getShares().filter(s => s.id !== id)); render(); }

// 衣物
function renderClothes() {
  const sub = subTab.cloth || 'all';
  const cats = [{ k: 'all', l: '全部' }, { k: 'baby', l: '宝宝' }, { k: 'mom', l: '妈妈' }];
  let tabs = `<div class="sub-tabs">`;
  cats.forEach(c => tabs += `<button class="sub-tab ${sub === c.k ? 'active' : ''}" onclick="setSubTab('cloth','${c.k}')">${c.l}</button>`);
  tabs += `</div>`;
  let list = Store.getClothes();
  if (sub !== 'all') list = list.filter(c => c.owner === sub);
  list = list.slice().reverse();
  let h = `<div class="card">`;
  if (!list.length) h += `<div class="empty"><span class="emoji">👕</span>还没有记录</div>`;
  else list.forEach(c => {
    h += `<div class="list-item">
      ${c.image ? `<img class="thumb" src="${c.image}">` : '<div class="thumb" style="display:flex;align-items:center;justify-content:center">👕</div>'}
      <div class="item-main">
        <div class="item-title">${esc(c.name)} <span class="tag ${c.owner === 'baby' ? 'tag-orange' : ''}">${c.owner === 'baby' ? '宝宝' : '妈妈'}</span></div>
        <div class="item-sub">${esc(c.size || '')} ${c.season ? '· ' + esc(c.season) : ''} ${c.note ? '· ' + esc(c.note) : ''}</div>
        <div class="item-sub">${D.fmt(c.date)}</div>
      </div>
      <button class="del-btn" onclick="delCloth('${c.id}')">×</button></div>`;
  });
  h += `</div>`;
  return tabs + h;
}
function addCloth() {
  openModal(`
    <div class="modal-head"><h3>添加衣物</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="row">
      <div class="field"><label>归属</label><select class="select" id="cOwner"><option value="baby">宝宝</option><option value="mom">妈妈</option></select></div>
      <div class="field"><label>季节</label><select class="select" id="cSeason"><option>春</option><option>夏</option><option>秋</option><option>冬</option></select></div>
    </div>
    <div class="field"><label>名称</label><input class="input" id="cName" placeholder="如 连体衣/连衣裙"></div>
    <div class="field"><label>尺码</label><input class="input" id="cSize" placeholder="如 80码/M"></div>
    <div class="field"><label>备注</label><input class="input" id="cNote" placeholder="如 价格/购入地"></div>
    <div class="field"><label>图片</label><input class="input" id="cImage" type="file" accept="image/*"></div>
    <button class="btn btn-block" onclick="saveCloth()">保存</button>
  `);
  setTimeout(() => $('#cName').focus(), 100);
}
async function saveCloth() {
  const owner = $('#cOwner').value;
  const season = $('#cSeason').value;
  const name = $('#cName').value.trim();
  if (!name) return;
  const size = $('#cSize').value.trim();
  const note = $('#cNote').value.trim();
  const image = await readImg($('#cImage').files[0]);
  const c = Store.getClothes();
  c.push({ id: uid(), owner, season, name, size, note, image, date: D.today() });
  Store.setClothes(c);
  closeModal(); render();
}
function delCloth(id) { Store.setClothes(Store.getClothes().filter(c => c.id !== id)); render(); }

// 消耗品（按地点分组）
// ---------- 过期辅助 ----------
// 生产日期+保质期(月) -> 计算距今天的过期状态
// 返回 {status: 'ok'|'warn'|'expired', daysLeft: 数字, expDate: 'YYYY-MM-DD'}
function expireInfo(prodDate, shelfMonths) {
  if (!prodDate || !shelfMonths) return null;
  const p = new Date(prodDate);
  if (isNaN(p.getTime())) return null;
  const m = Number(shelfMonths);
  if (!m || m <= 0) return null;
  const exp = new Date(p.getFullYear(), p.getMonth() + m, p.getDate());
  const today0 = new Date(); today0.setHours(0, 0, 0, 0);
  const exp0 = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());
  const diffDays = Math.round((exp0 - today0) / 86400000);
  let status = 'ok';
  if (diffDays < 0) status = 'expired';
  else if (diffDays <= 30) status = 'warn';
  return { status, daysLeft: diffDays, expDate: D.fmt(exp.getFullYear() + '-' +
    (exp.getMonth() + 1).toString().padStart(2, '0') + '-' +
    exp.getDate().toString().padStart(2, '0')) };
}
function renderConsumables() {
  const list = Store.getConsumables();
  // 过期汇总
  let expCount = 0, warnCount = 0;
  list.forEach(c => {
    const info = expireInfo(c.prodDate, c.shelf);
    if (info?.status === 'expired') expCount++;
    else if (info?.status === 'warn') warnCount++;
  });
  // 按地点分组（无地点归为"未分类"）
  const byLoc = {};
  list.forEach(c => {
    const loc = c.location || '未分类';
    if (!byLoc[loc]) byLoc[loc] = [];
    byLoc[loc].push(c);
  });
  let h = `<div class="card"><div class="card-title"><span class="title-left">🧴 消耗品库存</span>
    <button class="btn btn-ghost btn-sm" onclick="addConsumable()">+ 添加</button></div>`;
  if (expCount || warnCount) {
    h += `<div class="expire-summary">
      ${expCount ? `<span class="exp-badge exp-expired">❌ 已过期 ${expCount} 件</span>` : ''}
      ${warnCount ? `<span class="exp-badge exp-warn">⚠️ 30天内过期 ${warnCount} 件</span>` : ''}
    </div>`;
  }
  const locs = Object.keys(byLoc);
  if (!locs.length) h += `<div class="empty"><span class="emoji">🧴</span>还没有记录</div>`;
  else locs.forEach(loc => {
    const items = byLoc[loc];
    const lowCnt = items.filter(c => Number(c.stock) <= Number(c.warn || 1)).length;
    const expLocBad = items.filter(c => expireInfo(c.prodDate, c.shelf)?.status !== 'ok').length;
    h += `<div class="loc-group">
      <div class="loc-head">📍 ${esc(loc)} <span class="loc-count">${items.length}件${lowCnt ? ' · ⚠️' + lowCnt + '件低库存' : ''}${expLocBad ? ' · 🧪 ' + expLocBad + '件到期' : ''}</span></div>`;
    items.forEach(c => {
      const stock = Number(c.stock);
      const cls = stock <= 0 ? 'stock-empty' : stock <= Number(c.warn || 1) ? 'stock-low' : '';
      const info = expireInfo(c.prodDate, c.shelf);
      let expBadge = '';
      if (info?.status === 'expired') expBadge = `<span class="exp-tag exp-expired">已过期 ${Math.abs(info.daysLeft)}天</span>`;
      else if (info?.status === 'warn') expBadge = `<span class="exp-tag exp-warn">${info.daysLeft}天后到期</span>`;
      h += `<div class="list-item">
        <div class="item-main">
          <div class="item-title">${esc(c.name)} ${expBadge}</div>
          <div class="item-sub">剩余 <span class="${cls}">${stock} ${esc(c.unit || '')}</span>
          ${info ? ` · 到期 ${info.expDate}` : ''}
          ${c.prodDate ? ` · 生产 ${D.fmt(c.prodDate)}` : ''}
          ${c.shelf ? ` · 保质期${c.shelf}月` : ''}
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="editConsumable('${c.id}')">✏️</button>
        <button class="btn btn-ghost btn-sm" onclick="chgStock('${c.id}',1)">+</button>
        <button class="btn btn-ghost btn-sm" onclick="chgStock('${c.id}',-1)">-</button>
        <button class="del-btn" onclick="delConsumable('${c.id}')">×</button></div>`;
    });
    h += `</div>`;
  });
  h += `</div>`;
  return h;
}
function addConsumable(editId) {
  const list = Store.getConsumables();
  const existLocs = [...new Set(list.map(c => c.location).filter(Boolean))];
  const ed = editId ? list.find(c => c.id === editId) : null;
  openModal(`
    <div class="modal-head"><h3>${ed ? '编辑消耗品' : '添加消耗品'}</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <input type="hidden" id="cnId" value="${ed?.id || ''}">
    <div class="field"><label>所在地点</label><input class="input" id="cnLoc" list="locList" placeholder="如 客厅/卧室/厨房/宝宝房" value="${escapeAttr(ed?.location || '')}">
      <datalist id="locList">${existLocs.map(l => `<option value="${esc(l)}">`).join('')}</datalist></div>
    <div class="field"><label>名称</label><input class="input" id="cnName" placeholder="如 纸尿裤/奶粉" value="${escapeAttr(ed?.name || '')}"></div>
    <div class="row">
      <div class="field"><label>单位</label><input class="input" id="cnUnit" placeholder="如 片/罐" value="${escapeAttr(ed?.unit || '')}"></div>
      <div class="field"><label>剩余数量</label><input class="input" id="cnStock" type="number" value="${ed?.stock ?? 0}"></div>
    </div>
    <div class="row">
      <div class="field"><label>生产日期</label><input class="input" id="cnProd" type="date" value="${escapeAttr(ed?.prodDate || '')}"></div>
      <div class="field"><label>保质期(月)</label><input class="input" id="cnShelf" type="number" placeholder="如 12" value="${escapeAttr(ed?.shelf || '')}"></div>
    </div>
    <div class="field"><label>低库存提醒(低于此值)</label><input class="input" id="cnWarn" type="number" value="${ed?.warn ?? 2}"></div>
    <button class="btn btn-block" onclick="saveConsumable()">保存</button>
  `);
  setTimeout(() => $('#cnLoc').focus(), 100);
}
function editConsumable(id) { addConsumable(id); }
function saveConsumable() {
  const name = $('#cnName').value.trim();
  if (!name) return;
  const id = $('#cnId').value;
  const location = $('#cnLoc').value.trim() || '未分类';
  const unit = $('#cnUnit').value.trim();
  const stock = Number($('#cnStock').value || 0);
  const warn = Number($('#cnWarn').value || 2);
  const prodDate = $('#cnProd').value || '';
  const shelf = $('#cnShelf').value ? Number($('#cnShelf').value) : '';
  const c = Store.getConsumables();
  if (id) {
    const x = c.find(y => y.id === id);
    if (x) Object.assign(x, { name, location, unit, stock, warn, prodDate, shelf });
  } else {
    c.push({ id: uid(), name, location, unit, stock, warn, prodDate, shelf });
  }
  Store.setConsumables(c);
  closeModal(); render();
}
function chgStock(id, delta) {
  const c = Store.getConsumables();
  const x = c.find(y => y.id === id);
  if (x) { x.stock = Math.max(0, Number(x.stock) + delta); Store.setConsumables(c); render(); }
}
function delConsumable(id) { Store.setConsumables(Store.getConsumables().filter(c => c.id !== id)); render(); }

// ========= 拉屎记录月历 =========
let poopYM = null; // {y, m}
const POOP_SHAPES = { 1: '🟤硬', 2: '💩正常', 3: '🟡软', 4: '🟧稀' };
const POOP_COLORS = { 1: '棕色', 2: '深色', 3: '黑色', 4: '黄色' };
function renderPoops() {
  const now = new Date();
  if (!poopYM) poopYM = { y: now.getFullYear(), m: now.getMonth() };
  const { y, m } = poopYM;
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  const startWeekday = first.getDay();
  const daysInMonth = last.getDate();
  const todayStr = D.today();
  const todayDate = new Date();
  const isCurMonth = y === todayDate.getFullYear() && m === todayDate.getMonth();

  const poops = Store.getPoops();
  // 本月统计
  let monthCnt = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const p = poops.find(x => x.date === ds);
    if (p) monthCnt += Number(p.count || 1);
  }
  // 近7天统计
  let weekCnt = 0, weekDays = 0;
  for (let i = 0; i < 7; i++) {
    const ds = D.offset(-i);
    const p = poops.find(x => x.date === ds);
    if (p) { weekCnt += Number(p.count || 1); weekDays++; }
  }
  const todayPoop = Store.getPoopBy(D.today());

  let h = `<div class="card poop-card">
    <div class="cal-head">
      <button class="cal-nav" onclick="poopMove(-1)">‹</button>
      <div class="cal-title">${y}年${m + 1}月${isCurMonth ? '<span class="tag tag-green" style="margin-left:6px">本月</span>' : ''}</div>
      <button class="cal-nav" onclick="poopMove(1)">›</button>
    </div>
    <div class="stat-row">
      <div class="stat-box"><div class="num">${monthCnt}</div><div class="label">本月次数</div></div>
      <div class="stat-box"><div class="num">${weekCnt}</div><div class="label">近7天</div></div>
      <div class="stat-box"><div class="num">${weekDays ? (weekCnt / weekDays).toFixed(1) : '0'}</div><div class="label">日均(7天)</div></div>
    </div>
    ${!isCurMonth ? `<button class="btn btn-ghost btn-sm" onclick="poopGoToday()" style="margin-bottom:8px">回到今天</button>` : ''}
    <div class="poop-quick">
      <div class="poop-today-info">${todayPoop ? `今日已记录 ${POOP_SHAPES[todayPoop.shape] || ''} ${todayPoop.count || 1}次` : '今日未记录'}</div>
      <button class="btn btn-block" onclick="poopQuick()">💩 一键记录今日</button>
    </div>
    <div class="cal-grid">
      <div class="cal-wk">日</div><div class="cal-wk">一</div><div class="cal-wk">二</div><div class="cal-wk">三</div><div class="cal-wk">四</div><div class="cal-wk">五</div><div class="cal-wk">六</div>`;
  for (let i = 0; i < startWeekday; i++) h += `<div class="cal-cell empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const p = poops.find(x => x.date === ds);
    const isToday = ds === todayStr;
    const emoji = p ? (Number(p.count) > 1 ? '💩×' + p.count : '💩') : '';
    h += `<div class="cal-cell poop-cell ${isToday ? 'today' : ''} ${p ? 'has-rec' : ''}" onclick="openPoop('${ds}')">
      <div class="cal-date">${d}</div>
      ${emoji ? `<div class="cal-preview">${emoji}</div>` : ''}
      ${p && p.shape ? `<div class="poop-shape-mini">${{1:'🟤',2:'💩',3:'🟡',4:'🟧'}[p.shape] || ''}</div>` : ''}
    </div>`;
  }
  h += `</div></div>`;
  // 当月记录列表
  const monthRecs = poops.filter(p => p.date.startsWith(`${y}-${String(m + 1).padStart(2, '0')}`)).sort((a, b) => b.date.localeCompare(a.date));
  h += `<div class="card"><div class="card-title"><span class="title-left">📋 ${m + 1}月记录</span></div>`;
  if (!monthRecs.length) h += `<div class="empty"><span class="emoji">💩</span>本月还没有记录</div>`;
  else monthRecs.forEach(p => {
    h += `<div class="list-item">
      <div class="item-main"><div class="item-title">${D.fmt(p.date)} ${POOP_SHAPES[p.shape] || ''} · ${p.count || 1}次</div>
        <div class="item-sub">${p.time ? '⏰' + p.time + ' ' : ''}${p.color ? POOP_COLORS[p.color] + ' ' : ''}${p.note ? '· ' + esc(p.note) : ''}</div></div>
      <button class="btn btn-ghost btn-sm" onclick="openPoop('${p.date}')">改</button>
      <button class="del-btn" onclick="delPoop('${p.date}')">×</button></div>`;
  });
  h += `</div>`;
  return h;
}
function poopMove(delta) {
  let { y, m } = poopYM;
  m += delta;
  if (m < 0) { m = 11; y--; }
  if (m > 11) { m = 0; y++; }
  poopYM = { y, m };
  render();
}
function poopGoToday() {
  const d = new Date();
  poopYM = { y: d.getFullYear(), m: d.getMonth() };
  render();
}
function poopQuick() {
  const date = D.today();
  const old = Store.getPoopBy(date) || {};
  Store.setPoopOne({
    id: old.id || uid(), date,
    count: (Number(old.count) || 0) + 1,
    time: nowHHMM(),
    shape: old.shape || 2,
    color: old.color || 1,
    note: old.note || ''
  });
  toast('💩 已记录今日一次');
  render();
}
function openPoop(date) {
  const old = Store.getPoopBy(date) || { count: 0, shape: 2, color: 1, time: '', note: '' };
  openModal(`
    <div class="modal-head"><h3>💩 拉屎记录 ${D.fmt(date)}</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="field"><label>次数</label><input class="input" id="pCount" type="number" value="${old.count || 1}" min="1"></div>
    <div class="field"><label>时间</label><input class="input" id="pTime" type="time" value="${old.time || nowHHMM()}"></div>
    <div class="field"><label>形状</label><select class="select" id="pShape">
      <option value="1" ${old.shape == 1 ? 'selected' : ''}>🟤 偏硬</option>
      <option value="2" ${old.shape == 2 ? 'selected' : ''}>💩 正常</option>
      <option value="3" ${old.shape == 3 ? 'selected' : ''}>🟡 偏软</option>
      <option value="4" ${old.shape == 4 ? 'selected' : ''}>🟧 稀</option>
    </select></div>
    <div class="field"><label>颜色</label><select class="select" id="pColor">
      <option value="1" ${old.color == 1 ? 'selected' : ''}>棕色</option>
      <option value="2" ${old.color == 2 ? 'selected' : ''}>深色</option>
      <option value="3" ${old.color == 3 ? 'selected' : ''}>黑色</option>
      <option value="4" ${old.color == 4 ? 'selected' : ''}>黄色</option>
    </select></div>
    <div class="field"><label>备注</label><input class="input" id="pNote" value="${esc(old.note || '')}" placeholder="如 顺畅/费力"></div>
    <button class="btn btn-block" onclick="savePoop('${date}')">保存</button>
  `);
}
function savePoop(date) {
  const count = Number($('#pCount').value || 1);
  const time = $('#pTime').value;
  const shape = Number($('#pShape').value);
  const color = Number($('#pColor').value);
  const note = $('#pNote').value.trim();
  const old = Store.getPoopBy(date) || {};
  Store.setPoopOne({ id: old.id || uid(), date, count, time, shape, color, note });
  closeModal(); render();
}
function delPoop(date) {
  if (!confirm('删除这一天的拉屎记录？')) return;
  Store.setPoops(Store.getPoops().filter(p => p.date !== date));
  render();
}

// ========= 待购物清单 =========
function renderShop() {
  const list = Store.getShop();
  const cats = Store.getShopCats();
  const collapsed = Store.getShopCollapsed();
  const pending = list.filter(s => !s.done);
  const done = list.filter(s => s.done);
  let h = `<div class="card shop-card">
    <div class="card-title">
      <span class="title-left">🛒 待购物清单</span>
      <span class="count-badge">待买 ${pending.length} · 已买 ${done.length}</span>
    </div>
    <div class="shop-add-row">
      <div class="shop-add-main">
        <input class="input tips-input" id="shopInput" placeholder="输入要买的东西，回车或点添加" onkeydown="if(event.key==='Enter')shopAdd()" />
        <div class="shop-sub">
          <input class="input input-sm" id="shopQty" placeholder="数量 (如 2 / 500g)" style="flex:1" />
          <select class="select select-sm" id="shopCat" style="flex:1.2">
            <option value="">选分类</option>
            ${cats.map(c => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join('')}
          </select>
          <button class="btn btn-sm btn-ghost" onclick="shopAddCat()" title="新增分类">+ 分类</button>
        </div>
      </div>
      <button class="btn" onclick="shopAdd()">添加</button>
    </div>
  </div>`;
  if (!list.length) {
    h += `<div class="empty-state">🛒 还没有待购物品，想到了就加进来吧～</div>`;
    return h;
  }
  // 分类汇总（按 category），空分类归到"其他"
  const catMap = {};
  const ensureCat = (c) => {
    const k = (c || '').trim() || '其他';
    if (!catMap[k]) catMap[k] = [];
    return k;
  };
  pending.forEach(s => {
    const k = ensureCat(s.category);
    catMap[k].push(s);
  });
  // 渲染未买（按分类分组 + 折叠）
  if (pending.length) {
    h += '<div class="shop-section"><div class="shop-section-title">📌 待买</div>';
    // 优先按预设分类顺序，再加用户自定义分类
    const allKeys = Object.keys(catMap).sort((a, b) => {
      const ia = cats.indexOf(a), ib = cats.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b, 'zh');
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    allKeys.forEach(cat => {
      const isCollapsed = collapsed.includes(cat);
      const items = catMap[cat];
      const doneInCat = list.filter(s => s.done && ((s.category || '').trim() || '其他') === cat).length;
      h += `<div class="shop-group">
        <div class="shop-group-head" onclick="shopToggleCollapse('${escapeAttr(cat)}')">
          <span class="shop-group-arrow">${isCollapsed ? '▶' : '▼'}</span>
          <span class="shop-group-label">🏷 ${escapeHtml(cat)}</span>
          <span class="shop-group-cnt">待买 ${items.length}${doneInCat ? ` · 已买 ${doneInCat}` : ''}</span>
        </div>
        <div class="shop-group-body ${isCollapsed ? 'is-collapsed' : ''}">`;
      items.forEach(s => {
        const idx = list.findIndex(x => x.id === s.id);
        h += `<div class="shop-item">
          <label class="shop-check">
            <input type="checkbox" onchange="shopToggle(${idx})" />
            <span class="shop-name">${escapeHtml(s.name)}</span>
            ${s.qty ? `<span class="shop-qty">×${escapeHtml(s.qty)}</span>` : ''}
            ${s.shop ? `<span class="shop-shop">📍 ${escapeHtml(s.shop)}</span>` : ''}
          </label>
          <div class="shop-item-actions">
            <button class="btn btn-sm btn-ghost" onclick="shopEdit(${idx})">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="shopDel(${idx})">🗑</button>
          </div>
        </div>`;
      });
      h += '</div></div>';
    });
    h += '</div>';
  }
  // 渲染已买（按分类分组 + 折叠）
  if (done.length) {
    const doneMap = {};
    const ensureD = (c) => {
      const k = (c || '').trim() || '其他';
      if (!doneMap[k]) doneMap[k] = [];
      return k;
    };
    done.forEach(s => {
      const k = ensureD(s.category);
      doneMap[k].push(s);
    });
    const doneCollapsed = Store.getShopCollapsedDone ? Store.getShopCollapsedDone() : [];
    h += '<div class="shop-section shop-done"><div class="shop-section-title">✅ 已买</div>';
    const dKeys = Object.keys(doneMap).sort((a, b) => {
      const ia = cats.indexOf(a), ib = cats.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b, 'zh');
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    dKeys.forEach(cat => {
      const isCollapsed = doneCollapsed.includes(cat);
      const items = doneMap[cat];
      h += `<div class="shop-group shop-group-done">
        <div class="shop-group-head" onclick="shopToggleCollapseDone('${escapeAttr(cat)}')">
          <span class="shop-group-arrow">${isCollapsed ? '▶' : '▼'}</span>
          <span class="shop-group-label">🏷 ${escapeHtml(cat)}</span>
          <span class="shop-group-cnt">${items.length}</span>
        </div>
        <div class="shop-group-body ${isCollapsed ? 'is-collapsed' : ''}">`;
      items.forEach(s => {
        const idx = list.findIndex(x => x.id === s.id);
        h += `<div class="shop-item shop-item-done">
          <label class="shop-check">
            <input type="checkbox" checked onchange="shopToggle(${idx})" />
            <span class="shop-name">${escapeHtml(s.name)}</span>
            ${s.qty ? `<span class="shop-qty">×${escapeHtml(s.qty)}</span>` : ''}
            ${s.shop ? `<span class="shop-shop">📍 ${escapeHtml(s.shop)}</span>` : ''}
          </label>
          <div class="shop-item-actions">
            <button class="btn btn-sm btn-danger" onclick="shopDel(${idx})">🗑</button>
          </div>
        </div>`;
      });
      h += '</div></div>';
    });
    h += '</div>';
  }
  return h;
}
function shopAdd() {
  const el = $('#shopInput');
  const qtyEl = $('#shopQty');
  const catEl = $('#shopCat');
  const name = (el?.value || '').trim();
  if (!name) { toast('请输入要买的东西'); return; }
  const list = Store.getShop();
  list.push({
    id: uid(),
    name,
    qty: (qtyEl?.value || '').trim(),
    category: (catEl?.value || '').trim() || '其他',
    shop: '',
    done: false,
    createdAt: D.today()
  });
  Store.setShop(list);
  // 把新分类合并到分类列表
  if ((catEl?.value || '').trim()) {
    const cats = Store.getShopCats();
    const c = catEl.value.trim();
    if (!cats.includes(c)) {
      cats.push(c);
      Store.setShopCats(cats);
    }
  }
  toast('🛒 已加入待购物清单');
  render();
}
// 新增分类（管理分类列表）
function shopAddCat() {
  openModal(`<div class="modal-card">
    <h3>🏷 管理分类</h3>
    <div id="shopCatList"></div>
    <div class="field"><label>新增分类</label>
      <div class="shop-add-main" style="flex-direction:row;gap:6px">
        <input class="input" id="newCatName" placeholder="输入分类名" onkeydown="if(event.key==='Enter')shopSaveNewCat()" />
        <button class="btn" onclick="shopSaveNewCat()">添加</button>
      </div>
    </div>
    <div class="row">
      <button class="btn btn-ghost" onclick="closeModal()">完成</button>
    </div>
  </div>`);
  shopRenderCatMgr();
}
function shopRenderCatMgr() {
  const cats = Store.getShopCats();
  const box = $('#shopCatList');
  if (!box) return;
  let h = '<div class="shop-cat-mgr">';
  cats.forEach((c, i) => {
    h += `<div class="shop-cat-row">
      <span>🏷 ${escapeHtml(c)}</span>
      <div class="shop-cat-ops">
        ${i > 0 ? `<button class="btn btn-xs btn-ghost" onclick="shopCatMove(${i},-1)">↑</button>` : ''}
        ${i < cats.length - 1 ? `<button class="btn btn-xs btn-ghost" onclick="shopCatMove(${i},1)">↓</button>` : ''}
        <button class="btn btn-xs btn-danger" onclick="shopCatDel(${i})">删除</button>
      </div>
    </div>`;
  });
  h += '</div>';
  box.innerHTML = h;
}
function shopSaveNewCat() {
  const el = $('#newCatName');
  const name = (el?.value || '').trim();
  if (!name) return;
  const cats = Store.getShopCats();
  if (cats.includes(name)) { toast('该分类已存在'); return; }
  cats.push(name);
  Store.setShopCats(cats);
  toast('✅ 已添加');
  shopRenderCatMgr();
  if (el) el.value = '';
}
function shopCatMove(i, d) {
  const cats = Store.getShopCats();
  const j = i + d;
  if (j < 0 || j >= cats.length) return;
  [cats[i], cats[j]] = [cats[j], cats[i]];
  Store.setShopCats(cats);
  shopRenderCatMgr();
}
function shopCatDel(i) {
  const cats = Store.getShopCats();
  const name = cats[i];
  if (!confirm(`删除分类「${name}」？该分类下的物品会归到"其他"`)) return;
  cats.splice(i, 1);
  Store.setShopCats(cats);
  // 清理已购/待购中的该分类名，归为其他
  const list = Store.getShop();
  list.forEach(s => { if (s.category === name) s.category = '其他'; });
  Store.setShop(list);
  shopRenderCatMgr();
}
// 折叠/展开分类（待买）
function shopToggleCollapse(cat) {
  const arr = Store.getShopCollapsed();
  const i = arr.indexOf(cat);
  if (i >= 0) arr.splice(i, 1); else arr.push(cat);
  Store.setShopCollapsed(arr);
  render();
}
// 折叠/展开分类（已买）
function shopToggleCollapseDone(cat) {
  let arr;
  try { arr = Store.getShopCollapsedDone(); } catch (e) { arr = []; }
  if (!Array.isArray(arr)) arr = [];
  const i = arr.indexOf(cat);
  if (i >= 0) arr.splice(i, 1); else arr.push(cat);
  DB.set('shopCollapsedDone', arr);
  render();
}
function shopToggle(idx) {
  const list = Store.getShop();
  if (!list[idx]) return;
  list[idx].done = !list[idx].done;
  if (list[idx].done) list[idx].doneAt = D.today();
  Store.setShop(list);
  toast(list[idx].done ? '✅ 已标记为已买' : '📌 已标记为待买');
  render();
}
function shopEdit(idx) {
  const list = Store.getShop();
  const s = list[idx];
  if (!s) return;
  const cats = Store.getShopCats();
  const curCat = (s.category || '').trim() || '其他';
  openModal(`<div class="modal-card">
    <h3>✏️ 编辑物品</h3>
    <div class="field"><label>名称</label><input class="input" id="shopName" value="${escapeAttr(s.name)}"></div>
    <div class="row">
      <div class="field"><label>数量</label><input class="input" id="shopQty" value="${escapeAttr(s.qty || '')}" placeholder="如 2 / 500g"></div>
      <div class="field"><label>类别</label>
        <select class="select" id="shopCat">
          <option value="">选分类</option>
          ${cats.map(c => `<option value="${escapeAttr(c)}" ${curCat === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="field"><label>购买地点</label><input class="input" id="shopShop" value="${escapeAttr(s.shop || '')}" placeholder="如 山姆/京东/楼下超市"></div>
    <div class="row">
      <button class="btn btn-ghost" onclick="closeModal()">取消</button>
      <button class="btn" onclick="shopSave(${idx})">保存</button>
    </div>
  </div>`);
}
function shopSave(idx) {
  const list = Store.getShop();
  if (!list[idx]) return;
  list[idx].name = ($('#shopName').value || '').trim();
  list[idx].qty = ($('#shopQty').value || '').trim();
  const catVal = ($('#shopCat').value || '').trim();
  list[idx].category = catVal || '其他';
  list[idx].shop = ($('#shopShop').value || '').trim();
  // 新分类合并
  if (catVal) {
    const cats = Store.getShopCats();
    if (!cats.includes(catVal)) { cats.push(catVal); Store.setShopCats(cats); }
  }
  Store.setShop(list);
  toast('✅ 已保存');
  closeModal();
  render();
}
function shopDel(idx) {
  if (!confirm('删除这个物品？')) return;
  const list = Store.getShop();
  list.splice(idx, 1);
  Store.setShop(list);
  toast('🗑 已删除');
  render();
}

// ========= 突发奇想/生活tips =========
function renderTips(type) {
  const isSudden = type === 'sudden';
  const list = isSudden ? Store.getTipsSudden() : Store.getTipsLife();
  const icon = isSudden ? '💡' : '🌱';
  const title = isSudden ? '突发奇想小tips' : '生活小tips';
  const placeholder = isSudden ? '突然想到的点子、灵感、创意…' : '生活里学到的、用得上的小窍门…';
  // 顶部输入框 + 列表
  let h = `<div class="card tips-card ${isSudden ? 'tips-sudden' : 'tips-life'}">
    <div class="card-title"><span class="title-left">${icon} ${title}</span><span class="count-badge">${list.length} 条</span></div>
    <div class="tips-input-row">
      <input class="input tips-input" id="tipInput_${type}" placeholder="${placeholder}" onkeydown="if(event.key==='Enter')addTip('${type}')" />
      <button class="btn" onclick="addTip('${type}')">添加</button>
    </div>
  </div>`;
  if (!list.length) {
    h += `<div class="empty-state">${icon} 还没有记录，想到什么随时写下来～</div>`;
    return h;
  }
  // 倒序显示，最新的在前
  h += '<div class="tips-list">';
  list.slice().reverse().forEach((t, idx) => {
    const realIdx = list.length - 1 - idx;
    h += `<div class="tip-item ${isSudden ? 'tip-sudden' : 'tip-life'}">
      <div class="tip-text">${escapeHtml(t.text)}</div>
      <div class="tip-meta">
        <span class="tip-date">📅 ${t.date} ${t.time || ''}</span>
        <span class="tip-actions">
          <button class="btn btn-sm btn-ghost" onclick="editTip('${type}', ${realIdx})">✏️ 编辑</button>
          <button class="btn btn-sm btn-danger" onclick="delTip('${type}', ${realIdx})">🗑</button>
        </span>
      </div>
    </div>`;
  });
  h += '</div>';
  return h;
}
function addTip(type) {
  const inputId = `tipInput_${type}`;
  const el = document.getElementById(inputId);
  const text = (el?.value || '').trim();
  if (!text) { toast('请先写点什么'); return; }
  const list = type === 'sudden' ? Store.getTipsSudden() : Store.getTipsLife();
  const now = new Date();
  list.push({
    id: uid(),
    text,
    date: D.today(),
    time: now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0')
  });
  if (type === 'sudden') Store.setTipsSudden(list); else Store.setTipsLife(list);
  toast('✅ 已添加');
  render();
}
function editTip(type, idx) {
  const list = type === 'sudden' ? Store.getTipsSudden() : Store.getTipsLife();
  const t = list[idx];
  if (!t) return;
  openModal(`<div class="modal-card">
    <h3>✏️ 编辑 ${type === 'sudden' ? '灵感' : '生活tip'}</h3>
    <div class="field"><textarea class="textarea" id="editTipText" rows="4">${escapeHtml(t.text)}</textarea></div>
    <div class="row">
      <button class="btn btn-ghost" onclick="closeModal()">取消</button>
      <button class="btn" onclick="saveTip('${type}', ${idx})">保存</button>
    </div>
  </div>`);
}
function saveTip(type, idx) {
  const text = ($('#editTipText')?.value || '').trim();
  if (!text) { toast('内容不能为空'); return; }
  const list = type === 'sudden' ? Store.getTipsSudden() : Store.getTipsLife();
  list[idx].text = text;
  if (type === 'sudden') Store.setTipsSudden(list); else Store.setTipsLife(list);
  toast('✅ 已保存');
  closeModal();
  render();
}
function delTip(type, idx) {
  if (!confirm('删除这条？')) return;
  const list = type === 'sudden' ? Store.getTipsSudden() : Store.getTipsLife();
  list.splice(idx, 1);
  if (type === 'sudden') Store.setTipsSudden(list); else Store.setTipsLife(list);
  toast('🗑 已删除');
  render();
}

// ========= 数据管理（导出/导入/清空） =========
// 所有持久化数据键
const DATA_KEYS = [
  'days', 'weekly', 'monthly', 'medList', 'accounts', 'trades', 'baby',
  'weights', 'bags', 'shares', 'clothes', 'consumables', 'routine',
  'sleepTarget', 'sleepList', 'babySleep', 'ledgers', 'poops',
  'tipsSudden', 'tipsLife', 'shop', 'notifyEnabled', 'notifyTimes',
  'babyCats', 'trips'
];
function renderData() {
  // 统计各模块数据量
  const stats = [
    { icon: '🏠', label: '每日打卡', get: () => Object.keys(DB.get('days', {})).length + ' 天' },
    { icon: '📋', label: '每周/月计划', get: () => {
        const wa = Store.getWeeklyAll(); const ma = Store.getMonthlyAll();
        let c = 0;
        for (const k in wa) c += wa[k].length;
        for (const k in ma) c += ma[k].length;
        return c + ' 条';
      }},
    { icon: '💊', label: '用药清单', get: () => Store.getMedList().length + ' 项' },
    { icon: '💰', label: '账目记录', get: () => Store.getAccounts().length + ' 条' },
    { icon: '📦', label: '买卖记录', get: () => Store.getTrades().length + ' 条' },
    { icon: '👶', label: '宝宝成长', get: () => Store.getBaby().length + ' 条' },
    { icon: '⚖️', label: '体重', get: () => Store.getWeights().length + ' 条' },
    { icon: '😴', label: '宝宝睡眠', get: () => Store.getBabySleep().length + ' 天' },
    { icon: '🧴', label: '消耗品', get: () => Store.getConsumables().length + ' 项' },
    { icon: '💩', label: '拉屎记录', get: () => Store.getPoops().length + ' 天' },
    { icon: '👕', label: '衣物', get: () => Store.getClothes().length + ' 件' },
    { icon: '💄', label: '好物分享', get: () => Store.getShares().length + ' 条' }
  ];
  let h = `<div class="card"><div class="card-title"><span class="title-left">💾 数据管理</span></div>
    <div class="data-stats">`;
  stats.forEach(s => {
    let cnt = '';
    try { cnt = s.get(); } catch (e) { cnt = '0'; }
    h += `<div class="data-stat"><span class="ds-icon">${s.icon}</span><span class="ds-label">${s.label}</span><span class="ds-num">${cnt}</span></div>`;
  });
  h += `</div></div>`;
  // 操作区
  h += `<div class="card"><div class="card-title"><span class="title-left">💌 一键微信备份</span></div>
    <div class="data-actions" style="gap:8px">
      <button class="btn btn-block" style="background:linear-gradient(135deg,#07c160,#10d16b);color:#fff;border-color:#07c160" onclick="exportForWeChat()">💌 导出备份并发到微信</button>
    </div>
    <div class="data-tip" style="margin-top:6px">
      ✨ 点一下：下载备份文件 + 显示微信发送步骤。建议设为每周代办提醒自己备份一次。
    </div>
  </div>`;
  h += `<div class="card"><div class="card-title"><span class="title-left">📤 备份与恢复</span></div>
    <div class="data-actions">
      <button class="btn btn-block" onclick="exportData()">📤 导出全部数据（JSON）</button>
      <button class="btn btn-ghost btn-block" onclick="$('#importFile').click()">📥 导入数据（覆盖现有）</button>
      <input type="file" id="importFile" accept=".json,application/json" style="display:none" onchange="importData(this)">
      <button class="btn btn-danger btn-block" onclick="clearAllData()">🗑 清空全部数据</button>
    </div>
    <div class="data-tip">💡 导出的 JSON 文件包含所有打卡、账目、记录。换手机/浏览器时用「导入」恢复。建议每周导出一次做备份。</div>
  </div>
  <div class="card"><div class="card-title"><span class="title-left">🔄 应用更新</span></div>
    <div class="data-actions" style="gap:6px">
      <div class="app-ver-row">
        <div class="app-ver-label">当前版本</div>
        <div class="app-ver-val" id="appVerVal">v29 · ${new Date().toLocaleDateString('zh-CN')}</div>
      </div>
      <button class="btn btn-block" style="background:linear-gradient(135deg,#ff7ab0,#ff9fc6);color:#fff;border-color:#ff7ab0" onclick="downloadApp()">⬇️ 下载最新版APP（单文件离线版）</button>
      <button class="btn btn-block" onclick="checkAppUpdate()">🔍 检查更新（立即联网）</button>
      <button class="btn btn-ghost btn-block" onclick="clearAppCacheAndReload()">♻️ 清除缓存强制刷新</button>
    </div>
    <div class="data-tip">💡 桌面应用（PWA）会自动检查更新，不生效时点上面两个按钮立刻处理。下载单文件版后双击就能离线用。</div>
  </div>`;
  return h;
}

// ========= 下载APP（稳定版）：先弹窗，再用 fetch+blob 同源下载，避免 a[download] 把当前页面顶没 =========
function downloadApp() {
  const localName = '甜酱日常.html';
  const versionStamp = 'v29';
  const url = new URL(localName, location.href).toString();
  const saveName = `甜酱日常-${versionStamp}.html`;

  // 先把弹窗开出来（用户一定看得到，不会像以前直接跳走）
  openModal(`
    <div class="modal-head"><h3>⬇️ 下载 甜酱日常 ${versionStamp}</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div style="padding:6px 0 4px;line-height:1.8;font-size:14px;color:var(--text)">
      <div style="font-weight:600;color:var(--pink-deep);margin-bottom:6px">选下面任一方式下载，推荐方式一：</div>

      <div style="background:var(--pink-soft);border-radius:12px;padding:12px 14px;margin:8px 0">
        <b>方式一 · 直接保存文件（稳定，Blob 同源下载）</b>
        <div style="margin-top:8px">
          <button class="btn btn-block" style="background:linear-gradient(135deg,#ff7ab0,#ff9fc6);color:#fff;border-color:#ff7ab0" onclick="__downloadBlobApp('${encodeURIComponent(url)}','${saveName}',this)">⬇️ 立即下载到本地</button>
        </div>
        <div id="__blobSt" style="margin-top:6px;font-size:12px;color:#b34b7c;min-height:18px"></div>
      </div>

      <div style="background:#eef6ff;border-radius:12px;padding:12px 14px;margin-top:6px">
        <b>方式二 · 先打开再手动保存（保底）</b>
        <div style="margin-top:8px">
          <a class="btn btn-block" style="text-decoration:none" href="${encodeURIComponent(url)}" target="_blank" rel="noopener nofollow">🔗 在新标签打开单文件版页面</a>
        </div>
        <div style="font-size:12px;opacity:0.85;margin-top:6px;line-height:1.6">
          打开后按系统保存：<br>
          · iOS Safari：底部「分享」→「存储到文件」<br>
          · 安卓：右上角菜单 →「下载 / 离线保存」<br>
          · 电脑：Ctrl + S 另存为 .html
        </div>
      </div>

      <div style="background:#fff7e6;border-radius:12px;padding:12px 14px;margin-top:6px;color:#b2791a">
        <b>方式三 · 复制链接自己粘贴到浏览器打开</b>
        <div style="margin-top:8px;display:flex;gap:6px">
          <input id="__dlLinkInput" readonly style="flex:1;padding:8px 10px;border:1px solid #eecfa3;border-radius:8px;background:#fffbea;font-size:12px;word-break:break-all" value="${url.replace(/"/g,'&quot;')}">
          <button class="btn" style="flex-shrink:0" onclick="__copyLinkApp()">复制</button>
        </div>
      </div>

      <div style="background:#f7efff;border-radius:12px;padding:10px 12px;margin-top:8px;font-size:13px;color:#6d3ea6;line-height:1.6">
        📌 下载下来的 .html <b>双击就能用</b>，内嵌了所有资源，不用服务器也不用联网。存到微信「文件传输助手」做个备份更安心～
      </div>
    </div>
    <button class="btn btn-ghost btn-block" onclick="closeModal()">关闭</button>
  `);
}

// Blob 下载：fetch 读字节 -> Blob -> a.click(objectURL)，不会把当前页面顶走
function __downloadBlobApp(urlEnc, saveName, btnEl) {
  const stEl = document.getElementById('__blobSt');
  const setSt = (t) => { if (stEl) stEl.textContent = t; };
  const url = decodeURIComponent(urlEnc);
  try {
    if (btnEl) { btnEl.disabled = true; btnEl.style.opacity = '0.7'; }
    setSt('📦 正在读取文件（约 550KB）...');
    fetch(url, { cache: 'no-store', credentials: 'same-origin' })
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.blob();
      })
      .then(blob => {
        setSt('✅ 文件准备完成，触发保存弹窗中...');
        const objURL = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objURL;
        a.download = saveName;
        // 关键：不设 target，且只用于 objectURL —— 不会导航
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(objURL), 5000);
        setTimeout(() => {
          setSt('✨ 如果系统没有弹出保存，就点上面「方式二」打开再手动保存～');
          if (btnEl) { btnEl.disabled = false; btnEl.style.opacity = '1'; }
        }, 1500);
      })
      .catch(err => {
        setSt('❌ 失败：' + (err?.message || err));
        if (btnEl) { btnEl.disabled = false; btnEl.style.opacity = '1'; }
      });
  } catch (err) {
    setSt('❌ 出错：' + (err?.message || err));
    if (btnEl) { btnEl.disabled = false; btnEl.style.opacity = '1'; }
  }
}
// 复制下载链接
function __copyLinkApp() {
  const input = document.getElementById('__dlLinkInput');
  if (!input) return;
  const txt = input.value;
  try {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(txt).then(() => toast('✅ 已复制，粘贴到浏览器打开就能下载'));
      return;
    }
  } catch (e) { /* fallthrough */ }
  try {
    input.removeAttribute('readonly');
    input.select();
    const ok = document.execCommand('copy');
    input.setAttribute('readonly', 'readonly');
    toast(ok ? '✅ 已复制' : '请长按输入框手动复制');
  } catch (e2) { toast('请长按输入框手动复制'); }
}
// 检查 PWA 更新
function checkAppUpdate() {
  if (!('serviceWorker' in navigator)) { toast('浏览器不支持 PWA'); return; }
  navigator.serviceWorker.getRegistration().then(reg => {
    if (!reg) { toast('⚠️ 当前未安装为桌面应用，可忽略'); return; }
    toast('🔍 正在检查更新...');
    reg.update().then(() => {
      const waiting = reg.waiting, installing = reg.installing;
      if (waiting) {
        toast('✨ 已发现新版本，点击确认刷新');
        waiting.postMessage({ type: 'SKIP_WAITING' });
        setTimeout(() => window.location.reload(), 500);
      } else if (installing) {
        toast('📥 新版本下载中，请稍候...');
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed') {
            toast('✅ 新版本已就绪，正在刷新');
            setTimeout(() => window.location.reload(), 500);
          }
        });
      } else {
        toast('✅ 当前已是最新版本');
      }
    }).catch(e => toast('检查失败: ' + e.message));
  });
}
// 清除缓存并强制刷新
function clearAppCacheAndReload() {
  if (!confirm('清除应用缓存并重新加载最新版本？（数据不会丢）')) return;
  const tasks = [];
  // 1) 清除 caches 里的旧缓存
  if ('caches' in window) {
    tasks.push(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).catch(()=>{}));
  }
  // 2) 注销现有 SW
  if ('serviceWorker' in navigator) {
    tasks.push(
      navigator.serviceWorker.getRegistrations().then(regs =>
        Promise.all(regs.map(r => r.unregister()))
      ).catch(()=>{})
    );
  }
  Promise.all(tasks).then(() => {
    window.location.reload(true);
  });
}
function exportData() {
  _doExport(false);
}
// 微信备份：导出后弹窗提示怎么发到微信
function exportForWeChat() {
  _doExport(true);
}
function _doExport(forWeChat) {
  const data = {};
  DATA_KEYS.forEach(k => {
    const v = DB.get(k, null);
    if (v !== null) data[k] = v;
  });
  data.__exportTime = new Date().toISOString();
  data.__version = 'tianjiang-v24';
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  // 文件名：年月日-时分，方便在微信里一眼看到什么时候备份的
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  a.download = `甜酱备份-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('📤 已导出备份文件');
  if (forWeChat) {
    setTimeout(() => {
      openModal(`
        <div class="modal-head"><h3>💌 已生成备份文件</h3><button class="modal-close" onclick="closeModal()">×</button></div>
        <div style="padding:6px 0 4px">
          <div class="section-head">存到微信的步骤：</div>
          <ol style="padding-left:22px;margin:6px 0;line-height:1.9;color:var(--text);font-size:14px">
            <li>文件刚才已经下载到手机里了，文件名类似 <b>甜酱备份-20260823-1530.json</b></li>
            <li>打开微信，进入「<b>文件传输助手</b>」聊天框</li>
            <li>点右下角 + 号 → 选「文件」→ 找到刚刚下载的那个 JSON 发出去 ✅</li>
          </ol>
          <div class="section-head">或者存到「微信收藏」：</div>
          <ol style="padding-left:22px;margin:6px 0;line-height:1.9;color:var(--text);font-size:14px">
            <li>在文件管理器里长按那个备份文件 → 「分享」→ 选「添加到微信收藏」</li>
          </ol>
          <div style="background:var(--pink-soft);border-radius:10px;padding:10px 12px;margin-top:8px;font-size:13px;color:var(--pink);line-height:1.6">
            💡 建议<b>每周日晚上</b>备份一次。恢复数据的时候，同样下载这个文件，再用「📥 导入数据」就可以啦。
          </div>
        </div>
        <button class="btn btn-block" onclick="closeModal()">知道了</button>
      `);
    }, 400);
  }
}
function importData(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!confirm('导入将覆盖现有全部数据，确定继续？')) return;
      // 先清空旧数据
      DATA_KEYS.forEach(k => { try { localStorage.removeItem('tj_' + k); } catch (err) {} });
      // 写入新数据
      let cnt = 0;
      DATA_KEYS.forEach(k => {
        if (data[k] !== undefined && data[k] !== null) {
          DB.set(k, data[k]);
          cnt++;
        }
      });
      toast('✅ 已导入 ' + cnt + ' 项数据');
      setTimeout(() => location.reload(), 600);
    } catch (err) {
      toast('❌ 导入失败：文件格式错误');
      alert('导入失败，请选择正确的备份 JSON 文件');
    }
  };
  reader.readAsText(file);
}
function clearAllData() {
  if (!confirm('⚠️ 确认清空全部数据？此操作不可恢复！\n\n建议先导出备份再清空。')) return;
  if (!confirm('再次确认：所有打卡、账目、记录都会被删除！')) return;
  DATA_KEYS.forEach(k => { try { localStorage.removeItem('tj_' + k); } catch (e) {} });
  toast('🗑 已清空全部数据');
  setTimeout(() => location.reload(), 600);
}

// 启动
if (Store.getNotifyEnabled()) startNotifyTimer();
render();
