(function () {
  'use strict';
  const WP = window.WP = window.WP || {};
  const U = WP.utils;
  const UI = WP.ui;
  const C = WP.components;
  const V = WP.views = WP.views || {};

  function S() { return WP.store; }
  function APP() { return WP.app; }

  const state = { range: 'all', q: '', method: 'all' };
  const METHOD_CHIPS = [
    { key: 'all', label: 'All' },
    { key: 'cash', label: 'Cash' },
    { key: 'card', label: 'Card' },
    { key: 'online', label: 'Online' },
    { key: 'cheque', label: 'Cheque' },
    { key: 'credit', label: 'Credit' }
  ];

  function range() {
    const today = U.todayISO();
    if (state.range === 'today') return { from: today, to: today, label: 'Today' };
    if (state.range === 'month') return { from: U.monthStartISO(), to: today, label: 'This month' };
    return { from: '', to: '', label: 'All time' };
  }

  function billType(route) {
    if (route && route.sub === 'sales') return 'sale';
    if (route && route.sub === 'service') return 'service';
    return 'all';
  }

  function cashierName(id) {
    const cashier = id ? S().cashierById(id) : null;
    return cashier ? cashier.name : '';
  }

  function saleBill(inv) {
    const cashier = cashierName(inv.cashierId);
    const items = Number(inv.itemCount) || 0;
    return {
      kind: 'sale', id: inv.id, no: inv.no, date: inv.date, createdAt: inv.createdAt,
      customerName: inv.customerName || 'Walk-in customer',
      customerPhone: inv.customerPhone || '',
      method: inv.method,
      chequeNo: inv.chequeNo || '',
      total: Number(inv.total) || 0,
      paid: Number(inv.paid) || 0,
      balance: Number(inv.balance) || 0,
      status: S().invoiceStatus(inv),
      detailMain: U.fmtQty(items) + ' item' + (items === 1 ? '' : 's'),
      detailSub: (inv.type === 'wholesale' ? 'Wholesale' : 'Retail') + (cashier ? ' · ' + cashier : ''),
      search: [inv.no, inv.date, inv.customerName, inv.customerPhone, inv.note, inv.method, inv.type,
        inv.chequeNo, String(inv.total), U.fmtNumber(inv.total, 2), String(inv.balance), cashier].join(' ').toLowerCase()
    };
  }

  function serviceBill(svc) {
    const cashier = cashierName(svc.cashierId);
    return {
      kind: 'service', id: svc.id, no: svc.no, date: svc.date, createdAt: svc.createdAt,
      customerName: svc.customerName || 'Walk-in customer',
      customerPhone: svc.phone || '',
      method: svc.method,
      chequeNo: '',
      total: Number(svc.total) || 0,
      paid: Number(svc.paid) || 0,
      balance: Number(svc.balance) || 0,
      status: S().invoiceStatus(svc),
      detailMain: svc.work || 'Workshop job',
      detailSub: [svc.machineType, svc.regNo, svc.technician].filter(Boolean).join(' · '),
      search: [svc.no, svc.date, svc.customerName, svc.phone, svc.technician, svc.machineType, svc.regNo,
        svc.work, svc.note, svc.method, String(svc.total), U.fmtNumber(svc.total, 2), String(svc.balance), cashier].join(' ').toLowerCase()
    };
  }

  function matchesLine(bill, q) {
    const lines = bill.kind === 'sale' ? S().invoiceLines(bill.id) : S().serviceLines(bill.id);
    return lines.some(line => ((line.name || '') + ' ' + (line.sku || '')).toLowerCase().includes(q));
  }

  function billSet(type) {
    const r = range();
    const q = state.q.trim().toLowerCase();
    const all = [];

    S().data.invoices.forEach(inv => {
      if (r.from && inv.date < r.from) return;
      if (r.to && inv.date > r.to) return;
      all.push(saleBill(inv));
    });
    S().data.services.forEach(svc => {
      if (r.from && svc.date < r.from) return;
      if (r.to && svc.date > r.to) return;
      all.push(serviceBill(svc));
    });

    const searched = q ? all.filter(bill => bill.search.includes(q) || matchesLine(bill, q)) : all;
    const byMethod = state.method === 'all' ? searched : searched.filter(bill => bill.method === state.method);
    const counts = {
      all: byMethod.length,
      sale: byMethod.filter(bill => bill.kind === 'sale').length,
      service: byMethod.filter(bill => bill.kind === 'service').length
    };
    const rows = (type === 'sale' || type === 'service') ? byMethod.filter(bill => bill.kind === type) : byMethod;
    return { rows: U.sortBy(rows, bill => bill.createdAt || bill.date, 'desc'), counts };
  }

  function statsHTML(rows, type) {
    const total = U.sumBy(rows, bill => bill.total);
    const paid = U.sumBy(rows, bill => bill.paid);
    const due = U.sumBy(rows, bill => bill.balance);
    const sales = rows.filter(bill => bill.kind === 'sale').length;
    const services = rows.length - sales;
    const countLabel = type === 'sale' ? 'Shop sale bills' : type === 'service' ? 'Service bills' : 'Bills found';
    const valueLabel = type === 'service' ? 'Service value' : type === 'sale' ? 'Sales value' : 'Bill value';
    return '<div class="stat-grid mb-16">' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">' + countLabel + '</span><span class="stat-icon green">' + UI.icon('receipt', 16) + '</span></div>' +
      '<div class="stat-value">' + U.fmtNumber(rows.length, 0) + '</div><div class="stat-meta"><b>' + sales + '</b> shop sales · <b>' + services + '</b> service</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">' + valueLabel + '</span><span class="stat-icon gold">' + UI.icon('chart', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(total) + '</div><div class="stat-meta">' + U.esc(range().label) + '</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Collected</span><span class="stat-icon blue">' + UI.icon('banknote', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(paid) + '</div><div class="stat-meta">At billing and later collections</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Outstanding</span><span class="stat-icon danger">' + UI.icon('clock', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(due) + '</div><div class="stat-meta"><b>' + rows.filter(bill => bill.balance > 0).length + '</b> bill' + (rows.filter(bill => bill.balance > 0).length === 1 ? '' : 's') + ' with a balance</div></div>' +
      '</div>';
  }

  function tabsHTML(type, counts) {
    const items = [
      { key: 'all', href: '#/bills', label: 'All bills' },
      { key: 'sale', href: '#/bills/sales', label: 'Shop sales' },
      { key: 'service', href: '#/bills/service', label: 'Service bills' }
    ];
    return '<nav class="tabs">' + items.map(item =>
      '<a class="tab' + (type === item.key ? ' active' : '') + '" href="' + item.href + '">' + item.label +
      '<span class="tab-count" data-bill-tab-count="' + item.key + '">' + counts[item.key] + '</span></a>').join('') + '</nav>';
  }

  function emptyTableHTML(type) {
    if (state.q.trim()) {
      return '<div class="card-body">' + UI.emptyState({
        icon: 'search', title: 'No bills match that search',
        text: 'Try another bill number, customer, phone, item name, work done or date range.'
      }) + '</div>';
    }
    if (type === 'sale') {
      return '<div class="card-body">' + UI.emptyState({
        icon: 'receipt', title: 'No shop sale bills in this range',
        text: 'Counter sales you bill will be searchable here.',
        action: '<a class="btn btn-primary" href="#/billing/new">' + UI.icon('plus', 14) + 'New sale</a>'
      }) + '</div>';
    }
    if (type === 'service') {
      return '<div class="card-body">' + UI.emptyState({
        icon: 'wrench', title: 'No service bills in this range',
        text: 'Workshop jobs you bill will be searchable here.',
        action: '<a class="btn btn-primary" href="#/service/new">' + UI.icon('plus', 14) + 'New service</a>'
      }) + '</div>';
    }
    return '<div class="card-body">' + UI.emptyState({
      icon: 'receipt', title: 'No bills in this range',
      text: 'Make a shop sale or a service bill and it will appear here for searching and reprinting.',
      action: '<div class="btn-row" style="justify-content:center"><a class="btn" href="#/service/new">' + UI.icon('wrench', 14) + 'New service</a><a class="btn btn-primary" href="#/billing/new">' + UI.icon('plus', 14) + 'New sale</a></div>'
    }) + '</div>';
  }

  function tableHTML(rows, type) {
    if (!rows.length) return emptyTableHTML(type);
    const body = rows.slice(0, 200).map(bill => {
      const kindBadge = bill.kind === 'sale'
        ? '<span class="badge green">Shop sale</span>'
        : '<span class="badge blue">Service</span>';
      const customer = bill.customerName === 'Walk-in customer' && !bill.customerPhone
        ? '<span class="muted">Walk-in customer</span>'
        : '<div class="customer-cell"><span class="avatar" style="width:26px;height:26px;font-size:9px">' + U.esc(U.initials(bill.customerName)) + '</span><div><div class="customer-name">' + U.esc(bill.customerName) + '</div><div class="customer-sub">' + U.esc(bill.customerPhone || 'Saved customer') + '</div></div></div>';
      return '<tr class="row-click" data-bill-row="' + bill.id + '" data-bill-kind="' + bill.kind + '">' +
        '<td><div class="cell-stack"><span class="cell-main">' + U.esc(bill.no) + '</span><span class="cell-sub">' + U.fmtTime(bill.createdAt) + '</span></div></td>' +
        '<td>' + kindBadge + '</td>' +
        '<td class="nowrap">' + U.fmtDate(bill.date, { mode: 'short' }) + '</td>' +
        '<td>' + customer + '</td>' +
        '<td><div class="cell-stack" style="max-width:250px"><span class="cell-main" style="font-weight:500">' + U.esc(bill.detailMain) + '</span><span class="cell-sub">' + U.esc(bill.detailSub) + '</span></div></td>' +
        '<td>' + UI.methodInline(bill.method) + (bill.chequeNo ? '<div class="cell-sub">Chq ' + U.esc(bill.chequeNo) + '</div>' : '') + '</td>' +
        '<td class="right num">' + U.money(bill.total) + '</td>' +
        '<td class="right num ' + (bill.balance > 0 ? 'due-value' : 'muted') + '">' + U.money(bill.balance) + '</td>' +
        '<td>' + UI.statusBadge(bill.status) + '</td>' +
        '<td><div class="row-actions">' +
        '<button type="button" class="btn btn-sm" data-bill-print="' + bill.id + '" data-print-kind="' + bill.kind + '" title="Print this bill">' + UI.icon('printer', 13) + 'Print</button>' +
        '<button type="button" class="icon-btn" title="Open bill">' + UI.icon('arrowRight', 15) + '</button>' +
        '</div></td></tr>';
    }).join('');
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Bill</th><th>Type</th><th>Date</th><th>Customer</th><th>Details</th><th>Payment</th><th class="right">Total</th><th class="right">Balance</th><th>Status</th><th></th></tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<div class="card-foot flex-between"><span class="hint">Showing ' + Math.min(rows.length, 200) + ' of ' + rows.length + ' bill' + (rows.length === 1 ? '' : 's') + ' · use Print to open a copy</span></div>';
  }

  function printBill(kind, id) {
    const detail = kind === 'service' ? S().serviceDetail(id) : S().invoiceDetail(id);
    if (!detail) { UI.toast('That bill could not be found.', 'error'); return; }
    UI.printHtml(UI.receiptFor(kind === 'service' ? 'service' : 'invoice', detail));
  }

  function openBill(kind, id) {
    if (kind === 'service') C.serviceDetailModal(id, { onChanged: () => APP().dataChanged() });
    else C.invoiceDetailModal(id, { onChanged: () => APP().dataChanged() });
  }

  function countLabel(rows) {
    return rows.length + ' bill' + (rows.length === 1 ? '' : 's');
  }

  function screen(route) {
    const type = billType(route);
    const set = billSet(type);
    const title = type === 'sale' ? 'Shop sale bills' : type === 'service' ? 'Service bills' : 'Bill search';
    return UI.pageHead({
      eyebrow: 'Counter · ' + range().label,
      title: title,
      subtitle: 'Find any issued bill and print a copy. Shop sales and service bills are kept in separate tabs.',
      actions: '<a class="btn" href="#/service/new">' + UI.icon('wrench', 15) + 'New service</a>' +
        '<a class="btn btn-primary" href="#/billing/new">' + UI.icon('plus', 15) + 'New sale</a>'
    }) +
      tabsHTML(type, set.counts) +
      '<div id="bill-stats">' + statsHTML(set.rows, type) + '</div>' +
      '<div class="card inventory-card"><div class="inv-toolbar">' +
      '<div class="search-box" style="max-width:390px">' + UI.icon('search', 16) + '<input class="input" id="bill-search" placeholder="Search bill no, customer, phone, item, work done…" value="' + U.attr(state.q) + '"></div>' +
      '<div class="segmented" data-bill-range>' +
      '<button class="seg-btn ' + (state.range === 'today' ? 'active' : '') + '" data-range="today">Today</button>' +
      '<button class="seg-btn ' + (state.range === 'month' ? 'active' : '') + '" data-range="month">This month</button>' +
      '<button class="seg-btn ' + (state.range === 'all' ? 'active' : '') + '" data-range="all">All</button></div>' +
      '<span class="toolbar-sep"></span>' +
      '<div class="segmented wrap" data-bill-method>' +
      METHOD_CHIPS.map(chip => '<button class="seg-btn ' + (state.method === chip.key ? 'active' : '') + '" data-method="' + chip.key + '">' + chip.label + '</button>').join('') + '</div>' +
      '<span class="spacer"></span><span class="toolbar-label" id="bill-result-count">' + countLabel(set.rows) + '</span>' +
      '</div><div id="bill-table">' + tableHTML(set.rows, type) + '</div></div>';
  }

  function mount(content, route) {
    const scope = content.querySelector('#view-root') || content;
    const type = billType(route);
    const stats = content.querySelector('#bill-stats');
    const table = content.querySelector('#bill-table');
    const count = content.querySelector('#bill-result-count');
    const search = content.querySelector('#bill-search');

    function paint() {
      const set = billSet(type);
      if (stats) stats.innerHTML = statsHTML(set.rows, type);
      if (table) table.innerHTML = tableHTML(set.rows, type);
      if (count) count.textContent = countLabel(set.rows);
      const eyebrow = content.querySelector('.page-head .eyebrow');
      if (eyebrow) eyebrow.textContent = 'Counter · ' + range().label;
      ['all', 'sale', 'service'].forEach(key => {
        const el = content.querySelector('[data-bill-tab-count="' + key + '"]');
        if (el) el.textContent = set.counts[key];
      });
      content.querySelectorAll('[data-bill-range] [data-range]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.range === state.range);
      });
      content.querySelectorAll('[data-bill-method] [data-method]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.method === state.method);
      });
    }

    content.querySelectorAll('[data-bill-range] [data-range]').forEach(btn => {
      btn.addEventListener('click', () => { state.range = btn.dataset.range; paint(); });
    });
    content.querySelectorAll('[data-bill-method] [data-method]').forEach(btn => {
      btn.addEventListener('click', () => { state.method = btn.dataset.method; paint(); });
    });
    if (search) search.addEventListener('input', U.debounce(() => { state.q = search.value; paint(); }, 150));

    scope.addEventListener('click', e => {
      const print = e.target.closest('[data-bill-print]');
      if (print) { printBill(print.dataset.printKind, Number(print.dataset.billPrint)); return; }
      const row = e.target.closest('[data-bill-row]');
      if (row) openBill(row.dataset.billKind, Number(row.dataset.billRow));
    });
  }

  V.bills = {
    render(route) { return screen(route); },
    mount(content, route) { mount(content, route); },
    refresh() { APP().renderRoute(true); }
  };
})();
