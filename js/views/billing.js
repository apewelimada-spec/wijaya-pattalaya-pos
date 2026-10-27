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

  const listState = { range: 'month', type: 'all', q: '' };
  const HELD_KEY = 'wijaya-pattalaya-held-bills';

  const posState = {
    cart: [],
    customerId: '',
    wholesale: false,
    discount: '',
    method: 'cash',
    received: '',
    note: '',
    chequeNo: '',
    chequeDate: U.todayISO(),
    search: '',
    filter: 'all'
  };

  /* =========================================================
     INVOICE LIST
     ========================================================= */
  function listRange() {
    const today = U.todayISO();
    if (listState.range === 'today') return { from: today, to: today, label: 'Today' };
    if (listState.range === 'all') return { from: '', to: '', label: 'All time' };
    return { from: U.monthStartISO(), to: today, label: 'This month' };
  }

  function filteredInvoices() {
    const r = listRange();
    const q = listState.q.trim().toLowerCase();
    let rows = S().data.invoices.filter(inv => {
      if (r.from && inv.date < r.from) return false;
      if (r.to && inv.date > r.to) return false;
      if (listState.type !== 'all' && inv.type !== listState.type) return false;
      if (q) {
        const hay = (inv.no + ' ' + (inv.customerName || '') + ' ' + (inv.customerPhone || '') + ' ' + (inv.note || '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return U.sortBy(rows, inv => (inv.createdAt || inv.date), 'desc');
  }

  function listStats(rows) {
    const total = U.sumBy(rows, inv => inv.total);
    const paid = U.sumBy(rows, inv => inv.paid);
    const due = U.sumBy(rows, inv => inv.balance);
    const wholesaleCount = rows.filter(i => i.type === 'wholesale').length;
    const creditCount = rows.filter(i => Number(i.balance) > 0).length;
    return '<div class="stat-grid mb-16">' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Invoices</span><span class="stat-icon green">' + UI.icon('receipt', 16) + '</span></div>' +
      '<div class="stat-value">' + U.fmtNumber(rows.length, 0) + '</div><div class="stat-meta"><b>' + wholesaleCount + '</b> wholesale · <b>' + (rows.length - wholesaleCount) + '</b> retail</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Sales value</span><span class="stat-icon gold">' + UI.icon('chart', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(total) + '</div><div class="stat-meta">' + U.esc(listRange().label) + '</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Collected</span><span class="stat-icon blue">' + UI.icon('banknote', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(paid) + '</div><div class="stat-meta">Sale payments + later collections</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Outstanding</span><span class="stat-icon danger">' + UI.icon('clock', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(due) + '</div><div class="stat-meta"><b>' + creditCount + '</b> invoice' + (creditCount === 1 ? '' : 's') + ' with a balance</div></div>' +
      '</div>';
  }

  function listTableHTML(rows) {
    if (!rows.length) {
      return '<div class="card-body">' + UI.emptyState({
        icon: 'receipt', title: 'No invoices found',
        text: listState.q ? 'Try a different search, range or invoice type.' : 'Sales you bill at the counter will appear here.',
        action: '<a class="btn btn-primary" href="#/billing/new">' + UI.icon('plus', 14) + 'New sale</a>'
      }) + '</div>';
    }
    const body = rows.slice(0, 200).map(inv => {
      const status = S().invoiceStatus(inv);
      return '<tr class="row-click" data-invoice-row="' + inv.id + '">' +
        '<td><div class="cell-stack"><span class="cell-main">' + U.esc(inv.no) + (inv.type === 'wholesale' ? ' <span class="badge gold" style="margin-left:4px">Wholesale</span>' : '') + '</span>' +
        '<span class="cell-sub">' + U.fmtTime(inv.createdAt) + ' · ' + U.fmtQty(inv.itemCount) + ' items</span></div></td>' +
        '<td class="nowrap">' + U.fmtDate(inv.date, { mode: 'short' }) + '</td>' +
        '<td>' + (inv.customerId
          ? '<div class="customer-cell"><span class="avatar" style="width:26px;height:26px;font-size:9px">' + U.esc(U.initials(inv.customerName)) + '</span><div><div class="customer-name">' + U.esc(inv.customerName) + '</div><div class="customer-sub">' + U.esc(inv.customerPhone || 'Saved customer') + '</div></div></div>'
          : '<span class="muted">Walk-in customer</span>') + '</td>' +
        '<td>' + UI.methodInline(inv.method) + (inv.chequeNo ? '<div class="cell-sub">Chq ' + U.esc(inv.chequeNo) + '</div>' : '') + '</td>' +
        '<td class="right num">' + U.money(inv.total) + (Number(inv.discount) > 0 ? '<div class="cell-sub">−' + U.money(inv.discount) + ' disc.</div>' : '') + '</td>' +
        '<td class="right num">' + U.money(inv.paid) + '</td>' +
        '<td class="right num ' + (Number(inv.balance) > 0 ? 'due-value' : 'muted') + '">' + U.money(inv.balance) + '</td>' +
        '<td>' + UI.statusBadge(status) + '</td>' +
        '<td><div class="row-actions"><button type="button" class="icon-btn" data-invoice-view="' + inv.id + '" title="View invoice">' + UI.icon('arrowRight', 15) + '</button></div></td>' +
        '</tr>';
    }).join('');
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Payment</th><th class="right">Total</th><th class="right">Paid</th><th class="right">Balance</th><th>Status</th><th></th></tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<div class="card-foot flex-between"><span class="hint">Showing ' + Math.min(rows.length, 200) + ' of ' + rows.length + ' invoice' + (rows.length === 1 ? '' : 's') + '</span>' +
      '<button class="link-btn" data-export-invoices>' + UI.icon('download', 13) + 'Export CSV</button></div>';
  }

  function listScreen() {
    return UI.pageHead({
      eyebrow: 'Counter · ' + listRange().label,
      title: 'Invoices',
      subtitle: 'Every retail and wholesale bill, with payment status and balance.',
      actions: '<button class="btn" data-export-invoices>' + UI.icon('download', 15) + 'Export CSV</button>' +
        '<a class="btn btn-primary" href="#/billing/new">' + UI.icon('plus', 15) + 'New sale</a>'
    }) +
      '<div id="inv-stats">' + listStats(filteredInvoices()) + '</div>' +
      '<div class="card inventory-card"><div class="inv-toolbar">' +
      '<div class="search-box" style="max-width:320px">' + UI.icon('search', 16) + '<input class="input" id="inv-search" placeholder="Search invoice, customer or phone…" value="' + U.attr(listState.q) + '"></div>' +
      '<div class="segmented" data-inv-range>' +
      '<button class="seg-btn ' + (listState.range === 'today' ? 'active' : '') + '" data-range="today">Today</button>' +
      '<button class="seg-btn ' + (listState.range === 'month' ? 'active' : '') + '" data-range="month">This month</button>' +
      '<button class="seg-btn ' + (listState.range === 'all' ? 'active' : '') + '" data-range="all">All</button></div>' +
      '<span class="spacer"></span>' +
      '<select class="select sm" id="inv-type" style="width:140px">' + UI.option('all', 'All types', listState.type) + UI.option('retail', 'Retail', listState.type) + UI.option('wholesale', 'Wholesale', listState.type) + '</select>' +
      '</div><div id="inv-table">' + listTableHTML(filteredInvoices()) + '</div></div>';
  }

  function exportInvoices(rows) {
    if (!rows.length) { UI.toast('There are no invoices to export for this filter.', 'info'); return; }
    const data = [['Invoice', 'Date', 'Customer', 'Phone', 'Type', 'Payment', 'Subtotal', 'Discount', 'Total', 'Paid', 'Balance', 'Status']]
      .concat(rows.map(i => [i.no, i.date, i.customerName, i.customerPhone, i.type, i.method, i.subtotal, i.discount, i.total, i.paid, i.balance, S().invoiceStatus(i)]));
    U.downloadFile('wijaya-invoices-' + (listRange().from || 'all') + '.csv', U.toCSV(data), 'text/csv;charset=utf-8');
    UI.toast('Invoice list exported.');
  }

  /* =========================================================
     POS / NEW SALE
     ========================================================= */
  function itemPrice(item) {
    return posState.wholesale && Number(item.wholesale) > 0 ? Number(item.wholesale) : Number(item.retail);
  }

  function cartCount() {
    return U.sumBy(posState.cart, l => l.qty);
  }

  function cartTotals() {
    const subtotal = U.round2(U.sumBy(posState.cart, l => Number(l.qty) * Number(l.price)));
    const discount = U.round2(U.clamp(U.toNum(posState.discount, 0), 0, subtotal));
    return { subtotal, discount, total: U.round2(subtotal - discount) };
  }

  function qtyInCart(itemId) {
    const line = posState.cart.find(l => Number(l.itemId) === Number(itemId));
    return line ? Number(line.qty) : 0;
  }

  /* ---------- held bills ---------- */
  function heldBills() {
    try {
      const raw = localStorage.getItem(HELD_KEY);
      const list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) return [];
      return list
        .filter(bill => bill && bill.id && Array.isArray(bill.items))
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    } catch (err) { return []; }
  }

  function writeHeldBills(list) {
    try {
      localStorage.setItem(HELD_KEY, JSON.stringify(list));
      return true;
    } catch (err) {
      UI.toast('Could not save the held bill in this browser profile.', 'error');
      return false;
    }
  }

  function heldBillById(id) {
    return heldBills().find(bill => String(bill.id) === String(id)) || null;
  }

  function heldWhen(bill) {
    const stamp = String(bill.createdAt || '');
    if (!stamp) return '—';
    const day = stamp.slice(0, 10);
    return day === U.todayISO() ? U.fmtTime(stamp) : U.fmtDate(day, { mode: 'short' }) + ' · ' + U.fmtTime(stamp);
  }

  function heldStripHTML() {
    const count = heldBills().length;
    if (!count) return '';
    return '<button type="button" class="held-link" data-held-bills>' + UI.icon('inbox', 14) +
      '<span><b>' + count + ' held bill' + (count === 1 ? '' : 's') + '</b> waiting · tap to switch</span>' +
      '<span class="held-link-arrow">' + UI.icon('arrowRight', 13) + '</span></button>';
  }

  function heldBillHTML(bill) {
    const count = U.sumBy(bill.items || [], line => Number(line.qty) || 0);
    const by = bill.cashierName ? ' · ' + U.esc(bill.cashierName) : '';
    return '<div class="held-card">' +
      '<div class="held-card-main">' +
      '<div class="held-card-title">' + U.esc(bill.customerName || 'Walk-in customer') +
      (bill.wholesale ? ' <span class="badge gold">Wholesale</span>' : '') + '</div>' +
      '<div class="held-card-sub">' + U.fmtQty(count) + ' item' + (Number(count) === 1 ? '' : 's') +
      ' · ' + U.esc(heldWhen(bill)) + by + '</div></div>' +
      '<div class="held-card-total">' + U.money(bill.total) + '</div>' +
      '<div class="held-card-actions">' +
      '<button type="button" class="btn btn-sm btn-primary" data-resume-held="' + U.attr(bill.id) + '">' + UI.icon('arrowRight', 13) + 'Resume</button>' +
      '<button type="button" class="icon-btn danger" data-discard-held="' + U.attr(bill.id) + '" title="Discard held bill">' + UI.icon('trash', 15) + '</button>' +
      '</div></div>';
  }

  function heldListHTML() {
    const list = heldBills();
    if (!list.length) {
      return UI.emptyState({ compact: true, icon: 'inbox', title: 'No held bills', text: 'On a new sale, tap Hold to park the current bill and serve the next customer.' });
    }
    return '<div class="held-list">' + list.map(heldBillHTML).join('') + '</div>';
  }

  function currentBillRecord() {
    const totals = cartTotals();
    const cust = selectedCustomer();
    const cashier = APP().getActiveCashier();
    return {
      id: 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      createdAt: U.nowStamp(),
      cashierId: APP().getActiveCashierId(),
      cashierName: cashier ? cashier.name : '',
      customerId: posState.customerId || null,
      customerName: cust ? cust.name : 'Walk-in customer',
      items: posState.cart.map(line => ({ itemId: line.itemId, qty: line.qty, price: line.price })),
      wholesale: !!posState.wholesale,
      discount: posState.discount,
      method: posState.method,
      received: posState.received,
      note: posState.note,
      chequeNo: posState.chequeNo,
      chequeDate: posState.chequeDate,
      total: totals.total,
      count: cartCount()
    };
  }

  function updateHeldStrip(scope) {
    const strip = scope.querySelector('#held-strip');
    if (strip) strip.innerHTML = heldStripHTML();
  }

  function holdCurrentBill(scope) {
    if (!posState.cart.length) return;
    const list = heldBills();
    list.push(currentBillRecord());
    if (!writeHeldBills(list)) return;
    resetAfterSale();
    const search = scope.querySelector('#pos-search');
    if (search) search.value = '';
    renderCatalog(scope);
    renderCart(scope);
    UI.toast('Bill held · ' + heldBills().length + ' waiting at the counter.');
  }

  async function resumeHeldBill(id, scope, modal) {
    const bill = heldBillById(id);
    if (!bill) {
      UI.toast('That held bill is no longer available.', 'info');
      modal.close();
      return;
    }
    const items = [];
    let adjusted = false;
    bill.items.forEach(line => {
      const item = S().itemById(Number(line.itemId));
      const stock = item ? Number(item.qty) || 0 : 0;
      let qty = U.round2(U.toNum(line.qty, 0));
      if (!item || item.active === false || stock <= 0.0001) { adjusted = true; return; }
      if (qty > stock) { qty = stock; adjusted = true; }
      if (qty <= 0) { adjusted = true; return; }
      if (Number(line.qty) !== qty) adjusted = true;
      items.push({ itemId: item.id, qty, price: U.round2(U.toNum(line.price, itemPrice(item))) });
    });
    if (!items.length) {
      UI.toast('Every item on that held bill is out of stock now. It was left in the held list.', 'error');
      return;
    }
    if (posState.cart.length) {
      const ok = await UI.confirmDialog({
        title: 'Resume this held bill?',
        text: 'The current bill has ' + U.fmtQty(cartCount()) + ' item' + (cartCount() === 1 ? '' : 's') +
          '. It will be held first, then this bill will open.',
        confirmText: 'Hold current & resume',
        danger: false
      });
      if (!ok) return;
      const withCurrent = heldBills();
      withCurrent.push(currentBillRecord());
      if (!writeHeldBills(withCurrent)) return;
    }
    const remaining = heldBills().filter(entry => String(entry.id) !== String(bill.id));
    if (!writeHeldBills(remaining)) return;
    posState.cart = items;
    posState.customerId = bill.customerId && S().customerById(bill.customerId) ? bill.customerId : '';
    posState.wholesale = !!bill.wholesale;
    posState.discount = bill.discount === undefined || bill.discount === null ? '' : String(bill.discount);
    posState.method = bill.method || 'cash';
    posState.received = bill.received === undefined || bill.received === null ? '' : String(bill.received);
    posState.note = bill.note || '';
    posState.chequeNo = bill.chequeNo || '';
    posState.chequeDate = bill.chequeDate || U.todayISO();
    posState.search = '';
    posState.filter = 'all';
    const search = scope.querySelector('#pos-search');
    if (search) search.value = '';
    modal.close();
    renderCatalog(scope);
    renderCart(scope);
    UI.toast(adjusted ? 'Held bill resumed · unavailable stock was adjusted.' : 'Held bill resumed.');
  }

  function openHeldBillsModal(scope) {
    const modal = UI.modal({
      title: 'Held bills',
      subtitle: 'Parked at this counter. Resume one to keep billing.',
      body: '<div data-held-list>' + heldListHTML() + '</div>'
    });
    modal.panel.addEventListener('click', async e => {
      const resume = e.target.closest('[data-resume-held]');
      if (resume) { await resumeHeldBill(resume.dataset.resumeHeld, scope, modal); return; }
      const discard = e.target.closest('[data-discard-held]');
      if (!discard) return;
      const bill = heldBillById(discard.dataset.discardHeld);
      if (!bill) return;
      const ok = await UI.confirmDialog({
        title: 'Discard this held bill?',
        text: 'The parked items, customer and payment details for ' + (bill.customerName || 'Walk-in customer') + ' will be removed.',
        confirmText: 'Discard bill',
        danger: true
      });
      if (!ok) return;
      const remaining = heldBills().filter(entry => String(entry.id) !== String(bill.id));
      if (!writeHeldBills(remaining)) return;
      modal.body.querySelector('[data-held-list]').innerHTML = heldListHTML();
      updateHeldStrip(scope);
      UI.toast('Held bill discarded.');
    });
  }

  function selectedCustomer() {
    return posState.customerId ? S().customerById(posState.customerId) : null;
  }

  function catalogItems() {
    const q = posState.search.trim().toLowerCase();
    return S().activeItems().filter(item => {
      if (posState.filter === 'part' && item.category !== 'part') return false;
      if (posState.filter === 'machine' && item.category !== 'machine') return false;
      if (q) {
        const hay = (item.name + ' ' + (item.sku || '') + ' ' + (item.brand || '') + ' ' + (item.compatible || '') + ' ' + (item.group || '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      if (a.category !== b.category) return a.category === 'part' ? -1 : 1;
      return String(a.name).localeCompare(String(b.name));
    });
  }

  function catalogHTML() {
    const items = catalogItems();
    if (!items.length) {
      const noItems = S().activeItems().length === 0;
      return '<div class="catalog-empty">' + UI.emptyState({
        compact: false, icon: 'box',
        title: noItems ? (adminMode() ? 'Your catalogue is empty' : 'No items in the catalogue') : 'No matching items',
        text: noItems ? (adminMode() ? 'Add spare parts and machines before billing your first sale.' : 'Ask the shop admin to add stock before billing a sale.') : 'Try another search or switch the category filter.',
        action: noItems && adminMode() ? '<button type="button" class="btn btn-primary" data-add-new-part>' + UI.icon('plus', 14) + 'Add a spare part</button>' : ''
      }) + '</div>';
    }
    return items.map(item => {
      const stock = Number(item.qty) || 0;
      const disabled = stock <= 0.0001;
      const inCart = qtyInCart(item.id);
      const kind = item.category === 'machine' ? 'Machine' : (item.group || 'Part');
      const meta = item.category === 'machine'
        ? (item.origin || 'Machine') + (item.brand ? ' · ' + item.brand : '')
        : (item.sku || '') + (item.brand ? ' · ' + item.brand : '');
      return '<button type="button" class="product-card' + (disabled ? ' disabled' : '') + '" data-add="' + item.id + '"' + (disabled ? ' disabled' : '') + '>' +
        '<div class="product-top"><span class="product-kind">' + U.esc(kind) + (inCart ? ' · in bill' : '') + '</span>' +
        (item.category === 'machine' ? '<span class="origin ' + (item.origin === 'Local' ? 'local' : 'import') + '">' + U.esc(item.origin || 'Import') + '</span>' : '') + '</div>' +
        '<div class="product-name">' + U.esc(item.name) + '</div>' +
        '<div class="product-meta">' + U.esc(meta || '—') + ' · ' + (stock > 0 ? U.fmtQty(stock) + ' in stock' : 'out of stock') + '</div>' +
        '<div class="product-bottom"><div class="product-price">' + U.money(itemPrice(item)) + '<small>' + (posState.wholesale ? 'Wholesale' : 'Retail') + '</small></div>' +
        '<span class="add-orb">' + UI.icon(disabled ? 'x' : 'plus', 13) + '</span></div></button>';
    }).join('');
  }

  function customerPanelHTML() {
    const cust = selectedCustomer();
    const due = cust ? S().customerDue(cust.id) : 0;
    const advance = cust ? S().customerAdvance(cust.id) : 0;
    return '<div class="cart-customer"><div class="field" style="flex:1">' +
      '<label class="label" for="pos-customer">Customer</label>' +
      '<div class="flex gap-6"><select class="select sm" id="pos-customer" style="height:34px">' + UI.customerOptions(posState.customerId, true) + '</select>' +
      '<button type="button" class="icon-btn bordered" data-add-customer title="Add a new customer">' + UI.icon('userPlus', 15) + '</button></div>' +
      (cust ? '<div class="hint">' + (due > 0 ? 'Due ' + U.money(due) : 'No due') + ' · Advance ' + U.money(advance) + '</div>' : '<div class="hint">Walk-in sale. Pick a saved customer for credit or advances.</div>') +
      '</div></div>';
  }

  function payFieldsHTML(totals) {
    const advance = selectedCustomer() ? S().customerAdvance(posState.customerId) : 0;
    const due = selectedCustomer() ? S().customerDue(posState.customerId) : 0;
    if (posState.method === 'cash') {
      const received = posState.received === '' ? totals.total : U.toNum(posState.received, 0);
      const change = U.round2(received - totals.total);
      return '<div class="pay-fields"><div class="form-grid">' +
        '<div class="field"><label class="label" for="pos-received">Cash received</label><div class="input-group"><span class="prefix">' + U.esc(U.symbol()) + '</span>' +
        '<input class="input" id="pos-received" type="number" min="0" step="0.01" value="' + U.attr(posState.received) + '" placeholder="' + totals.total.toFixed(2) + '"></div></div>' +
        '<div class="field"><label class="label">Balance / change</label><div class="input" style="display:flex;align-items:center;background:var(--surface-2);color:' + (change < 0 ? 'var(--danger)' : 'var(--success)') + ';font-weight:600">' +
        (change >= 0 ? 'Change ' + U.money(change) : 'Short ' + U.money(Math.abs(change))) + '</div></div></div></div>';
    }
    if (posState.method === 'cheque') {
      return '<div class="pay-fields"><div class="form-grid">' +
        '<div class="field"><label class="label" for="pos-cheque-no">Cheque number</label><input class="input" id="pos-cheque-no" placeholder="e.g. 045812" value="' + U.attr(posState.chequeNo) + '"></div>' +
        '<div class="field"><label class="label" for="pos-cheque-date">Cheque date</label><input class="input" id="pos-cheque-date" type="date" value="' + U.attr(posState.chequeDate) + '"></div>' +
        '</div><div class="pay-note mt-8">The full bill is recorded as paid by cheque.</div></div>';
    }
    if (posState.method === 'card' || posState.method === 'online') {
      return '<div class="pay-fields"><div class="pay-note">Full amount collected by ' + (posState.method === 'card' ? 'card' : 'online transfer') + '. The bill will be marked paid.</div></div>';
    }
    if (posState.method === 'credit') {
      const cust = selectedCustomer();
      return '<div class="pay-fields"><div class="pay-note">' + (cust
        ? '<b>' + U.esc(cust.name) + '</b> will owe ' + U.money(due + totals.total) + ' after this sale (including existing due).'
        : 'Choose a saved customer above to record this sale on credit.') + '</div></div>';
    }
    const cust = selectedCustomer();
    let note;
    if (!cust) note = 'Choose a saved customer above to use their advance.';
    else if (advance <= 0) note = U.esc(cust.name) + ' has no available advance.';
    else {
      const applied = Math.min(advance, totals.total);
      note = '<b>' + U.esc(cust.name) + '</b> has ' + U.money(advance) + ' in advance. ' + U.money(applied) + ' will be applied' +
        (applied < totals.total ? '; the remaining ' + U.money(totals.total - applied) + ' stays as credit.' : ' and the bill is fully settled.');
    }
    return '<div class="pay-fields"><div class="pay-note">' + note + '</div></div>';
  }

  function cartPanelHTML() {
    const totals = cartTotals();
    const count = cartCount();
    const cust = selectedCustomer();
    const lines = posState.cart.length ? posState.cart.map(line => {
      const item = S().itemById(line.itemId);
      if (!item) return '';
      return '<div class="cart-line">' +
        '<div><div class="cart-line-name">' + U.esc(item.name) + '</div><div class="cart-line-meta">' + U.esc(item.sku || '') + ' · ' + U.fmtQty(item.qty) + ' in stock</div></div>' +
        '<div class="cart-line-right"><div class="cart-line-total">' + U.money(Number(line.qty) * Number(line.price)) + '</div><div class="cart-line-meta">' + U.money(line.price) + ' each</div></div>' +
        '<div class="cart-line-controls"><div class="qty-control">' +
        '<button type="button" class="qty-btn" data-qty="-1" data-line="' + line.itemId + '" aria-label="Reduce quantity">' + UI.icon('minus', 12) + '</button>' +
        '<input class="qty-input" type="number" min="0.01" step="0.01" value="' + U.attr(line.qty) + '" data-qty-input="' + line.itemId + '" aria-label="Quantity">' +
        '<button type="button" class="qty-btn" data-qty="1" data-line="' + line.itemId + '" aria-label="Increase quantity">' + UI.icon('plus', 12) + '</button></div>' +
        '<div class="flex-center gap-8"><input class="price-edit" type="number" min="0" step="0.01" value="' + U.attr(line.price) + '" data-price="' + line.itemId + '" title="Unit selling price">' +
        '<button type="button" class="line-remove" data-remove="' + line.itemId + '" title="Remove line">' + UI.icon('trash', 14) + '</button></div>' +
        '</div></div>';
    }).join('') : '<div class="cart-empty"><span class="orb">' + UI.icon('cart', 19) + '</span><b>The bill is empty</b><span>Tap a part or machine to add it, or scan its SKU.</span></div>';
    const payButtons = ['cash', 'card', 'online', 'credit', 'cheque', 'advance'].map(m =>
      '<button type="button" class="pay-btn' + (posState.method === m ? ' active' : '') + '" data-pay="' + m + '">' +
      UI.icon(UI.METHOD_ICONS[m], 13) + UI.methodLabel(m) + '</button>').join('');
    return '<div class="cart-head"><div><div class="cart-title">Current bill</div>' +
      '<div class="cart-sub">' + count + ' item' + (count === 1 ? '' : 's') + ' · ' + U.money(totals.total) + '</div></div>' +
      '<div class="cart-head-actions">' + (posState.wholesale ? '<span class="wholesale-flag">Wholesale</span>' : '') +
      '<button type="button" class="btn btn-sm cart-hold-btn" data-hold-bill title="Hold this bill and start a new one" ' + (posState.cart.length ? '' : 'disabled') + '>' + UI.icon('inbox', 13) + 'Hold</button>' +
      '<button type="button" class="icon-btn" data-clear-cart title="Clear bill" ' + (posState.cart.length ? '' : 'disabled') + '>' + UI.icon('trash', 15) + '</button></div></div>' +
      '<div class="held-strip" id="held-strip">' + heldStripHTML() + '</div>' +
      '<div class="cart-scroll">' + customerPanelHTML() + '<div class="cart-lines">' + lines + '</div></div>' +
      '<div class="cart-checkout"><div class="totals">' +
      '<div class="total-row"><span>Subtotal</span><b>' + U.money(totals.subtotal) + '</b></div>' +
      '<div class="total-row"><span>Discount (' + U.esc(U.symbol()) + ')</span><input class="discount-input" id="pos-discount" type="number" min="0" max="' + totals.subtotal + '" step="0.01" value="' + U.attr(posState.discount) + '" placeholder="0.00"></div>' +
      (cust && S().customerDue(cust.id) > 0 ? '<div class="total-row"><span>Existing due</span><b class="due-value">' + U.money(S().customerDue(cust.id)) + '</b></div>' : '') +
      '<div class="total-row grand-total"><span>Total</span><b>' + U.money(totals.total) + '</b></div></div>' +
      '<div class="pay-label"><span class="label" style="margin:0">Payment</span>' +
      (cust ? '<span class="tiny muted">Advance ' + U.money(S().customerAdvance(cust.id)) + '</span>' : '<span class="tiny muted">Walk-in</span>') + '</div>' +
      '<div class="pay-methods">' + payButtons + '</div>' + payFieldsHTML(totals) +
      '<div class="field mt-8"><input class="input" id="pos-note" style="height:34px" placeholder="Note / reference (optional)" value="' + U.attr(posState.note) + '"></div>' +
      '<button type="button" class="btn btn-primary checkout-btn mt-12" data-checkout' + (posState.cart.length ? '' : ' disabled') + '>' +
      UI.icon('checkCircle', 16) + (posState.cart.length ? 'Complete sale · ' + U.money(totals.total) : 'Add items to complete sale') + '</button></div>';
  }

  function posScreen() {
    return UI.pageHead({
      eyebrow: 'Counter · ' + U.fmtDate(U.todayISO(), { mode: 'medium' }),
      title: 'New sale',
      subtitle: 'Ring up spare parts and machines. Switch to wholesale to use wholesale prices.',
      actions: '<a class="btn" href="#/billing">' + UI.icon('receipt', 15) + 'All invoices</a>'
    }) +
      '<div class="pos-layout">' +
      '<section class="card catalog-card"><div class="catalog-head"><div class="catalog-tools">' +
      '<div class="search-box" style="flex:1;min-width:210px">' + UI.icon('search', 16) + '<input class="input" id="pos-search" placeholder="Search name, brand, SKU…  (Enter to add)" value="' + U.attr(posState.search) + '"></div>' +
      '<div class="segmented" data-pos-filter>' +
      '<button class="seg-btn ' + (posState.filter === 'all' ? 'active' : '') + '" data-cat="all">All</button>' +
      '<button class="seg-btn ' + (posState.filter === 'part' ? 'active' : '') + '" data-cat="part">Parts</button>' +
      '<button class="seg-btn ' + (posState.filter === 'machine' ? 'active' : '') + '" data-cat="machine">Machines</button></div>' +
      '<div class="segmented" data-sale-type>' +
      '<button class="seg-btn ' + (!posState.wholesale ? 'active' : '') + '" data-type="retail">Retail</button>' +
      '<button class="seg-btn ' + (posState.wholesale ? 'active gold' : '') + '" data-type="wholesale">Wholesale</button></div>' +
      (adminMode() ? '<button type="button" class="icon-btn bordered" data-add-new-part title="Add spare part">' + UI.icon('plus', 16) + '</button>' : '') +
      '</div><div class="flex-between mt-12"><span class="toolbar-label" id="catalog-count"></span><span class="hint">Stock is checked before billing</span></div></div>' +
      '<div class="catalog-grid" id="catalog-grid">' + catalogHTML() + '</div></section>' +
      '<div id="cart-panel-wrap"><aside class="card cart-panel" id="cart-panel">' + cartPanelHTML() + '</aside></div></div>';
  }

  function renderCatalog(scope) {
    const grid = scope.querySelector('#catalog-grid');
    if (grid) grid.innerHTML = catalogHTML();
    const count = scope.querySelector('#catalog-count');
    if (count) count.textContent = catalogItems().length + ' item' + (catalogItems().length === 1 ? '' : 's') + ' shown';
    scope.querySelectorAll('[data-pos-filter] [data-cat]').forEach(btn => btn.classList.toggle('active', btn.dataset.cat === posState.filter));
    scope.querySelectorAll('[data-sale-type] [data-type]').forEach(btn => {
      const active = (btn.dataset.type === 'wholesale') === posState.wholesale;
      btn.classList.toggle('active', active);
      if (btn.dataset.type === 'wholesale') btn.classList.toggle('gold', active);
    });
  }

  function renderCart(scope) {
    const wrap = scope.querySelector('#cart-panel-wrap');
    if (!wrap) return;
    wrap.innerHTML = '<aside class="card cart-panel" id="cart-panel">' + cartPanelHTML() + '</aside>';
  }

  function addToCart(itemId, qty) {
    const item = S().itemById(itemId);
    if (!item || item.active === false) { UI.toast('That item is no longer available.', 'error'); return false; }
    const addQty = Math.max(0.001, U.toNum(qty, 1));
    const existing = posState.cart.find(l => Number(l.itemId) === Number(item.id));
    const newQty = (existing ? Number(existing.qty) : 0) + addQty;
    if (Number(item.qty) + 0.0001 < newQty) {
      UI.toast('Only ' + U.fmtQty(item.qty) + ' of ' + item.name + ' in stock.', 'error');
      return false;
    }
    if (existing) {
      existing.qty = U.round2(existing.qty + addQty);
    } else {
      posState.cart.push({ itemId: item.id, qty: addQty, price: itemPrice(item) });
    }
    return true;
  }

  function resetAfterSale() {
    posState.cart = [];
    posState.customerId = '';
    posState.wholesale = false;
    posState.discount = '';
    posState.received = '';
    posState.note = '';
    posState.method = 'cash';
    posState.chequeNo = '';
    posState.chequeDate = U.todayISO();
    posState.search = '';
    posState.filter = 'all';
  }

  async function completeSale(scope, button) {
    if (!posState.cart.length) { UI.toast('Add at least one item to the bill.', 'error'); return; }
    const totals = cartTotals();
    if (totals.total < 0) { UI.toast('The discount cannot be more than the subtotal.', 'error'); return; }
    const method = posState.method;
    if (method === 'cash') {
      const effectiveReceived = posState.received === '' ? totals.total : U.toNum(posState.received, 0);
      if (effectiveReceived + 0.009 < totals.total) { UI.toast('Cash received is less than the bill total.', 'error'); return; }
    }
    if (method === 'credit' || method === 'advance') {
      if (!posState.customerId) { UI.toast('Choose a saved customer for this payment type.', 'error'); return; }
    }
    if (method === 'cheque' && !posState.chequeNo.trim()) { UI.toast('Enter the cheque number.', 'error'); return; }
    const items = posState.cart.map(l => ({ itemId: l.itemId, qty: l.qty, price: l.price }));
    try {
      await UI.withLoading(button, async () => {
        const result = await S().createInvoice({
          items,
          type: posState.wholesale ? 'wholesale' : 'retail',
          customerId: posState.customerId || null,
          discount: totals.discount,
          method,
          received: method === 'cash' ? (posState.received === '' ? totals.total : posState.received) : '',
          chequeNo: posState.chequeNo,
          chequeDate: posState.chequeDate,
          note: posState.note,
          cashierId: APP().getActiveCashierId()
        });
        resetAfterSale();
        APP().refresh();
        UI.showReceipt('invoice', result);
        UI.toast('Sale ' + result.invoice.no + ' completed' + (result.change > 0 ? ' · change ' + U.money(result.change) : '') + '.');
      });
    } catch (err) {
      UI.toast(err.userMessage || err.message || 'Could not complete this sale.', 'error');
    }
  }

  function bindList(content) {
    const scope = content.querySelector('#view-root') || content;
    const stats = content.querySelector('#inv-stats');
    const table = content.querySelector('#inv-table');
    const search = content.querySelector('#inv-search');
    const type = content.querySelector('#inv-type');

    function paint() {
      const rows = filteredInvoices();
      if (stats) stats.innerHTML = listStats(rows);
      if (table) table.innerHTML = listTableHTML(rows);
      content.querySelectorAll('[data-inv-range] [data-range]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.range === listState.range);
      });
    }

    content.querySelectorAll('[data-inv-range] [data-range]').forEach(btn => {
      btn.addEventListener('click', () => { listState.range = btn.dataset.range; paint(); });
    });
    if (search) {
      search.addEventListener('input', U.debounce(() => { listState.q = search.value; paint(); }, 180));
    }
    if (type) type.addEventListener('change', () => { listState.type = type.value; paint(); });
    scope.addEventListener('click', e => {
      const exportBtn = e.target.closest('[data-export-invoices]');
      if (exportBtn) { exportInvoices(filteredInvoices()); return; }
      const row = e.target.closest('[data-invoice-row]');
      const view = e.target.closest('[data-invoice-view]');
      if (row || view) {
        const id = Number((view || row).dataset.invoiceView || row.dataset.invoiceRow);
        C.invoiceDetailModal(id, { onChanged: () => APP().dataChanged() });
      }
    });
  }

  function bindPos(content) {
    const scope = content.querySelector('#view-root') || content;
    const prefill = APP().takePrefill();
    if (prefill) {
      if (addToCart(prefill, 1)) renderCart(scope);
    }
    renderCatalog(scope);

    scope.addEventListener('click', async e => {
      const add = e.target.closest('[data-add]');
      if (add && !add.disabled) {
        if (addToCart(Number(add.dataset.add), 1)) renderCart(scope);
        return;
      }
      const addPart = e.target.closest('[data-add-new-part]');
      if (addPart) { if (adminMode()) C.itemModal({ category: 'part' }); return; }
      const addCust = e.target.closest('[data-add-customer]');
      if (addCust) {
        C.addCustomerModal({
          onSaved: c => {
            posState.customerId = c.id;
            APP().refresh();
          }
        });
        return;
      }
      const hold = e.target.closest('[data-hold-bill]');
      if (hold) { holdCurrentBill(scope); return; }
      const held = e.target.closest('[data-held-bills]');
      if (held) { openHeldBillsModal(scope); return; }
      const clear = e.target.closest('[data-clear-cart]');
      if (clear) {
        if (!posState.cart.length) return;
        const ok = await UI.confirmDialog({ title: 'Clear this bill?', text: 'All items, discount and payment details on the current bill will be removed.', confirmText: 'Clear bill', danger: true });
        if (!ok) return;
        resetAfterSale();
        renderCart(scope);
        return;
      }
      const qtyBtn = e.target.closest('[data-qty]');
      if (qtyBtn) {
        const line = posState.cart.find(l => Number(l.itemId) === Number(qtyBtn.dataset.line));
        if (!line) return;
        const item = S().itemById(line.itemId);
        const next = U.round2(Number(line.qty) + Number(qtyBtn.dataset.qty));
        if (next <= 0) {
          posState.cart = posState.cart.filter(l => Number(l.itemId) !== Number(line.itemId));
        } else if (item && next > Number(item.qty) + 0.0001) {
          UI.toast('Only ' + U.fmtQty(item.qty) + ' in stock.', 'error'); return;
        } else {
          line.qty = next;
        }
        renderCart(scope);
        return;
      }
      const remove = e.target.closest('[data-remove]');
      if (remove) {
        posState.cart = posState.cart.filter(l => Number(l.itemId) !== Number(remove.dataset.remove));
        renderCart(scope);
        return;
      }
      const pay = e.target.closest('[data-pay]');
      if (pay) {
        posState.method = pay.dataset.pay;
        renderCart(scope);
        return;
      }
      const cat = e.target.closest('[data-pos-filter] [data-cat]');
      if (cat) {
        posState.filter = cat.dataset.cat;
        renderCatalog(scope);
        return;
      }
      const type = e.target.closest('[data-sale-type] [data-type]');
      if (type) {
        posState.wholesale = type.dataset.type === 'wholesale';
        posState.cart.forEach(line => {
          const item = S().itemById(line.itemId);
          if (item) line.price = itemPrice(item);
        });
        renderCatalog(scope);
        renderCart(scope);
        return;
      }
      const checkout = e.target.closest('[data-checkout]');
      if (checkout) { await completeSale(scope, checkout); }
    });

    scope.addEventListener('change', e => {
      const t = e.target;
      if (t.id === 'pos-customer') {
        posState.customerId = t.value;
        renderCart(scope);
        return;
      }
      if (t.id === 'pos-discount') {
        posState.discount = t.value;
        renderCart(scope);
        return;
      }
      if (t.id === 'pos-note') {
        posState.note = t.value;
        return;
      }
      if (t.id === 'pos-received') {
        posState.received = t.value;
        return;
      }
      if (t.id === 'pos-cheque-no') {
        posState.chequeNo = t.value;
        return;
      }
      if (t.id === 'pos-cheque-date') {
        posState.chequeDate = t.value;
        return;
      }
      if (t.dataset.qtyInput !== undefined) {
        const line = posState.cart.find(l => Number(l.itemId) === Number(t.dataset.qtyInput));
        if (!line) return;
        const item = S().itemById(line.itemId);
        let qty = U.toNum(t.value, 0);
        if (qty <= 0) {
          posState.cart = posState.cart.filter(l => Number(l.itemId) !== Number(line.itemId));
        } else {
          if (item && qty > Number(item.qty) + 0.0001) {
            UI.toast('Only ' + U.fmtQty(item.qty) + ' in stock.', 'error');
            qty = Number(item.qty);
          }
          line.qty = U.round2(qty);
        }
        renderCart(scope);
        return;
      }
      if (t.dataset.price !== undefined) {
        const line = posState.cart.find(l => Number(l.itemId) === Number(t.dataset.price));
        if (!line) return;
        const price = U.round2(U.toNum(t.value, line.price));
        if (price < 0) { UI.toast('Price cannot be negative.', 'error'); }
        else line.price = price;
        renderCart(scope);
      }
    });

    scope.addEventListener('input', e => {
      if (e.target.id === 'pos-received') {
        posState.received = e.target.value;
        const totals = cartTotals();
        const received = posState.received === '' ? totals.total : U.toNum(posState.received, 0);
        const change = U.round2(received - totals.total);
        const field = e.target.closest('.form-grid');
        const box = field && field.querySelectorAll('.input')[1];
        if (box) {
          box.textContent = change >= 0 ? 'Change ' + U.money(change) : 'Short ' + U.money(Math.abs(change));
          box.style.color = change < 0 ? 'var(--danger)' : 'var(--success)';
        }
      }
      if (e.target.id === 'pos-note') posState.note = e.target.value;
      if (e.target.id === 'pos-cheque-no') posState.chequeNo = e.target.value;
    });

    const search = scope.querySelector('#pos-search');
    if (search) {
      search.addEventListener('input', U.debounce(() => {
        posState.search = search.value;
        renderCatalog(scope);
      }, 140));
      search.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const q = search.value.trim();
        if (!q) return;
        const exact = S().findItemByScan(q);
        const results = catalogItems();
        const target = exact || (results.length === 1 ? results[0] : null);
        if (!target) { UI.toast('No single item matched that search.', 'info'); return; }
        if (addToCart(target.id, 1)) {
          posState.search = '';
          search.value = '';
          renderCatalog(scope);
          renderCart(scope);
        }
      });
    }
  }

  V.billing = {
    render(route) {
      return route && route.sub === 'new' ? posScreen() : listScreen();
    },
    mount(content, route) {
      if (route && route.sub === 'new') bindPos(content);
      else bindList(content);
    },
    refresh() {
      APP().renderRoute(true);
    }
  };
})();
