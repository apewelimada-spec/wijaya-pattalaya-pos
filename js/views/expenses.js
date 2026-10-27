(function () {
  'use strict';
  const WP = window.WP = window.WP || {};
  const U = WP.utils;
  const UI = WP.ui;
  const C = WP.components;
  const V = WP.views = WP.views || {};

  function S() { return WP.store; }
  function APP() { return WP.app; }
  function adminMode() {
    return !(WP.auth && WP.auth.isCashier && WP.auth.isCashier());
  }

  const state = { range: 'month', cat: 'all', q: '' };

  function rangeDates() {
    const today = U.todayISO();
    if (state.range === 'today') return { from: today, to: today, label: 'Today' };
    if (state.range === 'all') return { from: '', to: '', label: 'All time' };
    return { from: U.monthStartISO(), to: today, label: 'This month' };
  }

  function rangeExpenses() {
    const r = rangeDates();
    return S().rangeExpenses(r.from, r.to);
  }

  function filteredExpenses() {
    const q = state.q.trim().toLowerCase();
    return U.sortBy(rangeExpenses().filter(e => {
      if (state.cat !== 'all' && e.category !== state.cat) return false;
      if (q) {
        const hay = (e.description + ' ' + (e.note || '') + ' ' + e.amount).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }), e => (e.date || '') + (e.createdAt || ''), 'desc');
  }

  function categories() { return S().constants.EXPENSE_CATEGORIES; }

  function categoryTotals() {
    const map = {};
    categories().forEach(c => { map[c.key] = 0; });
    rangeExpenses().forEach(e => { map[e.category] = U.round2((map[e.category] || 0) + Number(e.amount || 0)); });
    return map;
  }

  function statsHTML() {
    const rows = rangeExpenses();
    const totals = categoryTotals();
    const total = U.sumBy(rows, e => e.amount);
    const today = U.sumBy(S().data.expenses.filter(e => e.date === U.todayISO()), e => e.amount);
    const cash = U.sumBy(rows.filter(e => e.method === 'cash'), e => e.amount);
    const bank = U.sumBy(rows.filter(e => e.method !== 'cash'), e => e.amount);
    let biggest = { label: '—', amount: 0 };
    categories().forEach(c => { if ((totals[c.key] || 0) > biggest.amount) biggest = { label: c.label, amount: totals[c.key] }; });
    return '<div class="stat-grid mb-16">' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Expenses ' + U.esc(rangeDates().label.toLowerCase()) + '</span><span class="stat-icon danger">' + UI.icon('wallet', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(total) + '</div><div class="stat-meta"><b>' + rows.length + '</b> entr' + (rows.length === 1 ? 'y' : 'ies') + '</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Spent today</span><span class="stat-icon gold">' + UI.icon('calendar', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(today) + '</div><div class="stat-meta">' + U.esc(U.fmtDate(U.todayISO(), { mode: 'short' })) + '</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Cash vs bank</span><span class="stat-icon blue">' + UI.icon('banknote', 16) + '</span></div>' +
      '<div class="stat-value sm">' + U.moneyShort(cash) + '</div><div class="stat-meta">Cash ' + U.moneyShort(cash) + ' · bank ' + U.moneyShort(bank) + '</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Largest category</span><span class="stat-icon green">' + UI.icon('chart', 16) + '</span></div>' +
      '<div class="stat-value sm">' + U.moneyShort(biggest.amount) + '</div><div class="stat-meta">' + U.esc(biggest.label) + '</div></div>' +
      '</div>';
  }

  function categoryCardsHTML() {
    const totals = categoryTotals();
    return '<div class="expense-cats">' + categories().map(c =>
      '<button type="button" class="expense-cat' + (state.cat === c.key ? ' active' : '') + '" data-expense-cat="' + c.key + '">' +
      '<span class="expense-cat-ico">' + UI.icon(c.icon, 15) + '</span>' +
      '<span class="expense-cat-name">' + U.esc(c.label) + '</span>' +
      '<span class="expense-cat-amt">' + U.moneyShort(totals[c.key] || 0) + '</span></button>').join('') +
      '</div>';
  }

  function tableHTML(rows) {
    if (!rows.length) {
      return '<div class="card-body">' + UI.emptyState({
        icon: 'wallet',
        title: 'No expenses found',
        text: state.q ? 'Try a different search, range or category.' : 'Record bills, personal drawings, vehicle costs, marketing and house expenses here.',
        action: '<button class="btn btn-primary" data-add-expense>' + UI.icon('plus', 14) + 'Record expense</button>'
      }) + '</div>';
    }
    const labels = {};
    categories().forEach(c => { labels[c.key] = c.label; });
    const icons = {};
    categories().forEach(c => { icons[c.key] = c.icon; });
    const body = rows.slice(0, 300).map(e => {
      const cashier = e.cashierId ? S().cashierById(e.cashierId) : null;
      return '<tr>' +
        '<td class="nowrap">' + U.fmtDate(e.date, { mode: 'short' }) + '<div class="cell-sub">' + U.fmtTime(e.createdAt) + '</div></td>' +
        '<td><span class="group-tag" style="display:inline-flex;align-items:center;gap:5px">' + UI.icon(icons[e.category] || 'more', 12) + U.esc(labels[e.category] || U.titleCase(e.category)) + '</span></td>' +
        '<td><div class="cell-stack"><span class="cell-main">' + U.esc(e.description) + '</span>' + (e.note ? '<span class="cell-sub">' + U.esc(e.note) + '</span>' : '') + '</div></td>' +
        '<td>' + UI.methodInline(e.method) + '</td>' +
        '<td>' + (cashier ? U.esc(cashier.name) : '<span class="muted">—</span>') + '</td>' +
        '<td class="right num"><span class="text-danger">− ' + U.money(e.amount) + '</span></td>' +
        '<td><div class="row-actions">' + (adminMode()
          ? '<button type="button" class="icon-btn danger" data-delete-expense="' + e.id + '" title="Delete expense">' + UI.icon('trash', 15) + '</button>'
          : '') + '</div></td></tr>';
    }).join('');
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Paid by</th><th>Cashier</th><th class="right">Amount</th><th></th></tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<div class="card-foot flex-between"><span class="hint">Showing ' + Math.min(rows.length, 300) + ' of ' + rows.length + ' · total <b>' + U.money(U.sumBy(rows, e => e.amount)) + '</b></span>' +
      '<button class="link-btn" data-export-expenses>' + UI.icon('download', 13) + 'Export CSV</button></div>';
  }

  function exportExpenses(rows) {
    if (!rows.length) { UI.toast('No expenses to export for this filter.', 'info'); return; }
    const label = {};
    categories().forEach(c => { label[c.key] = c.label; });
    const data = [['Date', 'Category', 'Description', 'Amount', 'Method', 'Cashier', 'Note']]
      .concat(rows.map(e => {
        const cashier = e.cashierId ? S().cashierById(e.cashierId) : null;
        return [e.date, label[e.category] || e.category, e.description, e.amount, e.method, cashier ? cashier.name : '', e.note];
      }));
    U.downloadFile('wijaya-expenses-' + (rangeDates().from || 'all') + '.csv', U.toCSV(data), 'text/csv;charset=utf-8');
    UI.toast('Expenses exported.');
  }

  function screen() {
    const rows = filteredExpenses();
    return UI.pageHead({
      eyebrow: 'Money · ' + rangeDates().label,
      title: 'Expenses',
      subtitle: 'Bills, personal, vehicle, marketing, house and other shop spending.',
      actions: '<button class="btn btn-primary" data-add-expense>' + UI.icon('plus', 15) + 'Record expense</button>'
    }) +
      '<div id="exp-stats">' + statsHTML() + '</div>' +
      '<div id="exp-cats">' + categoryCardsHTML() + '</div>' +
      '<div class="card inventory-card"><div class="inv-toolbar">' +
      '<div class="search-box" style="max-width:320px">' + UI.icon('search', 16) + '<input class="input" id="exp-search" placeholder="Search description or note…" value="' + U.attr(state.q) + '"></div>' +
      '<div class="segmented" data-exp-range>' +
      '<button class="seg-btn ' + (state.range === 'today' ? 'active' : '') + '" data-range="today">Today</button>' +
      '<button class="seg-btn ' + (state.range === 'month' ? 'active' : '') + '" data-range="month">This month</button>' +
      '<button class="seg-btn ' + (state.range === 'all' ? 'active' : '') + '" data-range="all">All</button></div>' +
      '<span class="spacer"></span><span class="toolbar-label" id="exp-count">' + rows.length + ' entries</span></div>' +
      '<div id="exp-table">' + tableHTML(rows) + '</div></div>';
  }

  function openExpenseModal() {
    const options = categories().map(c => UI.option(c.key, c.label, 'bills')).join('');
    const m = UI.modal({
      title: 'Record expense',
      subtitle: 'Money going out of the shop or cash drawer.',
      size: 'md',
      body:
        '<form id="expense-form"><div class="form-grid">' +
        '<div class="field"><label class="label" for="ex-category">Category</label><select class="select" id="ex-category" name="category">' + options + '</select></div>' +
        '<div class="field"><label class="label" for="ex-date">Date</label><input class="input" id="ex-date" name="date" type="date" value="' + U.todayISO() + '" required></div>' +
        '<div class="field"><label class="label" for="ex-amount">Amount</label><div class="input-group"><span class="prefix">' + U.esc(U.symbol()) + '</span><input class="input" id="ex-amount" name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00" autofocus></div></div>' +
        '<div class="field"><label class="label" for="ex-method">Paid by</label><select class="select" id="ex-method" name="method">' +
        UI.option('cash', 'Cash', 'cash') + UI.option('card', 'Card', '') + UI.option('online', 'Online transfer', '') + UI.option('cheque', 'Cheque', '') + '</select></div>' +
        '<div class="field full"><label class="label" for="ex-description">Description</label><input class="input" id="ex-description" name="description" required placeholder="e.g. Electricity bill for September" autocomplete="off"></div>' +
        '<div class="field full"><label class="label" for="ex-note">Note <span class="opt">(optional)</span></label><input class="input" id="ex-note" name="note" placeholder="Receipt number or remark" autocomplete="off"></div>' +
        '</div></form>' +
        '<div class="pay-note mt-12">Cash expenses reduce the active cashier’s expected drawer for the session.</div>',
      footer: '<button type="button" class="btn" data-modal-close>Cancel</button>' +
        '<button type="submit" class="btn btn-primary" form="expense-form">' + UI.icon('check', 15) + 'Save expense</button>'
    });
    const form = m.panel.querySelector('#expense-form');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const submit = m.panel.querySelector('[type="submit"][form="expense-form"]');
      const values = UI.formValues(form);
      try {
        await UI.withLoading(submit, async () => {
          const expense = await S().addExpense(Object.assign({}, values, { cashierId: APP().getActiveCashierId() }));
          m.close();
          UI.toast('Expense saved · ' + U.money(expense.amount) + ' · ' + U.titleCase(expense.category) + '.');
          APP().dataChanged();
        });
      } catch (err) { UI.toast(err.userMessage || err.message || 'Could not save expense.', 'error'); }
    });
    return m;
  }

  V.expenses = {
    render() {
      return screen();
    },
    mount(content) {
      const scope = content.querySelector('#view-root') || content;
      function paint() {
        const rows = filteredExpenses();
        const table = scope.querySelector('#exp-table');
        const count = scope.querySelector('#exp-count');
        const stats = scope.querySelector('#exp-stats');
        const cats = scope.querySelector('#exp-cats');
        if (table) table.innerHTML = tableHTML(rows);
        if (count) count.textContent = rows.length + ' entries';
        if (stats) stats.innerHTML = statsHTML();
        if (cats) cats.innerHTML = categoryCardsHTML();
      }
      const search = scope.querySelector('#exp-search');
      if (search) search.addEventListener('input', U.debounce(() => { state.q = search.value; paint(); }, 160));
      scope.addEventListener('click', async e => {
        if (e.target.closest('[data-add-expense]')) { openExpenseModal(); return; }
        const rangeBtn = e.target.closest('[data-exp-range] [data-range]');
        if (rangeBtn) {
          state.range = rangeBtn.dataset.range;
          scope.querySelectorAll('[data-exp-range] .seg-btn').forEach(b => b.classList.toggle('active', b === rangeBtn));
          paint();
          return;
        }
        const catBtn = e.target.closest('[data-expense-cat]');
        if (catBtn) {
          const key = catBtn.dataset.expenseCat;
          state.cat = state.cat === key ? 'all' : key;
          paint();
          return;
        }
        if (e.target.closest('[data-export-expenses]')) { exportExpenses(filteredExpenses()); return; }
        const del = e.target.closest('[data-delete-expense]');
        if (del && adminMode()) {
          const id = Number(del.dataset.deleteExpense);
          const expense = S().data.expenses.find(x => Number(x.id) === id);
          if (!expense) return;
          const ok = await UI.confirmDialog({
            title: 'Delete this expense?',
            text: U.money(expense.amount) + ' · ' + expense.description + '. This removes it from the cashier drawer and reports.',
            confirmText: 'Delete expense'
          });
          if (!ok) return;
          try {
            await S().deleteExpense(id);
            UI.toast('Expense deleted.');
            APP().dataChanged();
          } catch (err) { UI.toast(err.userMessage || err.message || 'Could not delete expense.', 'error'); }
        }
      });
    },
    refresh() {
      APP().renderRoute(true);
    }
  };
})();
