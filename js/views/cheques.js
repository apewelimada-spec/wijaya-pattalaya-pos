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

  const state = { filter: 'pending', q: '' };

  function filtered() {
    const q = state.q.trim().toLowerCase();
    return S().chequeReminders().filter(r => {
      if (state.filter === 'pending' && r.days < 0) return false;
      if (state.filter === 'due' && r.days !== 0) return false;
      if (state.filter === 'overdue' && r.days >= 0) return false;
      if (!q) return true;
      return (r.no + ' ' + r.customer + ' ' + r.chequeNo + ' ' + r.kind).toLowerCase().includes(q);
    });
  }

  function dueLabel(r) {
    if (r.days < 0) return '<span class="badge red">Overdue ' + Math.abs(r.days) + ' day' + (Math.abs(r.days) === 1 ? '' : 's') + '</span>';
    if (r.days === 0) return '<span class="badge gold">Due today</span>';
    if (r.days <= 3) return '<span class="badge gold">In ' + r.days + ' day' + (r.days === 1 ? '' : 's') + '</span>';
    return '<span class="badge green">In ' + r.days + ' days</span>';
  }

  function statsHTML() {
    const rows = S().chequeReminders();
    const pending = rows.filter(r => r.days >= 0);
    const overdue = rows.filter(r => r.days < 0);
    const dueToday = rows.filter(r => r.days === 0);
    const pendingValue = U.sumBy(pending, r => Number(r.amount) || 0);
    const overdueValue = U.sumBy(overdue, r => Number(r.amount) || 0);
    return '<div class="stat-grid mb-16">' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Cheques to bank</span><span class="stat-icon blue">' + UI.icon('fileText', 16) + '</span></div>' +
      '<div class="stat-value">' + pending.length + '</div><div class="stat-meta">Today and future</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Value pending</span><span class="stat-icon gold">' + UI.icon('coins', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(pendingValue) + '</div><div class="stat-meta">Not yet due</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Due today</span><span class="stat-icon danger">' + UI.icon('alert', 16) + '</span></div>' +
      '<div class="stat-value">' + dueToday.length + '</div><div class="stat-meta">' + U.money(U.sumBy(dueToday, r => Number(r.amount) || 0)) + ' to bank today</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Overdue</span><span class="stat-icon danger">' + UI.icon('clock', 16) + '</span></div>' +
      '<div class="stat-value">' + overdue.length + '</div><div class="stat-meta">' + U.money(overdueValue) + ' past the date</div></div>' +
      '</div>';
  }

  function tableHTML(rows) {
    if (!rows.length) {
      const noneAtAll = S().chequeReminders().length === 0;
      return '<div class="card-body">' + UI.emptyState({
        icon: 'fileText',
        title: noneAtAll ? 'No cheques recorded' : 'No cheques in this filter',
        text: noneAtAll
          ? 'When a bill or advance is paid by cheque, it appears here with the banking date so nothing is forgotten.'
          : 'Try the Pending or Overdue filter, or clear the search.'
      }) + '</div>';
    }
    const body = rows.map(r => {
      const kindBadge = r.billKind === 'service'
        ? '<span class="badge blue">Service</span>'
        : r.billKind === 'invoice'
          ? '<span class="badge green">Shop sale</span>'
          : '<span class="badge grey">' + U.esc(r.kind) + '</span>';
      return '<tr class="row-click" data-cheque-row="' + r.billKind + ':' + r.id + '">' +
        '<td><div class="cell-stack"><span class="cell-main">' + U.esc(r.no || '—') + '</span><span class="cell-sub">' + U.esc(U.fmtDate(r.date, { mode: 'short' })) + '</span></div></td>' +
        '<td>' + kindBadge + '</td>' +
        '<td><div class="cell-stack"><span class="cell-main" style="font-weight:500">' + U.esc(r.customer || 'No customer') + '</span><span class="cell-sub">Chq ' + U.esc(r.chequeNo || '—') + '</span></div></td>' +
        '<td class="nowrap">' + U.esc(U.fmtDate(r.chequeDate)) + '</td>' +
        '<td>' + dueLabel(r) + '</td>' +
        '<td class="right num"><b>' + U.money(r.amount) + '</b></td>' +
        '<td><div class="row-actions"><button type="button" class="icon-btn" title="Open bill">' + UI.icon('arrowRight', 15) + '</button></div></td></tr>';
    }).join('');
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Bill</th><th>Type</th><th>Customer & cheque</th><th>Cheque date</th><th>Status</th><th class="right">Amount</th><th></th></tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<div class="card-foot"><span class="hint">Showing ' + rows.length + ' cheque' + (rows.length === 1 ? '' : 's') + ' · bank each cheque on its date and keep this list clear</span></div>';
  }

  /* ---------------- cheques we gave to suppliers ---------------- */
  const SUP_TONE = { withus: 'gold', returned: 'blue', honoured: 'green', dishonoured: 'red' };

  function supplierChequeRows() {
    return S().supplierPaymentsList().filter(p => p.kind === 'cheque' && p.direction === 'to');
  }

  function supDays(p) {
    const base = U.todayISO();
    const t = new Date(base + 'T00:00:00').getTime();
    const d = new Date((p.chequeDate || base) + 'T00:00:00').getTime();
    return Math.round((d - t) / 86400000);
  }

  function supStatusLabel(p) {
    const label = S().constants.SUPPLIER_PAYMENT_STATUS[p.status] || p.status;
    return '<span class="badge ' + (SUP_TONE[p.status] || 'grey') + '">' + U.esc(label) + '</span>';
  }

  function supplierStatsHTML() {
    const rows = supplierChequeRows();
    const withUs = rows.filter(p => p.status === 'withus');
    const handed = rows.filter(p => p.status === 'returned');
    const bounced = rows.filter(p => p.status === 'dishonoured');
    const value = list => U.sumBy(list, p => Number(p.amount) || 0);
    return '<div class="stat-grid mb-16">' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Our cheques with us</span><span class="stat-icon gold">' + UI.icon('banknote', 16) + '</span></div>' +
      '<div class="stat-value">' + withUs.length + '</div><div class="stat-meta">' + U.money(value(withUs)) + ' not handed over yet</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Handed over, waiting on bank</span><span class="stat-icon blue">' + UI.icon('clock', 16) + '</span></div>' +
      '<div class="stat-value">' + handed.length + '</div><div class="stat-meta">' + U.money(value(handed)) + ' to confirm honoured</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Honoured</span><span class="stat-icon green">' + UI.icon('check', 16) + '</span></div>' +
      '<div class="stat-value">' + rows.filter(p => p.status === 'honoured').length + '</div><div class="stat-meta">Cleared by the bank</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Dishonoured</span><span class="stat-icon danger">' + UI.icon('alert', 16) + '</span></div>' +
      '<div class="stat-value">' + bounced.length + '</div><div class="stat-meta">' + U.money(value(bounced)) + ' bounced</div></div>' +
      '</div>';
  }

  function supplierTableHTML(rows) {
    if (!rows.length) {
      return '<div class="card-body">' + UI.emptyState({
        compact: true, icon: 'banknote', title: 'No cheques given to suppliers',
        text: 'Record a supplier cheque under Suppliers → Cheques & advances, or pay a supplier bill by cheque, and it is tracked here until the bank clears it.'
      }) + '</div>';
    }
    const body = rows.map(p => {
      const days = supDays(p);
      const value = p.status === 'withus'
        ? '<span class="badge gold">Still in your drawer</span>'
        : p.status === 'returned'
          ? (days < 0 ? '<span class="badge red">Value ' + Math.abs(days) + ' days past</span>' : days === 0 ? '<span class="badge gold">Value today</span>' : '<span class="badge blue">Value in ' + days + ' day' + (days === 1 ? '' : 's') + '</span>')
          : supStatusLabel(p);
      return '<tr class="row-click" data-sup-cheque="' + p.id + '">' +
        '<td><div class="cell-stack"><span class="cell-main">' + U.esc(p.chequeNo || '—') + '</span><span class="cell-sub">' + U.esc(U.fmtDate(p.date, { mode: 'short' })) + '</span></div></td>' +
        '<td><div class="cell-stack"><span class="cell-main" style="font-weight:500">' + U.esc(p.supplierName) + '</span><span class="cell-sub">' + U.esc(p.bank || 'No bank noted') + '</span></div></td>' +
        '<td>' + (p.refNo ? '<span class="mono">' + U.esc(p.refNo) + '</span>' : '<span class="muted">—</span>') + '</td>' +
        '<td class="nowrap">' + U.esc(U.fmtDate(p.chequeDate || p.date)) + '</td>' +
        '<td>' + value + '</td>' +
        '<td class="right num"><b>' + U.money(p.amount) + '</b></td>' +
        '<td><div class="row-actions">' + (adminMode() ? (
          (p.status === 'withus' ? '<button type="button" class="icon-btn" data-sup-action="' + p.id + ':returned" title="Mark handed over to supplier">' + UI.icon('check', 15) + '</button>' : '') +
          (p.status === 'returned' ? '<button type="button" class="icon-btn" data-sup-action="' + p.id + ':honoured" title="Mark honoured by the bank">' + UI.icon('banknote', 15) + '</button>' : '') +
          (p.status !== 'dishonoured' ? '<button type="button" class="icon-btn danger" data-sup-action="' + p.id + ':dishonoured" title="Mark dishonoured">' + UI.icon('alert', 15) + '</button>' : '') +
          (p.status === 'dishonoured' ? '<button type="button" class="icon-btn" data-sup-action="' + p.id + ':withus" title="Put the cheque back in the drawer">' + UI.icon('refresh', 15) + '</button>' : '')
        ) : '') + '</div></td></tr>';
    }).join('');
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Cheque</th><th>Supplier</th><th>Against bill</th><th>Value date</th><th>Where is it</th><th class="right">Amount</th><th></th></tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<div class="card-foot"><span class="hint">A cheque only reduces what you owe the supplier after you mark it handed over.</span></div>';
  }

  function supplierScreenHTML() {
    const rows = supplierChequeRows();
    return '<div class="card inventory-card mt-16"><div class="card-head bordered"><div><div class="card-title">Cheques we gave to suppliers</div>' +
      '<div class="card-sub">Track your own cheques — still with us, handed over, honoured by the bank, or bounced.</div></div>' +
      (adminMode() ? '<a class="btn btn-sm" href="#/suppliers">' + UI.icon('building', 13) + 'Supplier accounts</a>' : '') + '</div>' +
      '<div class="card-pad" style="padding-bottom:0">' + '<div id="sup-cheque-stats">' + supplierStatsHTML() + '</div></div>' +
      '<div id="sup-cheque-table">' + supplierTableHTML(rows) + '</div></div>';
  }

  function screenHTML() {
    const rows = filtered();
    return UI.pageHead({
      eyebrow: 'Money · Cheques',
      title: 'Cheque reminders',
      subtitle: 'Every cheque taken at the counter or as an advance, with the date it must go to the bank.',
      actions: ''
    }) +
      '<div id="cheque-stats">' + statsHTML() + '</div>' +
      '<div class="card inventory-card"><div class="inv-toolbar">' +
      '<div class="search-box" style="max-width:320px">' + UI.icon('search', 16) + '<input class="input" id="cheque-search" placeholder="Search bill, customer or cheque no…" value="' + U.attr(state.q) + '"></div>' +
      '<div class="segmented" data-cheque-filter>' +
      '<button class="seg-btn ' + (state.filter === 'pending' ? 'active' : '') + '" data-filter="pending">Pending</button>' +
      '<button class="seg-btn ' + (state.filter === 'due' ? 'active' : '') + '" data-filter="due">Due today</button>' +
      '<button class="seg-btn ' + (state.filter === 'overdue' ? 'active' : '') + '" data-filter="overdue">Overdue</button>' +
      '<button class="seg-btn ' + (state.filter === 'all' ? 'active' : '') + '" data-filter="all">All</button></div>' +
      '<span class="spacer"></span><span class="toolbar-label" id="cheque-count">' + rows.length + ' cheques</span></div>' +
      '<div id="cheque-table">' + tableHTML(rows) + '</div></div>' +
      supplierScreenHTML();
  }

  function openBill(billKind, id) {
    if (billKind === 'service') C.serviceDetailModal(id, { onChanged: () => APP().dataChanged() });
    else if (billKind === 'invoice') C.invoiceDetailModal(id, { onChanged: () => APP().dataChanged() });
  }

  V.cheques = {
    render() {
      return screenHTML();
    },
    mount(content) {
      const scope = content.querySelector('#view-root') || content;
      const search = scope.querySelector('#cheque-search');
      function paint() {
        const rows = filtered();
        const table = scope.querySelector('#cheque-table');
        const count = scope.querySelector('#cheque-count');
        const stats = scope.querySelector('#cheque-stats');
        if (table) table.innerHTML = tableHTML(rows);
        if (count) count.textContent = rows.length + ' cheques';
        if (stats) stats.innerHTML = statsHTML();
        const supTable = scope.querySelector('#sup-cheque-table');
        const supStats = scope.querySelector('#sup-cheque-stats');
        if (supTable) supTable.innerHTML = supplierTableHTML(supplierChequeRows());
        if (supStats) supStats.innerHTML = supplierStatsHTML();
      }
      if (search) search.addEventListener('input', U.debounce(() => { state.q = search.value; paint(); }, 160));
      scope.addEventListener('click', async e => {
        const action = e.target.closest('[data-sup-action]');
        if (action) {
          const parts = String(action.dataset.supAction).split(':');
          const cheque = S().supplierPaymentById(Number(parts[0]));
          if (!cheque) return;
          if (parts[1] === 'dishonoured') {
            const ok = await UI.confirmDialog({
              title: 'Mark cheque dishonoured?',
              text: 'Cheque ' + (cheque.chequeNo || '') + ' to ' + cheque.supplierName + ' · ' + U.money(cheque.amount) + '. It will be added back to what you owe the supplier.',
              confirmText: 'Mark dishonoured'
            });
            if (!ok) return;
          }
          try {
            const updated = await S().setSupplierPaymentStatus(cheque.id, parts[1]);
            UI.toast('Cheque ' + (updated.chequeNo || '') + ' · ' + (S().constants.SUPPLIER_PAYMENT_STATUS[updated.status] || updated.status));
            APP().dataChanged();
          } catch (err) { UI.toast(err.userMessage || err.message || 'Could not update the cheque.', 'error'); }
          return;
        }
        const filterBtn = e.target.closest('[data-cheque-filter] [data-filter]');
        if (filterBtn) {
          state.filter = filterBtn.dataset.filter;
          scope.querySelectorAll('[data-cheque-filter] [data-filter]').forEach(btn => btn.classList.toggle('active', btn === filterBtn));
          paint();
          return;
        }
        const supRow = e.target.closest('[data-sup-cheque]');
        if (supRow) {
          if (!adminMode()) { UI.toast('Supplier accounts are admin only.', 'info'); return; }
          APP().navigate('#/suppliers/payments');
          return;
        }
        const row = e.target.closest('[data-cheque-row]');
        if (row) {
          const parts = row.dataset.chequeRow.split(':');
          openBill(parts[0], Number(parts[1]));
        }
      });
    },
    refresh() {
      APP().renderRoute(true);
    }
  };
})();
