(function () {
  'use strict';
  const WP = window.WP = window.WP || {};
  const U = WP.utils;
  const UI = WP.ui;
  const C = WP.components;
  const V = WP.views = WP.views || {};

  function S() { return WP.store; }
  function APP() { return WP.app; }

  const listState = { range: 'month', q: '' };

  function listRange() {
    const today = U.todayISO();
    if (listState.range === 'today') return { from: today, to: today, label: 'Today' };
    if (listState.range === 'all') return { from: '', to: '', label: 'All time' };
    return { from: U.monthStartISO(), to: today, label: 'This month' };
  }

  function filteredServices() {
    const r = listRange();
    const q = listState.q.trim().toLowerCase();
    const rows = S().rangeServices(r.from, r.to).filter(svc => {
      if (!q) return true;
      const hay = (svc.no + ' ' + (svc.customerName || '') + ' ' + (svc.technician || '') + ' ' + (svc.machineType || '') + ' ' + (svc.regNo || '') + ' ' + (svc.work || '')).toLowerCase();
      return hay.includes(q);
    });
    return U.sortBy(rows, svc => svc.createdAt || svc.date, 'desc');
  }

  function listStats(rows) {
    const total = U.sumBy(rows, s => s.total);
    const returned = U.sumBy(rows, s => s.returned);
    const paid = U.sumBy(rows, s => s.paid);
    const due = U.sumBy(rows, s => s.balance);
    const techs = new Set(rows.map(s => (s.technician || '').toLowerCase()).filter(Boolean));
    return '<div class="stat-grid mb-16">' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Service jobs</span><span class="stat-icon green">' + UI.icon('wrench', 16) + '</span></div>' +
      '<div class="stat-value">' + U.fmtNumber(rows.length, 0) + '</div><div class="stat-meta"><b>' + techs.size + '</b> technician' + (techs.size === 1 ? '' : 's') + ' · ' + U.esc(listRange().label) + '</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Service value</span><span class="stat-icon gold">' + UI.icon('chart', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(U.round2(total - returned)) + '</div><div class="stat-meta">Net of ' + U.money(returned) + ' returns</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Collected</span><span class="stat-icon blue">' + UI.icon('banknote', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(paid) + '</div><div class="stat-meta">Payments at billing and later collections</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Outstanding</span><span class="stat-icon danger">' + UI.icon('clock', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(due) + '</div><div class="stat-meta"><b>' + rows.filter(s => Number(s.balance) > 0).length + '</b> job' + (rows.filter(s => Number(s.balance) > 0).length === 1 ? '' : 's') + ' with a balance</div></div>' +
      '</div>';
  }

  function serviceTableHTML(rows) {
    if (!rows.length) {
      return '<div class="card-body">' + UI.emptyState({
        icon: 'wrench', title: 'No service jobs found',
        text: listState.q ? 'Try a different search or date range.' : 'When a machine comes into the workshop, create a service bill with the work done and parts used.',
        action: '<a class="btn btn-primary" href="#/service/new">' + UI.icon('plus', 14) + 'New service</a>'
      }) + '</div>';
    }
    const body = rows.slice(0, 200).map(svc => {
      const status = S().invoiceStatus(svc);
      return '<tr class="row-click" data-service-row="' + svc.id + '">' +
        '<td><div class="cell-stack"><span class="cell-main">' + U.esc(svc.no) + '</span><span class="cell-sub">' + U.fmtDate(svc.date, { mode: 'short' }) + ' · ' + U.fmtTime(svc.createdAt) + '</span></div></td>' +
        '<td><div class="cell-stack" style="max-width:220px"><span class="cell-main" style="font-weight:500">' + U.esc(svc.work || 'No work note') + '</span><span class="cell-sub">' + U.esc(svc.machineType || 'Machine not specified') + (svc.regNo ? ' · ' + U.esc(svc.regNo) : '') + '</span></div></td>' +
        '<td>' + (svc.customerId
          ? '<div class="customer-cell"><span class="avatar" style="width:26px;height:26px;font-size:9px">' + U.esc(U.initials(svc.customerName)) + '</span><div><div class="customer-name">' + U.esc(svc.customerName) + '</div><div class="customer-sub">' + U.esc(svc.phone || 'Saved customer') + '</div></div></div>'
          : '<span class="muted">' + U.esc(svc.customerName || 'Walk-in') + '</span>') + '</td>' +
        '<td><span class="strong">' + U.esc(svc.technician) + '</span><div class="cell-sub">' + UI.methodLabel(svc.method) + '</div></td>' +
        '<td class="right num">' + U.money(svc.total) + '</td>' +
        '<td class="right num">' + U.money(svc.paid) + '</td>' +
        '<td class="right num ' + (Number(svc.balance) > 0 ? 'due-value' : 'muted') + '">' + U.money(svc.balance) + '</td>' +
        '<td>' + UI.statusBadge(status) + '</td>' +
        '<td><div class="row-actions"><button type="button" class="icon-btn" data-service-view="' + svc.id + '" title="View service bill">' + UI.icon('arrowRight', 15) + '</button></div></td></tr>';
    }).join('');
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Service bill</th><th>Work done</th><th>Customer</th><th>Technician</th><th class="right">Total</th><th class="right">Paid</th><th class="right">Balance</th><th>Status</th><th></th></tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<div class="card-foot flex-between"><span class="hint">Showing ' + Math.min(rows.length, 200) + ' of ' + rows.length + ' job' + (rows.length === 1 ? '' : 's') + '</span>' +
      '<button class="link-btn" data-export-services>' + UI.icon('download', 13) + 'Export CSV</button></div>';
  }

  function exportServices(rows) {
    if (!rows.length) { UI.toast('No service jobs to export for this filter.', 'info'); return; }
    const data = [['Service bill', 'Date', 'Customer', 'Phone', 'Machine', 'Reg no', 'Technician', 'Work done', 'Labour', 'Parts', 'Discount', 'Total', 'Paid', 'Balance', 'Payment method', 'Status']]
      .concat(rows.map(s => [s.no, s.date, s.customerName, s.phone, s.machineType, s.regNo, s.technician, s.work, s.labor, s.partsTotal, s.discount, s.total, s.paid, s.balance, s.method, S().statusLabel(S().invoiceStatus(s))]));
    U.downloadFile('wijaya-service-jobs-' + (listRange().from || 'all') + '.csv', U.toCSV(data), 'text/csv;charset=utf-8');
    UI.toast('Service jobs exported.');
  }

  function listScreen() {
    const rows = filteredServices();
    return UI.pageHead({
      eyebrow: 'Workshop · ' + listRange().label,
      title: 'Service jobs',
      subtitle: 'Every workshop job with the technician, work done, parts used and payment status.',
      actions: '<button class="btn" data-export-services>' + UI.icon('download', 15) + 'Export CSV</button>' +
        '<a class="btn btn-primary" href="#/service/new">' + UI.icon('plus', 15) + 'New service</a>'
    }) +
      '<nav class="tabs"><a class="tab active" href="#/service">All jobs</a><a class="tab" href="#/service/tech">By technician</a></nav>' +
      '<div id="svc-list-stats">' + listStats(rows) + '</div>' +
      '<div class="card inventory-card"><div class="inv-toolbar">' +
      '<div class="search-box" style="max-width:330px">' + UI.icon('search', 16) + '<input class="input" id="svc-list-search" placeholder="Search job, customer, technician, machine or work…" value="' + U.attr(listState.q) + '"></div>' +
      '<div class="segmented" data-svc-range>' +
      '<button class="seg-btn ' + (listState.range === 'today' ? 'active' : '') + '" data-range="today">Today</button>' +
      '<button class="seg-btn ' + (listState.range === 'month' ? 'active' : '') + '" data-range="month">This month</button>' +
      '<button class="seg-btn ' + (listState.range === 'all' ? 'active' : '') + '" data-range="all">All</button></div>' +
      '<span class="spacer"></span><span class="toolbar-label" id="svc-list-count">' + rows.length + ' jobs</span></div>' +
      '<div id="svc-list-table">' + serviceTableHTML(rows) + '</div></div>';
  }

  /* ---------------- by technician ---------------- */
  function techScreen() {
    const from = U.monthStartISO();
    const to = U.todayISO();
    const data = S().servicesByTechnician(from, to);
    const max = Math.max(1, ...data.rows.map(r => r.total));
    const cards = data.rows.map(r => {
      const share = U.pct(r.total, data.total);
      return '<div class="card tech-card"><div class="tech-card-head"><span class="tech-avatar">' + U.esc(U.initials(r.name)) + '</span>' +
        '<div><div class="tech-card-name">' + U.esc(r.name) + '</div><div class="tech-card-sub">' + r.jobs + ' job' + (r.jobs === 1 ? '' : 's') + ' · last ' + U.esc(U.fmtDate(r.lastDate, { mode: 'short' })) + '</div></div></div>' +
        '<div class="tech-card-body">' +
        '<div class="tech-fig"><span>Labour</span><b>' + U.moneyShort(r.labour) + '</b></div>' +
        '<div class="tech-fig"><span>Parts</span><b>' + U.moneyShort(r.parts) + '</b></div>' +
        '<div class="tech-fig"><span>Total</span><b>' + U.moneyShort(r.total) + '</b></div>' +
        '</div><div class="tech-share"><i style="width:' + U.clamp((r.total / max) * 100, 1, 100) + '%"></i></div>' +
        '<div class="card-foot flex-between"><span class="hint">' + U.fmtNumber(share, 1) + '% of service value</span>' +
        (Number(r.due) > 0 ? '<span class="badge red">' + U.moneyShort(r.due) + ' due</span>' : '<span class="badge green">Paid</span>') + '</div></div>';
    }).join('');
    const tableRows = data.rows.map(r =>
      '<tr><td><div class="customer-cell"><span class="avatar">' + U.esc(U.initials(r.name)) + '</span><div><div class="customer-name">' + U.esc(r.name) + '</div><div class="customer-sub">Last job ' + U.esc(U.fmtDate(r.lastDate, { mode: 'short' })) + '</div></div></div></td>' +
      '<td class="right num">' + r.jobs + '</td>' +
      '<td class="right num">' + U.money(r.labour) + '</td>' +
      '<td class="right num">' + U.money(r.parts) + '</td>' +
      '<td class="right num">' + U.money(r.total) + '</td>' +
      '<td class="right num">' + U.money(r.due) + '</td></tr>').join('');
    return UI.pageHead({
      eyebrow: 'Workshop · Monthly report',
      title: 'Service by technician',
      subtitle: 'Who did the work this month, and what each name brought in.',
      actions: '<a class="btn" href="#/service">' + UI.icon('arrowLeft', 15) + 'All jobs</a>' +
        '<a class="btn btn-primary" href="#/service/new">' + UI.icon('plus', 15) + 'New service</a>'
    }) +
      '<nav class="tabs"><a class="tab" href="#/service">All jobs</a><a class="tab active" href="#/service/tech">By technician</a></nav>' +
      '<div class="stat-grid mb-16">' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Jobs this month</span><span class="stat-icon green">' + UI.icon('wrench', 16) + '</span></div><div class="stat-value">' + data.jobs + '</div><div class="stat-meta">' + U.esc(U.monthLabel(U.monthKey(to))) + '</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Service value</span><span class="stat-icon gold">' + UI.icon('chart', 16) + '</span></div><div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(data.total) + '</div><div class="stat-meta">Labour plus parts used</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Collected</span><span class="stat-icon blue">' + UI.icon('banknote', 16) + '</span></div><div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(data.paid) + '</div><div class="stat-meta">' + U.money(data.due) + ' still due</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Parts cost used</span><span class="stat-icon danger">' + UI.icon('box', 16) + '</span></div><div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(data.partsCost) + '</div><div class="stat-meta">Cost of parts consumed in service</div></div>' +
      '</div>' +
      (data.rows.length
        ? '<div class="technician-stats mb-16">' + cards + '</div>' +
          '<div class="card inventory-card"><div class="card-head bordered"><div><div class="card-title">Technician totals</div><div class="card-sub">Sorted by service value for the current month.</div></div></div>' +
          '<div class="table-wrap"><table class="table"><thead><tr><th>Technician</th><th class="right">Jobs</th><th class="right">Labour</th><th class="right">Parts</th><th class="right">Total</th><th class="right">Due</th></tr></thead><tbody>' + tableRows + '</tbody></table></div></div>'
        : '<div class="card">' + UI.emptyState({ icon: 'users', title: 'No service jobs this month', text: 'Create a service bill and the technician’s name will be counted here.' }) + '</div>');
  }

  /* =========================================================
     NEW SERVICE BILL
     ========================================================= */
  const FORM_DEFAULTS = {
    customerId: '',
    customerName: '',
    customerPhone: '',
    machineType: '',
    regNo: '',
    technician: '',
    work: '',
    parts: [],
    labor: '',
    discount: '',
    method: 'cash',
    received: '',
    chequeNo: '',
    chequeDate: U.todayISO(),
    note: '',
    search: '',
    jobNo: '',
    jobAdvance: 0
  };
  const serviceForm = Object.assign({}, FORM_DEFAULTS);

  function resetServiceForm() {
    Object.assign(serviceForm, FORM_DEFAULTS, { parts: [], chequeDate: U.todayISO(), method: 'cash' });
  }

  function startFromJob(job) {
    resetServiceForm();
    if (!job) return;
    serviceForm.jobNo = job.no || '';
    serviceForm.jobAdvance = Number(job.advance) || 0;
    serviceForm.customerId = job.customerId ? String(job.customerId) : '';
    const customer = chosenCustomer();
    serviceForm.customerName = customer ? '' : (job.customerName || '');
    serviceForm.customerPhone = customer ? '' : (job.phone || '');
    serviceForm.machineType = job.machineType || '';
    serviceForm.regNo = job.regNo || '';
    serviceForm.technician = job.technician || '';
    serviceForm.work = job.work || '';
  }

  function chosenCustomer() {
    return serviceForm.customerId ? S().customerById(Number(serviceForm.customerId)) : null;
  }

  function formPartsTotal() {
    return U.round2(U.sumBy(serviceForm.parts, l => Number(l.qty) * Number(l.price)));
  }

  function formTotals() {
    const partsTotal = formPartsTotal();
    const labor = U.round2(U.toNum(serviceForm.labor, 0));
    const subtotal = U.round2(partsTotal + labor);
    const discount = U.round2(U.clamp(U.toNum(serviceForm.discount, 0), 0, subtotal));
    return { partsTotal, labor, subtotal, discount, total: U.round2(subtotal - discount) };
  }

  function technicianList() {
    const names = S().data.services.map(s => (s.technician || '').trim()).filter(Boolean);
    return U.unique(names).sort();
  }

  function machineTypeList() {
    const types = S().data.services.map(s => (s.machineType || '').trim()).filter(Boolean);
    return U.unique(types).sort();
  }

  function customerFieldHTML() {
    return '<div class="field"><label class="label" for="svc-customer">Customer <span class="opt">(saved, for credit or advance)</span></label>' +
      '<div style="display:flex;gap:6px">' +
      '<select class="select" id="svc-customer" style="flex:1">' +
      UI.option('', 'Walk-in customer', serviceForm.customerId) +
      U.sortBy(S().activeCustomers(), c => c.name.toLowerCase(), 'asc').map(c =>
        '<option value="' + c.id + '"' + (Number(serviceForm.customerId) === Number(c.id) ? ' selected' : '') + '>' + U.esc(c.name) + (c.phone ? ' · ' + U.esc(c.phone) : '') + '</option>').join('') +
      '</select>' +
      '<button type="button" class="btn" data-svc-add-customer title="Add a new customer">' + UI.icon('userPlus', 15) + '</button>' +
      '</div></div>';
  }

  function walkinFieldsHTML() {
    return '<div class="form-grid' + (serviceForm.customerId ? ' hidden' : '') + '" data-walkin-fields>' +
      '<div class="field"><label class="label" for="svc-walkin-name">Walk-in name <span class="opt">(optional)</span></label>' +
      '<input class="input" id="svc-walkin-name" data-svc-field="customerName" value="' + U.attr(serviceForm.customerName) + '" placeholder="Customer name" autocomplete="off"></div>' +
      '<div class="field"><label class="label" for="svc-walkin-phone">Phone <span class="opt">(optional)</span></label>' +
      '<input class="input" id="svc-walkin-phone" data-svc-field="customerPhone" value="' + U.attr(serviceForm.customerPhone) + '" placeholder="07X XXX XXXX" autocomplete="off"></div>' +
      '</div>';
  }

  function pickerResultsHTML() {
    const q = serviceForm.search.trim().toLowerCase();
    if (!q) return '';
    const rows = S().activeItems().filter(i => i.category === 'part' &&
      ((i.name || '').toLowerCase().includes(q) || (i.sku || '').toLowerCase().includes(q) || (i.compatible || '').toLowerCase().includes(q))).slice(0, 8);
    if (!rows.length) return '<div class="picker-empty">No part found. Add it under Spare parts first.</div>';
    return rows.map(item => {
      const inCart = U.sumBy(serviceForm.parts.filter(l => Number(l.itemId) === Number(item.id)), l => l.qty);
      const available = U.round2(Number(item.qty) - inCart);
      return '<button type="button" class="picker-result" data-svc-pick="' + item.id + '"' + (available <= 0 ? ' disabled style="opacity:.5"' : '') + '>' +
        '<span class="picker-result-main"><span class="picker-result-name">' + U.esc(item.name) + '</span>' +
        '<span class="picker-result-meta">' + U.esc(item.sku || '') + ' · ' + available + ' available</span></span>' +
        '<span class="picker-result-price">' + U.money(item.retail) + '</span></button>';
    }).join('');
  }

  function partRowHTML(line) {
    const item = S().itemById(line.itemId);
    if (!item) return '';
    const qty = Number(line.qty);
    return '<div class="pe-line" data-part-line="' + item.id + '">' +
      '<div><div class="pe-name">' + U.esc(item.name) + '</div><div class="pe-meta">' + U.esc(item.sku || '') + ' · stock ' + U.fmtQty(item.qty) + '</div></div>' +
      '<div class="pe-total">' + U.money(qty * Number(line.price)) + '</div>' +
      '<div class="pe-controls">' +
      '<div class="qty-control"><button type="button" class="qty-btn" data-svc-minus="' + item.id + '">−</button>' +
      '<span class="qty-input" style="display:grid;place-items:center">' + U.fmtQty(qty) + '</span>' +
      '<button type="button" class="qty-btn" data-svc-plus="' + item.id + '">+</button></div>' +
      '<input class="price-edit" data-svc-price="' + item.id + '" type="number" min="0" step="0.01" value="' + Number(line.price).toFixed(2) + '" title="Unit price">' +
      '<button type="button" class="line-remove" data-svc-remove="' + item.id + '" title="Remove part">' + UI.icon('trash', 14) + '</button>' +
      '</div></div>';
  }

  function partsListHTML() {
    if (!serviceForm.parts.length) {
      return '<div class="empty-inline">No parts added. Search above to use stock parts on this job.</div>';
    }
    return serviceForm.parts.map(partRowHTML).join('');
  }

  function totalsHTML() {
    const t = formTotals();
    return '<div class="total-row"><span>Parts used</span><b id="svc-parts-total">' + U.money(t.partsTotal) + '</b></div>' +
      '<div class="total-row"><span>Labour / service charge</span><b id="svc-labor-total">' + U.money(t.labor) + '</b></div>' +
      '<div class="total-row"><span>Subtotal</span><b id="svc-subtotal-total">' + U.money(t.subtotal) + '</b></div>' +
      '<div class="total-row"><span>Discount</span><b id="svc-discount-total">− ' + U.money(t.discount) + '</b></div>' +
      '<div class="total-row grand-total"><span>Service total</span><b id="svc-grand-total">' + U.money(t.total) + '</b></div>';
  }

  function payFieldsHTML() {
    const t = formTotals();
    const customer = chosenCustomer();
    if (serviceForm.method === 'cash') {
      const received = U.toNum(serviceForm.received, 0);
      const change = received > t.total ? U.round2(received - t.total) : 0;
      return '<div class="field"><label class="label" for="svc-received">Cash received</label>' +
        '<div class="input-group"><span class="prefix">' + U.esc(U.symbol()) + '</span>' +
        '<input class="input" id="svc-received" data-svc-field="received" type="number" min="0" step="0.01" placeholder="' + t.total.toFixed(2) + '" value="' + U.attr(serviceForm.received) + '"></div>' +
        '<div class="change-line"><span>Change to give</span><span id="svc-cash-change">' + U.money(change) + '</span></div>' +
        '</div>';
    }
    if (serviceForm.method === 'cheque') {
      return '<div class="form-grid"><div class="field"><label class="label" for="svc-cheque-no">Cheque number</label>' +
        '<input class="input" id="svc-cheque-no" data-svc-field="chequeNo" value="' + U.attr(serviceForm.chequeNo) + '" placeholder="e.g. 045812" autocomplete="off"></div>' +
        '<div class="field"><label class="label" for="svc-cheque-date">Cheque date</label>' +
        '<input class="input" id="svc-cheque-date" data-svc-field="chequeDate" type="date" value="' + U.attr(serviceForm.chequeDate) + '"></div></div>';
    }
    if (serviceForm.method === 'credit') {
      return '<div class="pay-note">The full ' + U.money(t.total) + ' will be added to ' +
        (customer ? '<b>' + U.esc(customer.name) + '</b>' : '<b>the customer</b>') + '’s outstanding balance. Collect it later from Customers.</div>';
    }
    if (serviceForm.method === 'advance') {
      const available = customer ? S().customerAdvance(customer.id) : 0;
      return '<div class="pay-note">' + (customer
        ? 'Available advance: <b>' + U.money(available) + '</b>. ' + (available >= t.total ? 'The full bill can be covered.' : 'Only ' + U.money(available) + ' can be applied; the remainder needs another method.')
        : 'Choose a saved customer to use their advance.') + '</div>';
    }
    return '<div class="pay-note">' + (serviceForm.method === 'card' ? 'Card' : 'Online transfer') + ' payment of <b>' + U.money(t.total) + '</b> will be recorded as fully paid. Confirm on the terminal before saving.</div>';
  }

  function newScreen() {
    const techs = technicianList();
    const types = machineTypeList();
    const t = formTotals();
    return UI.pageHead({
      eyebrow: 'Workshop · New bill',
      title: 'New service bill',
      subtitle: 'Record who did the work, what was done, the parts used and how it was paid.',
      actions: '<a class="btn" href="#/service">' + UI.icon('arrowLeft', 15) + 'Service jobs</a>'
    }) +
      (serviceForm.jobNo
        ? '<div class="job-bill-bar"><span>' + UI.icon('fileText', 15) +
          '<span class="job-bill-text">Billing for job card <b>' + U.esc(serviceForm.jobNo) + '</b>' +
          (serviceForm.machineType ? ' · ' + U.esc(serviceForm.machineType) : '') +
          (serviceForm.regNo ? ' · ' + U.esc(serviceForm.regNo) : '') +
          (Number(serviceForm.jobAdvance) > 0
            ? ' · advance ' + U.money(serviceForm.jobAdvance) + (serviceForm.customerId ? ' sits on the customer’s account — pay this bill with Advance to use it' : ' already collected')
            : '') + '</span></span>' +
          '<button type="button" class="btn btn-sm" data-svc-clear-job>Not this job</button></div>'
        : '') +
      '<div class="service-layout">' +
      '<div class="service-main">' +
      '<div class="card card-pad"><div class="card-title mb-12">' + UI.icon('users', 18) + 'Customer & machine</div>' +
      '<div class="form-grid">' +
      '<div class="full">' + customerFieldHTML() + '</div>' +
      '<div class="full">' + walkinFieldsHTML() + '</div>' +
      '<div class="field"><label class="label" for="svc-machine-type">Machine / tractor</label>' +
      '<input class="input" id="svc-machine-type" data-svc-field="machineType" value="' + U.attr(serviceForm.machineType) + '" placeholder="e.g. Mahindra 575 DI" autocomplete="off" list="svc-machine-types">' +
      '<datalist id="svc-machine-types">' + types.map(t => '<option value="' + U.attr(t) + '"></option>').join('') + '</datalist></div>' +
      '<div class="field"><label class="label" for="svc-reg-no">Registration / serial <span class="opt">(optional)</span></label>' +
      '<input class="input" id="svc-reg-no" data-svc-field="regNo" value="' + U.attr(serviceForm.regNo) + '" placeholder="e.g. NP-1234" autocomplete="off"></div>' +
      '</div></div>' +
      '<div class="card card-pad"><div class="card-title mb-12">' + UI.icon('wrench', 18) + 'Work done</div>' +
      '<div class="form-grid">' +
      '<div class="field full"><label class="label" for="svc-technician">Technician who did the service</label>' +
      (techs.length ? '<div class="tech-chips mb-8">' + techs.slice(0, 8).map(name =>
        '<button type="button" class="tech-chip' + (serviceForm.technician === name ? ' active' : '') + '" data-svc-tech="' + U.attr(name) + '">' + U.esc(name) + '</button>').join('') + '</div>' : '') +
      '<input class="input" id="svc-technician" data-svc-field="technician" value="' + U.attr(serviceForm.technician) + '" placeholder="Type technician name" autocomplete="off"></div>' +
      '<div class="field full"><label class="label" for="svc-work">Work done <span class="opt">(required, printed on the bill)</span></label>' +
      '<textarea class="textarea" id="svc-work" data-svc-field="work" rows="4" placeholder="Describe exactly what was done — e.g. Replaced hydraulic pump seal, cleaned oil filter, tested lift under load.">' + U.esc(serviceForm.work) + '</textarea></div>' +
      '</div></div>' +
      '<div class="card card-pad"><div class="card-title mb-12">' + UI.icon('box', 18) + 'Parts used <span class="badge grey" id="svc-partcount">' + serviceForm.parts.length + '</span></div>' +
      '<div class="part-picker"><div class="search-box">' + UI.icon('search', 16) +
      '<input class="input" id="svc-part-search" placeholder="Search a part by name, SKU or model…" value="' + U.attr(serviceForm.search) + '" autocomplete="off"></div>' +
      '<div class="picker-results' + (serviceForm.search.trim() ? '' : ' hidden') + '" id="svc-picker">' + pickerResultsHTML() + '</div></div>' +
      '<div class="pe-list mt-12" id="svc-parts-list">' + partsListHTML() + '</div>' +
      '<div class="hint mt-8">Parts are taken out of live stock when the bill is saved.</div></div>' +
      '</div>' +
      '<aside class="card service-side">' +
      '<div class="cart-head"><div><div class="cart-title">Service bill</div><div class="cart-sub" id="svc-customer-label">' + U.esc(chosenCustomer() ? chosenCustomer().name : 'Walk-in customer') + '</div></div>' +
      '<span class="wholesale-flag">SERVICE</span></div>' +
      '<div class="service-bill-scroll"><div class="card-pad" style="padding-top:14px">' +
      '<div class="form-grid" style="gap:10px">' +
      '<div class="field"><label class="label" for="svc-labor">Labour charge</label>' +
      '<div class="input-group"><span class="prefix">' + U.esc(U.symbol()) + '</span><input class="input" id="svc-labor" data-svc-field="labor" type="number" min="0" step="0.01" placeholder="0.00" value="' + U.attr(serviceForm.labor) + '"></div></div>' +
      '<div class="field"><label class="label" for="svc-discount">Discount</label>' +
      '<div class="input-group"><span class="prefix">' + U.esc(U.symbol()) + '</span><input class="input" id="svc-discount" data-svc-field="discount" type="number" min="0" step="0.01" placeholder="0.00" value="' + U.attr(serviceForm.discount) + '"></div></div>' +
      '</div>' +
      '<div class="divider"></div>' +
      '<div class="totals" id="svc-totals">' + totalsHTML() + '</div>' +
      '<div class="pay-label"><span class="label">Payment method</span><span class="hint" id="svc-advance-hint">' + (chosenCustomer() && S().customerAdvance(chosenCustomer().id) > 0 ? 'Advance ' + U.money(S().customerAdvance(chosenCustomer().id)) : '') + '</span></div>' +
      '<div class="pay-methods">' +
      '<button type="button" class="pay-btn' + (serviceForm.method === 'cash' ? ' active' : '') + '" data-svc-method="cash">' + UI.icon('banknote', 13) + 'Cash</button>' +
      '<button type="button" class="pay-btn' + (serviceForm.method === 'card' ? ' active' : '') + '" data-svc-method="card">' + UI.icon('card', 13) + 'Card</button>' +
      '<button type="button" class="pay-btn' + (serviceForm.method === 'online' ? ' active' : '') + '" data-svc-method="online">' + UI.icon('globe', 13) + 'Online</button>' +
      '<button type="button" class="pay-btn' + (serviceForm.method === 'cheque' ? ' active' : '') + '" data-svc-method="cheque">' + UI.icon('fileText', 13) + 'Cheque</button>' +
      '<button type="button" class="pay-btn' + (serviceForm.method === 'credit' ? ' active' : '') + '" data-svc-method="credit">' + UI.icon('clock', 13) + 'Credit</button>' +
      '<button type="button" class="pay-btn' + (serviceForm.method === 'advance' ? ' active' : '') + '" data-svc-method="advance">' + UI.icon('coins', 13) + 'Advance</button>' +
      '</div>' +
      '<div class="pay-fields" id="svc-payfields">' + payFieldsHTML() + '</div>' +
      '<div class="field"><label class="label" for="svc-note">Note <span class="opt">(optional)</span></label>' +
      '<input class="input" id="svc-note" data-svc-field="note" value="' + U.attr(serviceForm.note) + '" placeholder="Warranty, next service or remark" autocomplete="off"></div>' +
      '</div></div>' +
      '<div class="service-summary"><button type="button" class="btn btn-primary checkout-btn" data-svc-submit>' + UI.icon('check', 16) + 'Save service bill · ' + U.money(t.total) + '</button>' +
      '<div class="hint center mt-8">' + UI.icon('printer', 12) + ' A receipt opens after saving.</div></div>' +
      '</aside></div>';
  }

  function paintParts(scope) {
    const list = scope.querySelector('#svc-parts-list');
    if (list) list.innerHTML = partsListHTML();
    const count = scope.querySelector('#svc-partcount');
    if (count) count.textContent = serviceForm.parts.length;
  }

  function paintPicker(scope) {
    const picker = scope.querySelector('#svc-picker');
    if (!picker) return;
    picker.innerHTML = pickerResultsHTML();
    picker.classList.toggle('hidden', !serviceForm.search.trim());
  }

  function paintTotals(scope) {
    const t = formTotals();
    const partsEl = scope.querySelector('#svc-parts-total');
    if (partsEl) partsEl.textContent = U.money(t.partsTotal);
    const laborEl = scope.querySelector('#svc-labor-total');
    if (laborEl) laborEl.textContent = U.money(t.labor);
    const subEl = scope.querySelector('#svc-subtotal-total');
    if (subEl) subEl.textContent = U.money(t.subtotal);
    const discEl = scope.querySelector('#svc-discount-total');
    if (discEl) discEl.textContent = '− ' + U.money(t.discount);
    const grandEl = scope.querySelector('#svc-grand-total');
    if (grandEl) grandEl.textContent = U.money(t.total);
    const changeEl = scope.querySelector('#svc-cash-change');
    if (changeEl) {
      const received = U.toNum(serviceForm.received, 0);
      changeEl.textContent = U.money(received > t.total ? U.round2(received - t.total) : 0);
    }
    const submit = scope.querySelector('[data-svc-submit]');
    if (submit) submit.innerHTML = UI.icon('check', 16) + 'Save service bill · ' + U.money(t.total);
  }

  function paintPayFields(scope) {
    const wrap = scope.querySelector('#svc-payfields');
    if (wrap) wrap.innerHTML = payFieldsHTML();
    const hint = scope.querySelector('#svc-advance-hint');
    if (hint) {
      const customer = chosenCustomer();
      hint.textContent = customer && S().customerAdvance(customer.id) > 0 ? 'Advance ' + U.money(S().customerAdvance(customer.id)) : '';
    }
  }

  function addPart(scope, itemId) {
    const item = S().itemById(Number(itemId));
    if (!item) return;
    let line = serviceForm.parts.find(l => Number(l.itemId) === Number(item.id));
    const used = line ? Number(line.qty) : 0;
    if (used + 1 > Number(item.qty) + 0.0001) {
      UI.toast('Only ' + U.fmtQty(item.qty) + ' of ' + item.name + ' available.', 'info');
      return;
    }
    if (line) line.qty = U.round2(Number(line.qty) + 1);
    else serviceForm.parts.push({ itemId: item.id, qty: 1, price: Number(item.retail) });
    serviceForm.search = '';
    const search = scope.querySelector('#svc-part-search');
    if (search) search.value = '';
    paintParts(scope);
    paintPicker(scope);
    paintTotals(scope);
    if (search) search.focus();
  }

  async function submitService(scope) {
    const totals = formTotals();
    const customer = chosenCustomer();
    if (!serviceForm.technician.trim()) { UI.toast('Enter the technician who did the service.', 'error'); return; }
    if (!serviceForm.work.trim()) { UI.toast('Describe the work that was done.', 'error'); return; }
    if (totals.partsTotal + totals.labor <= 0) { UI.toast('Add a labour charge or at least one part.', 'error'); return; }
    if (['credit', 'advance'].includes(serviceForm.method) && !customer) {
      UI.toast(serviceForm.method === 'credit' ? 'Choose a saved customer for a credit service bill.' : 'Choose a saved customer to use an advance.', 'error'); return;
    }
    if (serviceForm.method === 'cheque' && !serviceForm.chequeNo.trim()) { UI.toast('Enter the cheque number.', 'error'); return; }
    if (serviceForm.method === 'cash') {
      const received = serviceForm.received === '' ? totals.total : U.toNum(serviceForm.received, 0);
      if (received + 0.009 < totals.total) { UI.toast('Cash received is less than the service total.', 'error'); return; }
    }
    const submit = scope.querySelector('[data-svc-submit]');
    try {
      await UI.withLoading(submit, async () => {
        const result = await S().createService({
          customerId: customer ? customer.id : null,
          customerName: customer ? customer.name : serviceForm.customerName,
          customerPhone: customer ? customer.phone : serviceForm.customerPhone,
          machineType: serviceForm.machineType,
          regNo: serviceForm.regNo,
          technician: serviceForm.technician,
          work: serviceForm.work,
          parts: serviceForm.parts.map(l => ({ itemId: l.itemId, qty: l.qty, price: l.price })),
          labor: totals.labor,
          discount: totals.discount,
          method: serviceForm.method,
          received: serviceForm.method === 'cash' ? (serviceForm.received === '' ? totals.total : serviceForm.received) : '',
          chequeNo: serviceForm.chequeNo,
          chequeDate: serviceForm.chequeDate,
          note: serviceForm.note,
          cashierId: WP.app.getActiveCashierId()
        });
        resetServiceForm();
        APP().refresh();
        UI.showReceipt('service', result);
        UI.toast('Service bill ' + result.service.no + ' saved.');
      });
    } catch (err) {
      UI.toast(err.userMessage || err.message || 'Could not save the service bill.', 'error');
    }
  }

  V.services = {
    startFromJob,
    render(route) {
      if (route && route.sub === 'new') return newScreen();
      if (route && route.sub === 'tech') return techScreen();
      return listScreen();
    },
    mount(content, route) {
      const scope = content.querySelector('#view-root') || content;

      if (route && route.sub === 'new') {
        scope.addEventListener('input', e => {
          const field = e.target.closest('[data-svc-field]');
          if (field) serviceForm[field.dataset.svcField] = field.value;
          if (field && field.dataset.svcField === 'labor') paintTotals(scope);
          if (field && field.dataset.svcField === 'discount') paintTotals(scope);
          if (field && field.dataset.svcField === 'received') paintTotals(scope);
          if (e.target.id === 'svc-part-search') {
            serviceForm.search = e.target.value;
            paintPicker(scope);
          }
          if (e.target.matches('[data-svc-price]')) {
            const itemId = Number(e.target.dataset.svcPrice);
            const line = serviceForm.parts.find(l => Number(l.itemId) === Number(itemId));
            if (line) {
              line.price = Math.max(0, U.toNum(e.target.value, 0));
              paintTotals(scope);
              const row = e.target.closest('.pe-line');
              const total = row ? row.querySelector('.pe-total') : null;
              if (total) total.textContent = U.money(Number(line.qty) * Number(line.price));
            }
          }
        });

        scope.addEventListener('change', e => {
          if (e.target.id === 'svc-customer') {
            serviceForm.customerId = e.target.value;
            const customer = chosenCustomer();
            const walkin = scope.querySelector('[data-walkin-fields]');
            if (walkin) walkin.classList.toggle('hidden', !!serviceForm.customerId);
            const label = scope.querySelector('#svc-customer-label');
            if (label) label.textContent = customer ? customer.name : 'Walk-in customer';
            paintPayFields(scope);
          }
          if (e.target.matches('[data-svc-price]')) {
            const itemId = Number(e.target.dataset.svcPrice);
            const line = serviceForm.parts.find(l => Number(l.itemId) === Number(itemId));
            if (line) line.price = Math.max(0, U.toNum(e.target.value, 0));
            paintTotals(scope);
          }
        });

        scope.addEventListener('keydown', e => {
          if (e.target.id === 'svc-part-search' && e.key === 'Escape') {
            serviceForm.search = '';
            e.target.value = '';
            paintPicker(scope);
          }
        });

        scope.addEventListener('click', e => {
          const method = e.target.closest('[data-svc-method]');
          if (method) {
            serviceForm.method = method.dataset.svcMethod;
            scope.querySelectorAll('[data-svc-method]').forEach(btn => btn.classList.toggle('active', btn === method));
            paintPayFields(scope);
            paintTotals(scope);
            return;
          }
          if (e.target.closest('[data-svc-add-customer]')) {
            C.addCustomerModal({
              onSaved(customer) {
                serviceForm.customerId = String(customer.id);
                serviceForm.customerName = '';
                serviceForm.customerPhone = '';
              }
            });
            return;
          }
          const techChip = e.target.closest('[data-svc-tech]');
          if (techChip) {
            serviceForm.technician = techChip.dataset.svcTech;
            const input = scope.querySelector('#svc-technician');
            if (input) input.value = serviceForm.technician;
            scope.querySelectorAll('[data-svc-tech]').forEach(chip => chip.classList.toggle('active', chip === techChip));
            return;
          }
          const pick = e.target.closest('[data-svc-pick]');
          if (pick) { addPart(scope, pick.dataset.svcPick); return; }
          const plus = e.target.closest('[data-svc-plus]');
          if (plus) {
            const itemId = Number(plus.dataset.svcPlus);
            const item = S().itemById(itemId);
            const line = serviceForm.parts.find(l => Number(l.itemId) === itemId);
            if (!item || !line) return;
            if (Number(line.qty) + 1 > Number(item.qty) + 0.0001) { UI.toast('Only ' + U.fmtQty(item.qty) + ' in stock.', 'info'); return; }
            line.qty = U.round2(Number(line.qty) + 1);
            paintParts(scope); paintTotals(scope);
            return;
          }
          const minus = e.target.closest('[data-svc-minus]');
          if (minus) {
            const itemId = Number(minus.dataset.svcMinus);
            const line = serviceForm.parts.find(l => Number(l.itemId) === itemId);
            if (!line) return;
            line.qty = U.round2(Number(line.qty) - 1);
            if (line.qty <= 0) serviceForm.parts = serviceForm.parts.filter(l => Number(l.itemId) !== itemId);
            paintParts(scope); paintTotals(scope);
            return;
          }
          const remove = e.target.closest('[data-svc-remove]');
          if (remove) {
            const itemId = Number(remove.dataset.svcRemove);
            serviceForm.parts = serviceForm.parts.filter(l => Number(l.itemId) !== itemId);
            paintParts(scope); paintTotals(scope);
            return;
          }
          if (e.target.closest('[data-svc-clear-job]')) {
            resetServiceForm();
            APP().renderRoute(true);
            return;
          }
          if (e.target.closest('[data-svc-submit]')) { submitService(scope); }
        });
        return;
      }

      if (route && route.sub === 'tech') return;

      const search = scope.querySelector('#svc-list-search');
      function paintScope() {
        const rows = filteredServices();
        const table = scope.querySelector('#svc-list-table');
        const stats = scope.querySelector('#svc-list-stats');
        const count = scope.querySelector('#svc-list-count');
        if (table) table.innerHTML = serviceTableHTML(rows);
        if (stats) stats.innerHTML = listStats(rows);
        if (count) count.textContent = rows.length + ' jobs';
      }
      if (search) search.addEventListener('input', U.debounce(() => { listState.q = search.value; paintScope(); }, 160));
      scope.addEventListener('click', e => {
        const rangeBtn = e.target.closest('[data-svc-range] [data-range]');
        if (rangeBtn) {
          listState.range = rangeBtn.dataset.range;
          APP().renderRoute(true);
          return;
        }
        if (e.target.closest('[data-export-services]')) { exportServices(filteredServices()); return; }
        const row = e.target.closest('[data-service-row]');
        if (row) { C.serviceDetailModal(Number(row.dataset.serviceRow), { onChanged: () => APP().dataChanged() }); }
      });
    },
    refresh() {
      APP().renderRoute(true);
    }
  };
})();
