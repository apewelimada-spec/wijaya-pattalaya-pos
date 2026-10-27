(function () {
  'use strict';
  const WP = window.WP = window.WP || {};
  const U = WP.utils;
  const UI = WP.ui;
  const V = WP.views = WP.views || {};

  function S() { return WP.store; }
  function APP() { return WP.app; }

  const state = {
    from: U.monthStartISO(),
    to: U.todayISO(),
    preset: 'month',
    day: U.todayISO(),
    tab: 'summary'
  };
  const originView = { side: 'Local' };

  const TABS = [
    { key: 'summary', label: 'Summary', href: '#/reports' },
    { key: 'local', label: 'Local report', href: '#/reports/local' },
    { key: 'export', label: 'Export report', href: '#/reports/export' }
  ];

  const EXPORT_LABELS = {
    business: 'Business report',
    local: 'Local report',
    import: 'Import report',
    supplier: 'Supplier cheques & advances',
    daybook: 'Day book'
  };

  function tabsHTML() {
    return '<nav class="tabs">' + TABS.map(t =>
      '<a class="tab' + (state.tab === t.key ? ' active' : '') + '" href="' + t.href + '">' + t.label + '</a>').join('') + '</nav>';
  }

  function exportItems() {
    return [
      { key: 'business', icon: 'chart', title: 'Full business report', text: 'Sales, service, profit, parts sold, technicians, machines, returns, day book, supplier money and the Local & Import split.' },
      { key: 'local', icon: 'home', title: 'Local report', text: 'Local goods only — stock on hand and what was bought from local suppliers in the period.' },
      { key: 'import', icon: 'globe', title: 'Import report', text: 'Imported goods only — stock on hand and what was bought in (or from import suppliers) in the period.' },
      { key: 'supplier', icon: 'building', title: 'Supplier cheques & advances', text: 'Supplier bills, cheques still in the drawer, handed over, honoured or bounced, and advances both ways.' },
      { key: 'daybook', icon: 'calendar', title: 'Day book · ' + U.fmtDate(state.day, { mode: 'medium' }), text: 'Opening balance, money in and out and the closing cash and bank for the chosen day — change the day on the Summary tab.' }
    ];
  }

  function exportTabHTML() {
    return '<div class="card inventory-card"><div class="card-head bordered"><div><div class="card-title">Choose a report</div>' +
      '<div class="card-sub">Period: <b>' + U.esc(rangeLabel()) + '</b> · change it above and every print or file follows.</div></div></div>' +
      '<div class="card-body export-list">' +
      exportItems().map(it => '<div class="export-row"><div class="export-info">' +
        '<span class="export-icon">' + UI.icon(it.icon, 16) + '</span>' +
        '<div><div class="export-title">' + U.esc(it.title) + '</div><div class="export-text">' + U.esc(it.text) + '</div></div></div>' +
        '<div class="export-actions">' +
        '<button type="button" class="btn btn-sm" data-print="' + it.key + '">' + UI.icon('printer', 14) + 'Print A4</button>' +
        '<button type="button" class="btn btn-sm btn-primary" data-csv="' + it.key + '">' + UI.icon('download', 14) + 'CSV</button>' +
        '</div></div>').join('') +
      '</div><div class="card-foot"><span class="hint">Print opens the normal print window — choose A4 paper or save as PDF. CSV files open in Excel.</span></div></div>';
  }

  function sumParts(rows) {
    return (rows || []).reduce((acc, r) => {
      acc.saleQty += Number(r.saleQty) || 0;
      acc.serviceQty += Number(r.serviceQty) || 0;
      acc.qty += Number(r.qty) || 0;
      acc.revenue += Number(r.revenue) || 0;
      return acc;
    }, { saleQty: 0, serviceQty: 0, qty: 0, revenue: 0 });
  }

  function presetRange(key) {
    const today = U.todayISO();
    if (key === 'today') return { from: today, to: today };
    if (key === 'week') return { from: U.addDays(today, -6), to: today };
    if (key === 'last-month') {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: U.isoDate(first), to: U.isoDate(last) };
    }
    if (key === 'year') return { from: today.slice(0, 4) + '-01-01', to: today };
    if (key === 'all') return { from: '', to: '' };
    return { from: U.monthStartISO(), to: today };
  }

  const PRESETS = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Last 7 days' },
    { key: 'month', label: 'This month' },
    { key: 'last-month', label: 'Last month' },
    { key: 'year', label: 'This year' },
    { key: 'all', label: 'All time' }
  ];

  function rangeLabel() {
    return U.periodLabel(state.from, state.to);
  }

  function statCard(label, value, meta, icon, tone) {
    return '<div class="stat-card"><div class="stat-top"><span class="stat-label">' + U.esc(label) + '</span>' +
      '<span class="stat-icon ' + (tone || 'green') + '">' + UI.icon(icon || 'chart', 16) + '</span></div>' +
      '<div class="stat-value sm">' + value + '</div><div class="stat-meta">' + meta + '</div></div>';
  }

  function reportRow(label, value, cls) {
    return '<div class="report-list-row"><span class="report-list-label">' + label + '</span><span class="report-list-amt ' + (cls || '') + '">' + value + '</span></div>';
  }

  function moneyValue(v) {
    return '<span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(v);
  }

  function rangeBarHTML() {
    return '<div class="card card-pad mb-16"><div class="flex-between wrap gap-12">' +
      '<div class="report-range">' +
      '<div class="field"><label class="label" for="rep-from">From</label><input class="input sm" id="rep-from" type="date" value="' + U.attr(state.from) + '"></div>' +
      '<div class="field"><label class="label" for="rep-to">To</label><input class="input sm" id="rep-to" type="date" value="' + U.attr(state.to) + '"></div>' +
      '<button class="btn btn-sm btn-primary" data-apply-range>' + UI.icon('filter', 13) + 'Apply</button>' +
      '</div>' +
      '<div class="pill-select">' + PRESETS.map(p =>
        '<button type="button" class="period-chip' + (state.preset === p.key ? ' active' : '') + '" data-preset="' + p.key + '">' + p.label + '</button>').join('') + '</div>' +
      '</div><div class="hint mt-8">Showing <b>' + U.esc(rangeLabel()) + '</b> · opening cash and bank are managed per day below.</div></div>';
  }

  function openingCardsHTML() {
    const db = S().dayBook(state.day);
    const opening = S().getOpening(state.day);
    return '<div class="report-columns mb-16">' +
      '<div class="card card-pad"><div class="card-title mb-12">' + UI.icon('calendar', 18) + 'Opening balance</div>' +
      '<div class="opening-editor">' +
      '<div class="field"><label class="label" for="opening-date">Day</label>' +
      '<input class="input sm" id="opening-date" type="date" value="' + U.attr(state.day) + '"></div>' +
      '<div class="field"><label class="label" for="opening-cash">Opening cash</label>' +
      '<div class="input-group"><span class="prefix">' + U.esc(U.symbol()) + '</span><input class="input sm" id="opening-cash" type="number" min="0" step="0.01" value="' + Number(opening.cash || 0).toFixed(2) + '"></div></div>' +
      '<div class="field"><label class="label" for="opening-bank">Opening bank</label>' +
      '<div class="input-group"><span class="prefix">' + U.esc(U.symbol()) + '</span><input class="input sm" id="opening-bank" type="number" min="0" step="0.01" value="' + Number(opening.bank || 0).toFixed(2) + '"></div></div>' +
      '</div>' +
      '<div class="field mt-12"><label class="label" for="opening-note">Note <span class="opt">(optional)</span></label>' +
      '<input class="input sm" id="opening-note" placeholder="e.g. carried forward from yesterday" value="' + U.attr(opening.note || '') + '"></div>' +
      '<div class="flex-between mt-12"><span class="hint">Used in the day book and closing balances for the chosen day.</span>' +
      '<button class="btn btn-sm btn-primary" data-save-opening>' + UI.icon('save', 13) + 'Save opening</button></div></div>' +
      '<div class="card card-pad"><div class="flex-between mb-12"><div class="card-title">' + UI.icon('receipt', 18) + 'Day book</div>' +
      '<span class="badge grey">' + U.esc(U.fmtDate(state.day, { mode: 'medium' })) + '</span></div>' +
      '<div class="daybook-balance">' +
      '<div class="db-cell"><span>Cash opening</span><b>' + U.moneyShort(db.opening.cash || 0) + '</b></div>' +
      '<div class="db-cell"><span>Cash in</span><b>' + U.moneyShort(db.cashIn) + '</b></div>' +
      '<div class="db-cell"><span>Cash out</span><b>' + U.moneyShort(db.cashOut) + '</b></div>' +
      '<div class="db-cell featured"><span>Cash closing</span><b>' + U.moneyShort(db.closingCash) + '</b></div>' +
      '</div>' +
      reportRow('Bank opening', U.money(db.opening.bank || 0)) +
      reportRow('Bank in / out', '+ ' + U.money(db.bankIn) + ' / − ' + U.money(db.bankOut)) +
      reportRow('Bank closing', '<b>' + U.money(db.closingBank) + '</b>') +
      reportRow('Credit given today', U.money(db.creditSales), 'text-gold') +
      reportRow('Invoices / service jobs', db.invoiceCount + ' / ' + db.serviceCount) +
      reportRow('Expenses / returns', db.expenses.length + ' / ' + db.returns.length) +
      '</div></div>';
  }

  function summaryCardsHTML(s) {
    return '<div class="stat-grid mb-16">' +
      statCard('Net revenue', moneyValue(s.salesNet + s.serviceNet), 'Shop ' + U.moneyShort(s.salesNet) + ' · service ' + U.moneyShort(s.serviceNet), 'chart', 'green') +
      statCard('Gross profit', moneyValue(s.grossProfit), 'Parts cost ' + U.moneyShort(s.partsCost), 'coins', 'gold') +
      statCard('Expenses', moneyValue(s.expensesTotal), 'All categories', 'wallet', 'danger') +
      statCard('Net profit', moneyValue(s.netProfit), 'After expenses · ' + U.esc(rangeLabel()), 'banknote', 'blue') +
      '</div>';
  }

  function salesProfitHTML(s) {
    return '<div class="report-columns">' +
      '<div class="card card-pad"><div class="card-title mb-12">' + UI.icon('receipt', 18) + 'Sales & service</div>' +
      reportRow('Shop sales (gross)', U.money(s.salesGross)) +
      reportRow('Shop returns', '− ' + U.money(s.salesReturns), 'text-danger') +
      reportRow('Shop sales (net)', '<b>' + U.money(s.salesNet) + '</b>') +
      reportRow('Retail / wholesale', U.money(s.retail) + ' / ' + U.money(s.wholesale)) +
      reportRow('Service (gross)', U.money(s.serviceGross)) +
      reportRow('Service returns', '− ' + U.money(s.serviceReturns), 'text-danger') +
      reportRow('Service (net)', '<b>' + U.money(s.serviceNet) + '</b>') +
      reportRow('Discounts given', U.money(s.discounts), 'text-gold') +
      '</div>' +
      '<div class="card card-pad"><div class="card-title mb-12">' + UI.icon('chart', 18) + 'Profit & loss</div>' +
      reportRow('Sales + service (net)', U.money(s.salesNet + s.serviceNet)) +
      reportRow('Cost of parts sold', '− ' + U.money(s.partsCost), 'text-danger') +
      reportRow('Gross profit', '<b>' + U.money(s.grossProfit) + '</b>') +
      reportRow('Operating expenses', '− ' + U.money(s.expensesTotal), 'text-danger') +
      reportRow('Net profit', '<b class="' + (s.netProfit < 0 ? 'text-danger' : 'text-success') + '">' + U.money(s.netProfit) + '</b>') +
      reportRow('Machine units sold', U.fmtQty(s.machineUnits)) +
      reportRow('Invoices / service jobs', s.invoiceCount + ' / ' + s.serviceCount) +
      reportRow('Return documents', s.returnsCount) +
      '</div></div>';
  }

  function paymentExpenseHTML(s) {
    const methods = [['cash', 'Cash'], ['card', 'Card'], ['online', 'Online'], ['cheque', 'Cheque']];
    const paidTotal = U.sumBy(methods, m => s.receivedByMethod[m[0]] || 0);
    const catsMax = Math.max(1, ...s.expenseByCategory.map(c => c.amount));
    return '<div class="report-columns">' +
      '<div class="card card-pad"><div class="card-title mb-12">' + UI.icon('banknote', 18) + 'How customers paid</div>' +
      methods.map(m => reportRow(UI.methodLabel(m[0]), U.money(s.receivedByMethod[m[0]] || 0))).join('') +
      reportRow('Total received', '<b>' + U.money(paidTotal) + '</b>') +
      '<div class="divider"></div>' +
      reportRow('Credit sales in period', U.money(s.creditSales), 'text-gold') +
      reportRow('Later collections', U.money(s.collections)) +
      reportRow('Advances received', U.money(s.advancesReceived)) +
      reportRow('Receivables now', U.money(s.receivables)) +
      reportRow('Unused advances now', U.money(s.advancesBalance)) +
      '</div>' +
      '<div class="card card-pad"><div class="card-title mb-12">' + UI.icon('wallet', 18) + 'Expenses by category</div>' +
      s.expenseByCategory.map(c =>
        '<div class="cat-bar-row"><div class="cat-bar-top"><span>' + U.esc(c.label) + '</span><b>' + U.money(c.amount) + '</b></div>' +
        '<div class="cat-bar-track"><div class="cat-bar-fill" style="width:' + U.clamp((c.amount / catsMax) * 100, 0, 100) + '%"></div></div></div>').join('') +
      '<div class="divider"></div>' + reportRow('Total expenses', '<b>' + U.money(s.expensesTotal) + '</b>') +
      reportRow('Low stock alerts', s.lowStockCount + ' item' + (s.lowStockCount === 1 ? '' : 's')) +
      '</div></div>';
  }

  function topPartsHTML(s) {
    if (!s.topParts.length) {
      return '<div class="card">' + UI.emptyState({ compact: true, icon: 'box', title: 'No part sales in this period', text: 'Parts sold at the counter or used in service jobs will rank here.' }) + '</div>';
    }
    return '<div class="card inventory-card"><div class="card-head bordered"><div><div class="card-title">Top selling parts</div><div class="card-sub">By revenue in the selected period.</div></div></div>' +
      '<div class="table-wrap"><table class="table compact"><thead><tr><th>Part</th><th class="right">Qty</th><th class="right">Revenue</th></tr></thead><tbody>' +
      s.topParts.map(p => '<tr><td><span class="strong">' + U.esc(p.name) + '</span></td><td class="right num">' + U.fmtQty(p.qty) + '</td><td class="right num">' + U.money(p.revenue) + '</td></tr>').join('') +
      '</tbody></table></div></div>';
  }

  function techHTML() {
    const data = S().servicesByTechnician(state.from, state.to);
    if (!data.rows.length) {
      return '<div class="card">' + UI.emptyState({ compact: true, icon: 'users', title: 'No service jobs in this period', text: 'Technician totals appear when service bills are saved.' }) + '</div>';
    }
    return '<div class="card inventory-card"><div class="card-head bordered"><div><div class="card-title">Service by technician</div><div class="card-sub">' + U.esc(rangeLabel()) + ' · labour and parts by name.</div></div></div>' +
      '<div class="table-wrap"><table class="table compact"><thead><tr><th>Technician</th><th class="right">Jobs</th><th class="right">Labour</th><th class="right">Parts</th><th class="right">Total</th><th class="right">Due</th></tr></thead><tbody>' +
      data.rows.map(r => '<tr><td><span class="strong">' + U.esc(r.name) + '</span></td><td class="right num">' + r.jobs + '</td><td class="right num">' + U.money(r.labour) + '</td><td class="right num">' + U.money(r.parts) + '</td><td class="right num">' + U.money(r.total) + '</td><td class="right num ' + (r.due > 0 ? 'due-value' : 'muted') + '">' + U.money(r.due) + '</td></tr>').join('') +
      '</tbody></table></div></div>';
  }

  function machineHTML() {
    const data = S().machineSalesReport(state.from, state.to);
    return '<div class="card inventory-card"><div class="card-head bordered"><div><div class="card-title">Machines sold</div><div class="card-sub">' + U.fmtQty(data.unitsNet) + ' units · ' + U.esc(rangeLabel()) + '</div></div></div>' +
      '<div class="card-body" style="padding-bottom:8px">' +
      '<div class="parts-stat-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:8px">' +
      '<div class="stat-card" style="box-shadow:none"><div class="stat-top"><span class="stat-label">Units (net)</span></div><div class="stat-value">' + U.fmtQty(data.unitsNet) + '</div></div>' +
      '<div class="stat-card" style="box-shadow:none"><div class="stat-top"><span class="stat-label">Revenue</span></div><div class="stat-value sm">' + U.moneyShort(data.revenue) + '</div></div>' +
      '<div class="stat-card" style="box-shadow:none"><div class="stat-top"><span class="stat-label">Import / local</span></div><div class="stat-value sm" style="font-size:16px">' + U.fmtQty(data.importUnits) + ' / ' + U.fmtQty(data.localUnits) + '</div></div>' +
      '<div class="stat-card" style="box-shadow:none"><div class="stat-top"><span class="stat-label">Gross profit</span></div><div class="stat-value sm">' + U.moneyShort(U.round2(data.revenue - data.cost)) + '</div></div>' +
      '</div></div>' +
      (data.rows.length
        ? '<div class="table-wrap"><table class="table compact"><thead><tr><th>Date</th><th>Machine</th><th>Customer</th><th class="right">Qty</th><th class="right">Revenue</th></tr></thead><tbody>' +
          data.rows.slice(0, 8).map(r => '<tr><td class="nowrap">' + U.fmtDate(r.date, { mode: 'short' }) + '</td><td>' + U.esc(r.name) + '<div class="cell-sub">' + U.esc(r.origin) + '</div></td><td>' + U.esc(r.customer || 'Walk-in') + '</td><td class="right num">' + U.fmtQty(r.netQty) + '</td><td class="right num">' + U.money(r.total) + '</td></tr>').join('') +
          '</tbody></table></div>' + (data.rows.length > 8 ? '<div class="card-foot hint">Showing latest 8 of ' + data.rows.length + ' machine sale lines.</div>' : '')
        : '<div class="empty-inline">No machines sold in this period.</div>') +
      '</div>';
  }

  function returnsHTML() {
    const data = S().returnReport(state.from, state.to);
    if (!data.rows.length) {
      return '<div class="card">' + UI.emptyState({ compact: true, icon: 'archive', title: 'No returns in this period', text: 'Invoices and service bills returned or refunded will be listed here.' }) + '</div>';
    }
    return '<div class="card inventory-card"><div class="card-head bordered"><div><div class="card-title">Returns & refunds</div><div class="card-sub">' + U.money(data.total) + ' returned · ' + U.money(data.refunded) + ' refunded · ' + U.money(data.adjusted) + ' adjusted against balances.</div></div></div>' +
      '<div class="table-wrap"><table class="table compact"><thead><tr><th>Date</th><th>Return</th><th>Reference</th><th>Customer</th><th>Method</th><th class="right">Amount</th></tr></thead><tbody>' +
      data.rows.slice(0, 10).map(r => '<tr><td class="nowrap">' + U.fmtDate(r.date, { mode: 'short' }) + '</td><td><span class="mono">' + U.esc(r.no) + '</span></td><td><span class="mono">' + U.esc(r.refNo) + '</span><div class="cell-sub">' + U.esc(r.reason || '') + '</div></td><td>' + U.esc(r.customerName || 'Walk-in') + '</td><td>' + UI.methodLabel(r.method) + '</td><td class="right num">' + U.money(r.amount) + '</td></tr>').join('') +
      '</tbody></table></div></div>';
  }

  function originStockTableHTML(block) {
    const rows = block.items.filter(i => i.qty > 0);
    const list = rows.length ? rows : block.items;
    if (!list.length) {
      return '<div class="empty-inline">No ' + block.origin.toLowerCase() + ' items in the catalogue yet.</div>';
    }
    return '<div class="table-wrap"><table class="table compact"><thead><tr><th>' + (block.origin === 'Import' ? 'Imported item' : 'Local item') + '</th><th class="right">Qty</th><th class="right">Cost value</th><th class="right">Retail value</th></tr></thead><tbody>' +
      list.slice(0, 60).map(i => '<tr><td><div class="cell-stack"><span class="cell-main">' + U.esc(i.name) + '</span>' +
        '<span class="cell-sub">' + U.esc([i.sku, U.titleCase(i.category), i.group].filter(Boolean).join(' · ')) + '</span></div></td>' +
        '<td class="right num">' + U.fmtQty(i.qty) + '</td>' +
        '<td class="right num">' + U.money(i.costValue) + '</td>' +
        '<td class="right num">' + U.money(i.retailValue) + '</td></tr>').join('') +
      '</tbody></table></div>' +
      (list.length > 60 ? '<div class="card-foot hint">Showing the 60 highest-value of ' + list.length + ' ' + block.origin.toLowerCase() + ' items.</div>' : '');
  }

  function originBuyTableHTML(block) {
    if (!block.lines.length) {
      return '<div class="empty-inline">No ' + block.origin.toLowerCase() + ' purchases in ' + U.esc(rangeLabel()) + '.</div>';
    }
    return '<div class="table-wrap"><table class="table compact"><thead><tr><th>Bought in</th><th>Part</th><th>Supplier</th><th class="right">Qty</th><th class="right">Amount</th></tr></thead><tbody>' +
      block.lines.slice(0, 60).map(l => '<tr><td class="nowrap">' + U.fmtDate(l.date, { mode: 'short' }) + '<div class="cell-sub">' + U.esc(l.no) + '</div></td>' +
        '<td><span class="cell-main">' + U.esc(l.name) + '</span><div class="cell-sub">' + U.money(l.unitCost) + ' each</div></td>' +
        '<td>' + U.esc(l.supplier) + '</td>' +
        '<td class="right num">' + U.fmtQty(l.qty) + '</td>' +
        '<td class="right num">' + U.money(l.amount) + '</td></tr>').join('') +
      '</tbody></table></div>' +
      (block.lines.length > 60 ? '<div class="card-foot hint">Showing the latest 60 of ' + block.lines.length + ' lines.</div>' : '');
  }

  function originSideHTML(data, side) {
    const stock = data.stock.filter(b => b.origin === side)[0] || { origin: side, itemCount: 0, inStockItems: 0, qty: 0, costValue: 0, retailValue: 0, items: [] };
    const buys = data.purchases.filter(b => b.origin === side)[0] || { origin: side, billCount: 0, qty: 0, amount: 0, lines: [] };
    const icon = side === 'Import' ? 'globe' : 'home';
    return '<div class="inv-toolbar">' +
      '<div class="segmented" data-origin-side>' +
      '<button class="seg-btn' + (originView.side === 'Local' ? ' active' : '') + '" data-side="Local">' + UI.icon('home', 13) + 'Local</button>' +
      '<button class="seg-btn' + (originView.side === 'Import' ? ' active gold' : '') + '" data-side="Import">' + UI.icon('globe', 13) + 'Import</button></div>' +
      '<span class="spacer"></span><span class="toolbar-label">' + U.esc(side) + ' · ' + stock.itemCount + ' items · ' + U.money(stock.retailValue) + ' at retail</span></div>' +
      '<div class="report-columns">' +
      '<div class="card card-pad"><div class="card-title mb-12">' + UI.icon(icon, 18) + side + ' — stock on hand</div>' +
      reportRow('Items in catalogue', stock.itemCount + ' (' + stock.inStockItems + ' with stock)') +
      reportRow('Total quantity', U.fmtQty(stock.qty)) +
      reportRow('Value at cost', U.money(stock.costValue)) +
      reportRow('Value at retail', '<b>' + U.money(stock.retailValue) + '</b>') +
      reportRow('Margin if all sold', U.money(U.round2(stock.retailValue - stock.costValue)), stock.retailValue - stock.costValue >= 0 ? 'text-success' : 'text-danger') +
      '<div class="divider"></div>' + originStockTableHTML(stock) + '</div>' +
      '<div class="card card-pad"><div class="card-title mb-12">' + UI.icon('truck', 18) + side + ' — what we bought (' + U.esc(rangeLabel()) + ')</div>' +
      reportRow('Purchase lines', String(buys.billCount)) +
      reportRow('Quantity received', U.fmtQty(buys.qty)) +
      reportRow('Paid to suppliers', '<b>' + U.money(buys.amount) + '</b>') +
      '<div class="divider"></div>' + originBuyTableHTML(buys) + '</div>' +
      '</div>';
  }

  function supplierMoneyTotals() {
    const ledger = S().supplierLedger();
    const sum = fn => U.round2(U.sumBy(ledger, fn));
    return {
      bills: sum(r => r.billsTotal),
      credited: sum(r => r.givenCredited),
      payable: sum(r => r.owedToSupplier),
      advanced: sum(r => r.advanceToSupplier),
      withUs: sum(r => r.givenHeldBack),
      bounced: sum(r => r.givenBounced),
      taken: sum(r => r.advanceTaken)
    };
  }

  function supplierMoneyHTML() {
    const m = supplierMoneyTotals();
    const records = S().supplierPaymentsList().slice(0, 8);
    const STATUS_TONE = { withus: 'gold', returned: 'blue', honoured: 'green', dishonoured: 'red', settled: 'grey' };
    return '<div class="report-columns" id="report-supplier-money">' +
      '<div class="card card-pad"><div class="card-title mb-12">' + UI.icon('building', 18) + 'Supplier money</div>' +
      reportRow('All supplier bills (stock + expense)', U.money(m.bills)) +
      reportRow('Cheques &amp; advances handed over', '− ' + U.money(m.credited)) +
      reportRow('Cheques still in your drawer', U.money(m.withUs), m.withUs > 0 ? 'text-gold' : '') +
      reportRow('Dishonoured cheques', m.bounced > 0 ? '<b class="text-danger">' + U.money(m.bounced) + '</b>' : U.money(0)) +
      reportRow('Payable to suppliers now', '<b class="' + (m.payable > 0 ? 'text-danger' : 'text-success') + '">' + U.money(m.payable) + '</b>') +
      reportRow('Advances given (overpaid)', U.money(m.advanced)) +
      reportRow('Advance held from suppliers', U.money(m.taken), 'text-gold') +
      '<div class="divider"></div>' +
      '<div class="hint">A cheque only leaves the payable after you mark it handed under Suppliers → Cheques &amp; advances; a bounced cheque comes back onto the payable.</div>' +
      '</div>' +
      '<div class="card card-pad"><div class="card-title mb-12">' + UI.icon('banknote', 18) + 'Latest supplier records</div>' +
      (records.length
        ? records.map(p => '<div class="report-list-row"><span class="report-list-label"><span class="strong">' + U.esc(p.supplierName) + '</span>' +
          '<span class="cell-sub">' + U.esc(p.kind === 'cheque' ? 'Cheque ' + (p.chequeNo || '') : 'Advance') + ' · ' + U.esc(p.direction === 'to' ? 'we gave' : 'supplier gave') +
          (p.refNo ? ' · ' + U.esc(p.refNo) : '') + '</span></span>' +
          '<span class="report-list-amt"><span class="badge ' + (STATUS_TONE[p.status] || 'grey') + '">' + U.esc(S().constants.SUPPLIER_PAYMENT_STATUS[p.status] || p.status) + '</span> ' + U.money(p.amount) + '</span></div>').join('')
        : '<div class="empty-inline">No supplier cheques or advances recorded yet.</div>') +
      '</div></div>';
  }

  function originHTML() {
    const data = S().originReport(state.from, state.to);
    const side = originView.side === 'Import' ? 'import' : 'local';
    return '<div class="card inventory-card mb-16" id="report-origin"><div class="card-head bordered"><div><div class="card-title">Local &amp; Import</div>' +
      '<div class="card-sub">Click Local or Import — that side’s stock list and purchase list appears below.</div></div>' +
      '<div class="head-actions"><button type="button" class="btn btn-sm" data-print="' + side + '">' + UI.icon('printer', 14) + 'Print ' + U.esc(originView.side) + '</button>' +
      '<button type="button" class="btn btn-sm btn-primary" data-csv="' + side + '">' + UI.icon('download', 14) + U.esc(originView.side) + ' CSV</button></div></div>' +
      originSideHTML(data, originView.side) + '</div>';
  }

  function summaryTabHTML() {
    const s = S().reportsSummary(state.from, state.to);
    return '<div id="report-summary">' + summaryCardsHTML(s) + '</div>' +
      '<div id="report-daybook">' + openingCardsHTML() + '</div>' +
      '<div id="report-sales-profit">' + salesProfitHTML(s) + '</div>' +
      '<div id="report-payments-expense">' + paymentExpenseHTML(s) + '</div>' +
      '<div class="report-columns"><div id="report-tech">' + techHTML() + '</div><div id="report-machine">' + machineHTML() + '</div></div>' +
      '<div class="report-columns"><div id="report-parts">' + topPartsHTML(s) + '</div><div id="report-returns">' + returnsHTML() + '</div></div>' +
      supplierMoneyHTML();
  }

  function localTabHTML() {
    return '<div id="report-origin">' + originHTML() + '</div>';
  }

  const HEADS = {
    summary: { title: 'Reports', subtitle: 'Sales, service, machines, profit, opening balances and every rupee received or spent.' },
    local: { title: 'Local & Import report', subtitle: 'Click Local or Import — that side’s stock on hand and the goods bought in the period, listed apart.' },
    export: { title: 'Export reports', subtitle: 'Print a report on A4 or download it as a CSV file for Excel — one report at a time or the full business report.' }
  };

  function screen() {
    const head = HEADS[state.tab] || HEADS.summary;
    return UI.pageHead({
      eyebrow: 'Money · Reports',
      title: head.title,
      subtitle: head.subtitle,
      actions: ''
    }) +
      tabsHTML() +
      rangeBarHTML() +
      '<div class="report-sheet">' +
      (state.tab === 'local' ? localTabHTML() : state.tab === 'export' ? exportTabHTML() : summaryTabHTML()) +
      '</div>';
  }

  /* ---------------- print ---------------- */
  function originPrintBlocks(origin) {
    return origin.stock.map((stock, idx) => {
      const buys = origin.purchases[idx];
      const label = stock.origin;
      const summary = '<p class="sub"><b>' + U.esc(label) + '</b> — ' + stock.itemCount + ' items · ' + U.esc(U.fmtQty(stock.qty)) +
        ' pieces in stock · ' + U.esc(U.money(stock.costValue)) + ' at cost · ' + U.esc(U.money(stock.retailValue)) + ' at retail · bought ' +
        U.esc(U.money(buys.amount)) + ' in ' + U.esc(rangeLabel()) + ' over ' + buys.billCount + ' lines</p>';
      const stockTable = '<table><thead><tr><th>' + U.esc(label) + ' stock list</th><th class="r">Qty</th><th class="r">Cost value</th><th class="r">Retail value</th></tr></thead><tbody>' +
        (stock.items.length
          ? stock.items.slice(0, 40).map(i => '<tr><td>' + U.esc(i.name) + (i.sku ? ' <span class="sub">' + U.esc(i.sku) + '</span>' : '') + '</td>' +
            '<td class="r">' + U.esc(U.fmtQty(i.qty)) + '</td><td class="r">' + U.esc(U.money(i.costValue)) + '</td><td class="r">' + U.esc(U.money(i.retailValue)) + '</td></tr>').join('')
          : '<tr><td colspan="4">No ' + U.esc(label.toLowerCase()) + ' items in the catalogue.</td></tr>') +
        '</tbody></table>';
      const buyTable = '<table><thead><tr><th>Date</th><th>' + U.esc(label) + ' purchase list</th><th>Supplier</th><th class="r">Qty</th><th class="r">Amount</th></tr></thead><tbody>' +
        (buys.lines.length
          ? buys.lines.slice(0, 40).map(l => '<tr><td>' + U.esc(U.fmtDate(l.date, { mode: 'short' })) + '</td><td>' + U.esc(l.name) +
            ' <span class="sub">' + U.esc(l.no) + '</span></td><td>' + U.esc(l.supplier) + '</td><td class="r">' + U.esc(U.fmtQty(l.qty)) +
            '</td><td class="r">' + U.esc(U.money(l.amount)) + '</td></tr>').join('')
          : '<tr><td colspan="5">No ' + U.esc(label.toLowerCase()) + ' purchases in this period.</td></tr>') +
        '</tbody></table>';
      return summary + stockTable + buyTable;
    }).join('');
  }

  function supplierMoneyPrintBlocks() {
    const m = supplierMoneyTotals();
    const records = S().supplierPaymentsList().slice(0, 30);
    const summary = '<table><thead><tr><th>Supplier money</th><th class="r">Amount</th></tr></thead><tbody>' +
      '<tr><td>All supplier bills (stock + expense)</td><td class="r">' + U.esc(U.money(m.bills)) + '</td></tr>' +
      '<tr><td>Cheques &amp; advances handed over</td><td class="r">− ' + U.esc(U.money(m.credited)) + '</td></tr>' +
      '<tr><td>Cheques still in your drawer</td><td class="r">' + U.esc(U.money(m.withUs)) + '</td></tr>' +
      '<tr><td>Dishonoured cheques</td><td class="r">' + U.esc(U.money(m.bounced)) + '</td></tr>' +
      '<tr><td><b>Payable to suppliers now</b></td><td class="r"><b>' + U.esc(U.money(m.payable)) + '</b></td></tr>' +
      '<tr><td>Advances given (overpaid)</td><td class="r">' + U.esc(U.money(m.advanced)) + '</td></tr>' +
      '<tr><td>Advance held from suppliers</td><td class="r">' + U.esc(U.money(m.taken)) + '</td></tr>' +
      '</tbody></table>' +
      '<p class="sub">A cheque only leaves the payable after it is marked handed over; a bounced cheque comes back onto the payable.</p>';
    const table = '<table><thead><tr><th>Date</th><th>Supplier</th><th>Record</th><th>Direction</th><th>Status</th><th class="r">Amount</th></tr></thead><tbody>' +
      (records.length
        ? records.map(p => '<tr><td>' + U.esc(U.fmtDate(p.date, { mode: 'short' })) + '</td><td>' + U.esc(p.supplierName) + '</td>' +
          '<td>' + U.esc(p.kind === 'cheque' ? 'Cheque ' + (p.chequeNo || '—') : 'Advance') + (p.refNo ? ' <span class="sub">' + U.esc(p.refNo) + '</span>' : '') + '</td>' +
          '<td>' + U.esc(p.direction === 'to' ? 'We gave' : 'Supplier gave') + '</td>' +
          '<td>' + U.esc(S().constants.SUPPLIER_PAYMENT_STATUS[p.status] || p.status) + '</td>' +
          '<td class="r">' + U.esc(U.money(p.amount)) + '</td></tr>').join('')
        : '<tr><td colspan="6">No supplier cheques or advances recorded.</td></tr>') +
      '</tbody></table>';
    return '<h3>Supplier cheques &amp; advances</h3>' + summary + table;
  }

  function dayBookPrintBlock() {
    const day = S().dayBook(state.day);
    return '<h3>Day book · ' + U.esc(U.fmtDate(state.day)) + '</h3><table><thead><tr><th>Cash</th><th>Bank</th></tr></thead><tbody>' +
      '<tr><td>Opening ' + U.esc(U.money(day.opening.cash || 0)) + ' · In ' + U.esc(U.money(day.cashIn)) + ' · Out ' + U.esc(U.money(day.cashOut)) + '</td>' +
      '<td>Opening ' + U.esc(U.money(day.opening.bank || 0)) + ' · In ' + U.esc(U.money(day.bankIn)) + ' · Out ' + U.esc(U.money(day.bankOut)) + '</td></tr>' +
      '<tr><td><b>Closing cash ' + U.esc(U.money(day.closingCash)) + '</b></td><td><b>Closing bank ' + U.esc(U.money(day.closingBank)) + '</b></td></tr>' +
      '<tr><td>Credit given ' + U.esc(U.money(day.creditSales)) + '</td><td>Invoices / service jobs ' + day.invoiceCount + ' / ' + day.serviceCount + '</td></tr>' +
      '</tbody></table>';
  }

  function businessPrintBlocks() {
    const s = S().reportsSummary(state.from, state.to);
    const tech = S().servicesByTechnician(state.from, state.to);
    const machines = S().machineSalesReport(state.from, state.to);
    const returns = S().returnReport(state.from, state.to);
    const partTotals = sumParts(s.partRows);
    return (
      '<div class="grid">' +
      '<div class="box"><span>Net revenue</span><b>' + U.esc(U.money(s.salesNet + s.serviceNet)) + '</b></div>' +
      '<div class="box"><span>Gross profit</span><b>' + U.esc(U.money(s.grossProfit)) + '</b></div>' +
      '<div class="box"><span>Expenses</span><b>' + U.esc(U.money(s.expensesTotal)) + '</b></div>' +
      '<div class="box"><span>Net profit</span><b>' + U.esc(U.money(s.netProfit)) + '</b></div>' +
      '</div>' +
      '<h3>Sales & profit</h3><table><thead><tr><th>Item</th><th class="r">Amount</th></tr></thead><tbody>' +
      '<tr><td>Shop sales (gross)</td><td class="r">' + U.esc(U.money(s.salesGross)) + '</td></tr>' +
      '<tr><td>Shop returns</td><td class="r">' + U.esc(U.money(s.salesReturns)) + '</td></tr>' +
      '<tr><td>Shop sales (net)</td><td class="r">' + U.esc(U.money(s.salesNet)) + '</td></tr>' +
      '<tr><td>Service (gross)</td><td class="r">' + U.esc(U.money(s.serviceGross)) + '</td></tr>' +
      '<tr><td>Service returns</td><td class="r">' + U.esc(U.money(s.serviceReturns)) + '</td></tr>' +
      '<tr><td>Service (net)</td><td class="r">' + U.esc(U.money(s.serviceNet)) + '</td></tr>' +
      '<tr><td>Discounts given</td><td class="r">' + U.esc(U.money(s.discounts)) + '</td></tr>' +
      '<tr><td>Cost of parts sold</td><td class="r">' + U.esc(U.money(s.partsCost)) + '</td></tr>' +
      '<tr><td><b>Gross profit</b></td><td class="r"><b>' + U.esc(U.money(s.grossProfit)) + '</b></td></tr>' +
      '<tr><td><b>Net profit</b></td><td class="r"><b>' + U.esc(U.money(s.netProfit)) + '</b></td></tr>' +
      '</tbody></table>' +
      '<h3>Parts sold & used</h3><table><thead><tr><th>Part</th><th class="r">Shop sale</th><th class="r">Service</th><th class="r">Total qty</th><th class="r">Value</th></tr></thead><tbody>' +
      (s.partRows.length
        ? s.partRows.map(r => '<tr><td>' + U.esc(r.name) + '</td><td class="r">' + U.esc(U.fmtQty(r.saleQty)) + '</td><td class="r">' + U.esc(U.fmtQty(r.serviceQty)) + '</td><td class="r"><b>' + U.esc(U.fmtQty(r.qty)) + '</b></td><td class="r">' + U.esc(U.money(r.revenue)) + '</td></tr>').join('') +
          '<tr><td><b>Total</b></td><td class="r"><b>' + U.esc(U.fmtQty(partTotals.saleQty)) + '</b></td><td class="r"><b>' + U.esc(U.fmtQty(partTotals.serviceQty)) + '</b></td><td class="r"><b>' + U.esc(U.fmtQty(partTotals.qty)) + '</b></td><td class="r"><b>' + U.esc(U.money(partTotals.revenue)) + '</b></td></tr>'
        : '<tr><td colspan="5">No parts sold or used in this period.</td></tr>') +
      '</tbody></table>' +
      '<p class="sub">Shop quantities are net of returns. Values are before bill-level discounts.</p>' +
      '<h3>Receivables & advances</h3><table><thead><tr><th>Item</th><th class="r">Amount</th></tr></thead><tbody>' +
      '<tr><td>Credit sales in period</td><td class="r">' + U.esc(U.money(s.creditSales)) + '</td></tr>' +
      '<tr><td>Collections received</td><td class="r">' + U.esc(U.money(s.collections)) + '</td></tr>' +
      '<tr><td>Advances received</td><td class="r">' + U.esc(U.money(s.advancesReceived)) + '</td></tr>' +
      '<tr><td>Receivables outstanding now</td><td class="r">' + U.esc(U.money(s.receivables)) + '</td></tr>' +
      '<tr><td>Unused advances now</td><td class="r">' + U.esc(U.money(s.advancesBalance)) + '</td></tr>' +
      '<tr><td>Machine units sold</td><td class="r">' + U.esc(U.fmtQty(s.machineUnits)) + '</td></tr>' +
      '</tbody></table>' +
      '<h3>Machines sold</h3><table><thead><tr><th>Machine</th><th>Source</th><th class="r">Qty</th><th class="r">Revenue</th></tr></thead><tbody>' +
      (machines.rows.length ? machines.rows.map(r => '<tr><td>' + U.esc(r.name) + '</td><td>' + U.esc(r.origin) + '</td><td class="r">' + U.esc(U.fmtQty(r.netQty)) + '</td><td class="r">' + U.esc(U.money(r.total)) + '</td></tr>').join('') : '<tr><td colspan="4">No machines sold in this period.</td></tr>') +
      '</tbody></table>' +
      '<h3>Service by technician</h3><table><thead><tr><th>Technician</th><th class="r">Jobs</th><th class="r">Labour</th><th class="r">Parts</th><th class="r">Total</th><th class="r">Due</th></tr></thead><tbody>' +
      (tech.rows.length ? tech.rows.map(r => '<tr><td>' + U.esc(r.name) + '</td><td class="r">' + r.jobs + '</td><td class="r">' + U.esc(U.money(r.labour)) + '</td><td class="r">' + U.esc(U.money(r.parts)) + '</td><td class="r">' + U.esc(U.money(r.total)) + '</td><td class="r">' + U.esc(U.money(r.due)) + '</td></tr>').join('') : '<tr><td colspan="6">No service jobs in this period.</td></tr>') +
      '</tbody></table>' +
      '<h3>Expenses by category</h3><table><thead><tr><th>Category</th><th class="r">Amount</th></tr></thead><tbody>' +
      s.expenseByCategory.map(c => '<tr><td>' + U.esc(c.label) + '</td><td class="r">' + U.esc(U.money(c.amount)) + '</td></tr>').join('') +
      '<tr><td><b>Total</b></td><td class="r"><b>' + U.esc(U.money(s.expensesTotal)) + '</b></td></tr>' +
      '</tbody></table>' +
      dayBookPrintBlock() +
      '<h3>Returns</h3><table><thead><tr><th>Return</th><th>Reference</th><th>Customer</th><th class="r">Amount</th><th class="r">Refunded</th></tr></thead><tbody>' +
      (returns.rows.length ? returns.rows.slice(0, 20).map(r => '<tr><td>' + U.esc(r.no) + '</td><td>' + U.esc(r.refNo) + '</td><td>' + U.esc(r.customerName || 'Walk-in') + '</td><td class="r">' + U.esc(U.money(r.amount)) + '</td><td class="r">' + U.esc(U.money(r.refund)) + '</td></tr>').join('') : '<tr><td colspan="5">No returns in this period.</td></tr>') +
      '</tbody></table>');
  }

  function originSideBlocks(origin, side) {
    const stock = origin.stock.filter(b => b.origin === side);
    const buys = origin.purchases.filter(b => b.origin === side);
    return '<h3>' + U.esc(side) + ' stock &amp; purchases</h3>' + originPrintBlocks({ stock: stock, purchases: buys });
  }

  function printReportFor(key) {
    const origin = S().originReport(state.from, state.to);
    const content = key === 'local' ? originSideBlocks(origin, 'Local')
      : key === 'import' ? originSideBlocks(origin, 'Import')
      : key === 'supplier' ? supplierMoneyPrintBlocks()
      : key === 'daybook' ? dayBookPrintBlock()
      : businessPrintBlocks() + supplierMoneyPrintBlocks() + '<h3>Local &amp; Import</h3>' + originPrintBlocks(origin);
    UI.printDocument({
      title: EXPORT_LABELS[key] || 'Business report',
      meta: '<span><b>Shop:</b> ' + U.esc(S().data.settings.shopName) + '</span>' +
        (key === 'daybook' ? '<span><b>Day:</b> ' + U.esc(U.fmtDate(state.day)) + '</span>'
          : '<span><b>Period:</b> ' + U.esc(rangeLabel()) + '</span>') +
        '<span><b>Generated:</b> ' + U.esc(U.fmtDateTime(U.nowStamp())) + '</span>',
      content
    });
    UI.toast('Print window opened.');
  }

  function businessCsvRows() {
    const s = S().reportsSummary(state.from, state.to);
    const tech = S().servicesByTechnician(state.from, state.to);
    const machines = S().machineSalesReport(state.from, state.to);
    const partTotals = sumParts(s.partRows);
    return [
      ['Summary'],
      ['Shop sales gross', s.salesGross], ['Shop returns', s.salesReturns], ['Shop sales net', s.salesNet],
      ['Service gross', s.serviceGross], ['Service returns', s.serviceReturns], ['Service net', s.serviceNet],
      ['Discounts', s.discounts], ['Cost of parts sold', s.partsCost], ['Gross profit', s.grossProfit],
      ['Expenses', s.expensesTotal], ['Net profit', s.netProfit],
      ['Credit sales', s.creditSales], ['Collections', s.collections], ['Advances received', s.advancesReceived],
      ['Receivables outstanding', s.receivables], ['Unused advances', s.advancesBalance],
      ['Machine units sold', s.machineUnits], ['Invoices', s.invoiceCount], ['Service jobs', s.serviceCount], ['Returns', s.returnsCount],
      [],
      ['Payments by method'],
      ['Cash', s.receivedByMethod.cash], ['Card', s.receivedByMethod.card], ['Online', s.receivedByMethod.online], ['Cheque', s.receivedByMethod.cheque],
      [],
      ['Expenses by category']
    ].concat(s.expenseByCategory.map(c => [c.label, c.amount]))
      .concat([
        [],
        ['Parts sold & used'],
        ['Part', 'Shop sale qty', 'Service qty', 'Total qty', 'Value']
      ])
      .concat(s.partRows.map(r => [r.name, r.saleQty, r.serviceQty, r.qty, r.revenue]))
      .concat([
        ['Total', partTotals.saleQty, partTotals.serviceQty, partTotals.qty, partTotals.revenue],
        [],
        ['Service by technician'],
        ['Technician', 'Jobs', 'Labour', 'Parts', 'Total', 'Due']
      ])
      .concat(tech.rows.map(r => [r.name, r.jobs, r.labour, r.parts, r.total, r.due]))
      .concat([
        [],
        ['Machines sold'],
        ['Invoice', 'Date', 'Machine', 'Source', 'Qty', 'Net qty', 'Revenue']
      ])
      .concat(machines.rows.map(r => [r.invoiceNo, r.date, r.name, r.origin, r.qty, r.netQty, r.total]));
  }

  function originCsvRows(side) {
    const all = S().originReport(state.from, state.to);
    const originData = side
      ? { stock: all.stock.filter(b => b.origin === side), purchases: all.purchases.filter(b => b.origin === side) }
      : all;
    const label = side || 'Local & Import';
    return [
      [label + ' — stock on hand'],
      ['Origin', 'Items', 'Items in stock', 'Quantity', 'Cost value', 'Retail value']
    ]
      .concat(originData.stock.map(b => [b.origin, b.itemCount, b.inStockItems, b.qty, b.costValue, b.retailValue]))
      .concat([
        [],
        ['Local & Import — purchases in period'],
        ['Origin', 'Purchase lines', 'Quantity', 'Amount']
      ])
      .concat(originData.purchases.map(b => [b.origin, b.billCount, b.qty, b.amount]))
      .concat(originData.stock.flatMap(b => [
        [],
        [b.origin + ' stock list'],
        ['Item', 'SKU', 'Category', 'Group', 'Qty', 'Cost value', 'Retail value']
      ].concat(b.items.map(i => [i.name, i.sku, i.category, i.group, i.qty, i.costValue, i.retailValue]))))
      .concat(originData.purchases.flatMap(b => [
        [],
        [b.origin + ' purchase list · ' + rangeLabel()],
        ['Date', 'Bill', 'Supplier', 'Item', 'Qty', 'Unit cost', 'Amount']
      ].concat(b.lines.map(l => [l.date, l.no, l.supplier, l.name, l.qty, l.unitCost, l.amount]))));
  }

  function supplierCsvRows() {
    const money = supplierMoneyTotals();
    return [
      ['Supplier cheques & advances'],
        ['All supplier bills', money.bills],
        ['Cheques & advances handed over', money.credited],
        ['Cheques still in your drawer', money.withUs],
        ['Dishonoured cheques', money.bounced],
        ['Payable to suppliers now', money.payable],
        ['Advances given', money.advanced],
        ['Advance held from suppliers', money.taken],
      [],
      ['Date', 'Supplier', 'Kind', 'Direction', 'Status', 'Cheque no', 'Bank', 'Cheque date', 'Reference', 'Amount']
    ]
      .concat(S().supplierPaymentsList().map(p => [p.date, p.supplierName, p.kind, p.direction, p.status, p.chequeNo, p.bank, p.chequeDate, p.refNo, p.amount]));
  }

  function dayBookCsvRows() {
    const day = S().dayBook(state.day);
    return [
      ['Day book · ' + U.fmtDate(state.day)],
      ['Cash opening', U.round2(day.opening.cash || 0)], ['Cash in', day.cashIn], ['Cash out', day.cashOut], ['Cash closing', day.closingCash],
      ['Bank opening', U.round2(day.opening.bank || 0)], ['Bank in', day.bankIn], ['Bank out', day.bankOut], ['Bank closing', day.closingBank],
      ['Credit given', day.creditSales],
      ['Invoices', day.invoiceCount], ['Service jobs', day.serviceCount],
      ['Expense lines', day.expenses.length], ['Return documents', day.returns.length]
    ];
  }

  function exportCsvFor(key) {
    const body = key === 'local' ? originCsvRows('Local')
      : key === 'import' ? originCsvRows('Import')
      : key === 'supplier' ? supplierCsvRows()
      : key === 'daybook' ? dayBookCsvRows()
      : businessCsvRows().concat(originCsvRows()).concat(supplierCsvRows()).concat(dayBookCsvRows());
    const rows = [
      ['Wijaya Pattalaya — ' + (EXPORT_LABELS[key] || 'Business report')],
      key === 'daybook' ? ['Day', U.fmtDate(state.day)] : ['Period', rangeLabel()],
      ['Generated', U.fmtDateTime(U.nowStamp())],
      []
    ].concat(body);
    const stamp = key === 'daybook' ? state.day : (state.from || 'all') + '-to-' + (state.to || 'today');
    U.downloadFile('wijaya-' + key + '-report-' + stamp + '.csv', U.toCSV(rows), 'text/csv;charset=utf-8');
    UI.toast((EXPORT_LABELS[key] || 'Report') + ' downloaded.');
  }

  V.reports = {
    render(route) {
      const sub = route && route.sub;
      state.tab = sub === 'local' || sub === 'export' ? sub : 'summary';
      return screen();
    },
    mount(content) {
      const scope = content.querySelector('#view-root') || content;
      scope.addEventListener('click', async e => {
        const side = e.target.closest('[data-origin-side] [data-side]');
        if (side) {
          originView.side = side.dataset.side === 'Import' ? 'Import' : 'Local';
          APP().renderRoute(true);
          return;
        }
        const preset = e.target.closest('[data-preset]');
        if (preset) {
          const range = presetRange(preset.dataset.preset);
          state.from = range.from;
          state.to = range.to;
          state.preset = preset.dataset.preset;
          APP().renderRoute(true);
          return;
        }
        if (e.target.closest('[data-apply-range]')) {
          const from = scope.querySelector('#rep-from').value;
          const to = scope.querySelector('#rep-to').value;
          if (from && to && from > to) { UI.toast('The start date must be before the end date.', 'error'); return; }
          state.from = from;
          state.to = to;
          state.preset = 'custom';
          APP().renderRoute(true);
          return;
        }
        if (e.target.closest('[data-save-opening]')) {
          const cash = scope.querySelector('#opening-cash').value;
          const bank = scope.querySelector('#opening-bank').value;
          const note = scope.querySelector('#opening-note').value;
          try {
            await S().saveOpening(state.day, { cash, bank, note });
            UI.toast('Opening balance saved for ' + U.fmtDate(state.day) + '.');
            APP().renderRoute(true);
          } catch (err) { UI.toast(err.userMessage || err.message || 'Could not save opening balance.', 'error'); }
          return;
        }
        const printBtn = e.target.closest('[data-print]');
        if (printBtn) { printReportFor(printBtn.dataset.print); return; }
        const csvBtn = e.target.closest('[data-csv]');
        if (csvBtn) { exportCsvFor(csvBtn.dataset.csv); }
      });
      scope.addEventListener('change', e => {
        if (e.target.id === 'opening-date') {
          if (!e.target.value) { e.target.value = state.day; return; }
          state.day = e.target.value;
          APP().renderRoute(true);
        }
      });
    },
    refresh() {
      APP().renderRoute(true);
    }
  };
})();
