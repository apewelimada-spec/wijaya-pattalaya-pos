(function () {
  'use strict';
  const WP = window.WP = window.WP || {};
  const U = WP.utils;
  const UI = WP.ui;
  const S = WP.store;
  const APP = {};
  const LS_ACTIVE = 'wijaya-pos-active-cashier';

  const NAV = [
    { section: 'Counter' },
    { key: 'dashboard', href: '#/dashboard', icon: 'dashboard', label: 'Dashboard' },
    { key: 'billing-new', href: '#/billing/new', icon: 'cart', label: 'New sale' },
    { key: 'service-new', href: '#/service/new', icon: 'wrench', label: 'New service' },
    { key: 'bills', href: '#/bills', icon: 'search', label: 'Bill search' },
    { key: 'quotations', href: '#/quotations', icon: 'receipt', label: 'Quotations' },
    { section: 'Catalogue' },
    { key: 'parts', href: '#/parts', icon: 'box', label: 'Spare parts', badge: 'lowstock' },
    { key: 'machines', href: '#/machines', icon: 'truck', label: 'Machines & tractors' },
    { key: 'suppliers', href: '#/suppliers', icon: 'building', label: 'Suppliers' },
    { section: 'Workshop' },
    { key: 'service', href: '#/service', icon: 'wrench', label: 'Service jobs' },
    { key: 'customers', href: '#/customers', icon: 'users', label: 'Customers' },
    { key: 'jobcards', href: '#/jobcards', icon: 'fileText', label: 'Job cards' },
    { section: 'Money' },
    { key: 'expenses', href: '#/expenses', icon: 'wallet', label: 'Expenses' },
    { key: 'cashiers', href: '#/cashiers', icon: 'coins', label: 'Cashiers' },
    { key: 'cheques', href: '#/cheques', icon: 'banknote', label: 'Cheques' },
    { key: 'reports', href: '#/reports', icon: 'chart', label: 'Reports' },
    { section: 'System' },
    { key: 'settings', href: '#/settings', icon: 'settings', label: 'Settings' }
  ];

  const ADMIN_NAV_KEYS = ['reports', 'settings', 'suppliers'];

  let activeCashierId = null;
  let currentRoute = null;
  let currentView = null;
  let prefillItemId = null;
  let lastRouteKey = '';
  let shellStarted = false;

  function authReady() {
    return !!(WP.auth && typeof WP.auth.isConfigured === 'function' && WP.auth.isConfigured());
  }

  function cashierSession() {
    return authReady() && WP.auth.isCashier();
  }

  function parseHash() {
    const raw = String(location.hash || '').replace(/^#\/?/, '');
    const clean = raw.split('?')[0];
    const segments = clean.split('/').filter(Boolean);
    return { name: segments[0] || 'dashboard', sub: segments[1] || '', raw: clean };
  }

  function routeMeta(route) {
    switch (route.name) {
      case 'dashboard': return { title: 'Dashboard', section: 'Overview' };
      case 'billing': return route.sub === 'new'
        ? { title: 'New sale', section: 'Counter' }
        : { title: 'Invoices', section: 'Counter' };
      case 'parts': return route.sub === 'moves'
        ? { title: 'Stock movements', section: 'Spare parts' }
        : { title: 'Spare parts', section: 'Catalogue' };
      case 'machines': return { title: 'Machines & tractors', section: 'Catalogue' };
      case 'service': return route.sub === 'new'
        ? { title: 'New service bill', section: 'Workshop' }
        : { title: 'Service jobs', section: 'Workshop' };
      case 'bills': return route.sub === 'sales'
        ? { title: 'Shop sale bills', section: 'Counter' }
        : route.sub === 'service'
          ? { title: 'Service bills', section: 'Counter' }
          : { title: 'Bill search', section: 'Counter' };
      case 'customers': return { title: 'Customers', section: 'Workshop' };
      case 'jobcards': return route.sub === 'new'
        ? { title: 'New job card', section: 'Workshop' }
        : { title: 'Job cards', section: 'Workshop' };
      case 'quotations': return route.sub === 'new'
        ? { title: 'New quotation', section: 'Counter' }
        : { title: 'Quotations', section: 'Counter' };
      case 'suppliers': return route.sub === 'payments'
        ? { title: 'Supplier cheques & advances', section: 'Catalogue' }
        : { title: 'Suppliers', section: 'Catalogue' };
      case 'cheques': return { title: 'Cheque reminders', section: 'Money' };
      case 'expenses': return { title: 'Expenses', section: 'Money' };
      case 'cashiers': return { title: 'Cashiers', section: 'Money' };
      case 'reports': return route.sub === 'local'
        ? { title: 'Local & Import report', section: 'Money' }
        : route.sub === 'export'
          ? { title: 'Export reports', section: 'Money' }
          : { title: 'Reports', section: 'Money' };
      case 'settings': return { title: 'Settings', section: 'System' };
      default: return { title: 'Dashboard', section: 'Overview' };
    }
  }

  function activeNavKey(route) {
    if (route.name === 'billing') return route.sub === 'new' ? 'billing-new' : 'billing-new';
    if (route.name === 'service') return route.sub === 'new' ? 'service-new' : 'service';
    return route.name;
  }

  function viewFor(route) {
    const views = WP.views || {};
    const name = route.name;
    if (name === 'billing') return views.billing;
    if (name === 'service') return views.services || views.service;
    if (name === 'bills') return views.bills;
    if (name === 'parts') return views.parts;
    if (name === 'machines') return views.machines;
    if (name === 'dashboard') return views.dashboard;
    if (name === 'customers') return views.customers;
    if (name === 'jobcards') return views.jobcards;
    if (name === 'quotations') return views.quotations;
    if (name === 'suppliers') return views.suppliers;
    if (name === 'cheques') return views.cheques;
    if (name === 'expenses') return views.expenses;
    if (name === 'cashiers') return views.cashiers;
    if (name === 'reports') return views.reports;
    if (name === 'settings') return views.settings;
    return views.dashboard;
  }

  /* ---------------- cashier ---------------- */
  function activeCashier() {
    return activeCashierId ? S.cashierById(activeCashierId) : null;
  }

  function loadActiveCashier() {
    if (cashierSession()) {
      const mine = S.cashierById(WP.auth.getCashierId());
      activeCashierId = mine && mine.active !== false ? mine.id : null;
      return;
    }
    let stored = null;
    try { stored = Number(localStorage.getItem(LS_ACTIVE)) || null; } catch (e) { stored = null; }
    let cashier = stored ? S.cashierById(stored) : null;
    if (!cashier || cashier.active === false) cashier = S.activeCashiers()[0] || S.data.cashiers[0] || null;
    activeCashierId = cashier ? cashier.id : null;
  }

  function setActiveCashier(id) {
    if (cashierSession() && Number(id) !== Number(WP.auth.getCashierId())) {
      UI.toast('Only the shop admin can switch cashier accounts.', 'error');
      return;
    }
    const cashier = S.cashierById(id);
    if (!cashier) return;
    activeCashierId = cashier.id;
    try { localStorage.setItem(LS_ACTIVE, String(cashier.id)); } catch (e) { /* private mode */ }
    renderTopbar();
    renderNav();
    if (typeof APP.afterCashierChange === 'function') APP.afterCashierChange(cashier);
  }

  function openCashierPicker() {
    if (cashierSession()) {
      WP.auth.openAccountModal();
      return;
    }
    const cashiers = S.activeCashiers();
    const rows = cashiers.map(c => {
      const session = S.openSessionFor(c.id);
      const summary = session ? S.sessionSummary(c.id, session) : null;
      return '<button type="button" class="cashier-pick-row" data-pick-cashier="' + c.id + '" style="display:flex;align-items:center;gap:11px;width:100%;padding:11px;border:1px solid ' +
        (Number(c.id) === Number(activeCashierId) ? 'var(--brand)' : 'var(--line)') + ';border-radius:10px;background:' +
        (Number(c.id) === Number(activeCashierId) ? 'var(--brand-wash)' : 'var(--surface)') + ';margin-bottom:7px;text-align:left">' +
        UI.avatar(c.name) +
        '<span style="flex:1;min-width:0"><span style="display:block;font-size:12.5px;font-weight:600">' + U.esc(c.name) + '</span>' +
        '<span style="display:block;font-size:10px;color:var(--muted)">' +
        (session ? 'Session open · ' + U.money(summary.expected) + ' expected' : 'No session open') + '</span></span>' +
        (Number(c.id) === Number(activeCashierId) ? '<span class="badge green">Active</span>' :
          '<span class="session-ribbon ' + (session ? 'open' : '') + '">' + (session ? 'Open' : 'Closed') + '</span>') +
        '</button>';
    }).join('');
    const m = UI.modal({
      title: 'Switch cashier',
      subtitle: 'Sales, collections and expenses are recorded against the active cashier.',
      size: 'md',
      body: rows || UI.emptyState({ compact: true, icon: 'users', title: 'No cashiers yet', text: 'Add a cashier from the Cashiers page first.' }),
      footer: '<a class="btn" href="#/cashiers" data-close-picker>Manage cashiers</a>' +
        '<button type="button" class="btn btn-primary" data-modal-close>Done</button>'
    });
    m.panel.querySelectorAll('[data-pick-cashier]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.pickCashier);
        setActiveCashier(id);
        m.close();
        const c = S.cashierById(id);
        const session = S.openSessionFor(id);
        UI.toast(c.name + ' is now the active cashier' + (session ? '.' : ' — open a counter session when you start.'));
        APP.refresh();
      });
    });
    const manage = m.panel.querySelector('[data-close-picker]');
    if (manage) manage.addEventListener('click', () => m.close());
    return m;
  }

  /* ---------------- chrome ---------------- */
  function brandHTML() {
    const shop = S.data.settings;
    return '<div class="brand">' +
      '<span class="brand-seal">' + UI.icon('tractor', 28) + '</span>' +
      '<div><div class="brand-name">' + U.esc(shop.shopName || 'Wijaya Pattalaya') + '</div>' +
      '<div class="brand-tag">' + U.esc(shop.tagline || 'Offline POS') + '</div></div></div>';
  }

  function navHTML() {
    const lowStockCount = S.lowStockItems().length;
    const restricted = cashierSession();
    let html = '';
    let section = null;
    NAV.forEach(item => {
      if (item.section) { section = item.section; return; }
      if (restricted && ADMIN_NAV_KEYS.indexOf(item.key) !== -1) return;
      if (section !== null) { html += '<div class="nav-section">' + U.esc(section) + '</div>'; section = null; }
      const badge = item.badge === 'lowstock' && lowStockCount > 0
        ? '<span class="nav-badge">' + lowStockCount + '</span>' : '';
      html += '<a class="nav-item" href="' + item.href + '" data-nav="' + item.key + '">' +
        '<span class="nav-ico">' + UI.icon(item.icon, 17) + '</span><span>' + U.esc(item.label) + '</span>' + badge + '</a>';
    });
    return html;
  }

  function renderNav() {
    const nav = document.getElementById('nav-scroll');
    if (nav) nav.innerHTML = navHTML();
    markActiveNav();
  }

  function markActiveNav() {
    if (!currentRoute) return;
    const key = activeNavKey(currentRoute);
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.nav === key);
    });
  }

  function topbarHTML(meta) {
    const cashier = activeCashier();
    const session = cashier ? S.openSessionFor(cashier.id) : null;
    const lowCount = S.lowStockItems().length;
    const crumbs = '<div class="crumbs"><a class="home" href="#/dashboard">' + U.esc(S.data.settings.shopName || 'Wijaya Pattalaya') + '</a>' +
      '<span class="sep">/</span><span class="current">' + U.esc(meta.title) + '</span></div>';
    return '<div class="flex-center gap-12" style="min-width:0">' +
      '<button type="button" class="icon-btn bordered menu-btn" id="menu-btn" aria-label="Open menu">' + UI.icon('menu', 17) + '</button>' +
      crumbs + '</div>' +
      '<div class="topbar-actions">' +
      '<a class="btn btn-sm btn-primary" href="#/billing/new">' + UI.icon('plus', 14) + '<span class="btn-label">New sale</span></a>' +
      (lowCount > 0 ? '<a class="btn btn-sm" href="#/parts" title="Low stock items" style="color:var(--warning)">' + UI.icon('alert', 14) + '<span class="btn-label">' + lowCount + ' low</span></a>' : '') +
      '<span class="top-date">' + UI.icon('calendar', 14) + U.esc(UI.pageDateLabel()) + '</span>' +
      '<button type="button" class="cashier-chip" id="cashier-chip" title="' + (cashierSession() ? 'My account' : 'Switch cashier') + '">' +
      UI.avatar(cashier ? cashier.name : '?') +
      '<span class="cashier-chip-text"><small>' + (cashierSession() ? 'Signed in' : 'Cashier') + '</small><b>' + U.esc(cashier ? cashier.name : 'None') + '</b></span>' +
      UI.statusDot(!!session) + '</button>' +
      '</div>';
  }

  function renderTopbar() {
    const bar = document.querySelector('.topbar');
    if (!bar) return;
    const meta = routeMeta(currentRoute || { name: 'dashboard', sub: '' });
    bar.innerHTML = topbarHTML(meta);
    const menu = bar.querySelector('#menu-btn');
    if (menu) menu.addEventListener('click', toggleSidebar);
    const chip = bar.querySelector('#cashier-chip');
    if (chip) {
      chip.addEventListener('click', () => {
        if (cashierSession()) WP.auth.openAccountModal();
        else openCashierPicker();
      });
    }
  }

  function userCardHTML() {
    const user = WP.auth && WP.auth.getUser ? WP.auth.getUser() : null;
    if (!user) return '';
    const isAdminUser = user.role === 'admin';
    return '<div class="signed-user">' +
      UI.avatar(user.name) +
      '<div class="signed-user-text"><b>' + U.esc(user.name) + '</b>' +
      '<small>' + (isAdminUser ? 'Administrator' : 'Cashier') + ' · @' + U.esc(user.username) + '</small></div>' +
      '<button type="button" class="signed-user-btn" data-account title="My account" aria-label="My account">' + UI.icon('user', 15) + '</button>' +
      '<button type="button" class="signed-user-btn" data-signout title="Sign out" aria-label="Sign out">' + UI.icon('logout', 15) + '</button>' +
      '</div>';
  }

  function sidebarFootHTML() {
    return userCardHTML() +
      '<div class="offline-chip"><span class="offline-dot"></span>' +
      '<div>Works fully offline.<br>Records save automatically in this browser profile.</div></div>';
  }

  function bindSidebarFoot() {
    const foot = document.getElementById('sidebar-foot');
    if (!foot) return;
    foot.onclick = e => {
      if (e.target.closest('[data-account]')) {
        e.preventDefault();
        if (WP.auth) WP.auth.openAccountModal();
        return;
      }
      if (e.target.closest('[data-signout]')) {
        e.preventDefault();
        if (WP.auth) WP.auth.confirmSignOut();
      }
    };
  }

  function refreshChrome() {
    const foot = document.getElementById('sidebar-foot');
    if (foot) {
      foot.innerHTML = sidebarFootHTML();
      bindSidebarFoot();
    }
    renderNav();
    renderTopbar();
  }

  function shellHTML() {
    const meta = { title: 'Dashboard' };
    return '<div class="app-shell">' +
      '<aside class="sidebar" id="sidebar">' + brandHTML() +
      '<nav class="nav-scroll" id="nav-scroll">' + navHTML() + '</nav>' +
      '<div class="sidebar-foot" id="sidebar-foot">' + sidebarFootHTML() + '</div>' +
      '</aside>' +
      '<div class="main-area">' +
      '<header class="topbar">' + topbarHTML(meta) + '</header>' +
      '<main class="content" id="content"></main>' +
      '</div></div>';
  }

  function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open');
  }

  function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');
  }

  /* ---------------- router ---------------- */
  function renderRoute(force) {
    const route = parseHash();
    if (authReady() && WP.auth.isLoggedIn() && !WP.auth.canAccessRoute(route)) {
      UI.toast('Reports and settings are for the shop admin.', 'error');
      if (location.hash !== '#/dashboard') {
        try { history.replaceState(null, '', '#/dashboard'); } catch (e) { location.hash = '#/dashboard'; }
        renderRoute(true);
      }
      return;
    }
    const routeKey = route.name + '/' + route.sub;
    if (!force && routeKey === lastRouteKey) { markActiveNav(); return; }
    lastRouteKey = routeKey;
    currentRoute = route;
    const meta = routeMeta(route);
    const content = document.getElementById('content');
    if (!content) return;
    const view = viewFor(route);
    currentView = view;
    renderTopbar();
    markActiveNav();
    closeSidebar();
    if (!view || typeof view.render !== 'function') {
      content.innerHTML = '<div class="view"><div class="card card-pad">' + UI.emptyState({
        icon: 'alert', title: 'This page is not available',
        text: 'The app files may be incomplete. Reload the POS from its folder.'
      }) + '</div></div>';
      return;
    }
    try {
      content.innerHTML = '<div class="view" id="view-root">' + view.render(route) + '</div>';
      if (typeof view.mount === 'function') view.mount(content, route);
      document.title = meta.title + ' · ' + (S.data.settings.shopName || 'Wijaya Pattalaya');
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch (err) {
      console.error('View failed to render', err);
      content.innerHTML = '<div class="view"><div class="card card-pad">' + UI.emptyState({
        icon: 'alert', title: 'Something went wrong on this page',
        text: (err && err.message) || 'Unknown error'
      }) + '<div class="center mt-16"><button class="btn btn-primary" data-reload-page>Reload app</button></div></div></div>';
      const reload = content.querySelector('[data-reload-page]');
      if (reload) reload.addEventListener('click', () => location.reload());
    }
  }

  function refresh() {
    renderTopbar();
    renderNav();
    if (currentView && typeof currentView.refresh === 'function') {
      try { currentView.refresh(); return; } catch (err) { console.warn('View refresh failed', err); }
    }
    renderRoute(true);
  }

  function dataChanged() {
    renderTopbar();
    renderNav();
    if (currentView && typeof currentView.refresh === 'function') {
      try { currentView.refresh(); return; } catch (err) { console.warn('View refresh failed', err); }
    }
    renderRoute(true);
  }

  function prefillItem(id) {
    prefillItemId = Number(id);
    if (currentRoute && currentRoute.name === 'billing' && currentRoute.sub === 'new') {
      renderRoute(true);
    } else {
      location.hash = '#/billing/new';
    }
  }

  function takePrefill() {
    const id = prefillItemId;
    prefillItemId = null;
    return id;
  }

  function settingsSaved() {
    const brand = document.querySelector('.brand');
    if (brand) brand.outerHTML = brandHTML();
    refreshChrome();
    renderRoute(true);
  }

  /* ---------------- boot ---------------- */
  function hideBoot() {
    const boot = document.getElementById('boot');
    if (boot) {
      boot.classList.add('fade');
      setTimeout(() => { if (boot.parentNode) boot.remove(); }, 420);
    }
  }

  function startShell() {
    if (shellStarted) return;
    shellStarted = true;
    loadActiveCashier();
    document.getElementById('app').innerHTML = shellHTML();
    bindSidebarFoot();
    renderNav();
    window.addEventListener('hashchange', () => renderRoute(false));
    window.addEventListener('online', renderTopbar);
    window.addEventListener('offline', renderTopbar);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) renderTopbar();
    });
    if (authReady() && WP.auth.isLoggedIn() && !WP.auth.canAccessRoute(parseHash())) {
      try { history.replaceState(null, '', '#/dashboard'); } catch (e) { location.hash = '#/dashboard'; }
    }
    if (!location.hash) {
      try { history.replaceState(null, '', '#/dashboard'); } catch (e) { location.hash = '#/dashboard'; }
    }
    renderRoute(true);
    hideBoot();
  }

  async function init() {
    try {
      await S.init();
    } catch (err) {
      console.error('Storage init failed', err);
      UI.toast('Could not load local data. Try reloading the app.', 'error', 7000);
    }
    if (WP.auth && typeof WP.auth.init === 'function') {
      await WP.auth.init({ onAuthenticated: startShell });
    } else {
      startShell();
    }
  }

  APP.init = init;
  APP.refresh = refresh;
  APP.dataChanged = dataChanged;
  APP.renderRoute = renderRoute;
  APP.getActiveCashierId = function () { return activeCashierId; };
  APP.getActiveCashier = activeCashier;
  APP.setActiveCashier = setActiveCashier;
  APP.openCashierPicker = openCashierPicker;
  APP.prefillItem = prefillItem;
  APP.takePrefill = takePrefill;
  APP.settingsSaved = settingsSaved;
  APP.refreshChrome = refreshChrome;
  APP.navigate = function (hash) {
    if (location.hash === hash) renderRoute(true);
    else location.hash = hash;
  };
  WP.app = APP;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
