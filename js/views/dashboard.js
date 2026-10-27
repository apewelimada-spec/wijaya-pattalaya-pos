(function () {
  'use strict';
  const WP = window.WP = window.WP || {};
  const U = WP.utils;
  const UI = WP.ui;
  const C = WP.components;
  const V = WP.views = WP.views || {};

  function store() { return WP.store; }
  function app() { return WP.app; }
  function cashierMode() { return !!(WP.auth && WP.auth.isCashier && WP.auth.isCashier()); }

  function statCard(opts) {
    return '<div class="stat-card' + (opts.dark ? ' dark' : '') + (opts.accent ? ' accent' : '') + '">' +
      '<div class="stat-top"><span class="stat-label">' + U.esc(opts.label) + '</span>' +
      '<span class="stat-icon ' + (opts.tone || 'green') + '">' + UI.icon(opts.icon || 'chart', 16) + '</span></div>' +
      '<div class="stat-value' + (opts.small ? ' sm' : '') + '">' + opts.value + '</div>' +
      '<div class="stat-meta">' + (opts.meta || '') + '</div></div>';
  }

  function invoiceRow(inv) {
    return '<div class="glance-row" data-invoice="' + inv.id + '" style="cursor:pointer">' +
      '<span class="glance-ico">' + UI.icon(inv.type === 'wholesale' ? 'building' : 'receipt', 15) + '</span>' +
      '<div class="glance-main"><div class="glance-title">' + U.esc(inv.no) + ' · ' + U.esc(inv.customerName || 'Walk-in') + '</div>' +
      '<div class="glance-sub">' + U.fmtTime(inv.createdAt) + ' · ' + UI.methodLabel(inv.method) + (inv.type === 'wholesale' ? ' · wholesale' : '') + '</div></div>' +
      '<div class="glance-val">' + U.money(inv.total) + (Number(inv.balance) > 0 ? '<div class="glance-sub" style="color:var(--danger)">' + U.money(inv.balance) + ' due</div>' : '<div class="glance-sub" style="color:var(--success)">Paid</div>') + '</div></div>';
  }

  function serviceRow(svc) {
    return '<div class="glance-row" data-service="' + svc.id + '" style="cursor:pointer">' +
      '<span class="glance-ico">' + UI.icon('wrench', 15) + '</span>' +
      '<div class="glance-main"><div class="glance-title">' + U.esc(svc.customerName || 'Walk-in') + ' · ' + U.esc(svc.technician) + '</div>' +
      '<div class="glance-sub">' + U.esc(svc.machineType || 'Machine') + (svc.regNo ? ' · ' + U.esc(svc.regNo) : '') + ' · ' + U.fmtTime(svc.createdAt) + '</div></div>' +
      '<div class="glance-val">' + U.money(svc.total) + (Number(svc.balance) > 0 ? '<div class="glance-sub" style="color:var(--danger)">' + U.money(svc.balance) + ' due</div>' : '<div class="glance-sub" style="color:var(--success)">Paid</div>') + '</div></div>';
  }

  function partRow(part) {
    return '<div class="glance-row">' +
      '<span class="glance-ico">' + UI.icon('box', 15) + '</span>' +
      '<div class="glance-main"><div class="glance-title">' + U.esc(part.name) + '</div>' +
      '<div class="glance-sub">' + U.fmtQty(part.qty) + ' sold today</div></div>' +
      '<div class="glance-val">' + U.money(part.revenue) + '</div></div>';
  }

  function todayTabContent(d, tab) {
    if (tab === 'services') {
      return d.todayServices.length ? d.todayServices.map(serviceRow).join('')
        : UI.emptyState({ compact: true, icon: 'wrench', title: 'No service jobs today', text: 'Create a service bill when a machine comes into the workshop.' });
    }
    if (tab === 'parts') {
      return d.todayParts.length ? d.todayParts.map(partRow).join('')
        : UI.emptyState({ compact: true, icon: 'box', title: 'No parts moved today', text: 'Parts sold at the counter and used in service jobs will appear here.' });
    }
    return d.todayInvoices.length ? d.todayInvoices.map(invoiceRow).join('')
      : UI.emptyState({ compact: true, icon: 'receipt', title: 'No sales today yet', text: 'Start a sale and this feed will show every invoice as it is billed.' });
  }

  function heroHTML(d) {
    const settings = store().data.settings;
    const session = d.cashier ? store().openSessionFor(d.cashier.id) : null;
    const lowText = d.lowStockCount
      ? '<span style="color:#efc88d">' + d.lowStockCount + ' item' + (d.lowStockCount === 1 ? '' : 's') + ' need restocking</span>'
      : 'Stock levels look healthy';
    return '<section class="hero">' +
      '<div class="hero-tractor">' + UI.icon('tractor', 130) + '</div>' +
      '<div><div class="hero-eyebrow"><span class="dot"></span>' + U.esc(UI.pageDateLabel()) + ' · ' + (session ? 'Counter open' : 'Counter not opened') + '</div>' +
      '<h2 class="hero-title">Today at <em>' + U.esc(settings.shopName || 'Wijaya Pattalaya') + '</em>.</h2>' +
      '<div class="hero-sub">Spare parts, workshop service and machine sales — all recorded in one offline ledger.</div>' +
      '<div class="hero-revenue"><span class="cur">' + U.esc(U.symbol()) + '</span><span class="amount">' + U.fmtNumber(d.totals.revenue) + '</span>' +
      '<span class="delta">' + d.totals.invoicesCount + ' invoice' + (d.totals.invoicesCount === 1 ? '' : 's') + ' · ' + d.totals.servicesCount + ' service' + (d.totals.servicesCount === 1 ? '' : 's') + '</span></div>' +
      '<div class="hero-split">' +
      '<div><div class="hero-mini-label">Shop sales (net)</div><div class="hero-mini-value">' + U.money(d.totals.netShop) + '</div></div>' +
      '<div><div class="hero-mini-label">Service (net)</div><div class="hero-mini-value">' + U.money(d.totals.netService) + '</div></div>' +
      '<div><div class="hero-mini-label">Cash & payments in</div><div class="hero-mini-value">' + U.money(d.totals.collected) + '</div></div>' +
      '</div>' +
      '<div class="hero-actions"><a class="btn btn-gold" href="#/billing/new">' + UI.icon('cart', 15) + 'New sale</a>' +
      '<a class="btn btn-outline-light" href="#/service/new">' + UI.icon('wrench', 15) + 'New service</a>' +
      '<a class="btn btn-outline-light" href="#/expenses">' + UI.icon('wallet', 15) + 'Record expense</a></div></div>' +
      '<div class="hero-side"><div class="hero-side-title">Shop at a glance</div><div class="hero-list">' +
      '<div class="hero-list-row"><span class="hero-list-left"><span class="ico">' + UI.icon('clock', 13) + '</span>Customer credit</span><b>' + U.money(d.receivables) + '</b></div>' +
      '<div class="hero-list-row"><span class="hero-list-left"><span class="ico">' + UI.icon('coins', 13) + '</span>Customer advances</span><b>' + U.money(d.advances) + '</b></div>' +
      '<div class="hero-list-row"><span class="hero-list-left"><span class="ico">' + UI.icon('truck', 13) + '</span>Machines sold this month</span><b>' + U.fmtQty(d.machinesSoldMonth) + '</b></div>' +
      '<div class="hero-list-row"><span class="hero-list-left"><span class="ico">' + UI.icon('alert', 13) + '</span>Stock watch</span><b>' + lowText + '</b></div>' +
      '</div>' + (store().data.items.length === 0 && !cashierMode() ? '<div class="hero-empty-note">New here? Add your spare parts first — then sales, service and credit all work from one catalogue.</div>' : '') + '</div>' +
      '</section>';
  }

  function chartHTML(d) {
    const max = Math.max(1, ...d.week.map(w => Math.max(w.sales, w.service)));
    const bars = d.week.map(w => {
      const shopH = w.sales > 0 ? Math.max(2, Math.round((w.sales / max) * 100)) : 0;
      const serviceH = w.service > 0 ? Math.max(2, Math.round((w.service / max) * 100)) : 0;
      return '<div class="chart-col"><div class="chart-bars">' +
        '<div class="bar shop" style="height:' + shopH + '%" data-tip="' + U.attr('Shop ' + U.money(w.sales)) + '"></div>' +
        '<div class="bar service" style="height:' + serviceH + '%" data-tip="' + U.attr('Service ' + U.money(w.service)) + '"></div>' +
        '</div></div>';
    }).join('');
    const hasAny = d.week.some(w => w.sales > 0 || w.service > 0);
    return '<div class="card"><div class="card-head"><div><div class="card-title">Last seven days</div>' +
      '<div class="card-sub">Shop sales and workshop service, net of returns.</div></div>' +
      '<div class="legend"><span><i class="s1"></i>Shop</span><span><i class="s2"></i>Service</span></div></div>' +
      '<div class="chart-wrap"><div class="chart">' + (hasAny ? bars : '<div class="chart-empty">No sales in the last seven days yet.</div>') + '</div>' +
      '<div class="chart-x">' + d.week.map(w => '<span class="' + (w.date === d.date ? 'today' : '') + '">' + U.esc(w.label) + '</span>').join('') + '</div>' +
      '</div></div>';
  }

  function todayCardHTML(d) {
    const counts = { invoices: d.todayInvoices.length, services: d.todayServices.length, parts: d.todayParts.length };
    return '<div class="card"><div class="card-head"><div><div class="card-title">Today at the counter</div>' +
      '<div class="card-sub">Tap any entry to open the invoice, service bill or part.</div></div>' +
      '<a class="link-btn" href="#/billing">All invoices ' + UI.icon('arrowRight', 13) + '</a></div>' +
      '<nav class="tabs today-tabs" role="tablist">' +
      '<button type="button" class="tab active" data-today-tab="invoices">Invoices <span class="tab-count">' + counts.invoices + '</span></button>' +
      '<button type="button" class="tab" data-today-tab="services">Service <span class="tab-count">' + counts.services + '</span></button>' +
      '<button type="button" class="tab" data-today-tab="parts">Parts <span class="tab-count">' + counts.parts + '</span></button>' +
      '</nav><div class="today-content" data-today-content>' + todayTabContent(d, 'invoices') + '</div></div>';
  }

  function drawerHTML(d) {
    if (!d.drawer) {
      return '<div class="card drawer-card"><div class="card-head"><div><div class="card-title">Cash drawer</div>' +
        '<div class="card-sub">No counter session is open.</div></div><span class="badge grey">Closed</span></div>' +
        '<div class="card-body">' + UI.emptyState({ compact: true, icon: 'coins', title: 'Open a session before trading', text: 'Enter the cash you start with, then close at night to reconcile.' }) +
        '<a class="btn btn-primary btn-block mt-12" href="#/cashiers">Open a cashier session</a></div></div>';
    }
    const summary = d.drawer.summary;
    const cashier = d.drawer.cashier || d.cashier || store().cashierById(d.drawer.session.cashierId);
    const isMine = activeCashierIdMatch(d);
    return '<div class="card drawer-card"><div class="card-head"><div><div class="card-title">Cash drawer</div>' +
      '<div class="card-sub">' + U.esc(cashier ? cashier.name : 'Counter') + (isMine ? ' · your session' : ' · open session') + '</div></div>' +
      '<span class="session-ribbon open">Open</span></div><div class="card-body">' +
      '<div class="drawer-row"><span>Opening cash</span><b>' + U.money(summary.opening) + '</b></div>' +
      '<div class="drawer-row"><span>Cash in (sales & collections)</span><b>' + U.money(summary.cashIn) + '</b></div>' +
      '<div class="drawer-row"><span>Cash out (expenses & refunds)</span><b>− ' + U.money(summary.cashOut) + '</b></div>' +
      '<div class="drawer-total"><span>Expected in drawer</span><b>' + U.money(summary.expected) + '</b></div>' +
      '<div class="btn-row mt-12"><a class="btn btn-primary btn-sm" href="#/cashiers">Manage & close</a>' +
      '<span class="tiny muted">' + summary.invoiceCount + ' sales · ' + summary.serviceCount + ' jobs</span></div>' +
      '</div></div>';
  }

  function activeCashierIdMatch(d) {
    const active = app().getActiveCashierId();
    return d.drawer && Number(d.drawer.session.cashierId) === Number(active);
  }

  function lowStockHTML(d) {
    const rows = d.lowStock.length ? d.lowStock.map(item =>
      '<div class="low-row"><span class="glance-ico">' + UI.icon('box', 14) + '</span>' +
      '<div class="low-main"><div class="low-name">' + U.esc(item.name) + '</div><div class="low-sub">' + U.esc(item.group || 'Part') + ' · ' + U.esc(item.sku || '') + '</div></div>' +
      '<span class="low-qty">' + U.fmtQty(item.qty) + '</span></div>').join('')
      : UI.emptyState({ compact: true, icon: 'checkCircle', title: 'Nothing low on stock', text: 'Every part is above its reorder level.' });
    return '<div class="card"><div class="card-head"><div><div class="card-title">Low stock</div>' +
      '<div class="card-sub">' + (d.lowStockCount ? d.lowStockCount + ' item' + (d.lowStockCount === 1 ? '' : 's') + ' at or below reorder level' : 'All parts are stocked well') + '</div></div>' +
      '<a class="icon-btn" href="#/parts" title="Open inventory">' + UI.icon('arrowRight', 15) + '</a></div>' +
      '<div class="card-body" style="padding-top:12px">' + rows + '</div></div>';
  }

  function techHTML(d) {
    const rows = d.techniciansMonth.length ? d.techniciansMonth.map((t, i) =>
      '<div class="tech-row"><span class="tech-rank">' + String(i + 1).padStart(2, '0') + '</span>' +
      '<div class="tech-main"><div class="tech-name">' + U.esc(t.name || 'Unassigned') + '</div>' +
      '<div class="tech-meta">' + t.jobs + ' job' + (t.jobs === 1 ? '' : 's') + ' this month</div></div>' +
      '<div class="tech-total">' + U.money(t.total) + '</div></div>').join('')
      : UI.emptyState({ compact: true, icon: 'wrench', title: 'No service by name yet', text: 'Service jobs you record this month will be grouped by technician.' });
    return '<div class="card"><div class="card-head"><div><div class="card-title">Service by name</div>' +
      '<div class="card-sub">This month, ranked by service value.</div></div>' +
      (cashierMode() ? '' : '<a class="icon-btn" href="#/reports" title="Service report">' + UI.icon('chart', 15) + '</a>') + '</div>' +
      '<div class="card-body" style="padding-top:12px">' + rows + '</div></div>';
  }

  function quickHTML() {
    const tiles = cashierMode()
      ? '<button type="button" class="quick-tile" data-quick="customer"><span class="qico">' + UI.icon('userPlus', 14) + '</span>Customer</button>' +
        '<button type="button" class="quick-tile gold" data-quick="sale"><span class="qico">' + UI.icon('cart', 14) + '</span>New sale</button>' +
        '<button type="button" class="quick-tile" data-quick="service"><span class="qico">' + UI.icon('wrench', 14) + '</span>New service</button>' +
        '<button type="button" class="quick-tile" data-quick="expenses"><span class="qico">' + UI.icon('wallet', 14) + '</span>Expense</button>'
      : '<button type="button" class="quick-tile" data-quick="part"><span class="qico">' + UI.icon('plus', 14) + '</span>Add part</button>' +
        '<button type="button" class="quick-tile gold" data-quick="machine"><span class="qico">' + UI.icon('truck', 14) + '</span>Add machine</button>' +
        '<button type="button" class="quick-tile" data-quick="customer"><span class="qico">' + UI.icon('userPlus', 14) + '</span>Customer</button>' +
        '<button type="button" class="quick-tile" data-quick="reports"><span class="qico">' + UI.icon('chart', 14) + '</span>Reports</button>';
    return '<div class="card"><div class="card-head"><div><div class="card-title">Quick actions</div>' +
      '<div class="card-sub">Everyday shop errands.</div></div></div><div class="card-body">' +
      '<div class="quick-tiles">' + tiles + '</div></div></div>';
  }

  V.dashboard = {
    render() {
      const d = store().dashboard(app().getActiveCashierId());
      const noData = store().data.items.length === 0 && store().data.invoices.length === 0 && store().data.services.length === 0;
      const onboarding = noData && !cashierMode() ? '<div class="warning-banner"><span class="banner-ico">' + UI.icon('info', 16) + '</span>' +
        '<span><b>Welcome to ' + U.esc(store().data.settings.shopName) + '.</b> Begin by adding your spare parts or a machine, then bill your first sale or service.</span>' +
        '<span class="spacer"></span><a class="btn btn-sm btn-gold" href="#/parts">Add inventory</a></div>' : '';
      const head = UI.pageHead({
        eyebrow: 'Overview · ' + U.fmtDate(d.date, { mode: 'medium' }),
        title: 'The shop, at a glance.',
        subtitle: 'Live picture of today’s counter, workshop and the cash in your drawer.',
        actions: (cashierMode() ? '' : '<a class="btn" href="#/reports">' + UI.icon('chart', 15) + 'Reports</a>') +
          '<a class="btn btn-primary" href="#/billing/new">' + UI.icon('plus', 15) + 'New sale</a>'
      });
      const stats = '<div class="stat-grid mt-16">' +
        statCard({ label: 'Invoices today', icon: 'receipt', tone: 'green', value: U.fmtNumber(d.totals.invoicesCount, 0), meta: '<b>' + U.money(d.totals.netShop) + '</b> shop sales net' }) +
        statCard({ label: 'Service jobs today', icon: 'wrench', tone: 'gold', value: U.fmtNumber(d.totals.servicesCount, 0), meta: '<b>' + U.money(d.totals.netService) + '</b> service net' }) +
        statCard({ label: 'Parts moved today', icon: 'box', tone: 'blue', value: U.fmtQty(d.totals.partsSoldQty), meta: 'Counter + workshop parts' }) +
        statCard({ label: 'Machines sold', icon: 'truck', tone: 'green', value: U.fmtNumber(d.machinesSoldMonth, 0), meta: '<b>' + U.fmtNumber(d.machinesSoldAll, 0) + '</b> sold all-time', accent: true }) +
        '</div>';
      return head + onboarding + heroHTML(d) + stats +
        '<div class="dash-main"><div class="stack">' + chartHTML(d) + todayCardHTML(d) + '</div>' +
        '<div class="dash-side">' + drawerHTML(d) + lowStockHTML(d) + techHTML(d) + quickHTML() + '</div></div>';
    },

    mount(root) {
      const d = store().dashboard(app().getActiveCashierId());
      const tabs = root.querySelectorAll('[data-today-tab]');
      const content = root.querySelector('[data-today-content]');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          tabs.forEach(t => t.classList.toggle('active', t === tab));
          content.innerHTML = todayTabContent(d, tab.dataset.todayTab);
          bindRows(root);
        });
      });

      function bindRows(scope) {
        scope.querySelectorAll('[data-invoice]').forEach(row => {
          row.addEventListener('click', () => C.invoiceDetailModal(Number(row.dataset.invoice), { onChanged: () => app().dataChanged() }));
        });
        scope.querySelectorAll('[data-service]').forEach(row => {
          row.addEventListener('click', () => C.serviceDetailModal(Number(row.dataset.service), { onChanged: () => app().dataChanged() }));
        });
      }
      bindRows(root);

      root.querySelectorAll('[data-quick]').forEach(btn => {
        btn.addEventListener('click', () => {
          const q = btn.dataset.quick;
          if (q === 'part') C.itemModal({ category: 'part' });
          else if (q === 'machine') C.itemModal({ category: 'machine' });
          else if (q === 'customer') C.addCustomerModal();
          else if (q === 'reports') location.hash = '#/reports';
          else if (q === 'sale') location.hash = '#/billing/new';
          else if (q === 'service') location.hash = '#/service/new';
          else if (q === 'expenses') location.hash = '#/expenses';
        });
      });
    },

    refresh() {
      app().renderRoute(true);
    }
  };
})();
