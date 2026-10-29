(() => {
  'use strict';

  const STORAGE_KEY = 'expenses';
  const NOTES_KEY = 'category_notes';
  const MAX_NOTE_TAGS = 8;
  const CATEGORIES = ['餐饮', '日用', '住房', '交通', '通讯', '娱乐', '服饰', '其他'];
  const CATEGORY_COLORS = {
    '餐饮': '#e91e63',
    '日用': '#ff9800',
    '住房': '#4caf50',
    '交通': '#2196f3',
    '通讯': '#9c27b0',
    '娱乐': '#ffc107',
    '服饰': '#00bcd4',
    '其他': '#9e9e9e',
  };

  const $ = (sel) => document.querySelector(sel);

  const form = $('#expense-form');
  const amountInput = $('#amount');
  const dateInput = $('#date');
  const noteInput = $('#note');
  const noteTagsEl = $('#note-tags');
  const categoryGroup = $('#category-group');
  const feedback = $('#feedback');
  const countEl = $('#count');
  const exportBtn = $('#export-btn');
  const importBtn = $('#import-btn');
  const importFileInput = $('#import-file');
  const monthLabelEl = $('#month-label');
  const monthTotalEl = $('#month-total');
  const categorySummaryEl = $('#category-summary');
  const listEl = $('#expense-list');
  const emptyStateEl = $('#empty-state');
  const prevMonthBtn = $('#prev-month');
  const nextMonthBtn = $('#next-month');
  const currentMonthBtn = $('#current-month-btn');

  let selectedCategory = null;
  let feedbackTimer = null;
  let viewMonth = formatLocalDate(new Date()).slice(0, 7); // 当前查看的月份 YYYY-MM

  // ---------- 存储 ----------
  // 结构：{ version, expenses: [...] }
  // 为下一阶段的「列表 / 删除 / 月度汇总」预留 version 与 id / date(YYYY-MM-DD) / createdAt。
  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { version: 1, expenses: [] };
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.expenses)) return { version: 1, expenses: [] };
      return data;
    } catch (err) {
      return { version: 1, expenses: [] };
    }
  }

  function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'e-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function formatLocalDate(d) {
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-');
  }

  function formatMoney(n) {
    return '¥' + Number(n).toFixed(2);
  }

  function categoryColor(cat) {
    return CATEGORY_COLORS[cat] || '#9e9e9e';
  }

  function formatDateLabel(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const wd = weekdays[new Date(y, m - 1, d).getDay()];
    return `${m}月${d}日 ${wd}`;
  }

  // ---------- 分类 ----------
  function renderCategories() {
    categoryGroup.innerHTML = '';
    CATEGORIES.forEach((cat) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'category-btn';
      btn.textContent = cat;
      btn.setAttribute('data-category', cat);
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', 'false');
      btn.addEventListener('click', () => selectCategory(cat));
      categoryGroup.appendChild(btn);
    });
  }

  function selectCategory(cat) {
    selectedCategory = cat;
    categoryGroup.querySelectorAll('.category-btn').forEach((btn) => {
      const active = btn.getAttribute('data-category') === cat;
      btn.classList.toggle('selected', active);
      btn.setAttribute('aria-checked', String(active));
    });
    renderNoteTags(cat);
  }

  // ---------- 备注智能记忆 ----------
  function loadCategoryNotes() {
    try {
      const raw = localStorage.getItem(NOTES_KEY);
      if (!raw) return {};
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
      return data;
    } catch (err) {
      return {};
    }
  }

  function saveCategoryNotes(notes) {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }

  function rememberNote(category, note) {
    const notes = loadCategoryNotes();
    const list = notes[category] || [];
    const filtered = list.filter((n) => n !== note); // 同分类去重
    filtered.unshift(note); // 最近使用的排最前
    notes[category] = filtered.slice(0, MAX_NOTE_TAGS); // 最多保留 8 个
    saveCategoryNotes(notes);
  }

  function renderNoteTags(category) {
    noteTagsEl.innerHTML = '';
    if (!category) {
      noteTagsEl.hidden = true;
      return;
    }
    const list = loadCategoryNotes()[category] || [];
    noteTagsEl.hidden = list.length === 0;
    list.slice(0, MAX_NOTE_TAGS).forEach((note) => {
      const tag = document.createElement('button');
      tag.type = 'button';
      tag.className = 'note-tag';
      tag.textContent = note;
      tag.addEventListener('click', () => {
        noteInput.value = note;
        noteInput.focus();
      });
      noteTagsEl.appendChild(tag);
    });
  }

  // ---------- 反馈 ----------
  function showFeedback(message, isError = false, duration = 1600) {
    feedback.textContent = message;
    feedback.classList.toggle('error', isError);
    feedback.classList.add('show');
    if (feedbackTimer) clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => feedback.classList.remove('show'), duration);
  }

  // ---------- 统一刷新：计数 + 列表 + 月度汇总 ----------
  function render() {
    const data = loadData();
    countEl.textContent = String(data.expenses.length);
    renderList(data);
    renderSummary(data);
  }

  function sortExpenses(expenses) {
    return [...expenses].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.createdAt < b.createdAt ? 1 : -1;
    });
  }

  function renderList(data) {
    const monthExpenses = data.expenses.filter((e) => e.date.slice(0, 7) === viewMonth);
    const sorted = sortExpenses(monthExpenses);
    listEl.innerHTML = '';
    const isCurrent = viewMonth === formatLocalDate(new Date()).slice(0, 7);
    emptyStateEl.textContent = isCurrent ? '还没有记录，记下第一笔吧' : '这个月没有记录';
    emptyStateEl.hidden = sorted.length > 0;

    // 按日期分组（同一天的记录归到一组）
    const groups = [];
    sorted.forEach((exp) => {
      const last = groups[groups.length - 1];
      if (last && last.date === exp.date) {
        last.items.push(exp);
      } else {
        groups.push({ date: exp.date, items: [exp] });
      }
    });

    groups.forEach((group) => {
      const subtotal = group.items.reduce((sum, e) => sum + e.amount, 0);

      const groupEl = document.createElement('div');
      groupEl.className = 'date-group';

      const header = document.createElement('div');
      header.className = 'date-header';
      const dateLabel = document.createElement('span');
      dateLabel.className = 'date-label';
      dateLabel.textContent = formatDateLabel(group.date);
      const dateSubtotal = document.createElement('span');
      dateSubtotal.className = 'date-subtotal';
      dateSubtotal.textContent = '共 ' + formatMoney(subtotal);
      header.appendChild(dateLabel);
      header.appendChild(dateSubtotal);
      groupEl.appendChild(header);

      const ul = document.createElement('ul');
      ul.className = 'expense-group';
      group.items.forEach((exp) => ul.appendChild(buildItem(exp)));
      groupEl.appendChild(ul);

      listEl.appendChild(groupEl);
    });
  }

  function buildItem(exp) {
    const li = document.createElement('li');
    li.className = 'expense-item';

    const left = document.createElement('div');
    left.className = 'item-left';

    const top = document.createElement('div');
    top.className = 'item-top';
    const dot = document.createElement('span');
    dot.className = 'cat-dot';
    dot.style.backgroundColor = categoryColor(exp.category);
    const cat = document.createElement('span');
    cat.className = 'item-category';
    cat.textContent = exp.category;
    top.appendChild(dot);
    top.appendChild(cat);
    left.appendChild(top);

    if (exp.note) {
      const note = document.createElement('div');
      note.className = 'item-note';
      note.textContent = exp.note;
      left.appendChild(note);
    }

    const right = document.createElement('div');
    right.className = 'item-right';
    const amount = document.createElement('span');
    amount.className = 'item-amount';
    amount.textContent = formatMoney(exp.amount);
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'delete-btn';
    del.textContent = '删除';
    del.setAttribute('aria-label', '删除这笔支出');
    del.addEventListener('click', () => deleteExpense(exp.id));
    right.appendChild(amount);
    right.appendChild(del);

    li.appendChild(left);
    li.appendChild(right);
    return li;
  }

  function changeMonth(delta) {
    const [y, m] = viewMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    viewMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    render();
  }

  function renderSummary(data) {
    const currentMonth = formatLocalDate(new Date()).slice(0, 7);
    const monthExpenses = data.expenses.filter((e) => e.date.slice(0, 7) === viewMonth);

    const [y, m] = viewMonth.split('-');
    monthLabelEl.textContent = `${y}年${Number(m)}月`;
    currentMonthBtn.hidden = viewMonth === currentMonth;

    const total = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
    monthTotalEl.textContent = formatMoney(total);

    categorySummaryEl.innerHTML = '';
    if (monthExpenses.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'summary-empty';
      empty.textContent = '该月暂无支出';
      categorySummaryEl.appendChild(empty);
      return;
    }

    const byCategory = {};
    monthExpenses.forEach((e) => {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    });
    Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, amt]) => {
        const pct = total > 0 ? (amt / total) * 100 : 0;

        const row = document.createElement('div');
        row.className = 'cat-row';

        const head = document.createElement('div');
        head.className = 'cat-row-head';

        const name = document.createElement('span');
        name.className = 'cat-name';
        const dot = document.createElement('span');
        dot.className = 'cat-dot';
        dot.style.backgroundColor = categoryColor(cat);
        name.appendChild(dot);
        name.appendChild(document.createTextNode(cat));

        const amount = document.createElement('span');
        amount.className = 'cat-amount';
        amount.textContent = `${formatMoney(amt)} · ${Math.round(pct)}%`;

        head.appendChild(name);
        head.appendChild(amount);

        const bar = document.createElement('div');
        bar.className = 'cat-bar';
        const fill = document.createElement('div');
        fill.className = 'cat-bar-fill';
        fill.style.width = pct.toFixed(2) + '%';
        fill.style.backgroundColor = categoryColor(cat);
        bar.appendChild(fill);

        row.appendChild(head);
        row.appendChild(bar);
        categorySummaryEl.appendChild(row);
      });
  }

  function deleteExpense(id) {
    const data = loadData();
    const exp = data.expenses.find((e) => e.id === id);
    if (!exp) return;
    const label = `${exp.category} ${formatMoney(exp.amount)}`;
    if (!window.confirm(`确定删除「${label}」这笔支出吗？`)) return;
    data.expenses = data.expenses.filter((e) => e.id !== id);
    saveData(data);
    render();
  }

  // ---------- 保存 ----------
  function handleSubmit(e) {
    e.preventDefault();

    const amountText = amountInput.value.trim();
    const amount = Number(amountText);

    if (amountText === '' || Number.isNaN(amount) || amount <= 0) {
      showFeedback('请输入大于 0 的金额', true);
      amountInput.focus();
      return;
    }
    if (!selectedCategory) {
      showFeedback('请选择一个分类', true);
      return;
    }

    // 日期兜底：若日期为空或格式异常，回退到今天，避免被月度汇总静默排除
    let date = dateInput.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      date = formatLocalDate(new Date());
      dateInput.value = date;
    }

    const note = noteInput.value.trim();

    const record = {
      id: makeId(),
      amount: Math.round(amount * 100) / 100, // 保留两位，避免浮点误差
      category: selectedCategory,
      date: date,
      note: note,
      createdAt: new Date().toISOString(),
    };

    const data = loadData();
    data.expenses.push(record);
    saveData(data);

    if (note) {
      rememberNote(selectedCategory, note);
      renderNoteTags(selectedCategory);
    }

    render();
    showFeedback('已记录');

    // 清空金额和备注，保留分类和日期，方便连续记账
    amountInput.value = '';
    noteInput.value = '';
    amountInput.focus();
  }

  // ---------- 导出 ----------
  function handleExport() {
    const data = loadData();
    const payload = {
      app: 'expense-tracker',
      version: data.version,
      exportedAt: new Date().toISOString(),
      count: data.expenses.length,
      expenses: data.expenses,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-backup-${formatLocalDate(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ---------- 导入 ----------
  function validateImport(payload) {
    if (!payload || typeof payload !== 'object') return { ok: false, reason: '不是有效的 JSON 对象' };
    if (!Array.isArray(payload.expenses)) return { ok: false, reason: '缺少 expenses 数组' };
    for (const e of payload.expenses) {
      if (!e || typeof e !== 'object') return { ok: false, reason: '存在无效的记录' };
      if (typeof e.id !== 'string' || e.id === '') return { ok: false, reason: '记录缺少 id' };
      if (typeof e.amount !== 'number' || !Number.isFinite(e.amount)) return { ok: false, reason: '记录金额无效' };
      if (typeof e.category !== 'string' || e.category === '') return { ok: false, reason: '记录缺少分类' };
      if (typeof e.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return { ok: false, reason: '记录日期格式错误' };
    }
    return { ok: true };
  }

  function handleImportFile(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = ''; // 允许下次再选同一文件
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      let payload;
      try {
        payload = JSON.parse(reader.result);
      } catch (err) {
        showFeedback('导入失败：文件不是有效的 JSON', true);
        return;
      }

      const check = validateImport(payload);
      if (!check.ok) {
        showFeedback('导入失败：' + check.reason, true);
        return;
      }

      const data = loadData();
      const existingIds = new Set(data.expenses.map((e) => e.id));
      let imported = 0;
      let skipped = 0;

      payload.expenses.forEach((e) => {
        if (existingIds.has(e.id)) {
          skipped += 1;
          return;
        }
        data.expenses.push({
          id: e.id,
          amount: Math.round(e.amount * 100) / 100,
          category: e.category,
          date: e.date,
          note: typeof e.note === 'string' ? e.note : '',
          createdAt: typeof e.createdAt === 'string' ? e.createdAt : new Date().toISOString(),
        });
        existingIds.add(e.id);
        imported += 1;
      });

      saveData(data);
      render();
      showFeedback(`导入 ${imported} 条，跳过 ${skipped} 条重复`, false, 2600);
    };
    reader.onerror = () => showFeedback('读取文件失败', true);
    reader.readAsText(file);
  }

  // ---------- Service Worker ----------
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // 注册失败不影响记账功能（例如本地 file:// 打开时）
    });
  }

  // ---------- 初始化 ----------
  function init() {
    renderCategories();
    dateInput.value = formatLocalDate(new Date()); // 默认今天（本地时区）
    render();
    amountInput.focus();
    form.addEventListener('submit', handleSubmit);
    exportBtn.addEventListener('click', handleExport);
    importBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', handleImportFile);
    prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    nextMonthBtn.addEventListener('click', () => changeMonth(1));
    currentMonthBtn.addEventListener('click', () => {
      viewMonth = formatLocalDate(new Date()).slice(0, 7);
      render();
    });
  }

  init();
  if (document.readyState === 'loading') {
    window.addEventListener('load', registerServiceWorker);
  } else {
    registerServiceWorker();
  }
})();
