(function () {
  'use strict';
  const WP = window.WP = window.WP || {};
  const U = WP.utils;
  const UI = WP.ui;
  const C = WP.components;
  const V = WP.views = WP.views || {};

  function S() { return WP.store; }
  function APP() { return WP.app; }

  const state = { q: '', view: 'all' };

  function customerRows() {
    const q = state.q.trim().toLowerCase();
    return U.sortBy(S().activeCustomers().filter(c => {
      const due = S().customerDue(c.id);
      const advance = S().customerAdvance(c.id);
      if (state.view === 'due' && due <= 0.009) return false;
      if (state.view === 'advance' && advance <= 0.009) return false;
      if (q) {
        const hay = (c.name + ' ' + (c.phone || '') + ' ' + (c.address || '') + ' ' + (c.note || '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }), c => c.name.toLowerCase(), 'asc');
  }

  function statsHTML() {
    const customers = S().activeCustomers();
    const dueCount = customers.filter(c => S().customerDue(c.id) > 0.009).length;
    const advanceCount = customers.filter(c => S().customerAdvance(c.id) > 0.009).length;
    return '<div class="stat-grid mb-16">' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Saved customers</span><span class="stat-icon green">' + UI.icon('users', 16) + '</span></div>' +
      '<div class="stat-value">' + customers.length + '</div><div class="stat-meta"><b>' + dueCount + '</b> owe money · <b>' + advanceCount + '</b> hold advances</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Total receivables</span><span class="stat-icon danger">' + UI.icon('clock', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(S().totalReceivables()) + '</div><div class="stat-meta">Credit sales, services and opening balances</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Advances held</span><span class="stat-icon gold">' + UI.icon('coins', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(S().totalAdvances()) + '</div><div class="stat-meta">Money customers have paid in advance</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Net position</span><span class="stat-icon blue">' + UI.icon('chart', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(U.round2(S().totalReceivables() - S().totalAdvances())) + '</div><div class="stat-meta">Receivables minus advances</div></div>' +
      '</div>';
  }

  function tableHTML(rows) {
    if (!rows.length) {
      const none = S().activeCustomers().length === 0;
      return '<div class="card-body">' + UI.emptyState({
        icon: 'users',
        title: none ? 'No customers saved yet' : 'No customers match this view',
        text: none ? 'Save a customer when you give credit or take an advance. Their full purchase and payment history stays here.' : 'Try another search, or switch the filter.',
        action: none ? '<button class="btn btn-primary" data-add-customer>' + UI.icon('userPlus', 14) + 'Add customer</button>' : ''
      }) + '</div>';
    }
    const body = rows.map(c => {
      const due = S().customerDue(c.id);
      const advance = S().customerAdvance(c.id);
      const last = S().customerLastActivity(c.id);
      return '<tr>' +
        '<td><div class="customer-cell">' + UI.avatar(c.name) +
        '<div><div class="customer-name">' + U.esc(c.name) + '</div><div class="customer-sub">' + U.esc(c.phone || 'No phone') + (c.address ? ' · ' + U.esc(c.address) : '') + '</div></div></div></td>' +
        '<td class="right num">' + U.money(c.openingBalance) + '</td>' +
        '<td class="right num ' + (due > 0.009 ? 'due-value' : 'muted') + '">' + U.money(due) + '</td>' +
        '<td class="right num ' + (advance > 0.009 ? 'advance-value' : 'muted') + '">' + U.money(advance) + '</td>' +
        '<td class="nowrap">' + (last ? U.fmtDate(last, { mode: 'short' }) : '<span class="muted">—</span>') + '</td>' +
        '<td><div class="row-actions">' +
        '<button type="button" class="icon-btn" data-collect-customer="' + c.id + '" title="Receive payment">' + UI.icon('banknote', 15) + '</button>' +
        '<button type="button" class="icon-btn" data-advance-customer="' + c.id + '" title="Record advance">' + UI.icon('coins', 15) + '</button>' +
        '<button type="button" class="icon-btn" data-statement-customer="' + c.id + '" title="Statement">' + UI.icon('fileText', 15) + '</button>' +
        '<button type="button" class="icon-btn" data-edit-customer="' + c.id + '" title="Edit customer">' + UI.icon('edit', 15) + '</button>' +
        '</div></td></tr>';
    }).join('');
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Customer</th><th class="right">Opening balance</th><th class="right">Outstanding due</th><th class="right">Advance</th><th>Last activity</th><th></th></tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<div class="card-foot flex-between"><span class="hint">Showing ' + rows.length + ' customer' + (rows.length === 1 ? '' : 's') + '</span>' +
      '<button class="link-btn" data-export-customers>' + UI.icon('download', 13) + 'Export CSV</button></div>';
  }

  function exportCustomers(rows) {
    if (!rows.length) { UI.toast('No customers to export for this filter.', 'info'); return; }
    const data = [['Customer', 'Phone', 'Address', 'Opening balance', 'Outstanding due', 'Advance', 'Last activity', 'Note']]
      .concat(rows.map(c => {
        const last = S().customerLastActivity(c.id);
        return [c.name, c.phone, c.address, c.openingBalance, S().customerDue(c.id), S().customerAdvance(c.id), last || '', c.note];
      }));
    U.downloadFile('wijaya-customers.csv', U.toCSV(data), 'text/csv;charset=utf-8');
    UI.toast('Customer list exported.');
  }

  function screen() {
    const rows = customerRows();
    return UI.pageHead({
      eyebrow: 'Workshop · Accounts',
      title: 'Customers',
      subtitle: 'Opening balances, credit collection, advances and full statements for every saved customer.',
      actions: '<button class="btn btn-primary" data-add-customer>' + UI.icon('userPlus', 15) + 'Add customer</button>'
    }) +
      '<div id="cust-stats">' + statsHTML() + '</div>' +
      '<div class="card inventory-card"><div class="inv-toolbar">' +
      '<div class="search-box" style="max-width:340px">' + UI.icon('search', 16) + '<input class="input" id="cust-search" placeholder="Search name, phone, address or note…" value="' + U.attr(state.q) + '"></div>' +
      '<div class="segmented" data-cust-view>' +
      '<button class="seg-btn ' + (state.view === 'all' ? 'active' : '') + '" data-view="all">All</button>' +
      '<button class="seg-btn ' + (state.view === 'due' ? 'active' : '') + '" data-view="due">With due</button>' +
      '<button class="seg-btn ' + (state.view === 'advance' ? 'active' : '') + '" data-view="advance">With advance</button></div>' +
      '<span class="spacer"></span><span class="toolbar-label" id="cust-count">' + rows.length + ' customers</span></div>' +
      '<div id="cust-table">' + tableHTML(rows) + '</div></div>';
  }

  V.customers = {
    render() {
      return screen();
    },
    mount(content) {
      const scope = content.querySelector('#view-root') || content;
      const search = scope.querySelector('#cust-search');
      function paint() {
        const rows = customerRows();
        const table = scope.querySelector('#cust-table');
        const count = scope.querySelector('#cust-count');
        const stats = scope.querySelector('#cust-stats');
        if (table) table.innerHTML = tableHTML(rows);
        if (count) count.textContent = rows.length + ' customers';
        if (stats) stats.innerHTML = statsHTML();
      }
      if (search) search.addEventListener('input', U.debounce(() => { state.q = search.value; paint(); }, 160));
      scope.addEventListener('click', e => {
        const viewBtn = e.target.closest('[data-cust-view] [data-view]');
        if (viewBtn) {
          state.view = viewBtn.dataset.view;
          scope.querySelectorAll('[data-cust-view] .seg-btn').forEach(b => b.classList.toggle('active', b === viewBtn));
          paint();
          return;
        }
        if (e.target.closest('[data-add-customer]')) { C.addCustomerModal({}); return; }
        if (e.target.closest('[data-export-customers]')) { exportCustomers(customerRows()); return; }
        const collect = e.target.closest('[data-collect-customer]');
        if (collect) { C.collectModal({ customerId: Number(collect.dataset.collectCustomer) }); return; }
        const advance = e.target.closest('[data-advance-customer]');
        if (advance) { C.advanceModal({ customerId: Number(advance.dataset.advanceCustomer) }); return; }
        const statement = e.target.closest('[data-statement-customer]');
        if (statement) { C.statementModal(Number(statement.dataset.statementCustomer)); return; }
        const edit = e.target.closest('[data-edit-customer]');
        if (edit) { C.addCustomerModal({ customer: S().customerById(Number(edit.dataset.editCustomer)) }); }
      });
    },
    refresh() {
      APP().renderRoute(true);
    }
  };
})();
