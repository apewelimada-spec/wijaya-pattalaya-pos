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

  const invState = { q: '', group: 'all', stock: 'all' };
  const moveState = { q: '', type: 'all' };

  const MOVE_META = {
    opening: { label: 'Opening stock', badge: 'blue' },
    purchase: { label: 'Stock received', badge: 'green' },
    sale: { label: 'Sale', badge: 'gold' },
    service: { label: 'Service use', badge: 'gold' },
    return: { label: 'Return', badge: 'green' },
    adjust: { label: 'Adjustment', badge: 'grey' }
  };

  function partsList() {
    return S().activeItems().filter(i => i.category === 'part');
  }

  function filteredParts() {
    const q = invState.q.trim().toLowerCase();
    return U.sortBy(partsList().filter(item => {
      if (invState.group !== 'all' && item.group !== invState.group) return false;
      const qty = Number(item.qty) || 0;
      const reorder = Number(item.reorder) || 0;
      if (invState.stock === 'low' && qty > reorder) return false;
      if (invState.stock === 'out' && qty > 0.0001) return false;
      if (invState.stock === 'in' && qty <= 0.0001) return false;
      if (q) {
        const hay = (item.name + ' ' + (item.sku || '') + ' ' + (item.brand || '') + ' ' + (item.compatible || '') + ' ' + (item.group || '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }), item => item.name.toLowerCase(), 'asc');
  }

  function invStatsHTML() {
    const parts = partsList();
    const units = U.sumBy(parts, i => i.qty);
    const costValue = U.sumBy(parts, i => Number(i.qty) * Number(i.cost));
    const retailValue = U.sumBy(parts, i => Number(i.qty) * Number(i.retail));
    const low = S().lowStockItems();
    return '<div class="parts-stat-grid">' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Spare part lines</span><span class="stat-icon green">' + UI.icon('box', 16) + '</span></div>' +
      '<div class="stat-value">' + parts.length + '</div><div class="stat-meta"><b>' + U.fmtQty(units) + '</b> units on hand</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Stock at cost</span><span class="stat-icon gold">' + UI.icon('coins', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(costValue) + '</div><div class="stat-meta">Money currently in inventory</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Stock at retail</span><span class="stat-icon blue">' + UI.icon('chart', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(retailValue) + '</div><div class="stat-meta">Expected sales value</div></div>' +
      '<div class="stat-card' + (low.length ? ' accent' : '') + '"><div class="stat-top"><span class="stat-label">Need restocking</span><span class="stat-icon danger">' + UI.icon('alert', 16) + '</span></div>' +
      '<div class="stat-value">' + low.length + '</div><div class="stat-meta">' + (low.length ? '<b>' + low.slice(0, 2).map(i => i.name).join(', ') + '</b>' : 'All above reorder level') + '</div></div>' +
      '</div>';
  }

  function stockCell(item) {
    const qty = Number(item.qty) || 0;
    const reorder = Number(item.reorder) || 0;
    const state = qty <= 0.0001 ? 'out' : qty <= reorder ? 'low' : 'ok';
    const label = state === 'out' ? 'Out of stock' : qty <= reorder ? 'Low stock' : 'In stock';
    const width = U.clamp((qty / Math.max(reorder * 3, 1)) * 100, 2, 100);
    return '<div class="stock ' + state + '"><span class="dot"></span>' + U.fmtQty(qty) + '</div>' +
      '<div class="stock-bar ' + (state === 'ok' ? '' : state) + '"><i style="width:' + width + '%"></i></div>' +
      '<div class="cell-sub">' + label + (reorder > 0 ? ' · alert at ' + U.fmtQty(reorder) : '') + '</div>';
  }

  function invTableHTML(rows) {
    if (!rows.length) {
      const noParts = partsList().length === 0;
      return '<div class="card-body">' + UI.emptyState({
        icon: 'box',
        title: noParts ? (adminMode() ? 'Add your first spare part' : 'No spare parts on the shelf') : 'No parts match these filters',
        text: noParts
          ? (adminMode() ? 'Keep stock, cost and selling prices in one catalogue. Billing and service will pick parts straight from here.' : 'The shop admin has not added any stock yet. Ask the admin before billing a sale.')
          : 'Try clearing the search, group or stock filter.',
        action: noParts && adminMode() ? '<button class="btn btn-primary" data-add-part>' + UI.icon('plus', 14) + 'Add spare part</button>' : ''
      }) + '</div>';
    }
    const body = rows.map(item => {
      const low = Number(item.qty) <= Number(item.reorder || 0);
      return '<tr class="' + (low ? '' : '') + '">' +
        '<td><div class="item-name-cell"><span class="item-thumb">' + U.esc(U.initials(item.name)) + '</span>' +
        '<div><div class="item-name-main">' + U.esc(item.name) + '</div><div class="item-name-sub">' + U.esc(item.sku || '') + (item.brand ? ' · ' + U.esc(item.brand) : '') + '</div></div></div></td>' +
        '<td><span class="group-tag">' + U.esc(item.group || 'Other') + '</span></td>' +
        '<td><div class="compat" title="' + U.attr(item.compatible || '') + '">' + U.esc(item.compatible || '—') + '</div></td>' +
        '<td style="min-width:94px">' + stockCell(item) + '</td>' +
        '<td class="right num">' + U.money(item.cost) + '</td>' +
        '<td class="right num">' + U.money(item.retail) + '</td>' +
        '<td class="right num">' + U.money(item.wholesale) + '</td>' +
        '<td class="right num">' + U.money(Number(item.qty) * Number(item.cost)) + '</td>' +
        '<td><div class="row-actions">' +
        (adminMode()
          ? '<button type="button" class="icon-btn" data-receive="' + item.id + '" title="Receive stock">' + UI.icon('download', 15) + '</button>' +
            '<button type="button" class="icon-btn" data-adjust="' + item.id + '" title="Adjust stock count">' + UI.icon('refresh', 15) + '</button>' +
            '<button type="button" class="icon-btn" data-edit-item="' + item.id + '" title="Edit part">' + UI.icon('edit', 15) + '</button>' +
            '<button type="button" class="icon-btn danger" data-archive-item="' + item.id + '" title="Remove part">' + UI.icon('trash', 15) + '</button>'
          : '') +
        '</div></td></tr>';
    }).join('');
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Part</th><th>Group</th><th>Fits</th><th>Stock</th><th class="right">Cost</th><th class="right">Retail</th><th class="right">Wholesale</th><th class="right">Stock value</th><th></th></tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<div class="card-foot flex-between"><span class="hint">Showing ' + rows.length + ' part' + (rows.length === 1 ? '' : 's') + '</span><span class="hint">Stock value is cost × quantity</span></div>';
  }

  function invScreen() {
    const groups = S().constants.PART_GROUPS;
    return UI.pageHead({
      eyebrow: 'Catalogue · Inventory',
      title: 'Spare parts',
      subtitle: 'Stock, cost and selling prices for every part on the shelf.',
      actions: '<a class="btn" href="#/parts/moves">' + UI.icon('list', 15) + 'Stock movements</a>' +
        (adminMode() ? '<button class="btn btn-primary" data-add-part>' + UI.icon('plus', 15) + 'Add part</button>' : '')
    }) +
      '<nav class="tabs"><a class="tab active" href="#/parts">Inventory</a><a class="tab" href="#/parts/moves">Stock movements</a></nav>' +
      invStatsHTML() +
      '<div class="card inventory-card"><div class="inv-toolbar">' +
      '<div class="search-box" style="max-width:310px">' + UI.icon('search', 16) + '<input class="input" id="parts-search" placeholder="Search name, SKU, brand, model…" value="' + U.attr(invState.q) + '"></div>' +
      '<select class="select sm" id="parts-group" style="width:150px">' + UI.option('all', 'All groups', invState.group) +
      groups.map(g => UI.option(g, g, invState.group)).join('') + '</select>' +
      '<select class="select sm" id="parts-stock" style="width:150px">' + UI.option('all', 'All stock levels', invState.stock) +
      UI.option('low', 'Low & out of stock', invState.stock) + UI.option('out', 'Out of stock', invState.stock) + UI.option('in', 'In stock', invState.stock) + '</select>' +
      '<span class="spacer"></span><span class="toolbar-label" id="parts-count"></span></div>' +
      '<div id="parts-table">' + invTableHTML(filteredParts()) + '</div></div>';
  }

  /* ---------------- stock movements ---------------- */
  function moveRows() {
    const q = moveState.q.trim();
    const rows = S().listStockMoves({ q, type: moveState.type === 'all' ? '' : moveState.type });
    return rows;
  }

  function movementTypeCell(type) {
    const meta = MOVE_META[type] || { label: U.titleCase(type || 'Movement'), badge: 'grey' };
    return '<span class="badge ' + meta.badge + '">' + U.esc(meta.label) + '</span>';
  }

  function moveStatsHTML(rows) {
    const inQty = U.sumBy(rows.filter(r => Number(r.qty) > 0), r => r.qty);
    const outQty = U.sumBy(rows.filter(r => Number(r.qty) < 0), r => Math.abs(r.qty));
    const purchaseValue = U.sumBy(rows.filter(r => r.type === 'purchase'), r => Number(r.qty) * Number(r.unitCost));
    return '<div class="parts-stat-grid">' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Movements</span><span class="stat-icon blue">' + UI.icon('list', 16) + '</span></div>' +
      '<div class="stat-value">' + rows.length + '</div><div class="stat-meta">Ledger entries in view</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Units in</span><span class="stat-icon green">' + UI.icon('arrowDownLeft', 16) + '</span></div>' +
      '<div class="stat-value">' + U.fmtQty(inQty) + '</div><div class="stat-meta">Received, returns and corrections</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Units out</span><span class="stat-icon danger">' + UI.icon('arrowUpRight', 16) + '</span></div>' +
      '<div class="stat-value">' + U.fmtQty(outQty) + '</div><div class="stat-meta">Counter sales and service use</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Purchases at cost</span><span class="stat-icon gold">' + UI.icon('coins', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(purchaseValue) + '</div><div class="stat-meta">Received stock value</div></div>' +
      '</div>';
  }

  function moveTableHTML(rows) {
    if (!rows.length) {
      return '<div class="card-body">' + UI.emptyState({ icon: 'list', title: 'No stock movements found', text: 'Receive, sell or adjust stock and every movement will be recorded here.' }) + '</div>';
    }
    const body = rows.slice(0, 300).map(m => {
      const item = S().itemById(m.itemId);
      const qty = Number(m.qty) || 0;
      return '<tr><td class="nowrap"><div class="cell-stack"><span class="cell-main">' + U.fmtDate(m.date, { mode: 'short' }) + '</span><span class="cell-sub">' + U.fmtTime(m.createdAt) + '</span></div></td>' +
        '<td>' + (item ? '<div class="item-name-main">' + U.esc(item.name) + '</div><div class="item-name-sub">' + U.esc(item.sku || '') + '</div>' : '<span class="muted">Unknown item</span>') + '</td>' +
        '<td>' + movementTypeCell(m.type) + '</td>' +
        '<td class="right num"><span class="' + (qty >= 0 ? 'movement-in' : 'movement-out') + '">' + (qty >= 0 ? '+ ' : '− ') + U.fmtQty(Math.abs(qty)) + '</span></td>' +
        '<td class="right num">' + U.money(m.unitCost) + '</td>' +
        '<td>' + (m.refNo ? '<span class="mono">' + U.esc(m.refNo) + '</span>' : '<span class="muted">—</span>') + '</td>' +
        '<td><div class="cell-stack"><span class="cell-main" style="font-weight:500">' + U.esc(m.supplier || m.note || '—') + '</span><span class="cell-sub">' + U.esc(S().cashierById(m.cashierId) ? (S().cashierById(m.cashierId).name) : '') + '</span></div></td></tr>';
    }).join('');
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Item</th><th>Movement</th><th class="right">Qty</th><th class="right">Unit cost</th><th>Reference</th><th>Detail</th></tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<div class="card-foot flex-between"><span class="hint">Showing ' + Math.min(rows.length, 300) + ' of ' + rows.length + '</span><button class="link-btn" data-export-moves>' + UI.icon('download', 13) + 'Export CSV</button></div>';
  }

  function exportMoves(rows) {
    if (!rows.length) { UI.toast('No stock movements to export.', 'info'); return; }
    const data = [['Date', 'Time', 'Item', 'SKU', 'Type', 'Qty', 'Unit cost', 'Reference', 'Supplier / note']]
      .concat(rows.map(m => {
        const item = S().itemById(m.itemId);
        return [m.date, U.fmtTime(m.createdAt), item ? item.name : '', item ? item.sku : '', m.type, m.qty, m.unitCost, m.refNo || '', (m.supplier || '') + (m.note ? ' — ' + m.note : '')];
      }));
    U.downloadFile('wijaya-stock-movements.csv', U.toCSV(data), 'text/csv;charset=utf-8');
    UI.toast('Stock movements exported.');
  }

  function movesScreen() {
    const rows = moveRows();
    return UI.pageHead({
      eyebrow: 'Catalogue · Stock ledger',
      title: 'Stock movements',
      subtitle: 'Every purchase, sale, return and stock correction in one audit trail.',
      actions: '<a class="btn" href="#/parts">' + UI.icon('arrowLeft', 15) + 'Back to inventory</a>'
    }) +
      '<nav class="tabs"><a class="tab" href="#/parts">Inventory</a><a class="tab active" href="#/parts/moves">Stock movements</a></nav>' +
      '<div id="move-stats">' + moveStatsHTML(rows) + '</div>' +
      '<div class="card inventory-card"><div class="inv-toolbar">' +
      '<div class="search-box" style="max-width:330px">' + UI.icon('search', 16) + '<input class="input" id="moves-search" placeholder="Search item, reference, supplier or note…" value="' + U.attr(moveState.q) + '"></div>' +
      '<select class="select sm" id="moves-type" style="width:170px">' + UI.option('all', 'All movements', moveState.type) +
      Object.keys(MOVE_META).map(k => UI.option(k, MOVE_META[k].label, moveState.type)).join('') + '</select>' +
      '<span class="spacer"></span><span class="toolbar-label" id="moves-count">' + rows.length + ' entries</span></div>' +
      '<div id="moves-table">' + moveTableHTML(rows) + '</div></div>';
  }

  V.parts = {
    render(route) {
      return route && route.sub === 'moves' ? movesScreen() : invScreen();
    },
    mount(content, route) {
      const scope = content.querySelector('#view-root') || content;
      if (route && route.sub === 'moves') {
        const search = scope.querySelector('#moves-search');
        const type = scope.querySelector('#moves-type');
        function paint() {
          const rows = moveRows();
          const stats = scope.querySelector('#move-stats');
          const table = scope.querySelector('#moves-table');
          const count = scope.querySelector('#moves-count');
          if (stats) stats.innerHTML = moveStatsHTML(rows);
          if (table) table.innerHTML = moveTableHTML(rows);
          if (count) count.textContent = rows.length + ' entries';
        }
        if (search) search.addEventListener('input', U.debounce(() => { moveState.q = search.value; paint(); }, 160));
        if (type) type.addEventListener('change', () => { moveState.type = type.value; paint(); });
        scope.addEventListener('click', e => {
          if (e.target.closest('[data-export-moves]')) exportMoves(moveRows());
        });
        return;
      }

      const search = scope.querySelector('#parts-search');
      const group = scope.querySelector('#parts-group');
      const stock = scope.querySelector('#parts-stock');
      function paint() {
        const table = scope.querySelector('#parts-table');
        const count = scope.querySelector('#parts-count');
        const rows = filteredParts();
        if (table) table.innerHTML = invTableHTML(rows);
        if (count) count.textContent = rows.length + ' of ' + partsList().length + ' parts';
      }
      if (search) search.addEventListener('input', U.debounce(() => { invState.q = search.value; paint(); }, 160));
      if (group) group.addEventListener('change', () => { invState.group = group.value; paint(); });
      if (stock) stock.addEventListener('change', () => { invState.stock = stock.value; paint(); });
      paint();

      scope.addEventListener('click', async e => {
        if (!adminMode()) return;
        const add = e.target.closest('[data-add-part]');
        if (add) { C.itemModal({ category: 'part' }); return; }
        const receive = e.target.closest('[data-receive]');
        if (receive) { C.receiveStockModal(Number(receive.dataset.receive)); return; }
        const adjust = e.target.closest('[data-adjust]');
        if (adjust) { C.adjustStockModal(Number(adjust.dataset.adjust)); return; }
        const edit = e.target.closest('[data-edit-item]');
        if (edit) { C.itemModal({ category: 'part', item: S().itemById(Number(edit.dataset.editItem)) }); return; }
        const archive = e.target.closest('[data-archive-item]');
        if (archive) {
          const item = S().itemById(Number(archive.dataset.archiveItem));
          if (item) await C.confirmArchiveItem(item);
        }
      });
    },
    refresh() {
      APP().renderRoute(true);
    }
  };
})();
