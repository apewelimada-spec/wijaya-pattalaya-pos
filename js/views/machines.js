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

  const machineState = { q: '', origin: 'all', stock: 'all' };
  const salesState = { q: '', origin: 'all' };

  function machinesList() {
    return S().activeItems().filter(i => i.category === 'machine');
  }

  function filteredMachines() {
    const q = machineState.q.trim().toLowerCase();
    return U.sortBy(machinesList().filter(item => {
      if (machineState.origin !== 'all' && item.origin !== machineState.origin) return false;
      const qty = Number(item.qty) || 0;
      if (machineState.stock === 'in' && qty <= 0.0001) return false;
      if (machineState.stock === 'out' && qty > 0.0001) return false;
      if (q) {
        const hay = (item.name + ' ' + (item.sku || '') + ' ' + (item.brand || '') + ' ' + (item.compatible || '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }), item => item.name.toLowerCase(), 'asc');
  }

  function machineStatsHTML() {
    const list = machinesList();
    const units = U.sumBy(list, i => i.qty);
    const costValue = U.sumBy(list, i => Number(i.qty) * Number(i.cost));
    const retailValue = U.sumBy(list, i => Number(i.qty) * Number(i.retail));
    const allSales = S().machineSalesReport('', '');
    const monthSales = S().machineSalesReport(U.monthStartISO(), U.todayISO());
    return '<div class="parts-stat-grid">' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Machines in stock</span><span class="stat-icon green">' + UI.icon('truck', 16) + '</span></div>' +
      '<div class="stat-value">' + U.fmtQty(units) + '</div><div class="stat-meta"><b>' + list.length + '</b> model' + (list.length === 1 ? '' : 's') + ' · <b>' + U.moneyShort(retailValue) + '</b> retail value</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Sold this month</span><span class="stat-icon gold">' + UI.icon('chart', 16) + '</span></div>' +
      '<div class="stat-value">' + U.fmtQty(monthSales.unitsNet) + '</div><div class="stat-meta">' + U.money(monthSales.revenue) + ' revenue · ' + U.esc(U.monthLabel(U.monthKey(U.todayISO()))) + '</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Sold all time</span><span class="stat-icon blue">' + UI.icon('checkCircle', 16) + '</span></div>' +
      '<div class="stat-value">' + U.fmtQty(allSales.unitsNet) + '</div><div class="stat-meta"><b>' + U.fmtQty(allSales.importUnits) + '</b> imported · <b>' + U.fmtQty(allSales.localUnits) + '</b> local</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Stock at cost</span><span class="stat-icon gold">' + UI.icon('coins', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(costValue) + '</div><div class="stat-meta">Capital tied up in machines</div></div>' +
      '</div>';
  }

  function machineCard(item) {
    const qty = Number(item.qty) || 0;
    const sold = S().machineSoldAllForItem(item.id);
    const cost = Number(item.cost) || 0;
    const retail = Number(item.retail) || 0;
    const margin = retail > 0 ? ((retail - cost) / retail) * 100 : 0;
    const stockBadge = qty > 0.0001
      ? '<span class="badge green">' + U.fmtQty(qty) + ' in stock</span>'
      : '<span class="badge red">Sold out</span>';
    return '<article class="card machine-card">' +
      '<div class="machine-top">' +
      '<div class="machine-badges"><span class="badge ' + (item.origin === 'Local' ? 'green' : 'gold') + '">' + U.esc(item.origin || 'Import') + '</span>' + stockBadge + '</div>' +
      '<div class="machine-icon">' + UI.icon('tractor', 23) + '</div>' +
      '<div class="machine-name">' + U.esc(item.name) + '</div>' +
      '<div class="machine-brand">' + U.esc(item.brand || 'No brand') + (item.compatible ? ' · ' + U.esc(item.compatible) : '') + '</div>' +
      '</div>' +
      '<div class="machine-body">' +
      '<div class="machine-figures">' +
      '<div class="machine-figure"><span>Cost price</span><b>' + U.money(item.cost) + '</b></div>' +
      '<div class="machine-figure"><span>Selling price</span><b>' + U.money(item.retail) + '</b></div>' +
      '<div class="machine-figure"><span>Wholesale</span><b>' + U.money(item.wholesale) + '</b></div>' +
      '<div class="machine-figure"><span>Sold all time</span><b>' + U.fmtQty(sold) + '</b></div>' +
      '</div>' +
      '<div class="hint mt-8">Margin <b>' + U.fmtNumber(margin, 1) + '%</b> · SKU ' + U.esc(item.sku || '—') + '</div>' +
      '</div>' +
      '<div class="machine-foot">' +
      (qty > 0.0001
        ? '<button type="button" class="btn btn-sm btn-primary" data-sell-machine="' + item.id + '">' + UI.icon('cart', 14) + 'Sell</button>'
        : '<span class="hint">Receive stock to sell</span>') +
      '<div class="row-actions">' +
      (adminMode()
        ? '<button type="button" class="icon-btn" data-receive="' + item.id + '" title="Receive stock">' + UI.icon('download', 15) + '</button>' +
          '<button type="button" class="icon-btn" data-edit-machine="' + item.id + '" title="Edit machine">' + UI.icon('edit', 15) + '</button>' +
          '<button type="button" class="icon-btn danger" data-archive-machine="' + item.id + '" title="Remove machine">' + UI.icon('trash', 15) + '</button>'
        : '') +
      '</div></div></article>';
  }

  function machineGridHTML(rows) {
    if (!rows.length) {
      const none = machinesList().length === 0;
      return '<div class="card">' + UI.emptyState({
        icon: 'truck',
        title: none ? (adminMode() ? 'No machines stocked yet' : 'No machines in stock') : 'No machines match these filters',
        text: none
          ? (adminMode() ? 'Add tractors and machines with import/local source, cost price and selling price. Sales are tracked separately from spare parts.' : 'The shop admin has not added any machines yet. Ask the admin before selling one.')
          : 'Try clearing the search or filters.',
        action: none && adminMode() ? '<button class="btn btn-primary" data-add-machine>' + UI.icon('plus', 14) + 'Add machine</button>' : ''
      }) + '</div>';
    }
    return '<div class="machine-grid">' + rows.map(machineCard).join('') + '</div>';
  }

  function machinesScreen() {
    return UI.pageHead({
      eyebrow: 'Catalogue · Heavy stock',
      title: 'Machines & tractors',
      subtitle: 'Import and local stock, cost and selling prices, and how many units have been sold.',
      actions: '<a class="btn" href="#/machines/sales">' + UI.icon('chart', 15) + 'Sales history</a>' +
        (adminMode() ? '<button class="btn btn-primary" data-add-machine>' + UI.icon('plus', 15) + 'Add machine</button>' : '')
    }) +
      '<nav class="tabs"><a class="tab active" href="#/machines">Stock</a><a class="tab" href="#/machines/sales">Sales history</a></nav>' +
      '<div id="machine-stats">' + machineStatsHTML() + '</div>' +
      '<div class="card mb-16"><div class="inv-toolbar">' +
      '<div class="search-box" style="max-width:310px">' + UI.icon('search', 16) + '<input class="input" id="machine-search" placeholder="Search model, brand or SKU…" value="' + U.attr(machineState.q) + '"></div>' +
      '<select class="select sm" id="machine-origin" style="width:140px">' + UI.option('all', 'All sources', machineState.origin) + UI.option('Import', 'Import', machineState.origin) + UI.option('Local', 'Local', machineState.origin) + '</select>' +
      '<select class="select sm" id="machine-stock" style="width:150px">' + UI.option('all', 'All stock', machineState.stock) + UI.option('in', 'In stock', machineState.stock) + UI.option('out', 'Sold out', machineState.stock) + '</select>' +
      '<span class="spacer"></span><span class="toolbar-label" id="machine-count"></span></div></div>' +
      '<div id="machine-grid">' + machineGridHTML(filteredMachines()) + '</div>';
  }

  /* ---------------- machine sales history ---------------- */
  function salesRows() {
    const all = S().machineSalesReport('', '');
    const q = salesState.q.trim().toLowerCase();
    return all.rows.filter(r => {
      if (salesState.origin !== 'all' && r.origin !== salesState.origin) return false;
      if (q) {
        const hay = (r.invoiceNo + ' ' + r.name + ' ' + (r.customer || '') + ' ' + (r.sku || '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function salesStatsHTML(rows) {
    const units = U.sumBy(rows, r => r.netQty);
    const revenue = U.sumBy(rows, r => r.total);
    const cost = U.sumBy(rows, r => r.cost);
    const profit = U.round2(revenue - cost);
    return '<div class="parts-stat-grid">' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Net units sold</span><span class="stat-icon green">' + UI.icon('truck', 16) + '</span></div>' +
      '<div class="stat-value">' + U.fmtQty(units) + '</div><div class="stat-meta">After machine returns</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Machine revenue</span><span class="stat-icon gold">' + UI.icon('banknote', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(revenue) + '</div><div class="stat-meta">Selling value at invoice</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Cost of machines sold</span><span class="stat-icon blue">' + UI.icon('box', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(cost) + '</div><div class="stat-meta">At recorded cost price</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Machine gross profit</span><span class="stat-icon green">' + UI.icon('chart', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(profit) + '</div><div class="stat-meta">Revenue minus cost</div></div>' +
      '</div>';
  }

  function salesTableHTML(rows) {
    if (!rows.length) {
      return '<div class="card-body">' + UI.emptyState({
        icon: 'chart', title: 'No machine sales found',
        text: 'Sell a machine through New sale and each unit will be counted here, including import/local source.'
      }) + '</div>';
    }
    const body = rows.slice(0, 300).map(r =>
      '<tr class="row-click" data-invoice-row="' + r.invoiceId + '">' +
      '<td><div class="cell-stack"><span class="cell-main">' + U.esc(r.name) + '</span><span class="cell-sub">' + U.esc(r.sku || '') + ' · ' + U.esc(r.origin) + '</span></div></td>' +
      '<td>' + U.esc(U.fmtDate(r.date, { mode: 'short' })) + '</td>' +
      '<td><span class="mono">' + U.esc(r.invoiceNo) + '</span><div class="cell-sub">' + U.esc(r.customer || 'Walk-in') + '</div></td>' +
      '<td class="right num">' + U.fmtQty(r.qty) + (r.returnedQty > 0 ? '<div class="cell-sub">−' + U.fmtQty(r.returnedQty) + ' returned</div>' : '') + '</td>' +
      '<td class="right num">' + U.money(r.price) + '</td>' +
      '<td class="right num">' + U.money(r.total) + '</td>' +
      '<td class="right num">' + U.money(r.cost) + '</td>' +
      '<td>' + UI.statusBadge(r.status) + '</td></tr>'
    ).join('');
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Machine</th><th>Date</th><th>Invoice / customer</th><th class="right">Qty sold</th><th class="right">Unit price</th><th class="right">Revenue</th><th class="right">Cost</th><th>Status</th></tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<div class="card-foot flex-between"><span class="hint">Showing ' + Math.min(rows.length, 300) + ' of ' + rows.length + ' line' + (rows.length === 1 ? '' : 's') + '</span>' +
      '<button class="link-btn" data-export-machine-sales>' + UI.icon('download', 13) + 'Export CSV</button></div>';
  }

  function salesScreen() {
    const rows = salesRows();
    return UI.pageHead({
      eyebrow: 'Catalogue · Machines sold',
      title: 'Machine sales history',
      subtitle: 'Every tractor and machine sold, with source, cost and profit.',
      actions: '<a class="btn" href="#/machines">' + UI.icon('arrowLeft', 15) + 'Back to stock</a>' +
        '<a class="btn btn-primary" href="#/billing/new">' + UI.icon('plus', 15) + 'New sale</a>'
    }) +
      '<nav class="tabs"><a class="tab" href="#/machines">Stock</a><a class="tab active" href="#/machines/sales">Sales history</a></nav>' +
      '<div id="machine-sales-stats">' + salesStatsHTML(rows) + '</div>' +
      '<div class="card inventory-card"><div class="inv-toolbar">' +
      '<div class="search-box" style="max-width:330px">' + UI.icon('search', 16) + '<input class="input" id="machine-sales-search" placeholder="Search machine, invoice or customer…" value="' + U.attr(salesState.q) + '"></div>' +
      '<select class="select sm" id="machine-sales-origin" style="width:140px">' + UI.option('all', 'All sources', salesState.origin) + UI.option('Import', 'Import', salesState.origin) + UI.option('Local', 'Local', salesState.origin) + '</select>' +
      '<span class="spacer"></span><span class="toolbar-label" id="machine-sales-count">' + rows.length + ' lines</span></div>' +
      '<div id="machine-sales-table">' + salesTableHTML(rows) + '</div></div>';
  }

  function exportSales(rows) {
    if (!rows.length) { UI.toast('No machine sales to export.', 'info'); return; }
    const data = [['Date', 'Invoice', 'Customer', 'Machine', 'SKU', 'Source', 'Qty', 'Returned', 'Net qty', 'Unit price', 'Revenue', 'Cost', 'Paid status']]
      .concat(rows.map(r => [r.date, r.invoiceNo, r.customer, r.name, r.sku, r.origin, r.qty, r.returnedQty, r.netQty, r.price, r.total, r.cost, S().statusLabel(r.status)]));
    U.downloadFile('wijaya-machine-sales.csv', U.toCSV(data), 'text/csv;charset=utf-8');
    UI.toast('Machine sales exported.');
  }

  V.machines = {
    render(route) {
      return route && route.sub === 'sales' ? salesScreen() : machinesScreen();
    },
    mount(content, route) {
      const scope = content.querySelector('#view-root') || content;
      if (route && route.sub === 'sales') {
        const search = scope.querySelector('#machine-sales-search');
        const origin = scope.querySelector('#machine-sales-origin');
        function paintSales() {
          const rows = salesRows();
          const stats = scope.querySelector('#machine-sales-stats');
          const table = scope.querySelector('#machine-sales-table');
          const count = scope.querySelector('#machine-sales-count');
          if (stats) stats.innerHTML = salesStatsHTML(rows);
          if (table) table.innerHTML = salesTableHTML(rows);
          if (count) count.textContent = rows.length + ' lines';
        }
        if (search) search.addEventListener('input', U.debounce(() => { salesState.q = search.value; paintSales(); }, 160));
        if (origin) origin.addEventListener('change', () => { salesState.origin = origin.value; paintSales(); });
        scope.addEventListener('click', e => {
          if (e.target.closest('[data-export-machine-sales]')) { exportSales(salesRows()); return; }
          const row = e.target.closest('[data-invoice-row]');
          if (row) C.invoiceDetailModal(Number(row.dataset.invoiceRow));
        });
        return;
      }

      const search = scope.querySelector('#machine-search');
      const origin = scope.querySelector('#machine-origin');
      const stock = scope.querySelector('#machine-stock');
      function paintMachines() {
        const rows = filteredMachines();
        const grid = scope.querySelector('#machine-grid');
        const count = scope.querySelector('#machine-count');
        if (grid) grid.innerHTML = machineGridHTML(rows);
        if (count) count.textContent = rows.length + ' of ' + machinesList().length + ' machines';
      }
      if (search) search.addEventListener('input', U.debounce(() => { machineState.q = search.value; paintMachines(); }, 160));
      if (origin) origin.addEventListener('change', () => { machineState.origin = origin.value; paintMachines(); });
      if (stock) stock.addEventListener('change', () => { machineState.stock = stock.value; paintMachines(); });

      scope.addEventListener('click', async e => {
        if (e.target.closest('[data-add-machine]')) {
          if (adminMode()) C.itemModal({ category: 'machine' });
          return;
        }
        const sell = e.target.closest('[data-sell-machine]');
        if (sell) {
          const item = S().itemById(Number(sell.dataset.sellMachine));
          if (!item || Number(item.qty) <= 0) { UI.toast('That machine is out of stock.', 'info'); return; }
          APP().prefillItem(item.id);
          return;
        }
        const receive = e.target.closest('[data-receive]');
        if (receive) {
          if (adminMode()) C.receiveStockModal(Number(receive.dataset.receive));
          return;
        }
        const edit = e.target.closest('[data-edit-machine]');
        if (edit) {
          if (adminMode()) C.itemModal({ category: 'machine', item: S().itemById(Number(edit.dataset.editMachine)) });
          return;
        }
        const archive = e.target.closest('[data-archive-machine]');
        if (archive && adminMode()) {
          const item = S().itemById(Number(archive.dataset.archiveMachine));
          if (item) await C.confirmArchiveItem(item);
        }
      });
      paintMachines();
    },
    refresh() {
      APP().renderRoute(true);
    }
  };
})();
