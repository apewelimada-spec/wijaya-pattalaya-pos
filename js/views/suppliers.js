(function () {
  'use strict';
  const WP = window.WP = window.WP || {};
  const U = WP.utils;
  const UI = WP.ui;
  const V = WP.views = WP.views || {};

  function S() { return WP.store; }
  function APP() { return WP.app; }
  function adminMode() {
    return !(WP.auth && WP.auth.isCashier && WP.auth.isCashier());
  }

  const listState = { q: '', category: 'all', tab: 'suppliers' };
  const billDraft = { supplierId: null, lines: [] };

  function supplierBillCount(id) {
    return S().supplierBills().filter(b => Number(b.supplierId) === Number(id)).length;
  }

  function supplierSpent(id) {
    return U.sumBy(S().supplierBills().filter(b => Number(b.supplierId) === Number(id)), b => Number(b.total) || 0);
  }

  function filteredSuppliers() {
    const q = listState.q.trim().toLowerCase();
    return U.sortBy(S().activeSuppliers().filter(s => {
      if (listState.category !== 'all' && s.category !== listState.category) return false;
      if (!q) return true;
      return (s.name + ' ' + (s.phone || '')).toLowerCase().includes(q);
    }), s => s.name.toLowerCase(), 'asc');
  }

  function monthBills() {
    const from = U.monthStartISO();
    return S().supplierBills().filter(b => b.date >= from);
  }

  function statsHTML() {
    const suppliers = S().activeSuppliers();
    const stockSuppliers = suppliers.filter(s => s.category === 'stock');
    const month = monthBills();
    const stockValue = U.sumBy(month.filter(b => b.category === 'stock'), b => Number(b.total) || 0);
    const expenseValue = U.sumBy(month.filter(b => b.category === 'expense'), b => Number(b.total) || 0);
    return '<div class="stat-grid mb-16">' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Stock suppliers</span><span class="stat-icon green">' + UI.icon('truck', 16) + '</span></div>' +
      '<div class="stat-value">' + stockSuppliers.length + '</div><div class="stat-meta">Goods go straight into inventory</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Expense suppliers</span><span class="stat-icon blue">' + UI.icon('wallet', 16) + '</span></div>' +
      '<div class="stat-value">' + (suppliers.length - stockSuppliers.length) + '</div><div class="stat-meta">Bills recorded as shop expenses</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Stock received this month</span><span class="stat-icon gold">' + UI.icon('box', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(stockValue) + '</div><div class="stat-meta">At cost · ' + month.filter(b => b.category === 'stock').length + ' bill' + (month.filter(b => b.category === 'stock').length === 1 ? '' : 's') + '</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Expense purchases this month</span><span class="stat-icon danger">' + UI.icon('coins', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(expenseValue) + '</div><div class="stat-meta">Added to Expenses automatically</div></div>' +
      '</div>';
  }

  function supplierTableHTML(rows) {
    if (!rows.length) {
      return '<div class="card-body">' + UI.emptyState({
        icon: 'building',
        title: S().activeSuppliers().length ? 'No suppliers match these filters' : 'No suppliers yet',
        text: S().activeSuppliers().length ? 'Try clearing the search or category filter.' : 'Add the shops you buy parts and supplies from. Stock suppliers add goods to inventory; expense suppliers just record the bill.',
        action: adminMode() ? '<button class="btn btn-primary" data-add-supplier>' + UI.icon('plus', 14) + 'Add supplier</button>' : ''
      }) + '</div>';
    }
    const body = rows.map(s => {
      const badge = s.category === 'expense'
        ? '<span class="badge blue">Expense supplier</span>'
        : '<span class="badge green">Stock supplier</span>';
      return '<tr>' +
        '<td><div class="customer-cell"><span class="avatar" style="width:26px;height:26px;font-size:9px">' + U.esc(U.initials(s.name)) + '</span>' +
        '<div><div class="customer-name">' + U.esc(s.name) + '</div><div class="customer-sub">' + U.esc(s.phone || 'No phone') + '</div></div></div></td>' +
        '<td>' + badge + '</td>' +
        '<td class="right num">' + supplierBillCount(s.id) + '</td>' +
        '<td class="right num">' + U.money(supplierSpent(s.id)) + '</td>' +
        '<td><div class="row-actions">' +
        (adminMode() ? '<button type="button" class="btn btn-sm" data-new-bill="' + s.id + '">' + UI.icon('plus', 13) + 'New bill</button>' : '') +
        (adminMode() ? '<button type="button" class="icon-btn" data-edit-supplier="' + s.id + '" title="Edit supplier">' + UI.icon('edit', 15) + '</button>' : '') +
        (adminMode() ? '<button type="button" class="icon-btn danger" data-archive-supplier="' + s.id + '" title="Remove supplier">' + UI.icon('trash', 15) + '</button>' : '') +
        '</div></td></tr>';
    }).join('');
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Supplier</th><th>Category</th><th class="right">Bills</th><th class="right">Total purchased</th><th></th></tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<div class="card-foot flex-between"><span class="hint">Showing ' + rows.length + ' supplier' + (rows.length === 1 ? '' : 's') + '</span>' +
      '<button class="link-btn" data-export-suppliers>' + UI.icon('download', 13) + 'Export CSV</button></div>';
  }

  function filteredBills() {
    return S().supplierBills().filter(b => {
      if (listState.category !== 'all' && b.category !== listState.category) return false;
      const q = listState.q.trim().toLowerCase();
      if (!q) return true;
      return (b.no + ' ' + b.supplierName + ' ' + (b.invoiceNo || '') + ' ' + (b.note || '')).toLowerCase().includes(q);
    });
  }

  function billsTableHTML(rows) {
    if (!rows.length) {
      return '<div class="card-body">' + UI.emptyState({
        icon: 'receipt',
        title: S().supplierBills().length ? 'No bills match these filters' : 'No supplier bills yet',
        text: S().supplierBills().length ? 'Try clearing the search or category filter.' : 'Open a supplier and use New bill to record goods received or an expense purchase.'
      }) + '</div>';
    }
    const body = rows.slice(0, 200).map(b => {
      const badge = b.category === 'expense' ? '<span class="badge blue">Expense</span>' : '<span class="badge green">Stock</span>';
      return '<tr class="row-click" data-bill-row="' + b.id + '">' +
        '<td><div class="cell-stack"><span class="cell-main">' + U.esc(b.no) + '</span><span class="cell-sub">' + U.fmtDate(b.date, { mode: 'short' }) + '</span></div></td>' +
        '<td><div class="cell-stack"><span class="cell-main" style="font-weight:500">' + U.esc(b.supplierName) + '</span><span class="cell-sub">Supplier inv: ' + U.esc(b.invoiceNo || '—') + '</span></div></td>' +
        '<td>' + badge + '</td>' +
        '<td class="right num">' + b.lines.length + '</td>' +
        '<td>' + UI.methodInline(b.method) + '</td>' +
        '<td class="right num"><b>' + U.money(b.total) + '</b></td>' +
        '<td><div class="row-actions"><button type="button" class="icon-btn" title="View bill">' + UI.icon('arrowRight', 15) + '</button></div></td></tr>';
    }).join('');
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Bill</th><th>Supplier</th><th>Type</th><th class="right">Lines</th><th>Payment</th><th class="right">Total</th><th></th></tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<div class="card-foot flex-between"><span class="hint">Showing ' + Math.min(rows.length, 200) + ' of ' + rows.length + ' bill' + (rows.length === 1 ? '' : 's') + '</span>' +
      '<button class="link-btn" data-export-bills>' + UI.icon('download', 13) + 'Export CSV</button></div>';
  }

  function exportSuppliers(rows) {
    if (!rows.length) { UI.toast('No suppliers to export.', 'info'); return; }
    const data = [['Supplier', 'Phone', 'Category', 'Bills', 'Total purchased']]
      .concat(rows.map(s => [s.name, s.phone, s.category, supplierBillCount(s.id), supplierSpent(s.id)]));
    U.downloadFile('wijaya-suppliers.csv', U.toCSV(data), 'text/csv;charset=utf-8');
    UI.toast('Suppliers exported.');
  }

  function exportBills(rows) {
    if (!rows.length) { UI.toast('No supplier bills to export.', 'info'); return; }
    const data = [['Bill no', 'Date', 'Supplier', 'Type', 'Supplier invoice', 'Item', 'Qty', 'Unit cost', 'Amount', 'Payment', 'Note']]
      .concat(rows.flatMap(b => b.lines.map(l => [b.no, b.date, b.supplierName, b.category, b.invoiceNo, l.name, l.qty, l.unitCost, l.total, b.method, b.note || ''])));
    U.downloadFile('wijaya-supplier-bills.csv', U.toCSV(data), 'text/csv;charset=utf-8');
    UI.toast('Supplier bills exported.');
  }

  function screenHTML() {
    const suppliers = filteredSuppliers();
    const bills = filteredBills();
    const head = listState.tab === 'payments'
      ? { title: 'Supplier cheques & advances', subtitle: 'Every cheque given to a supplier and every advance taken or given. A cheque stays in your drawer until you mark it handed over — only then does it reduce what you owe.' }
      : listState.tab === 'bills'
        ? { title: 'Supplier bills received', subtitle: 'Bills taken from suppliers. Stock bills add goods to inventory at their cost; expense bills are recorded under Expenses.' }
        : { title: 'Suppliers', subtitle: 'The suppliers you buy from, split into stock suppliers and expense suppliers, with what you owe or have advanced to each one.' };
    return UI.pageHead({
      eyebrow: 'Catalogue · Suppliers',
      title: head.title,
      subtitle: head.subtitle,
      actions: adminMode() ? '<button class="btn btn-primary" data-add-supplier>' + UI.icon('plus', 15) + 'Add supplier</button>' : ''
    }) +
      '<nav class="tabs">' +
      '<a class="tab' + (listState.tab === 'suppliers' ? ' active' : '') + '" href="#/suppliers" data-sup-tab="suppliers">Suppliers<span class="tab-count">' + S().activeSuppliers().length + '</span></a>' +
      '<a class="tab' + (listState.tab === 'bills' ? ' active' : '') + '" href="#/suppliers/bills" data-sup-tab="bills">Bills received<span class="tab-count">' + S().supplierBills().length + '</span></a>' +
      '<a class="tab' + (listState.tab === 'payments' ? ' active' : '') + '" href="#/suppliers/payments" data-sup-tab="payments">Cheques &amp; advances<span class="tab-count">' + S().supplierPaymentsList().length + '</span></a></nav>' +
      '<div id="sup-stats">' + (listState.tab === 'payments' ? paymentsStatsHTML() : statsHTML()) + '</div>' +
      '<div class="card inventory-card"><div class="inv-toolbar">' +
      '<div class="search-box" style="max-width:320px">' + UI.icon('search', 16) + '<input class="input" id="sup-search" placeholder="' + (listState.tab === 'payments' ? 'Search supplier, cheque no, bank or bill…' : 'Search supplier, bill or invoice no…') + '" value="' + U.attr(listState.q) + '"></div>' +
      '<select class="select sm" id="sup-category" style="width:170px">' +
      UI.option('all', 'All categories', listState.category) +
      UI.option('stock', 'Stock suppliers', listState.category) +
      UI.option('expense', 'Expense suppliers', listState.category) + '</select>' +
      (listState.tab === 'payments' && adminMode()
        ? '<button type="button" class="btn btn-sm btn-primary" data-add-payment="">' + UI.icon('plus', 13) + 'Cheque / advance</button>' : '') +
      '<span class="spacer"></span><span class="toolbar-label" id="sup-count"></span></div>' +
      '<div id="sup-table"></div></div>';
  }

  function paintTable(scope) {
    const table = scope.querySelector('#sup-table');
    const count = scope.querySelector('#sup-count');
    const stats = scope.querySelector('#sup-stats');
    if (stats) stats.innerHTML = listState.tab === 'payments' ? paymentsStatsHTML() : statsHTML();
    if (listState.tab === 'payments') {
      const rows = filteredPayments();
      if (table) table.innerHTML =
        '<div class="card-head bordered"><div><div class="card-title">Supplier accounts</div><div class="card-sub">Bills, cheques still in your hand and the balance with each supplier.</div></div></div>' +
        ledgerTableHTML(S().supplierLedger()) +
        '<div class="card-head bordered mt-16"><div><div class="card-title">Every cheque and advance</div><div class="card-sub">Track a cheque from your drawer to the supplier to the bank.</div></div></div>' +
        paymentsTableHTML(rows);
      if (count) count.textContent = rows.length + ' records';
      return;
    }
    if (listState.tab === 'suppliers') {
      const rows = filteredSuppliers();
      if (table) table.innerHTML = supplierTableHTML(rows);
      if (count) count.textContent = rows.length + ' suppliers';
    } else {
      const rows = filteredBills();
      if (table) table.innerHTML = billsTableHTML(rows);
      if (count) count.textContent = rows.length + ' bills';
    }
  }

  /* ---------------- cheques & advances ---------------- */
  const STATUS_TONE = { withus: 'gold', returned: 'blue', honoured: 'green', dishonoured: 'red', settled: 'grey' };

  function statusLabel(status) {
    return S().constants.SUPPLIER_PAYMENT_STATUS[status] || U.titleCase(status || '');
  }

  function statusBadgeHTML(status) {
    return '<span class="badge ' + (STATUS_TONE[status] || 'grey') + '">' + U.esc(statusLabel(status)) + '</span>';
  }

  function kindLabel(p) {
    if (p.kind === 'cheque') return 'Cheque ' + (p.direction === 'from' ? 'received from' : 'given to');
    return 'Advance ' + (p.direction === 'from' ? 'taken from' : 'given to');
  }

  function filteredPayments() {
    const q = listState.q.trim().toLowerCase();
    return S().supplierPaymentsList().filter(p => {
      if (listState.category !== 'all' && p.supplierCategory !== listState.category) return false;
      if (!q) return true;
      return (p.supplierName + ' ' + (p.chequeNo || '') + ' ' + (p.bank || '') + ' ' + (p.refNo || '') + ' ' + (p.note || '')).toLowerCase().includes(q);
    });
  }

  function paymentsStatsHTML() {
    const ledger = S().supplierLedger();
    const withUs = ledger.reduce((s, r) => s + r.givenHeldBack, 0);
    const payable = ledger.reduce((s, r) => s + r.owedToSupplier, 0);
    const advanced = ledger.reduce((s, r) => s + r.advanceToSupplier, 0);
    const taken = ledger.reduce((s, r) => s + r.advanceTaken, 0);
    const bounced = ledger.reduce((s, r) => s + r.givenBounced, 0);
    return '<div class="stat-grid mb-16">' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Cheques still with us</span><span class="stat-icon gold">' + UI.icon('banknote', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(withUs) + '</div><div class="stat-meta">Not handed over yet — supplier is still unpaid</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">We owe suppliers</span><span class="stat-icon danger">' + UI.icon('wallet', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(payable) + '</div><div class="stat-meta">Bills less cheques and advances handed over</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Advances we gave</span><span class="stat-icon blue">' + UI.icon('truck', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(advanced) + '</div><div class="stat-meta">Paid ahead — goods still to come</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Advances held from suppliers</span><span class="stat-icon green">' + UI.icon('coins', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(taken) + '</div><div class="stat-meta">' + U.money(bounced) + ' bounced so far</div></div>' +
      '</div>';
  }

  function ledgerTableHTML(rows) {
    if (!rows.length) {
      return '<div class="card-body">' + UI.emptyState({ compact: true, icon: 'building', title: 'No suppliers yet', text: 'Add a supplier first, then record the cheques and advances you exchange with them.' }) + '</div>';
    }
    const body = rows.map(r => {
      const pending = r.chequesWithUs.reduce((s, p) => s + Number(p.amount || 0), 0);
      const balance = r.advanceToSupplier > 0
        ? '<span class="text-success">' + U.money(r.advanceToSupplier) + ' advance</span>'
        : r.owedToSupplier > 0 ? '<span class="due-value">' + U.money(r.owedToSupplier) + ' payable</span>' : '<span class="muted">Settled</span>';
      return '<tr class="row-click" data-account-row="' + r.id + '">' +
        '<td><div class="customer-cell"><span class="avatar" style="width:26px;height:26px;font-size:9px">' + U.esc(U.initials(r.name)) + '</span>' +
        '<div><div class="customer-name">' + U.esc(r.name) + '</div><div class="customer-sub">' + (r.category === 'expense' ? 'Expense supplier' : 'Stock supplier') + '</div></div></div></td>' +
        '<td class="right num">' + r.billCount + '</td>' +
        '<td class="right num">' + U.money(r.billsTotal) + '</td>' +
        '<td class="right num">' + (pending > 0 ? U.money(pending) + '<div class="cell-sub">' + r.chequesWithUs.length + ' cheque' + (r.chequesWithUs.length === 1 ? '' : 's') + ' with us</div>' : '<span class="muted">—</span>') + '</td>' +
        '<td class="right num">' + (r.givenBounced > 0 ? '<span class="text-danger">' + U.money(r.givenBounced) + '</span>' : '<span class="muted">—</span>') + '</td>' +
        '<td class="right num">' + balance + '</td>' +
        '<td><div class="row-actions">' +
        (adminMode() ? '<button type="button" class="btn btn-sm" data-add-payment="' + r.id + '">' + UI.icon('plus', 13) + 'Cheque / advance</button>' : '') +
        '</div></td></tr>';
    }).join('');
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Supplier</th><th class="right">Bills</th><th class="right">Bills value</th><th class="right">Cheque with us</th><th class="right">Bounced</th><th class="right">Balance</th><th></th></tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  function paymentsTableHTML(rows) {
    if (!rows.length) {
      return '<div class="card-body">' + UI.emptyState({
        icon: 'banknote',
        title: S().supplierPaymentsList().length ? 'No cheques or advances match these filters' : 'No supplier cheques or advances yet',
        text: S().supplierPaymentsList().length ? 'Try clearing the search or category filter.' : 'When you hand a cheque to a supplier — or take an advance from one — record it here to follow it until it clears the bank.'
      }) + '</div>';
    }
    const body = rows.slice(0, 200).map(p => {
      const next = paymentActions(p);
      return '<tr class="row-click" data-payment-row="' + p.id + '">' +
        '<td><div class="cell-stack"><span class="cell-main">' + U.esc(U.fmtDate(p.date, { mode: 'short' })) + '</span><span class="cell-sub">' + U.esc(U.fmtTime(p.createdAt)) + '</span></div></td>' +
        '<td><div class="cell-stack"><span class="cell-main">' + U.esc(p.supplierName) + '</span><span class="cell-sub">' + U.esc(kindLabel(p)) + '</span></div></td>' +
        '<td>' + (p.kind === 'cheque'
          ? '<div class="cell-stack"><span class="cell-main mono">' + U.esc(p.chequeNo || '—') + '</span><span class="cell-sub">' + U.esc([p.bank, p.chequeDate ? 'value ' + U.fmtDate(p.chequeDate, { mode: 'short' }) : ''].filter(Boolean).join(' · ') || 'No bank noted') + '</span></div>'
          : '<span class="muted">' + U.esc(UI.methodLabel(p.method)) + '</span>') + '</td>' +
        '<td>' + (p.refNo ? '<span class="mono">' + U.esc(p.refNo) + '</span>' : '<span class="muted">—</span>') + '</td>' +
        '<td class="right num"><b>' + U.money(p.amount) + '</b><div class="cell-sub">' + (p.direction === 'from' ? 'in hand from supplier' : 'out to supplier') + '</div></td>' +
        '<td>' + statusBadgeHTML(p.status) + '</td>' +
        '<td><div class="row-actions">' + next + '</div></td></tr>';
    }).join('');
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Supplier</th><th>Cheque</th><th>Against</th><th class="right">Amount</th><th>Status</th><th></th></tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<div class="card-foot flex-between"><span class="hint">Cheques still with us are not counted as paid. Mark them handed over when the supplier receives them.</span>' +
      '<button class="link-btn" data-export-payments>' + UI.icon('download', 13) + 'Export CSV</button></div>';
  }

  function actionBtn(p, status, label, icon, cls) {
    return '<button type="button" class="icon-btn ' + (cls || '') + '" data-payment-status="' + p.id + ':' + status + '" title="' + U.attr(label) + '">' + UI.icon(icon, 15) + '</button>';
  }

  function paymentActions(p) {
    if (!adminMode()) return '';
    let out = '';
    if (p.status === 'withus') out += actionBtn(p, 'returned', 'Mark handed over to supplier', 'check', '');
    if (p.status === 'returned') out += actionBtn(p, 'honoured', 'Mark honoured by the bank', 'banknote', '');
    if (p.kind === 'cheque' && p.status !== 'dishonoured') out += actionBtn(p, 'dishonoured', 'Mark dishonoured (bounced)', 'alert', 'danger');
    if (p.status === 'dishonoured') out += actionBtn(p, 'withus', 'Put back as with us', 'refresh', '');
    out += actionBtn(p, 'delete', 'Delete this record', 'trash', 'danger');
    return out;
  }

  function exportPayments(rows) {
    if (!rows.length) { UI.toast('Nothing to export.', 'info'); return; }
    const data = [['Date', 'Supplier', 'Type', 'Direction', 'Cheque no', 'Bank', 'Cheque date', 'Against bill', 'Amount', 'Status', 'Note']]
      .concat(rows.map(p => [p.date, p.supplierName, p.kind, p.direction === 'to' ? 'Given to supplier' : 'Taken from supplier', p.chequeNo, p.bank, p.chequeDate, p.refNo, p.amount, statusLabel(p.status), p.note || '']));
    U.downloadFile('wijaya-supplier-payments.csv', U.toCSV(data), 'text/csv;charset=utf-8');
    UI.toast('Supplier cheques and advances exported.');
  }

  /* ---------------- payment modal ---------------- */
  function paymentModal(preSupplierId, onDone) {
    const suppliers = S().activeSuppliers();
    if (!suppliers.length) { UI.toast('Add a supplier first.', 'info'); return; }
    const draft = { kind: 'cheque', direction: 'to' };
    const supplierOptions = '<option value="">Choose a supplier…</option>' + U.sortBy(suppliers, s => s.name.toLowerCase(), 'asc').map(s =>
      '<option value="' + s.id + '"' + (String(preSupplierId) === String(s.id) ? ' selected' : '') + '>' + U.esc(s.name) + (s.category === 'expense' ? ' · expense' : '') + '</option>').join('');
    const m = UI.modal({
      title: 'Supplier cheque / advance',
      subtitle: 'Record a cheque you gave or took, or an advance paid ahead of the goods.',
      size: 'md',
      body:
        '<form id="suppay-form"><div class="form-grid">' +
        '<div class="field full"><label class="label" for="sp-supplier">Supplier</label>' +
        '<select class="select" id="sp-supplier" name="supplierId" required>' + supplierOptions + '</select></div>' +
        '<div class="field"><label class="label">Record type</label>' +
        '<div class="pay-methods">' +
        '<button type="button" class="pay-btn active" data-pay-kind="cheque">' + UI.icon('fileText', 13) + 'Cheque</button>' +
        '<button type="button" class="pay-btn" data-pay-kind="advance">' + UI.icon('banknote', 13) + 'Advance</button>' +
        '</div></div>' +
        '<div class="field"><label class="label">Direction</label>' +
        '<div class="pay-methods">' +
        '<button type="button" class="pay-btn active" data-pay-dir="to">' + UI.icon('arrowRight', 13) + 'We give</button>' +
        '<button type="button" class="pay-btn" data-pay-dir="from">' + UI.icon('arrowLeft', 13) + 'Supplier gives</button>' +
        '</div></div>' +
        '<div class="field"><label class="label" for="sp-amount">Amount</label>' +
        '<div class="input-group"><span class="prefix">' + U.esc(U.symbol()) + '</span><input class="input" id="sp-amount" name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00"></div></div>' +
        '<div class="field"><label class="label" for="sp-date">Date</label>' +
        '<input class="input" id="sp-date" name="date" type="date" value="' + U.attr(U.todayISO()) + '"></div>' +
        '<div data-pay-cheque>' +
        '<div class="field"><label class="label" for="sp-cheque-no">Cheque number</label>' +
        '<input class="input" id="sp-cheque-no" name="chequeNo" autocomplete="off" placeholder="e.g. 045812"></div>' +
        '<div class="field"><label class="label" for="sp-bank">Bank <span class="opt">(optional)</span></label>' +
        '<input class="input" id="sp-bank" name="bank" autocomplete="off" placeholder="e.g. BOI Kelaniya"></div>' +
        '<div class="field"><label class="label" for="sp-cheque-date">Cheque / value date</label>' +
        '<input class="input" id="sp-cheque-date" name="chequeDate" type="date" value="' + U.attr(U.todayISO()) + '"></div>' +
        '</div>' +
        '<div class="field"><label class="label" for="sp-method">Method</label>' +
        '<select class="select" id="sp-method" name="method">' +
        UI.option('cheque', 'Cheque', 'cheque') + UI.option('cash', 'Cash', '') + UI.option('online', 'Online transfer', '') + UI.option('card', 'Card', '') + '</select></div>' +
        '<div class="field full"><label class="label" for="sp-note">Note <span class="opt">(optional)</span></label>' +
        '<input class="input" id="sp-note" name="note" autocomplete="off" placeholder="e.g. part payment for hydraulic pump order"></div>' +
        '</div></form>' +
        '<div class="pay-note mt-12" id="sp-hint"></div>',
      footer: '<button type="button" class="btn" data-modal-close>Cancel</button>' +
        '<button type="submit" class="btn btn-primary" form="suppay-form">' + UI.icon('check', 15) + 'Save record</button>'
    });

    function paintForm() {
      const wrap = m.panel.querySelector('[data-pay-cheque]');
      if (wrap) wrap.classList.toggle('hidden', draft.kind !== 'cheque');
      const method = m.panel.querySelector('#sp-method');
      if (method && draft.kind === 'cheque') method.value = 'cheque';
      if (method && draft.kind === 'advance' && method.value === 'cheque') method.value = 'cash';
      const hint = m.panel.querySelector('#sp-hint');
      const dirText = draft.direction === 'to' ? 'we are giving to the supplier' : 'the supplier is giving us';
      const kindText = draft.kind === 'cheque'
        ? 'A cheque starts as <b>with us</b>. Mark it handed over when the supplier receives it, then honoured when the bank clears it.'
        : 'An advance is counted as settled straight away.';
      if (hint) hint.innerHTML = 'Direction: ' + dirText + '. ' + kindText;
    }
    paintForm();

    m.panel.addEventListener('click', e => {
      const kind = e.target.closest('[data-pay-kind]');
      if (kind) {
        draft.kind = kind.dataset.payKind;
        m.panel.querySelectorAll('[data-pay-kind]').forEach(b => b.classList.toggle('active', b === kind));
        paintForm();
        return;
      }
      const dir = e.target.closest('[data-pay-dir]');
      if (dir) {
        draft.direction = dir.dataset.payDir;
        m.panel.querySelectorAll('[data-pay-dir]').forEach(b => b.classList.toggle('active', b === dir));
        paintForm();
      }
    });

    m.panel.querySelector('#suppay-form').addEventListener('submit', async e => {
      e.preventDefault();
      const submit = m.panel.querySelector('[type="submit"][form="suppay-form"]');
      const values = UI.formValues(e.target);
      try {
        await UI.withLoading(submit, async () => {
          const saved = await S().addSupplierPayment({
            supplierId: values.supplierId, kind: draft.kind, direction: draft.direction,
            amount: values.amount, method: draft.kind === 'cheque' ? 'cheque' : values.method,
            date: values.date, chequeNo: values.chequeNo, bank: values.bank,
            chequeDate: values.chequeDate, note: values.note,
            cashierId: WP.app.getActiveCashierId()
          });
          m.close();
          UI.toast((saved.kind === 'cheque' ? 'Cheque ' + (saved.chequeNo || '') : 'Advance') + ' recorded · ' + U.money(saved.amount) +
            (saved.direction === 'to' ? ' to ' + saved.supplierName : ' from ' + saved.supplierName));
          APP().dataChanged();
          if (typeof onDone === 'function') onDone(saved);
        });
      } catch (err) { UI.toast(err.userMessage || err.message || 'Could not save the record.', 'error'); }
    });
    return m;
  }

  /* ---------------- supplier account modal ---------------- */
  function supplierAccountModal(supplierId) {
    const supplier = S().supplierById(supplierId);
    if (!supplier) { UI.toast('Supplier not found.', 'error'); return; }
    const acc = S().supplierAccount(supplier.id);
    const rows = acc.payments.length ? acc.payments.map(p =>
      '<tr><td>' + U.fmtDate(p.date, { mode: 'short' }) + '</td>' +
      '<td><div class="cell-stack"><span class="cell-main">' + U.esc(kindLabel(p)) + '</span><span class="cell-sub">' + U.esc([p.chequeNo, p.bank].filter(Boolean).join(' · ')) + '</span></div></td>' +
      '<td>' + (p.refNo ? '<span class="mono">' + U.esc(p.refNo) + '</span>' : '<span class="muted">—</span>') + '</td>' +
      '<td class="right num">' + U.money(p.amount) + '</td>' +
      '<td>' + statusBadgeHTML(p.status) + '</td></tr>').join('')
      : '<tr><td colspan="5"><div class="empty-inline">No cheques or advances recorded with this supplier yet.</div></td></tr>';
    const balance = acc.advanceToSupplier > 0
      ? '<div class="detail-total-row"><span>Advance given to supplier</span><b class="text-success">' + U.money(acc.advanceToSupplier) + '</b></div>'
      : '<div class="detail-total-row"><span>Payable to supplier</span><b class="' + (acc.owedToSupplier > 0 ? 'text-danger' : 'text-success') + '">' + U.money(acc.owedToSupplier) + '</b></div>';
    const modal = UI.modal({
      size: 'lg',
      title: supplier.name,
      subtitle: (supplier.category === 'expense' ? 'Expense supplier' : 'Stock supplier') + (supplier.phone ? ' · ' + supplier.phone : ''),
      body:
        '<div class="detail-totals">' +
        '<div class="detail-total-row"><span>Supplier bills (' + acc.billCount + ')</span><span>' + U.money(acc.billsTotal) + '</span></div>' +
        '<div class="detail-total-row"><span>Cheques / advances handed over</span><span>− ' + U.money(acc.givenCredited) + '</span></div>' +
        '<div class="detail-total-row"><span>Still with us (not counted)</span><span>' + U.money(acc.givenHeldBack) + '</span></div>' +
        (acc.givenBounced > 0 ? '<div class="detail-total-row"><span>Dishonoured</span><span class="text-danger">' + U.money(acc.givenBounced) + '</span></div>' : '') +
        balance +
        (acc.advanceTaken > 0 ? '<div class="detail-total-row"><span>Advance held from supplier</span><span class="text-gold">' + U.money(acc.advanceTaken) + '</span></div>' : '') +
        '</div>' +
        '<div class="table-wrap mt-16"><table class="table compact"><thead><tr><th>Date</th><th>Record</th><th>Against</th><th class="right">Amount</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></div>',
      footer: '<button type="button" class="btn" data-modal-close>Close</button>' +
        (adminMode() ? '<button type="button" class="btn" data-account-payment>' + UI.icon('plus', 14) + 'Cheque / advance</button>' : '') +
        '<button type="button" class="btn btn-primary" data-account-bill>' + UI.icon('receipt', 14) + 'New bill</button>'
    });
    const payBtn = modal.panel.querySelector('[data-account-payment]');
    if (payBtn) payBtn.addEventListener('click', () => paymentModal(supplier.id));
    modal.panel.querySelector('[data-account-bill]').addEventListener('click', () => supplierBillModal(supplier));
    return modal;
  }

  /* ---------------- supplier modal ---------------- */

  function supplierModal(supplier) {
    const editing = !!supplier;
    const m = UI.modal({
      title: editing ? 'Edit supplier' : 'Add supplier',
      subtitle: 'Stock suppliers add goods to inventory. Expense suppliers record the bill under Expenses instead.',
      size: 'md',
      body:
        '<form id="supplier-form"><div class="form-grid">' +
        '<div class="field full"><label class="label" for="sup-name">Supplier name</label>' +
        '<input class="input" id="sup-name" name="name" required autocomplete="off" placeholder="e.g. Colombo Auto Parts" value="' + U.attr(supplier ? supplier.name : '') + '"></div>' +
        '<div class="field"><label class="label" for="sup-phone">Phone <span class="opt">(optional)</span></label>' +
        '<input class="input" id="sup-phone" name="phone" autocomplete="off" placeholder="07X XXX XXXX" value="' + U.attr(supplier ? supplier.phone : '') + '"></div>' +
        '<div class="field"><label class="label" for="sup-cat">Category</label>' +
        '<select class="select" id="sup-cat" name="category">' +
        UI.option('stock', 'Stock supplier — goods to inventory', supplier ? supplier.category : 'stock') +
        UI.option('expense', 'Expense supplier — bill to expenses', supplier ? supplier.category : '') + '</select></div>' +
        '</div></form>',
      footer: '<button type="button" class="btn" data-modal-close>Cancel</button>' +
        '<button type="submit" class="btn btn-primary" form="supplier-form">' + UI.icon('check', 15) + (editing ? 'Save changes' : 'Add supplier') + '</button>'
    });
    m.panel.querySelector('#supplier-form').addEventListener('submit', async e => {
      e.preventDefault();
      const submit = m.panel.querySelector('[type="submit"][form="supplier-form"]');
      const values = UI.formValues(e.target);
      try {
        await UI.withLoading(submit, async () => {
          const saved = editing ? await S().updateSupplier(supplier.id, values) : await S().addSupplier(values);
          m.close();
          UI.toast((editing ? 'Saved ' : 'Added ') + saved.name + '.');
          APP().dataChanged();
        });
      } catch (err) {
        UI.toast(err.userMessage || err.message || 'Could not save the supplier.', 'error');
      }
    });
    return m;
  }

  /* ---------------- supplier bill modal ---------------- */
  function emptyLine(supplier) {
    if (supplier.category === 'expense') return { name: '', amount: '' };
    return { itemId: '', newName: '', qty: '', unitCost: '', sellPrice: '', origin: 'Local' };
  }

  function billLineHTML(supplier, line, idx) {
    if (supplier.category === 'expense') {
      return '<div class="pe-line" data-bill-line="' + idx + '">' +
        '<div style="flex:1;min-width:0"><div class="pe-name">' +
        '<input class="input" data-bl="name" placeholder="What was supplied — e.g. shop rent, oil, packing material" value="' + U.attr(line.name) + '"></div></div>' +
        '<div class="pe-controls">' +
        '<input class="price-edit" data-bl="amount" type="number" min="0" step="0.01" placeholder="Amount" value="' + U.attr(line.amount) + '" title="Amount">' +
        '<button type="button" class="line-remove" data-bl-remove="' + idx + '" title="Remove line">' + UI.icon('trash', 14) + '</button>' +
        '</div></div>';
    }
    const parts = U.sortBy(S().activeItems().filter(i => i.category === 'part'), i => i.name.toLowerCase(), 'asc');
    const isNew = line.itemId === 'new';
    return '<div class="pe-line" data-bill-line="' + idx + '" style="flex-wrap:wrap">' +
      '<div style="flex:1 1 100%;min-width:0">' +
      '<select class="select" data-bl="itemId">' +
      '<option value="">Choose a part…</option>' +
      parts.map(p => '<option value="' + p.id + '"' + (String(line.itemId) === String(p.id) ? ' selected' : '') + '>' + U.esc(p.name) + (p.sku ? ' · ' + U.esc(p.sku) : '') + '</option>').join('') +
      '<option value="new"' + (isNew ? ' selected' : '') + '>＋ New part (not in catalogue)</option>' +
      '</select>' +
      (isNew ? '<input class="input mt-6" data-bl="newName" placeholder="New part name" value="' + U.attr(line.newName) + '">' : '') +
      '</div>' +
      '<div class="pe-controls" style="flex-wrap:wrap;gap:6px">' +
      '<input class="price-edit" data-bl="qty" type="number" min="0" step="1" placeholder="Qty" value="' + U.attr(line.qty) + '" title="Quantity">' +
      '<input class="price-edit" data-bl="unitCost" type="number" min="0" step="0.01" placeholder="Unit cost" value="' + U.attr(line.unitCost) + '" title="Unit cost">' +
      (isNew ? '<input class="price-edit" data-bl="sellPrice" type="number" min="0" step="0.01" placeholder="Sell price" value="' + U.attr(line.sellPrice) + '" title="Selling price">' : '') +
      '<select class="select" data-bl="origin" style="width:96px">' +
      UI.option('Local', 'Local', line.origin) + UI.option('Import', 'Import', line.origin) + '</select>' +
      '<button type="button" class="line-remove" data-bl-remove="' + idx + '" title="Remove line">' + UI.icon('trash', 14) + '</button>' +
      '</div>' +
      '<div class="cell-sub" style="flex-basis:100%">Line total: <b data-bl-total>' + (U.toNum(line.qty, 0) > 0 ? U.money(U.round2(U.toNum(line.qty, 0) * U.toNum(line.unitCost, 0))) : '—') + '</b></div>' +
      '</div>';
  }

  function billLinesHTML(supplier) {
    if (!billDraft.lines.length) {
      return '<div class="empty-inline">No lines yet. Add what the supplier delivered on this invoice.</div>';
    }
    return billDraft.lines.map((line, idx) => billLineHTML(supplier, line, idx)).join('');
  }

  function billTotal() {
    if (billDraft.lines.some(l => l.amount !== undefined)) {
      return U.round2(U.sumBy(billDraft.lines, l => U.toNum(l.amount, 0)));
    }
    return U.round2(U.sumBy(billDraft.lines, l => U.toNum(l.qty, 0) * U.toNum(l.unitCost, 0)));
  }

  function supplierBillModal(supplier) {
    const isExpense = supplier.category === 'expense';
    billDraft.supplierId = supplier.id;
    billDraft.lines = [emptyLine(supplier)];
    const head =
      '<div class="modal-head"><div><div class="modal-title">' + U.esc(supplier.name) + '</div>' +
      '<div class="modal-sub">' + (isExpense ? 'Expense supplier — the bill is added to shop expenses, stock stays unchanged.' : 'Stock supplier — every line is added to inventory at cost.') + '</div></div>' +
      '<button type="button" class="modal-close" data-modal-close aria-label="Close">' + UI.icon('x', 16) + '</button></div>';
    const m = UI.modal({
      size: 'lg',
      headHTML: head,
      body:
        '<form id="sbill-form"><div class="form-grid">' +
        '<div class="field"><label class="label" for="sb-date">Date</label>' +
        '<input class="input" id="sb-date" name="date" type="date" value="' + U.attr(U.todayISO()) + '"></div>' +
        '<div class="field"><label class="label" for="sb-invno">Supplier invoice no</label>' +
        '<input class="input" id="sb-invno" name="invoiceNo" autocomplete="off" placeholder="e.g. INV-5521"></div>' +
        '<div class="field"><label class="label" for="sb-method">Payment method</label>' +
        '<select class="select" id="sb-method" name="method">' +
        UI.option('cash', 'Cash', 'cash') + UI.option('card', 'Card', '') + UI.option('online', 'Online transfer', '') + UI.option('cheque', 'Cheque', '') + '</select></div>' +
        '<div class="field full hidden" id="sb-cheque-fields">' +
        '<div class="form-grid">' +
        '<div class="field"><label class="label" for="sb-cheque-no">Our cheque number</label>' +
        '<input class="input" id="sb-cheque-no" name="chequeNo" autocomplete="off" placeholder="e.g. 045812"></div>' +
        '<div class="field"><label class="label" for="sb-cheque-bank">Bank <span class="opt">(optional)</span></label>' +
        '<input class="input" id="sb-cheque-bank" name="bank" autocomplete="off" placeholder="e.g. BOI Kelaniya"></div>' +
        '<div class="field"><label class="label" for="sb-cheque-date">Cheque date</label>' +
        '<input class="input" id="sb-cheque-date" name="chequeDate" type="date" value="' + U.attr(U.todayISO()) + '"></div>' +
        '</div>' +
        '<div class="hint mt-8">A cheque entered here is tracked under <b>Cheques &amp; advances</b> as <b>with us</b> until you mark it handed over — only then does it reduce what you owe.</div>' +
        '</div>' +
        '</div></form>' +
        '<div class="divider"></div>' +
        '<div class="flex-between mb-8"><div class="section-title-sm" style="margin:0">' + (isExpense ? 'Expense lines' : 'Goods supplied') + '</div>' +
        '<button type="button" class="btn btn-sm" data-add-line>' + UI.icon('plus', 13) + 'Add line</button></div>' +
        '<div class="pe-list" id="sbill-lines">' + billLinesHTML(supplier) + '</div>' +
        '<div class="detail-totals mt-12"><div class="detail-total-row total"><span>Bill total</span><b id="sbill-total">' + U.money(0) + '</b></div></div>',
      footer: '<button type="button" class="btn" data-modal-close>Cancel</button>' +
        '<button type="button" class="btn btn-primary" data-save-bill>' + UI.icon('check', 15) + 'Save bill</button>'
    });

    function paintLines() {
      const wrap = m.panel.querySelector('#sbill-lines');
      if (wrap) wrap.innerHTML = billLinesHTML(supplier);
      const total = m.panel.querySelector('#sbill-total');
      if (total) total.textContent = U.money(billTotal());
    }

    m.panel.querySelector('#sbill-lines').addEventListener('input', e => {
      const row = e.target.closest('[data-bill-line]');
      if (!row) return;
      const idx = Number(row.dataset.billLine);
      const line = billDraft.lines[idx];
      if (!line) return;
      const key = e.target.dataset.bl;
      if (key) line[key] = e.target.value;
      if (line.qty !== undefined) {
        const totalEl = row.querySelector('[data-bl-total]');
        if (totalEl) totalEl.textContent = U.toNum(line.qty, 0) > 0 ? U.money(U.round2(U.toNum(line.qty, 0) * U.toNum(line.unitCost, 0))) : '—';
      }
      const total = m.panel.querySelector('#sbill-total');
      if (total) total.textContent = U.money(billTotal());
    });

    m.panel.querySelector('#sbill-lines').addEventListener('change', e => {
      const row = e.target.closest('[data-bill-line]');
      if (!row) return;
      const idx = Number(row.dataset.billLine);
      const line = billDraft.lines[idx];
      if (!line) return;
      if (e.target.dataset.bl === 'itemId') {
        line.itemId = e.target.value;
        paintLines();
      }
    });

    m.panel.querySelector('[data-add-line]').addEventListener('click', () => {
      billDraft.lines.push(emptyLine(supplier));
      paintLines();
    });

    m.panel.querySelector('#sbill-lines').addEventListener('click', e => {
      const remove = e.target.closest('[data-bl-remove]');
      if (!remove) return;
      const idx = Number(remove.dataset.blRemove);
      billDraft.lines.splice(idx, 1);
      paintLines();
    });

    m.panel.querySelector('[data-save-bill]').addEventListener('click', async () => {
      const values = UI.formValues(m.panel.querySelector('#sbill-form'));
      const byCheque = values.method === 'cheque';
      if (byCheque && !String(values.chequeNo || '').trim()) {
        UI.toast('Enter the cheque number, or choose another payment method.', 'error');
        return;
      }
      const lines = billDraft.lines.map(l => Object.assign({}, l));
      const saveBtn = m.panel.querySelector('[data-save-bill]');
      try {
        await UI.withLoading(saveBtn, async () => {
          const bill = await S().addSupplierBill({
            supplierId: supplier.id,
            date: values.date,
            invoiceNo: values.invoiceNo,
            method: values.method,
            lines: lines,
            cashierId: WP.app.getActiveCashierId()
          });
          if (byCheque) {
            await S().addSupplierPayment({
              supplierId: supplier.id, kind: 'cheque', direction: 'to', amount: bill.total,
              method: 'cheque', date: values.date, chequeNo: values.chequeNo, bank: values.bank,
              chequeDate: values.chequeDate, refNo: bill.no,
              note: 'Cheque handed for bill ' + bill.no, cashierId: WP.app.getActiveCashierId()
            });
          }
          m.close();
          UI.toast('Bill ' + bill.no + ' saved · ' + U.money(bill.total) + (isExpense ? ' added to expenses.' : ' added to stock.') +
            (byCheque ? ' Cheque starts as with us.' : ''));
          APP().dataChanged();
        });
      } catch (err) {
        UI.toast(err.userMessage || err.message || 'Could not save the bill.', 'error');
      }
    });

    m.panel.querySelector('#sb-method').addEventListener('change', e => {
      const fields = m.panel.querySelector('#sb-cheque-fields');
      if (fields) fields.classList.toggle('hidden', e.target.value !== 'cheque');
    });
    return m;
  }

  function billDetailModal(id) {
    const bill = S().supplierBills().find(b => Number(b.id) === Number(id));
    if (!bill) { UI.toast('Bill not found.', 'error'); return; }
    const cashier = bill.cashierId ? S().cashierById(bill.cashierId) : null;
    const rows = bill.lines.map(l => {
      const item = l.itemId ? S().itemById(l.itemId) : null;
      const origin = l.origin || (item && item.origin) || '';
      return '<tr><td><div class="cell-stack"><span class="cell-main">' + U.esc(l.name) + '</span>' +
        (origin ? '<span class="cell-sub">' + U.esc(origin) + '</span>' : '') + '</div></td>' +
        '<td class="right num">' + (bill.category === 'expense' ? '—' : U.fmtQty(l.qty)) + '</td>' +
        '<td class="right num">' + (bill.category === 'expense' ? '—' : U.money(l.unitCost)) + '</td>' +
        '<td class="right num">' + U.money(l.total) + '</td></tr>';
    }).join('');
    const linked = S().supplierPaymentsList(bill.supplierId).filter(p => p.refNo === bill.no);
    const chequeBlock = linked.length
      ? '<div class="statement-section"><h4>Cheque recorded for this bill</h4><div class="mini-ledger">' + linked.map(p =>
        '<div class="mini-ledger-row"><div class="mini-ledger-main"><div class="mini-ledger-title">Cheque ' + U.esc(p.chequeNo || '—') + (p.bank ? ' · ' + U.esc(p.bank) : '') + '</div>' +
        '<div class="mini-ledger-sub">' + U.esc(statusLabel(p.status)) + (p.chequeDate ? ' · value ' + U.esc(U.fmtDate(p.chequeDate)) : '') + '</div></div>' +
        '<div class="mini-ledger-amt">' + U.money(p.amount) + '</div></div>').join('') + '</div></div>'
      : '';
    const head =
      '<div class="modal-head"><div><div class="modal-title">' + U.esc(bill.no) + '</div>' +
      '<div class="modal-sub">' + U.esc(bill.supplierName) + ' · ' + U.esc(U.fmtDate(bill.date)) + (bill.invoiceNo ? ' · supplier inv ' + U.esc(bill.invoiceNo) : '') + '</div></div>' +
      '<button type="button" class="modal-close" data-modal-close aria-label="Close">' + UI.icon('x', 16) + '</button></div>';
    UI.modal({
      size: 'md',
      headHTML: head,
      body:
        '<div class="detail-grid">' +
        '<div class="detail-block"><h4>Type</h4><p>' + (bill.category === 'expense' ? '<span class="badge blue">Expense supplier</span> — recorded under Expenses' : '<span class="badge green">Stock supplier</span> — goods added to inventory') + '</p></div>' +
        '<div class="detail-block"><h4>Payment</h4><p>' + U.esc(UI.methodLabel(bill.method)) + (cashier ? ' · ' + U.esc(cashier.name) : '') + '</p></div>' +
        '</div>' +
        '<div class="table-wrap mt-12"><table class="table compact"><thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Unit cost</th><th class="right">Amount</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<div class="detail-totals"><div class="detail-total-row total"><span>Bill total</span><b>' + U.money(bill.total) + '</b></div></div>' +
        chequeBlock +
        (bill.note ? '<div class="hint mt-8">Note: ' + U.esc(bill.note) + '</div>' : ''),
      footer: '<button type="button" class="btn btn-primary" data-modal-close>Done</button>'
    });
  }

  V.suppliers = {
    render(route) {
      const sub = route && route.sub;
      listState.tab = sub === 'payments' || sub === 'bills' ? sub : 'suppliers';
      return screenHTML();
    },
    mount(content) {
      const scope = content.querySelector('#view-root') || content;
      const search = scope.querySelector('#sup-search');
      const category = scope.querySelector('#sup-category');

      function paint() {
        paintTable(scope);
      }
      paint();

      if (search) search.addEventListener('input', U.debounce(() => { listState.q = search.value; paint(); }, 160));
      if (category) category.addEventListener('change', () => { listState.category = category.value; paint(); });

      scope.addEventListener('click', async e => {
        const tab = e.target.closest('[data-sup-tab]');
        if (tab) {
          e.preventDefault();
          listState.tab = tab.dataset.supTab;
          APP().navigate('#/suppliers' + (listState.tab === 'suppliers' ? '' : '/' + listState.tab));
          return;
        }
        if (e.target.closest('[data-export-suppliers]')) { exportSuppliers(filteredSuppliers()); return; }
        if (e.target.closest('[data-export-bills]')) { exportBills(filteredBills()); return; }
        if (e.target.closest('[data-export-payments]')) { exportPayments(filteredPayments()); return; }
        const addPay = e.target.closest('[data-add-payment]');
        if (addPay) {
          const id = Number(addPay.dataset.addPayment) || null;
          paymentModal(id);
          return;
        }
        const statusBtn = e.target.closest('[data-payment-status]');
        if (statusBtn) {
          const parts = String(statusBtn.dataset.paymentStatus).split(':');
          const payment = S().supplierPaymentById(Number(parts[0]));
          if (!payment) return;
          if (parts[1] === 'delete') {
            const ok = await UI.confirmDialog({
              title: 'Delete this record?',
              text: payment.supplierName + ' · ' + U.money(payment.amount) + (payment.chequeNo ? ' · cheque ' + payment.chequeNo : '') + '. This only removes the tracker entry, not the bill.',
              confirmText: 'Delete record'
            });
            if (!ok) return;
            try {
              await S().deleteSupplierPayment(payment.id);
              UI.toast('Record deleted.');
              APP().dataChanged();
            } catch (err) { UI.toast(err.userMessage || err.message || 'Could not delete the record.', 'error'); }
            return;
          }
          try {
            const updated = await S().setSupplierPaymentStatus(payment.id, parts[1]);
            UI.toast((updated.kind === 'cheque' ? 'Cheque ' + (updated.chequeNo || '') : 'Advance') + ' · ' + statusLabel(updated.status) + '.');
            APP().dataChanged();
          } catch (err) { UI.toast(err.userMessage || err.message || 'Could not update the status.', 'error'); }
          return;
        }
        const accountRow = e.target.closest('[data-account-row]');
        if (accountRow) { supplierAccountModal(Number(accountRow.dataset.accountRow)); return; }
        const paymentRow = e.target.closest('[data-payment-row]');
        if (paymentRow) {
          const payment = S().supplierPaymentById(Number(paymentRow.dataset.paymentRow));
          if (payment) supplierAccountModal(payment.supplierId);
          return;
        }
        if (e.target.closest('[data-add-supplier]')) { supplierModal(null); return; }
        const edit = e.target.closest('[data-edit-supplier]');
        if (edit) {
          const supplier = S().supplierById(Number(edit.dataset.editSupplier));
          if (supplier) supplierModal(supplier);
          return;
        }
        const archive = e.target.closest('[data-archive-supplier]');
        if (archive) {
          const supplier = S().supplierById(Number(archive.dataset.archiveSupplier));
          if (!supplier) return;
          const ok = await UI.confirmDialog({
            title: 'Remove ' + supplier.name + '?',
            text: 'The supplier is hidden from new bills. Bills already recorded stay in the history.',
            confirmText: 'Remove supplier'
          });
          if (!ok) return;
          try {
            await S().archiveSupplier(supplier.id);
            UI.toast(supplier.name + ' removed.');
            APP().dataChanged();
          } catch (err) { UI.toast(err.message || 'Could not remove the supplier.', 'error'); }
          return;
        }
        const newBill = e.target.closest('[data-new-bill]');
        if (newBill) {
          const supplier = S().supplierById(Number(newBill.dataset.newBill));
          if (supplier) supplierBillModal(supplier);
          return;
        }
        const row = e.target.closest('[data-bill-row]');
        if (row) billDetailModal(Number(row.dataset.billRow));
      });
    },
    refresh() {
      APP().renderRoute(true);
    }
  };
})();
