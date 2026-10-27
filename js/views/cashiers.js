(function () {
  'use strict';
  const WP = window.WP = window.WP || {};
  const U = WP.utils;
  const UI = WP.ui;
  const V = WP.views = WP.views || {};

  function S() { return WP.store; }
  function APP() { return WP.app; }

  function activeId() { return APP().getActiveCashierId(); }

  function restricted() {
    return !!(WP.auth && WP.auth.isCashier && WP.auth.isCashier());
  }

  function myId() {
    return WP.auth && WP.auth.getCashierId ? WP.auth.getCashierId() : null;
  }

  function loginFor(cashierId) {
    return WP.auth && WP.auth.getCashierLogin ? WP.auth.getCashierLogin(cashierId) : null;
  }

  function visibleCashiers() {
    if (!restricted()) return U.sortBy(S().data.cashiers, c => c.name.toLowerCase(), 'asc');
    const me = S().cashierById(myId());
    return me ? [me] : [];
  }

  function visibleSessions() {
    const all = S().cashierSessions('', '');
    if (!restricted()) return all;
    return all.filter(s => Number(s.cashierId) === Number(myId()));
  }

  function openSessions() {
    return S().data.cashierSessions.filter(s => !s.closedAt);
  }

  function sessionWindow(session) {
    const start = U.fmtDate(session.openedAt, { mode: 'short' }) + ' · ' + U.fmtTime(session.openedAt);
    return start + ' – ' + (session.closedAt ? U.fmtTime(session.closedAt) : 'now');
  }

  function partsHintHTML(parts) {
    if (!parts.rows.length) return '<div class="hint mb-8">No spare parts were sold or used in this shift.</div>';
    return '<div class="hint mb-8"><b>' + parts.rows.length + '</b> part' + (parts.rows.length === 1 ? '' : 's') +
      ' · <b>' + U.fmtQty(parts.qty) + '</b> unit' + (Number(parts.qty) === 1 ? '' : 's') +
      ' out · ' + U.money(parts.value) + ' value before bill discounts</div>';
  }

  function partsTableHTML(parts, compact) {
    if (!parts.rows.length) return '<div class="empty-inline">No parts moved in this shift.</div>';
    const body = parts.rows.map(row =>
      '<tr><td><div class="cell-stack"><span class="cell-main">' + U.esc(row.name) + '</span>' +
      (row.sku ? '<span class="cell-sub">' + U.esc(row.sku) + '</span>' : '') + '</div></td>' +
      '<td class="right num"><b>' + U.fmtQty(row.qty) + '</b></td>' +
      '<td class="right num">' + (row.saleQty > 0 ? U.fmtQty(row.saleQty) : '<span class="muted">—</span>') + '</td>' +
      '<td class="right num">' + (row.serviceQty > 0 ? U.fmtQty(row.serviceQty) : '<span class="muted">—</span>') + '</td>' +
      '<td class="right num">' + U.money(row.value) + '</td></tr>').join('');
    return '<div class="table-wrap"><table class="table shift-parts-table' + (compact ? ' compact' : '') + '">' +
      '<thead><tr><th>Part</th><th class="right">Total qty</th><th class="right">Shop sale</th><th class="right">Service</th><th class="right">Value</th></tr></thead>' +
      '<tbody>' + body + '</tbody>' +
      '<tfoot><tr><td><b>' + parts.rows.length + ' part' + (parts.rows.length === 1 ? '' : 's') + '</b></td>' +
      '<td class="right num"><b>' + U.fmtQty(parts.qty) + '</b></td>' +
      '<td class="right num"><b>' + U.fmtQty(parts.saleQty) + '</b></td>' +
      '<td class="right num"><b>' + U.fmtQty(parts.serviceQty) + '</b></td>' +
      '<td class="right num"><b>' + U.money(parts.value) + '</b></td></tr></tfoot></table></div>';
  }

  function cashLedgerHTML(summary) {
    return '<div class="mini-ledger">' +
      '<div class="mini-ledger-row"><div class="mini-ledger-main"><div class="mini-ledger-title">Cash sales</div><div class="mini-ledger-sub">Shop invoices billed in cash</div></div><div class="mini-ledger-amt">' + U.money(summary.saleCash) + '</div></div>' +
      '<div class="mini-ledger-row"><div class="mini-ledger-main"><div class="mini-ledger-title">Cash service</div><div class="mini-ledger-sub">Workshop bills billed in cash</div></div><div class="mini-ledger-amt">' + U.money(summary.serviceCash) + '</div></div>' +
      '<div class="mini-ledger-row"><div class="mini-ledger-main"><div class="mini-ledger-title">Cash collections & advances</div><div class="mini-ledger-sub">Payments received from customers</div></div><div class="mini-ledger-amt">' + U.money(summary.collectionsCash) + '</div></div>' +
      '<div class="mini-ledger-row"><div class="mini-ledger-main"><div class="mini-ledger-title">Cash expenses & refunds</div><div class="mini-ledger-sub">Money paid out</div></div><div class="mini-ledger-amt">− ' + U.money(U.round2(summary.expensesCash + summary.refundsCash)) + '</div></div>' +
      '</div>';
  }

  function otherPaymentsHTML(summary) {
    const total = U.round2(Number(summary.card || 0) + Number(summary.online || 0) + Number(summary.cheque || 0));
    return '<div class="mini-ledger">' +
      '<div class="mini-ledger-row"><div class="mini-ledger-main"><div class="mini-ledger-title">Card</div><div class="mini-ledger-sub">Card payments received</div></div><div class="mini-ledger-amt">' + U.money(summary.card) + '</div></div>' +
      '<div class="mini-ledger-row"><div class="mini-ledger-main"><div class="mini-ledger-title">Online transfer</div><div class="mini-ledger-sub">Bank and online payments</div></div><div class="mini-ledger-amt">' + U.money(summary.online) + '</div></div>' +
      '<div class="mini-ledger-row"><div class="mini-ledger-main"><div class="mini-ledger-title">Cheque</div><div class="mini-ledger-sub">Cheque payments received</div></div><div class="mini-ledger-amt">' + U.money(summary.cheque) + '</div></div>' +
      '<div class="mini-ledger-row"><div class="mini-ledger-main"><div class="mini-ledger-title">Total card, online & cheque</div></div><div class="mini-ledger-amt"><b>' + U.money(total) + '</b></div></div>' +
      '</div>';
  }

  function shiftActivityHTML(summary, parts) {
    return '<div class="mini-ledger">' +
      '<div class="mini-ledger-row"><div class="mini-ledger-main"><div class="mini-ledger-title">Shop sale bills</div></div><div class="mini-ledger-amt">' + summary.invoiceCount + '</div></div>' +
      '<div class="mini-ledger-row"><div class="mini-ledger-main"><div class="mini-ledger-title">Service bills</div></div><div class="mini-ledger-amt">' + summary.serviceCount + '</div></div>' +
      '<div class="mini-ledger-row"><div class="mini-ledger-main"><div class="mini-ledger-title">Customer collections</div></div><div class="mini-ledger-amt">' + summary.payments + '</div></div>' +
      '<div class="mini-ledger-row"><div class="mini-ledger-main"><div class="mini-ledger-title">Parts issued</div><div class="mini-ledger-sub">' + parts.rows.length + ' part' + (parts.rows.length === 1 ? '' : 's') + ' moved</div></div><div class="mini-ledger-amt">' + U.fmtQty(parts.qty) + ' units</div></div>' +
      '</div>';
  }

  function statsHTML() {
    const cashiers = S().activeCashiers();
    const sessions = openSessions();
    const drawer = U.sumBy(sessions, s => {
      const summary = S().sessionSummary(s.cashierId, s);
      return summary ? summary.expected : 0;
    });
    const today = U.todayISO();
    const cashSales = U.sumBy(S().data.invoices.filter(i => i.date === today && i.method === 'cash'), i => i.salePaid);
    const cashService = U.sumBy(S().data.services.filter(s => s.date === today && s.method === 'cash'), s => s.salePaid);
    const cashCollections = U.sumBy(S().data.payments.filter(p => p.date === today && p.method === 'cash' && (p.type === 'collection' || p.type === 'advance')), p => p.amount);
    return '<div class="stat-grid mb-16">' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Cashiers</span><span class="stat-icon green">' + UI.icon('users', 16) + '</span></div>' +
      '<div class="stat-value">' + cashiers.length + '</div><div class="stat-meta">Separate logins on this device</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Counters open</span><span class="stat-icon gold">' + UI.icon('coins', 16) + '</span></div>' +
      '<div class="stat-value">' + sessions.length + '</div><div class="stat-meta">' + (sessions.length ? sessions.map(s => (S().cashierById(s.cashierId) || {}).name).filter(Boolean).join(', ') : 'No cashier session is open') + '</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Cash expected in drawers</span><span class="stat-icon blue">' + UI.icon('wallet', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(drawer) + '</div><div class="stat-meta">Open sessions only</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Cash taken today</span><span class="stat-icon green">' + UI.icon('banknote', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(cashSales + cashService + cashCollections) + '</div><div class="stat-meta">Sales, service and collections</div></div>' +
      '</div>';
  }

  function cashierStatsHTML() {
    const cashier = S().cashierById(myId());
    const session = cashier ? S().openSessionFor(cashier.id) : null;
    const summary = session ? S().sessionSummary(cashier.id, session) : null;
    const today = U.todayISO();
    const cashSales = U.sumBy(S().data.invoices.filter(i => Number(i.cashierId) === Number(myId()) && i.date === today && i.method === 'cash'), i => i.salePaid);
    const cashService = U.sumBy(S().data.services.filter(s => Number(s.cashierId) === Number(myId()) && s.date === today && s.method === 'cash'), s => s.salePaid);
    const cashCollections = U.sumBy(S().data.payments.filter(p => Number(p.cashierId) === Number(myId()) && p.date === today && p.method === 'cash' && (p.type === 'collection' || p.type === 'advance')), p => p.amount);
    const mySessions = visibleSessions();
    return '<div class="stat-grid mb-16">' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">My counter session</span><span class="stat-icon ' + (session ? 'green' : 'gold') + '">' + UI.icon('lock', 16) + '</span></div>' +
      '<div class="stat-value sm">' + (session ? 'Open' : 'Closed') + '</div><div class="stat-meta">' + (session ? 'Opened ' + U.fmtTime(session.openedAt) : 'Open a session before taking cash') + '</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Expected in my drawer</span><span class="stat-icon blue">' + UI.icon('wallet', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(summary ? summary.expected : 0) + '</div><div class="stat-meta">' + (summary ? 'Opening ' + U.money(summary.opening) : 'No open drawer') + '</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">My cash taken today</span><span class="stat-icon green">' + UI.icon('banknote', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(cashSales + cashService + cashCollections) + '</div><div class="stat-meta">Sales, service and collections</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">My sessions on record</span><span class="stat-icon gold">' + UI.icon('clock', 16) + '</span></div>' +
      '<div class="stat-value">' + mySessions.length + '</div><div class="stat-meta">Only your own history is shown</div></div>' +
      '</div>';
  }

  function cashierCard(cashier) {
    const session = S().openSessionFor(cashier.id);
    const summary = session ? S().sessionSummary(cashier.id, session) : null;
    const isActive = Number(activeId()) === Number(cashier.id);
    const login = loginFor(cashier.id);
    const roleRestricted = restricted();
    return '<div class="card cashier-card"' + (isActive ? ' style="border-color:var(--brand);box-shadow:0 0 0 1px var(--brand)"' : '') + '>' +
      '<div class="cashier-head">' + UI.avatar(cashier.name, 'lg') +
      '<div style="flex:1;min-width:0"><div class="cashier-name">' + U.esc(cashier.name) + (isActive ? ' <span class="badge green" style="margin-left:4px">Active</span>' : '') + '</div>' +
      '<div class="cashier-sub">' + U.esc(cashier.phone || 'No phone') + '</div>' +
      '<div class="cashier-sub">' + (login ? UI.icon('key', 11) + ' @' + U.esc(login.username) : UI.icon('alert', 11) + ' No sign-in yet') + '</div></div>' +
      '<span class="session-ribbon ' + (session ? 'open' : '') + '">' + (session ? 'Open' : 'Closed') + '</span></div>' +
      '<div class="cashier-body">' +
      '<div class="cashier-fig-grid">' +
      '<div class="cashier-fig"><span>' + (session ? 'Expected in drawer' : 'Opening balance') + '</span><b>' + U.money(summary ? summary.expected : 0) + '</b></div>' +
      '<div class="cashier-fig"><span>' + (session ? 'Opened at' : 'Today’s sales') + '</span><b style="font-size:11px">' + (session ? U.fmtTime(session.openedAt) : U.money(summary && summary.expected ? summary.expected : 0)) + '</b></div>' +
      '</div>' +
      (session
        ? '<div class="hint">Opening ' + U.money(summary.opening) + ' · cash in ' + U.money(summary.cashIn) + ' · cash out ' + U.money(summary.cashOut) + '</div>'
        : '<div class="hint">Open a counter session before taking cash so the drawer reconciles at closing.</div>') +
      '<div class="cashier-actions">' +
      (session
        ? '<button type="button" class="btn btn-sm" data-shift-report="' + cashier.id + '">' + UI.icon('receipt', 13) + 'Shift report</button>' +
          '<button type="button" class="btn btn-sm" data-close-session="' + cashier.id + '">' + UI.icon('lock', 13) + 'Close session</button>'
        : '<button type="button" class="btn btn-sm btn-primary" data-open-session="' + cashier.id + '">' + UI.icon('lock', 13) + 'Open session</button>') +
      (roleRestricted
        ? '<button type="button" class="btn btn-sm" data-my-account>' + UI.icon('user', 13) + 'My account</button>'
        : (isActive ? '' : '<button type="button" class="btn btn-sm" data-switch-cashier="' + cashier.id + '">' + UI.icon('users', 13) + 'Set active</button>') +
          '<button type="button" class="icon-btn" data-cashier-login="' + cashier.id + '" title="Sign-in details">' + UI.icon('key', 14) + '</button>' +
          '<button type="button" class="icon-btn" data-edit-cashier="' + cashier.id + '" title="Edit cashier">' + UI.icon('edit', 14) + '</button>') +
      '</div></div></div>';
  }

  function historyHTML() {
    const rows = visibleSessions();
    if (!rows.length) {
      return '<div class="card-body">' + UI.emptyState({ compact: true, icon: 'coins', title: 'No sessions yet', text: restricted() ? 'Open your counter session when you start taking cash, then close it when you hand over the drawer.' : 'Open a session when a cashier starts and close it when they hand over the drawer.' }) + '</div>';
    }
    const body = rows.slice(0, 200).map(s => {
      const cashier = S().cashierById(s.cashierId);
      const diff = s.closedAt ? U.round2(Number(s.countedBalance || 0) - Number(s.expectedBalance || 0)) : null;
      return '<tr class="row-click" data-session-report="' + s.id + '">' +
        '<td><div class="cell-stack"><span class="cell-main">' + U.esc(cashier ? cashier.name : 'Unknown cashier') + '</span><span class="cell-sub">' + U.fmtDate(s.openedAt, { mode: 'short' }) + '</span></div></td>' +
        '<td class="nowrap">' + U.fmtTime(s.openedAt) + '</td>' +
        '<td class="nowrap">' + (s.closedAt ? U.fmtTime(s.closedAt) : '<span class="badge green">Open</span>') + '</td>' +
        '<td class="right num">' + U.money(s.openingBalance) + '</td>' +
        '<td class="right num">' + (s.expectedBalance === null ? '<span class="muted">—</span>' : U.money(s.expectedBalance)) + '</td>' +
        '<td class="right num">' + (s.countedBalance === null ? '<span class="muted">—</span>' : U.money(s.countedBalance)) + '</td>' +
        '<td class="right num ' + (diff === null ? '' : diff < -0.009 ? 'text-danger' : diff > 0.009 ? 'text-success' : 'muted') + '">' + (diff === null ? '—' : (diff > 0 ? '+ ' : diff < 0 ? '− ' : '') + U.money(Math.abs(diff))) + '</td>' +
        '<td>' + (s.closedAt ? '<span class="badge grey">Closed</span>' : '<span class="badge green dot">Open</span>') + '</td>' +
        '<td><div class="row-actions"><button type="button" class="icon-btn" data-session-report="' + s.id + '" title="View shift report">' + UI.icon('arrowRight', 15) + '</button></div></td></tr>';
    }).join('');
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Cashier</th><th>Opened</th><th>Closed</th><th class="right">Opening</th><th class="right">Expected</th><th class="right">Counted</th><th class="right">Difference</th><th>Status</th><th></th></tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<div class="card-foot flex-between"><span class="hint">Showing ' + Math.min(rows.length, 200) + ' of ' + rows.length + ' sessions</span>' +
      (restricted() ? '' : '<button class="link-btn" data-export-sessions>' + UI.icon('download', 13) + 'Export CSV</button>') + '</div>';
  }

  function exportSessions() {
    const rows = visibleSessions();
    if (!rows.length) { UI.toast('No cashier sessions to export.', 'info'); return; }
    const data = [['Cashier', 'Opened', 'Closed', 'Opening balance', 'Expected balance', 'Counted balance', 'Difference', 'Open note', 'Close note']]
      .concat(rows.map(s => {
        const cashier = S().cashierById(s.cashierId);
        const diff = s.closedAt ? U.round2(Number(s.countedBalance || 0) - Number(s.expectedBalance || 0)) : '';
        return [cashier ? cashier.name : '', s.openedAt, s.closedAt || '', s.openingBalance, s.expectedBalance === null ? '' : s.expectedBalance, s.countedBalance === null ? '' : s.countedBalance, diff, s.note || '', s.closeNote || ''];
      }));
    U.downloadFile('wijaya-cashier-sessions.csv', U.toCSV(data), 'text/csv;charset=utf-8');
    UI.toast('Cashier sessions exported.');
  }

  function screen() {
    const cashiers = visibleCashiers();
    const roleRestricted = restricted();
    return UI.pageHead({
      eyebrow: roleRestricted ? 'Money · My counter' : 'Money · Counter staff',
      title: roleRestricted ? 'My counter' : 'Cashiers',
      subtitle: roleRestricted ? 'Your sign-in, counter session and drawer. Only the shop admin can change your sign-in details.' : 'Separate cashiers, individual drawers, opening floats and end-of-shift reconciliation.',
      actions: roleRestricted
        ? '<button class="btn" data-my-account>' + UI.icon('user', 15) + 'My account</button>'
        : '<button class="btn btn-primary" data-add-cashier>' + UI.icon('userPlus', 15) + 'Add cashier</button>'
    }) +
      '<div id="cashier-stats">' + (roleRestricted ? cashierStatsHTML() : statsHTML()) + '</div>' +
      (cashiers.length
        ? '<div class="cashier-grid mb-16">' + cashiers.map(cashierCard).join('') + '</div>'
        : '<div class="card mb-16">' + UI.emptyState({ icon: 'users', title: 'Add your first cashier', text: 'Each cashier can open their own session and hand over a counted drawer.', action: '<button class="btn btn-primary" data-add-cashier>Add cashier</button>' }) + '</div>') +
      '<div class="card inventory-card"><div class="card-head bordered"><div><div class="card-title">' + (roleRestricted ? 'My session history' : 'Session history') + '</div><div class="card-sub">Expected cash = opening balance + cash in − cash out. Counted cash is entered at closing.</div></div></div>' +
      '<div id="session-history">' + historyHTML() + '</div></div>';
  }

  function openSessionModal(cashierId) {
    const cashier = S().cashierById(cashierId);
    if (!cashier) return;
    if (S().openSessionFor(cashierId)) { UI.toast(cashier.name + ' already has an open session.', 'info'); return; }
    const m = UI.modal({
      title: 'Open counter session',
      subtitle: cashier.name + ' · ' + U.fmtDate(U.todayISO()),
      size: 'md',
      body:
        '<form id="open-session-form"><div class="form-grid">' +
        '<div class="field"><label class="label" for="os-opening">Opening cash float</label>' +
        '<div class="input-group"><span class="prefix">' + U.esc(U.symbol()) + '</span><input class="input" id="os-opening" name="openingBalance" type="number" min="0" step="0.01" value="0.00" required></div>' +
        '<div class="hint">Cash already in the drawer before the first sale of this session.</div></div>' +
        '<div class="field full"><label class="label" for="os-note">Note <span class="opt">(optional)</span></label>' +
        '<input class="input" id="os-note" name="note" placeholder="e.g. morning shift, small notes float" autocomplete="off"></div>' +
        '</div></form>' +
        '<div class="pay-note mt-12">Cash sales, cash collections and cash expenses made while signed in as <b>' + U.esc(cashier.name) + '</b> will count toward this drawer.</div>',
      footer: '<button type="button" class="btn" data-modal-close>Cancel</button>' +
        '<button type="submit" class="btn btn-primary" form="open-session-form">' + UI.icon('lock', 15) + 'Open session</button>'
    });
    const form = m.panel.querySelector('#open-session-form');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const submit = m.panel.querySelector('[type="submit"][form="open-session-form"]');
      const values = UI.formValues(form);
      try {
        await UI.withLoading(submit, async () => {
          await S().openSession(cashierId, values);
          m.close();
          UI.toast('Session opened for ' + cashier.name + '.');
          APP().refresh();
        });
      } catch (err) { UI.toast(err.userMessage || err.message || 'Could not open the session.', 'error'); }
    });
  }

  function closeSessionModal(cashierId) {
    const cashier = S().cashierById(cashierId);
    const session = S().openSessionFor(cashierId);
    if (!cashier || !session) { UI.toast('There is no open session for this cashier.', 'info'); return; }
    const summary = S().sessionSummary(cashierId, session);
    const parts = S().sessionPartsBreakdown(cashierId, session);
    const m = UI.modal({
      title: 'Close counter session',
      subtitle: cashier.name + ' · opened ' + U.fmtTime(session.openedAt),
      size: 'md',
      body:
        '<div class="statement-hero mb-16">' +
        '<div class="statement-fig"><span>Opening float</span><b>' + U.money(summary.opening) + '</b></div>' +
        '<div class="statement-fig"><span>Cash in</span><b class="text-success">' + U.money(summary.cashIn) + '</b></div>' +
        '<div class="statement-fig"><span>Cash out</span><b class="text-danger">' + U.money(summary.cashOut) + '</b></div>' +
        '<div class="statement-fig"><span>Expected</span><b>' + U.money(summary.expected) + '</b></div>' +
        '</div>' +
        '<div class="mb-16">' + cashLedgerHTML(summary) + '</div>' +
        '<div class="statement-section"><h4>Parts issued this shift</h4>' + partsHintHTML(parts) + '<div class="shift-parts-scroll">' + partsTableHTML(parts, true) + '</div></div>' +
        '<form id="close-session-form"><div class="form-grid mt-16">' +
        '<div class="field"><label class="label" for="cs-counted">Counted cash in drawer</label>' +
        '<div class="input-group"><span class="prefix">' + U.esc(U.symbol()) + '</span><input class="input" id="cs-counted" name="countedBalance" type="number" min="0" step="0.01" required value="' + summary.expected.toFixed(2) + '"></div>' +
        '<div class="change-line"><span>Variance</span><span id="cs-variance">' + U.money(0) + '</span></div></div>' +
        '<div class="field"><label class="label" for="cs-note">Closing note <span class="opt">(optional)</span></label>' +
        '<input class="input" id="cs-note" name="note" placeholder="e.g. short by Rs. 50, paid for diesel" autocomplete="off"></div>' +
        '</div></form>',
      footer: '<button type="button" class="btn" data-modal-close>Cancel</button>' +
        '<button type="submit" class="btn btn-primary" form="close-session-form">' + UI.icon('check', 15) + 'Close & reconcile</button>'
    });
    const form = m.panel.querySelector('#close-session-form');
    const counted = form.querySelector('#cs-counted');
    const variance = m.panel.querySelector('#cs-variance');
    function paintVariance() {
      const val = U.round2(U.toNum(counted.value, 0) - summary.expected);
      variance.textContent = (val > 0 ? '+ ' : val < 0 ? '− ' : '') + U.money(Math.abs(val));
      variance.className = val < -0.009 ? 'text-danger' : val > 0.009 ? 'text-success' : 'muted';
    }
    counted.addEventListener('input', paintVariance);
    paintVariance();
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const submit = m.panel.querySelector('[type="submit"][form="close-session-form"]');
      const values = UI.formValues(form);
      try {
        await UI.withLoading(submit, async () => {
          const result = await S().closeSession(cashierId, values);
          m.close();
          const diff = result.difference;
          UI.toast('Session closed · expected ' + U.money(result.summary.expected) + ', counted ' + U.money(result.session.countedBalance) + (Math.abs(diff) > 0.009 ? ' · variance ' + U.money(Math.abs(diff)) : ' · balanced') + '.');
          APP().refresh();
        });
      } catch (err) { UI.toast(err.userMessage || err.message || 'Could not close the session.', 'error'); }
    });
  }

  function shiftReportSummary(cashierId, session) {
    const summary = S().sessionSummary(cashierId, session);
    const parts = S().sessionPartsBreakdown(cashierId, session);
    const closed = !!session.closedAt;
    const expected = closed && session.expectedBalance !== null && session.expectedBalance !== undefined
      ? Number(session.expectedBalance) : summary.expected;
    const counted = closed ? Number(session.countedBalance || 0) : null;
    const variance = closed ? U.round2(counted - expected) : null;
    const varianceText = variance === null ? '' : (variance > 0 ? '+ ' : variance < 0 ? '− ' : '') + U.money(Math.abs(variance));
    const varianceCls = variance === null || Math.abs(variance) < 0.009 ? 'muted' : variance < 0 ? 'text-danger' : 'text-success';
    return { summary, parts, closed, expected, counted, variance, varianceText, varianceCls };
  }

  function shiftReportModal(cashierId, session) {
    const cashier = S().cashierById(cashierId);
    if (!cashier || !session) { UI.toast('Shift not found.', 'error'); return; }
    if (restricted() && Number(session.cashierId) !== Number(myId())) return;
    const report = shiftReportSummary(cashierId, session);
    const summary = report.summary;
    const parts = report.parts;
    const m = UI.modal({
      size: 'lg',
      title: 'Shift report',
      subtitle: cashier.name + ' · ' + sessionWindow(session) + (report.closed ? ' · Closed' : ' · Open'),
      body:
        '<div class="statement-hero mb-16">' +
        '<div class="statement-fig"><span>Opening float</span><b>' + U.money(summary.opening) + '</b></div>' +
        '<div class="statement-fig"><span>Cash in</span><b class="text-success">' + U.money(summary.cashIn) + '</b></div>' +
        '<div class="statement-fig"><span>Cash out</span><b class="text-danger">' + U.money(summary.cashOut) + '</b></div>' +
        '<div class="statement-fig"><span>Expected in drawer</span><b>' + U.money(report.expected) + '</b></div>' +
        '</div>' +
        (report.closed
          ? '<div class="mini-ledger mb-16">' +
            '<div class="mini-ledger-row"><div class="mini-ledger-main"><div class="mini-ledger-title">Counted cash at close</div><div class="mini-ledger-sub">Entered when the drawer was handed over</div></div><div class="mini-ledger-amt">' + U.money(report.counted) + '</div></div>' +
            '<div class="mini-ledger-row"><div class="mini-ledger-main"><div class="mini-ledger-title">Variance</div><div class="mini-ledger-sub">Counted cash minus expected</div></div><div class="mini-ledger-amt ' + report.varianceCls + '">' + report.varianceText + '</div></div>' +
            '</div>'
          : '<div class="hint mb-16">This shift is still open. Figures update as bills, collections and expenses are recorded.</div>') +
        '<div class="statement-section"><h4>Parts issued this shift</h4>' + partsHintHTML(parts) + partsTableHTML(parts) + '</div>' +
        '<div class="report-columns">' +
        '<div class="statement-section"><h4>Cash drawer</h4>' + cashLedgerHTML(summary) + '</div>' +
        '<div class="statement-section"><h4>Other payments</h4>' + otherPaymentsHTML(summary) + '</div>' +
        '</div>' +
        '<div class="statement-section"><h4>Shift activity</h4>' + shiftActivityHTML(summary, parts) + '</div>' +
        (session.note ? '<div class="hint mt-8">Opening note: ' + U.esc(session.note) + '</div>' : '') +
        (session.closeNote ? '<div class="hint mt-4">Closing note: ' + U.esc(session.closeNote) + '</div>' : ''),
      footer: '<button type="button" class="btn" data-modal-close>Done</button>' +
        '<button type="button" class="btn btn-primary" data-print-shift>' + UI.icon('printer', 14) + 'Print shift report</button>'
    });
    const print = m.panel.querySelector('[data-print-shift]');
    if (print) print.addEventListener('click', () => printShiftReport(cashierId, session));
    return m;
  }

  function printShiftReport(cashierId, session) {
    const cashier = S().cashierById(cashierId);
    if (!cashier || !session) { UI.toast('Shift not found.', 'error'); return; }
    if (restricted() && Number(session.cashierId) !== Number(myId())) return;
    const report = shiftReportSummary(cashierId, session);
    const summary = report.summary;
    const parts = report.parts;
    const partRows = parts.rows.length
      ? parts.rows.map(row => '<tr><td>' + U.esc(row.name) + (row.sku ? '<div class="sub">' + U.esc(row.sku) + '</div>' : '') + '</td>' +
        '<td class="r">' + U.esc(U.fmtQty(row.qty)) + '</td>' +
        '<td class="r">' + U.esc(U.fmtQty(row.saleQty)) + '</td>' +
        '<td class="r">' + U.esc(U.fmtQty(row.serviceQty)) + '</td>' +
        '<td class="r">' + U.esc(U.money(row.value)) + '</td></tr>').join('')
      : '<tr><td colspan="5">No parts moved in this shift.</td></tr>';
    const content =
      '<div class="meta">' +
      '<span><b>Cashier:</b> ' + U.esc(cashier.name) + '</span>' +
      '<span><b>Shift:</b> ' + U.esc(U.fmtDate(session.openedAt)) + ' · ' + U.esc(U.fmtTime(session.openedAt)) + ' – ' + (report.closed ? U.esc(U.fmtTime(session.closedAt)) : 'open') + '</span>' +
      '<span><b>Status:</b> ' + (report.closed ? 'Closed' : 'Open') + '</span>' +
      '</div>' +
      '<div class="grid">' +
      '<div class="box"><span>Opening float</span><b>' + U.esc(U.money(summary.opening)) + '</b></div>' +
      '<div class="box"><span>Cash in</span><b>' + U.esc(U.money(summary.cashIn)) + '</b></div>' +
      '<div class="box"><span>Cash out</span><b>' + U.esc(U.money(summary.cashOut)) + '</b></div>' +
      '<div class="box"><span>Expected in drawer</span><b>' + U.esc(U.money(report.expected)) + '</b></div>' +
      '</div>' +
      (report.closed
        ? '<div class="totals"><div><span>Counted cash</span><span>' + U.esc(U.money(report.counted)) + '</span></div>' +
          '<div class="grand"><span>Variance</span><span>' + U.esc(report.varianceText) + '</span></div></div>'
        : '') +
      '<h3>Parts issued this shift</h3>' +
      '<table><thead><tr><th>Part</th><th class="r">Total qty</th><th class="r">Shop sale</th><th class="r">Service</th><th class="r">Value</th></tr></thead><tbody>' +
      partRows +
      '<tr><td><b>Total</b></td><td class="r"><b>' + U.esc(U.fmtQty(parts.qty)) + '</b></td><td class="r"><b>' + U.esc(U.fmtQty(parts.saleQty)) + '</b></td><td class="r"><b>' + U.esc(U.fmtQty(parts.serviceQty)) + '</b></td><td class="r"><b>' + U.esc(U.money(parts.value)) + '</b></td></tr>' +
      '</tbody></table>' +
      '<p class="sub">Part values are before bill-level discounts. Returns are recorded separately.</p>' +
      '<h3>Cash drawer</h3>' +
      '<table><thead><tr><th>Movement</th><th class="r">Amount</th></tr></thead><tbody>' +
      '<tr><td>Opening float</td><td class="r">' + U.esc(U.money(summary.opening)) + '</td></tr>' +
      '<tr><td>Cash sales</td><td class="r">' + U.esc(U.money(summary.saleCash)) + '</td></tr>' +
      '<tr><td>Cash service</td><td class="r">' + U.esc(U.money(summary.serviceCash)) + '</td></tr>' +
      '<tr><td>Cash collections & advances</td><td class="r">' + U.esc(U.money(summary.collectionsCash)) + '</td></tr>' +
      '<tr><td><b>Cash in</b></td><td class="r"><b>' + U.esc(U.money(summary.cashIn)) + '</b></td></tr>' +
      '<tr><td>Cash expenses & refunds</td><td class="r">− ' + U.esc(U.money(U.round2(summary.expensesCash + summary.refundsCash))) + '</td></tr>' +
      '<tr><td><b>Expected in drawer</b></td><td class="r"><b>' + U.esc(U.money(report.expected)) + '</b></td></tr>' +
      '</tbody></table>' +
      '<h3>Other payments</h3>' +
      '<table><thead><tr><th>Method</th><th class="r">Amount</th></tr></thead><tbody>' +
      '<tr><td>Card</td><td class="r">' + U.esc(U.money(summary.card)) + '</td></tr>' +
      '<tr><td>Online transfer</td><td class="r">' + U.esc(U.money(summary.online)) + '</td></tr>' +
      '<tr><td>Cheque</td><td class="r">' + U.esc(U.money(summary.cheque)) + '</td></tr>' +
      '<tr><td><b>Total card, online & cheque</b></td><td class="r"><b>' + U.esc(U.money(U.round2(summary.card + summary.online + summary.cheque))) + '</b></td></tr>' +
      '</tbody></table>' +
      '<h3>Shift activity</h3>' +
      '<table><thead><tr><th>Activity</th><th class="r">Count</th></tr></thead><tbody>' +
      '<tr><td>Shop sale bills</td><td class="r">' + summary.invoiceCount + '</td></tr>' +
      '<tr><td>Service bills</td><td class="r">' + summary.serviceCount + '</td></tr>' +
      '<tr><td>Customer collections</td><td class="r">' + summary.payments + '</td></tr>' +
      '<tr><td>Parts issued (units)</td><td class="r">' + U.esc(U.fmtQty(parts.qty)) + ' across ' + parts.rows.length + ' part' + (parts.rows.length === 1 ? '' : 's') + '</td></tr>' +
      '</tbody></table>' +
      (session.note ? '<p class="sub">Opening note: ' + U.esc(session.note) + '</p>' : '') +
      (session.closeNote ? '<p class="sub">Closing note: ' + U.esc(session.closeNote) + '</p>' : '');
    UI.printDocument({
      title: 'Shift report',
      meta: '<span><b>Shop:</b> ' + U.esc(S().data.settings.shopName) + '</span><span><b>Cashier:</b> ' + U.esc(cashier.name) + '</span><span><b>Status:</b> ' + (report.closed ? 'Closed' : 'Open') + '</span>',
      content: content
    });
  }

  function cashierModal(cashier) {
    const editing = !!cashier;
    const m = UI.modal({
      title: editing ? 'Edit cashier' : 'Add cashier',
      subtitle: editing ? 'Update the name or phone number.' : 'Add the person, then set a username and password so they can sign in.',
      size: 'md',
      body:
        '<form id="cashier-form"><div class="form-grid">' +
        '<div class="field full"><label class="label" for="ch-name">Cashier name</label>' +
        '<input class="input" id="ch-name" name="name" required autocomplete="off" placeholder="e.g. Nimal" value="' + U.attr(editing ? cashier.name : '') + '"></div>' +
        '<div class="field full"><label class="label" for="ch-phone">Phone <span class="opt">(optional)</span></label>' +
        '<input class="input" id="ch-phone" name="phone" autocomplete="off" placeholder="07X XXX XXXX" value="' + U.attr(editing ? cashier.phone : '') + '"></div>' +
        '</div></form>' +
        (editing
          ? '<div class="pay-note mt-12">Change this cashier’s username or reset their password from the key button on their card.</div>'
          : '<div class="pay-note mt-12">After adding, you will be asked to create a username and password for this cashier. Only the shop admin can reset them.</div>'),
      footer: '<button type="button" class="btn" data-modal-close>Cancel</button>' +
        '<button type="submit" class="btn btn-primary" form="cashier-form">' + UI.icon('check', 15) + (editing ? 'Save changes' : 'Add cashier') + '</button>'
    });
    const form = m.panel.querySelector('#cashier-form');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const submit = m.panel.querySelector('[type="submit"][form="cashier-form"]');
      const values = UI.formValues(form);
      try {
        await UI.withLoading(submit, async () => {
          const saved = editing ? await S().updateCashier(cashier.id, values) : await S().addCashier(values);
          m.close();
          UI.toast(editing ? 'Cashier updated.' : 'Cashier ' + saved.name + ' added. Now create their sign-in.');
          APP().dataChanged();
          if (!editing && WP.auth && WP.auth.openCashierLoginModal) {
            WP.auth.openCashierLoginModal(saved);
          }
        });
      } catch (err) { UI.toast(err.userMessage || err.message || 'Could not save cashier.', 'error'); }
    });
  }

  V.cashiers = {
    render() {
      return screen();
    },
    mount(content) {
      const scope = content.querySelector('#view-root') || content;
      scope.addEventListener('click', e => {
        if (e.target.closest('[data-my-account]')) {
          if (WP.auth) WP.auth.openAccountModal();
          return;
        }
        if (e.target.closest('[data-add-cashier]')) {
          if (!restricted()) cashierModal(null);
          return;
        }
        const shiftReport = e.target.closest('[data-shift-report]');
        if (shiftReport) {
          const id = Number(shiftReport.dataset.shiftReport);
          const session = S().openSessionFor(id);
          if (session) shiftReportModal(id, session);
          return;
        }
        const sessionRow = e.target.closest('[data-session-report]');
        if (sessionRow) {
          const id = Number(sessionRow.dataset.sessionReport);
          const session = S().data.cashierSessions.find(s => Number(s.id) === id);
          if (session) shiftReportModal(session.cashierId, session);
          return;
        }
        const open = e.target.closest('[data-open-session]');
        if (open) { openSessionModal(Number(open.dataset.openSession)); return; }
        const close = e.target.closest('[data-close-session]');
        if (close) { closeSessionModal(Number(close.dataset.closeSession)); return; }
        const sw = e.target.closest('[data-switch-cashier]');
        if (sw) {
          if (restricted()) return;
          const id = Number(sw.dataset.switchCashier);
          APP().setActiveCashier(id);
          UI.toast((S().cashierById(id) || {}).name + ' is now the active cashier.');
          APP().refresh();
          return;
        }
        const login = e.target.closest('[data-cashier-login]');
        if (login) {
          if (restricted()) return;
          const target = S().cashierById(Number(login.dataset.cashierLogin));
          if (target && WP.auth) WP.auth.openCashierLoginModal(target);
          return;
        }
        const edit = e.target.closest('[data-edit-cashier]');
        if (edit) {
          if (restricted()) return;
          cashierModal(S().cashierById(Number(edit.dataset.editCashier)));
          return;
        }
        if (e.target.closest('[data-export-sessions]')) exportSessions();
      });
    },
    refresh() {
      APP().renderRoute(true);
    }
  };
})();
