(function () {
  'use strict';
  const WP = window.WP = window.WP || {};
  const U = WP.utils;

  const ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h2l2.4 12.2a2 2 0 0 0 2 1.8h8.3a2 2 0 0 0 2-1.6L21 7H6"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.9 2.9-2.1-2.1 2.9-2.9Z"/>',
    truck: '<path d="M3 6h11v11H3z"/><path d="M14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    userPlus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
    wallet: '<path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>',
    chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
    chartPie: '<path d="M21 12a9 9 0 1 1-9-9v9h9Z"/><path d="M21 12a9 9 0 0 0-9-9v9h9Z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 0 1-4 0v-.09a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6h.08a1.7 1.7 0 0 0 1-1.55V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.08a1.7 1.7 0 0 0 1.55 1H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z"/>',
    box: '<path d="m21 8-9-5-9 5v8l9 5 9-5Z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>',
    receipt: '<path d="M4 3h16v18l-3-2-2 2-3-2-3 2-2-2-3 2Z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    banknote: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z"/>',
    fileText: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    coins: '<circle cx="8" cy="8" r="6"/><path d="M18.1 10.4A6 6 0 1 1 10.3 18M7 6h1v4M16.7 13.9l.7.7-2.8 2.8"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="m20 6-11 11-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    printer: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
    archive: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>',
    filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5Z"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c1 .3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z"/>',
    home: '<path d="m3 10 9-8 9 8v10a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2Z"/>',
    megaphone: '<path d="m3 11 18-5v12L3 13v-2Z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowLeft: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    arrowUpRight: '<path d="M7 17 17 7M8 7h9v9"/>',
    arrowDownLeft: '<path d="M17 7 7 17M16 17H7V8"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    lock: '<rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.8 12.2 8.7-8.7M15 8l3 3M18 5l2 2"/>',
    eye: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="m3 3 18 18"/><path d="M10.6 6.1A11 11 0 0 1 12 6c6.4 0 10 6 10 6a18 18 0 0 1-3.6 4.2M6.6 6.6C3.6 8.5 2 12 2 12s3.6 6 10 6a11 11 0 0 0 4.4-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v7c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12v7c0 1.7 4 3 9 3s9-1.3 9-3v-7"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    percent: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    tool: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.9 2.9-2.1-2.1 2.9-2.9Z"/>',
    scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/>',
    building: '<path d="m3 9 9-6 9 6M4 21h16M6 9v12M10 9v12M14 9v12M18 9v12"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    inbox: '<path d="M4 4h16v16H4z"/><path d="M4 12h4l2 3h4l2-3h4"/>',
    tractor: '<path d="M13 39h19l7-11h10v13h-5M13 39v-8h11v8" fill="none"/><circle cx="21" cy="45" r="7"/><circle cx="44" cy="46" r="5"/>'
  };

  function icon(name, size, extraClass) {
    const cls = 'ico' + (extraClass ? ' ' + extraClass : '');
    if (name === 'tractor') {
      return '<svg class="' + cls + '" width="' + (size || 20) + '" height="' + (size || 20) + '" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS.tractor + '</svg>';
    }
    return '<svg class="' + cls + '" width="' + (size || 18) + '" height="' + (size || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.info) + '</svg>';
  }

  /* ---------------- toasts ---------------- */
  function toast(message, type, duration) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (type || 'success');
    const ico = type === 'error' ? 'alert' : type === 'info' ? 'info' : 'checkCircle';
    el.innerHTML = '<span class="tico">' + icon(ico, 16) + '</span><div>' + U.esc(message) + '</div>' +
      '<button class="tclose" type="button" aria-label="Dismiss">' + icon('x', 13) + '</button>';
    root.appendChild(el);
    const remove = () => {
      if (!el.isConnected) return;
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 220);
    };
    el.querySelector('.tclose').addEventListener('click', remove);
    setTimeout(remove, duration || 3400);
  }

  /* ---------------- modals ---------------- */
  const modalStack = [];

  function syncBodyLock() {
    document.body.classList.toggle('modal-open', modalStack.length > 0);
  }

  function modal(options) {
    const opts = options || {};
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const panel = document.createElement('div');
    panel.className = 'modal' + (opts.size ? ' ' + opts.size : '');
    const header = opts.headHTML !== undefined
      ? opts.headHTML
      : '<div class="modal-head"><div><div class="modal-title">' + U.esc(opts.title || '') + '</div>' +
        (opts.subtitle ? '<div class="modal-sub">' + U.esc(opts.subtitle) + '</div>' : '') +
        '</div><button type="button" class="modal-close" data-modal-close aria-label="Close">' + icon('x', 16) + '</button></div>';
    panel.innerHTML = header +
      '<div class="modal-body"></div>' +
      (opts.footer !== undefined ? '<div class="modal-foot">' + opts.footer + '</div>' : '');
    overlay.appendChild(panel);
    const root = document.getElementById('modal-root');
    root.appendChild(overlay);
    const body = panel.querySelector('.modal-body');
    if (opts.body !== undefined) body.innerHTML = opts.body;
    let closed = false;
    const previousFocus = document.activeElement;
    function close() {
      if (closed) return;
      closed = true;
      overlay.remove();
      document.removeEventListener('keydown', keydown, true);
      const idx = modalStack.indexOf(entry);
      if (idx >= 0) modalStack.splice(idx, 1);
      syncBodyLock();
      if (previousFocus && previousFocus.focus) { try { previousFocus.focus(); } catch (e) { /* noop */ } }
      if (typeof opts.onClose === 'function') opts.onClose();
    }
    const entry = { overlay, panel, close };
    modalStack.push(entry);
    syncBodyLock();
    function keydown(e) {
      if (e.key === 'Escape' && modalStack[modalStack.length - 1] === entry) {
        e.preventDefault(); e.stopPropagation();
        if (!opts.noEscape) close();
      }
    }
    document.addEventListener('keydown', keydown, true);
    overlay.addEventListener('mousedown', e => {
      if (e.target === overlay && !opts.noBackdropClose) close();
    });
    panel.querySelectorAll('[data-modal-close]').forEach(btn => btn.addEventListener('click', close));
    setTimeout(() => {
      const focusable = panel.querySelector('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])');
      if (focusable && !panel.querySelector('.modal-body [autofocus]')) {
        try { focusable.focus({ preventScroll: true }); } catch (e) { /* noop */ }
      }
    }, 60);
    return { overlay, panel, body, close };
  }

  function confirmDialog(options) {
    const opts = options || {};
    return new Promise(resolve => {
      let done = false;
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      const panel = document.createElement('div');
      panel.className = 'modal';
      panel.style.maxWidth = '440px';
      panel.innerHTML =
        '<div class="confirm-body">' +
        '<div class="confirm-icon ' + (opts.danger === false ? 'gold' : '') + '">' + icon(opts.icon || (opts.danger === false ? 'info' : 'alert'), 20) + '</div>' +
        '<div class="confirm-title">' + U.esc(opts.title || 'Are you sure?') + '</div>' +
        '<div class="confirm-text">' + U.esc(opts.text || '') + '</div></div>' +
        '<div class="confirm-foot">' +
        '<button type="button" class="btn" data-no>' + U.esc(opts.cancelText || 'Cancel') + '</button>' +
        '<button type="button" class="btn ' + (opts.danger === false ? 'btn-primary' : 'btn-danger') + '" data-yes>' + U.esc(opts.confirmText || 'Confirm') + '</button>' +
        '</div>';
      overlay.appendChild(panel);
      document.getElementById('modal-root').appendChild(overlay);
      document.body.classList.add('modal-open');
      const finish = val => {
        if (done) return;
        done = true;
        overlay.remove();
        document.removeEventListener('keydown', keyFn, true);
        if (!document.querySelector('.modal-overlay')) document.body.classList.remove('modal-open');
        resolve(val);
      };
      const keyFn = e => {
        if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      };
      panel.querySelector('[data-yes]').addEventListener('click', () => finish(true));
      panel.querySelector('[data-no]').addEventListener('click', () => finish(false));
      overlay.addEventListener('mousedown', e => { if (e.target === overlay) finish(false); });
      document.addEventListener('keydown', keyFn, true);
      setTimeout(() => { const b = panel.querySelector('[data-yes]'); if (b) b.focus(); }, 50);
    });
  }

  /* ---------------- buttons ---------------- */
  function setLoading(button, loading) {
    if (!button) return;
    if (loading) {
      if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
      button.disabled = true;
      button.classList.add('is-loading');
      button.innerHTML = '<span class="spinner"></span>' + (button.dataset.loadingLabel ? U.esc(button.dataset.loadingLabel) : 'Saving…');
    } else {
      button.disabled = false;
      button.classList.remove('is-loading');
      if (button.dataset.originalHtml) {
        button.innerHTML = button.dataset.originalHtml;
        delete button.dataset.originalHtml;
      }
    }
  }

  async function withLoading(button, fn) {
    setLoading(button, true);
    try { return await fn(); } finally { setLoading(button, false); }
  }

  /* ---------------- page building ---------------- */
  function pageHead(opts) {
    return '<div class="page-head"><div>' +
      (opts.eyebrow ? '<div class="eyebrow">' + U.esc(opts.eyebrow) + '</div>' : '') +
      '<h1 class="page-title">' + (opts.rawTitle || U.esc(opts.title || '')) + '</h1>' +
      (opts.subtitle ? '<p class="page-sub">' + U.esc(opts.subtitle) + '</p>' : '') +
      '</div>' +
      (opts.actions ? '<div class="head-actions">' + opts.actions + '</div>' : '') +
      '</div>';
  }

  function tabs(items) {
    return '<nav class="tabs">' + items.map(t =>
      '<a class="tab' + (t.active ? ' active' : '') + '" href="' + t.href + '">' +
      U.esc(t.label) + (t.count !== undefined && t.count !== null ? '<span class="tab-count">' + t.count + '</span>' : '') +
      '</a>').join('') + '</nav>';
  }

  function statusBadge(status, labelOverride) {
    const classes = {
      paid: 'green', partial: 'gold', credit: 'red', returned: 'grey',
      'part-returned': 'blue', open: 'green', closed: 'grey'
    };
    const label = labelOverride || WP.store.statusLabel(status);
    return '<span class="badge ' + (classes[status] || 'grey') + ' dot">' + U.esc(label) + '</span>';
  }

  const METHOD_ICONS = { cash: 'banknote', card: 'card', online: 'globe', credit: 'clock', cheque: 'fileText', advance: 'coins' };
  function methodLabel(method) {
    const labels = { cash: 'Cash', card: 'Card', online: 'Online', credit: 'Credit', cheque: 'Cheque', advance: 'Advance' };
    return labels[method] || U.titleCase(method || '');
  }
  function methodInline(method) {
    return '<span class="method">' + icon(METHOD_ICONS[method] || 'banknote', 13) + methodLabel(method) + '</span>';
  }

  function emptyState(opts) {
    return '<div class="empty' + (opts.compact ? ' compact' : '') + '">' +
      '<div class="empty-orb">' + icon(opts.icon || 'inbox', opts.compact ? 17 : 21) + '</div>' +
      '<div class="empty-title">' + U.esc(opts.title || 'Nothing here yet') + '</div>' +
      '<div class="empty-text">' + U.esc(opts.text || '') + '</div>' +
      (opts.action || '') + '</div>';
  }

  function avatar(name, extra) {
    return '<span class="avatar ' + (extra || '') + '">' + U.esc(U.initials(name)) + '</span>';
  }

  function cashierOptions(selectedId, includeInactive) {
    const list = includeInactive ? WP.store.data.cashiers : WP.store.activeCashiers();
    return list.map(c => '<option value="' + c.id + '"' + (Number(selectedId) === Number(c.id) ? ' selected' : '') + '>' + U.esc(c.name) + '</option>').join('');
  }

  function customerOptions(selectedId, includeWalkIn) {
    const customers = U.sortBy(WP.store.activeCustomers(), c => c.name.toLowerCase(), 'asc');
    let html = includeWalkIn ? '<option value="">Walk-in customer</option>' : '';
    customers.forEach(c => {
      html += '<option value="' + c.id + '"' + (Number(selectedId) === Number(c.id) ? ' selected' : '') + '>' + U.esc(c.name) + (c.phone ? ' · ' + U.esc(c.phone) : '') + '</option>';
    });
    return html;
  }

  function option(value, label, selected) {
    return '<option value="' + U.attr(value) + '"' + (String(value) === String(selected) ? ' selected' : '') + '>' + U.esc(label) + '</option>';
  }

  function formValues(form) {
    const values = {};
    if (!form) return values;
    new FormData(form).forEach((value, key) => {
      if (values[key] !== undefined) {
        if (!Array.isArray(values[key])) values[key] = [values[key]];
        values[key].push(value);
      } else {
        values[key] = value;
      }
    });
    Array.from(form.querySelectorAll('input[type="checkbox"]')).forEach(cb => {
      if (cb.name) values[cb.name] = cb.checked;
    });
    return values;
  }

  /* ---------------- printing ---------------- */
  function printHtml(html) {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.getElementById('print-root').appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        console.error('Print failed', e);
        toast('The print dialog could not be opened.', 'error');
      }
      setTimeout(() => iframe.remove(), 60000);
    }, 160);
  }

  function printDocument(opts) {
    const shop = WP.store.data.settings;
    const address = [shop.address, shop.phone].filter(Boolean).join(' · ');
    const html = '<!doctype html><html><head><meta charset="utf-8"><title>' + U.esc(opts.title || shop.shopName) + '</title>' +
      '<style>' +
      '@page { size: A4 portrait; margin: 14mm; } *{box-sizing:border-box} body{font-family:"Segoe UI",Arial,"Nirmala UI","Iskoola Pota","Noto Sans Sinhala",sans-serif;color:#1b271f;font-size:11px;margin:0;}' +
      'header{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #103c2a;padding-bottom:12px;margin-bottom:18px;align-items:flex-end;}' +
      'h1{font-family:Georgia,"Nirmala UI","Iskoola Pota","Noto Sans Sinhala",serif;font-size:22px;margin:0 0 3px;color:#103c2a;font-weight:600}h2{font-family:Georgia,"Nirmala UI","Iskoola Pota","Noto Sans Sinhala",serif;font-size:18px;margin:0 0 4px;font-weight:600}' +
      '.shop-name{font-family:Georgia,"Nirmala UI","Iskoola Pota","Noto Sans Sinhala",serif;font-size:19px;color:#103c2a;font-weight:600}.shop-tag{font-size:8px;letter-spacing:.14em;text-transform:uppercase;color:#7d877f;margin-top:2px}.shop-contact{font-size:9px;color:#7d877f;text-align:right;line-height:1.5}' +
      '.meta{font-size:10px;color:#6b756d;margin-bottom:16px;display:flex;gap:20px;flex-wrap:wrap}' +
      '.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}.box{border:1px solid #ddd6c8;border-radius:7px;padding:9px 11px}.box span{display:block;font-size:7.5px;text-transform:uppercase;letter-spacing:.09em;color:#7d877f;font-weight:700}.box b{display:block;font-size:15px;margin-top:3px;font-variant-numeric:tabular-nums;color:#103c2a}' +
      'table{width:100%;border-collapse:collapse;font-size:10px;margin:8px 0 14px}th{text-align:left;text-transform:uppercase;font-size:7.5px;letter-spacing:.08em;color:#7d877f;border-bottom:1px solid #bbb;padding:6px 7px}td{padding:6px 7px;border-bottom:1px solid #eee;vertical-align:top}.r{text-align:right}.sub{font-size:8px;color:#888}' +
      'h3{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#7d877f;margin:16px 0 6px}' +
      '.totals{margin-left:auto;width:280px;font-size:10px}.totals div{display:flex;justify-content:space-between;padding:3px 0}.totals .grand{border-top:1px solid #222;font-weight:700;font-size:12px;padding-top:6px;margin-top:3px}' +
      'footer{border-top:1px solid #ddd6c8;margin-top:24px;padding-top:8px;font-size:8px;color:#8b938c;display:flex;justify-content:space-between}' +
      '@media print{.btn{display:none}}' +
      '</style></head><body>' +
      '<header><div><div class="shop-name">' + U.esc(shop.shopName) + '</div><div class="shop-tag">' + U.esc(shop.tagline) + '</div><h2 style="margin-top:12px">' + U.esc(opts.title) + '</h2></div>' +
      '<div class="shop-contact">' + U.esc(address).replace(/\n/g, '<br>') + '<br>Generated ' + U.esc(U.fmtDateTime(new Date().toISOString())) + '</div></header>' +
      (opts.meta ? '<div class="meta">' + opts.meta + '</div>' : '') +
      '<div class="report-content">' + (opts.content || '') + '</div>' +
      '<footer><span>' + U.esc(shop.footer || '') + '</span><span>' + U.esc(shop.shopName) + ' · Offline POS</span></footer>' +
      '</body></html>';
    printHtml(html);
  }

  function receiptHTML(kind, detail) {
    const shop = WP.store.data.settings;
    const isService = kind === 'service';
    const record = isService ? detail.service : detail.invoice;
    const lines = isService ? detail.parts : detail.lines;
    const cashier = record.cashierId ? WP.store.cashierById(record.cashierId) : null;
    const customer = record.customerName || 'Walk-in customer';
    const dateText = U.fmtDate(record.date) + ' · ' + U.fmtTime(record.createdAt);
    let itemRows = '';
    if (isService) {
      itemRows += lines.map(l => '<div class="receipt-line name"><span class="nm">' + U.esc(l.name) + '</span><span class="amt">' + U.esc(U.fmtNumber(l.total, 2)) + '</span></div>' +
        '<div class="receipt-line receipt-sub"><span class="nm">' + U.fmtQty(l.qty) + ' × ' + U.esc(U.fmtNumber(l.price, 2)) + '</span><span></span></div>').join('');
      if (Number(record.labor) > 0) {
        itemRows += '<div class="receipt-line name"><span class="nm">Labour / service charge</span><span class="amt">' + U.esc(U.fmtNumber(record.labor, 2)) + '</span></div>';
      }
    } else {
      itemRows += lines.map(l => '<div class="receipt-line name"><span class="nm">' + U.esc(l.name) + '</span><span class="amt">' + U.esc(U.fmtNumber(l.total, 2)) + '</span></div>' +
        '<div class="receipt-line receipt-sub"><span class="nm">' + U.fmtQty(l.qty) + ' × ' + U.esc(U.fmtNumber(l.price, 2)) + '</span><span></span></div>').join('');
    }
    const balance = Number(record.balance) || 0;
    const cashReceived = record.method === 'cash' ? Number(record.tendered || 0) : 0;
    const change = cashReceived > record.total ? U.round2(cashReceived - record.total) : 0;
    const returnNote = (Number(record.returned) || 0) > 0
      ? '<div class="receipt-total-line sub"><span>Returns / credits</span><span>' + U.esc(U.fmtNumber(record.returned, 2)) + '</span></div>' : '';
    const html = '<!doctype html><html><head><meta charset="utf-8"><title>' + U.esc(record.no) + '</title><style>' +
      '@page{size:80mm auto;margin:4mm}*{box-sizing:border-box}body{font-family:"Cascadia Mono",Consolas,"Nirmala UI","Iskoola Pota","Noto Sans Sinhala",monospace;font-size:10px;color:#181818;margin:0;line-height:1.45;}' +
      '.shop{text-align:center;padding-bottom:8px;border-bottom:1px dashed #999}.name{font-family:Georgia,"Nirmala UI","Iskoola Pota","Noto Sans Sinhala",serif;font-size:20px;font-weight:700;letter-spacing:.02em}.tag{font-size:8px;text-transform:uppercase;letter-spacing:.08em;color:#555;margin-top:2px}.contact{font-size:8.5px;color:#555;margin-top:4px;white-space:pre-line}' +
      '.doctype{text-align:center;font-size:9px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;margin:8px 0 4px;color:#0f3a28}' +
      '.meta{display:flex;justify-content:space-between;gap:10px;font-size:8.5px;color:#444;padding-bottom:6px;border-bottom:1px dashed #bbb}.meta div{min-width:0}.meta b{color:#111}' +
      '.items{padding:5px 0;border-bottom:1px dashed #bbb}.line{display:flex;justify-content:space-between;gap:8px;padding:1.5px 0}.nm{flex:1;min-width:0}.amt{white-space:nowrap;text-align:right}.sub{font-size:8px;color:#666}' +
      '.work{margin:6px 0;font-size:8.5px;line-height:1.5}.work b{font-size:8px;text-transform:uppercase;letter-spacing:.06em;color:#555}.totals{padding:5px 0;border-bottom:1px dashed #bbb}.totrow{display:flex;justify-content:space-between;gap:8px;padding:1.5px 0}.totrow.grand{border-top:1px solid #222;margin-top:4px;padding-top:5px;font-size:12px;font-weight:700}' +
      '.foot{text-align:center;padding-top:8px;font-size:8px;color:#555;line-height:1.6}.foot .thanks{font-size:9.5px;color:#222;font-weight:700;margin-bottom:2px}.foot .credit{margin-top:6px;font-size:7.5px;color:#666;letter-spacing:.05em}' +
      '.statusline{display:flex;justify-content:space-between;font-size:9px;margin-top:5px;padding-top:5px;border-top:1px dashed #ddd}.stamp{text-align:center;font-size:7.5px;letter-spacing:.14em;color:#888;margin-top:8px}' +
      '</style></head><body>' +
      '<div class="shop"><div class="name">' + U.esc(shop.shopName) + '</div><div class="tag">' + U.esc(shop.tagline) + '</div>' +
      (shop.address || shop.phone ? '<div class="contact">' + U.esc([shop.address, shop.phone].filter(Boolean).join('\n')) + '</div>' : '') + '</div>' +
      '<div class="doctype">' + (isService ? 'Service invoice' : (record.type === 'wholesale' ? 'Wholesale invoice' : 'Sales invoice')) + '</div>' +
      '<div class="meta"><div><b>' + U.esc(record.no) + '</b><br>' + U.esc(dateText) + '</div><div style="text-align:right">Cashier: ' + U.esc(cashier ? cashier.name : '—') + '<br>Customer: ' + U.esc(customer) + '</div></div>' +
      (isService ? '<div class="work"><b>Machine</b><br>' + U.esc(record.machineType || '—') + (record.regNo ? ' (' + U.esc(record.regNo) + ')' : '') + '<br><b>Technician</b><br>' + U.esc(record.technician) + '<br><b>Work done</b><br>' + U.esc(record.work) + '</div>' : '') +
      '<div class="items">' + (itemRows || '<div class="sub">No line items</div>') + '</div>' +
      '<div class="totals">' +
      '<div class="totrow"><span>Subtotal</span><span>' + U.esc(U.fmtNumber(record.subtotal, 2)) + '</span></div>' +
      (Number(record.discount) > 0 ? '<div class="totrow"><span>Discount</span><span>− ' + U.esc(U.fmtNumber(record.discount, 2)) + '</span></div>' : '') +
      '<div class="totrow grand"><span>TOTAL</span><span>' + U.esc(U.fmtNumber(record.total, 2)) + '</span></div>' +
      (Number(record.advanceUsed) > 0 ? '<div class="totrow"><span>Advance applied</span><span>' + U.esc(U.fmtNumber(record.advanceUsed, 2)) + '</span></div>' : '') +
      '<div class="totrow"><span>' + U.esc(methodLabel(record.method)) + '</span><span>' + U.esc(U.fmtNumber(record.paid, 2)) + '</span></div>' +
      (cashReceived > record.total ? '<div class="totrow"><span>Cash received</span><span>' + U.esc(U.fmtNumber(cashReceived, 2)) + '</span></div><div class="totrow"><span>Change</span><span>' + U.esc(U.fmtNumber(change, 2)) + '</span></div>' : '') +
      (returnNote) +
      '</div>' +
      '<div class="statusline"><span>Balance due</span><span><b>' + U.esc(U.money(balance)) + '</b></span></div>' +
      '<div class="foot"><div class="thanks">' + U.esc(shop.footer || 'Thank you') + '</div>' +
      'Please keep this receipt for any return or warranty.<br><span class="stamp">WIJAYA PATTALAYA · OFFLINE POS</span>' +
      '<div class="credit">Design by R. Vakista · 0775834824</div></div>' +
      '</body></html>';
    return html;
  }

  function receiptPreviewHTML(kind, detail) {
    const shop = WP.store.data.settings;
    const isService = kind === 'service';
    const record = isService ? detail.service : detail.invoice;
    const lines = isService ? detail.parts : detail.lines;
    const customer = record.customerName || 'Walk-in customer';
    const cashier = record.cashierId ? WP.store.cashierById(record.cashierId) : null;
    return '<div class="receipt-paper">' +
      '<div class="receipt-shop"><div class="receipt-shop-name">' + U.esc(shop.shopName) + '</div><div class="receipt-shop-tag">' + U.esc(shop.tagline) + '</div></div>' +
      '<div class="receipt-meta"><div><b>' + U.esc(record.no) + '</b><br>' + U.esc(U.fmtDate(record.date)) + ' · ' + U.esc(U.fmtTime(record.createdAt)) + '</div><div style="text-align:right">Cashier: ' + U.esc(cashier ? cashier.name : '—') + '<br>' + U.esc(customer) + '</div></div>' +
      (isService ? '<div class="receipt-service-note"><b>' + U.esc(record.machineType || 'Service') + '</b>' + (record.regNo ? ' (' + U.esc(record.regNo) + ')' : '') + '<br>Technician: ' + U.esc(record.technician) + '<br>' + U.esc(record.work) + '</div>' : '') +
      '<div class="receipt-items">' + lines.map(l => '<div class="receipt-line name"><span class="nm">' + U.esc(l.name) + '</span><span class="amt">' + U.esc(U.fmtNumber(l.total, 2)) + '</span></div><div class="receipt-line receipt-sub"><span class="nm">' + U.fmtQty(l.qty) + ' × ' + U.esc(U.fmtNumber(l.price, 2)) + '</span><span></span></div>').join('') +
      (isService && Number(record.labor) > 0 ? '<div class="receipt-line"><span class="nm">Labour charge</span><span class="amt">' + U.esc(U.fmtNumber(record.labor, 2)) + '</span></div>' : '') + '</div>' +
      '<div class="receipt-totals">' +
      '<div class="receipt-total-line"><span>Subtotal</span><span>' + U.esc(U.fmtNumber(record.subtotal, 2)) + '</span></div>' +
      (Number(record.discount) > 0 ? '<div class="receipt-total-line"><span>Discount</span><span>− ' + U.esc(U.fmtNumber(record.discount, 2)) + '</span></div>' : '') +
      '<div class="receipt-total-line grand"><span>Total</span><span>' + U.esc(U.money(record.total)) + '</span></div>' +
      '<div class="receipt-total-line"><span>' + U.esc(methodLabel(record.method)) + '</span><span>' + U.esc(U.money(record.paid)) + '</span></div>' +
      (record.method === 'cash' && Number(record.tendered) > record.total
        ? '<div class="receipt-total-line"><span>Cash received</span><span>' + U.esc(U.money(record.tendered)) + '</span></div><div class="receipt-total-line"><span>Change</span><span>' + U.esc(U.money(U.round2(Number(record.tendered) - record.total))) + '</span></div>'
        : '') +
      (Number(record.balance) > 0 ? '<div class="receipt-total-line"><span>Balance</span><span>' + U.esc(U.money(record.balance)) + '</span></div>' : '') +
      '</div>' +
      '<div class="receipt-foot"><div class="big">Thank you</div>' + U.esc(shop.footer || '') +
      '<div class="receipt-credit">Design by R. Vakista · 0775834824</div></div></div>';
  }

  /* ---------------- A4 documents ---------------- */
  function a4ShellCSS() {
    return '@page{size:A4 portrait;margin:14mm}*{box-sizing:border-box}body{font-family:"Segoe UI",Arial,"Nirmala UI","Iskoola Pota","Noto Sans Sinhala",sans-serif;color:#1b271f;font-size:11px;margin:0;}' +
      'header{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #103c2a;padding-bottom:12px;margin-bottom:16px;align-items:flex-end;}' +
      '.shop-name{font-family:Georgia,"Nirmala UI","Iskoola Pota","Noto Sans Sinhala",serif;font-size:20px;color:#103c2a;font-weight:600}.shop-tag{font-size:8px;letter-spacing:.14em;text-transform:uppercase;color:#7d877f;margin-top:2px}.shop-contact{font-size:9px;color:#7d877f;text-align:right;line-height:1.5}' +
      '.doc-title{font-family:Georgia,"Nirmala UI","Iskoola Pota","Noto Sans Sinhala",serif;font-size:16px;margin:2px 0 0;font-weight:600}' +
      '.meta{font-size:10px;color:#444;margin-bottom:14px;display:flex;gap:18px;flex-wrap:wrap}.meta b{color:#111}' +
      'table{width:100%;border-collapse:collapse;font-size:10px;margin:8px 0 14px}th{text-align:left;text-transform:uppercase;font-size:7.5px;letter-spacing:.08em;color:#7d877f;border-bottom:1px solid #bbb;padding:6px 7px}td{padding:6px 7px;border-bottom:1px solid #eee;vertical-align:top}.r{text-align:right}.sub{font-size:8px;color:#888}' +
      '.totals{margin-left:auto;width:270px;font-size:10px}.totals div{display:flex;justify-content:space-between;padding:3px 0}.totals .grand{border-top:1px solid #222;font-weight:700;font-size:12px;padding-top:6px;margin-top:3px}' +
      '.workbox{border:1px solid #ddd6c8;border-radius:7px;padding:9px 12px;margin-bottom:12px;font-size:10px;line-height:1.7}.workbox b{color:#7d877f;font-size:8px;text-transform:uppercase;letter-spacing:.08em;display:inline-block;min-width:86px}' +
      'footer{border-top:1px solid #ddd6c8;margin-top:22px;padding-top:8px;font-size:8px;color:#8b938c;display:flex;justify-content:space-between}' +
      '.credit{margin-top:10px;text-align:center;font-size:8px;color:#8b938c;letter-spacing:.04em}' +
      '@media print{.btn{display:none}}';
  }

  function a4Header(docTitle) {
    const shop = WP.store.data.settings;
    const address = [shop.address, shop.phone].filter(Boolean).join(' · ');
    return '<header><div><div class="shop-name">' + U.esc(shop.shopName) + '</div><div class="shop-tag">' + U.esc(shop.tagline) + '</div>' +
      '<div class="doc-title">' + U.esc(docTitle) + '</div></div>' +
      '<div class="shop-contact">' + U.esc(address).replace(/\n/g, '<br>') + '<br>Printed ' + U.esc(U.fmtDateTime(new Date().toISOString())) + '</div></header>';
  }

  function a4BillHTML(kind, detail) {
    const isService = kind === 'service';
    const record = isService ? detail.service : detail.invoice;
    const lines = isService ? detail.parts : detail.lines;
    const cashier = record.cashierId ? WP.store.cashierById(record.cashierId) : null;
    const shop = WP.store.data.settings;
    const title = isService ? 'Service bill' : (record.type === 'wholesale' ? 'Wholesale invoice' : 'Sales invoice');
    let rows = lines.map(l => '<tr><td>' + U.esc(l.name) + (l.sku ? '<div class="sub">' + U.esc(l.sku) + '</div>' : '') + '</td>' +
      '<td class="r">' + U.fmtQty(l.qty) + '</td><td class="r">' + U.esc(U.fmtNumber(l.price, 2)) + '</td><td class="r">' + U.esc(U.fmtNumber(l.total, 2)) + '</td></tr>').join('');
    if (isService && Number(record.labor) > 0) {
      rows += '<tr><td>Labour / service charge</td><td class="r">1</td><td class="r"></td><td class="r">' + U.esc(U.fmtNumber(record.labor, 2)) + '</td></tr>';
    }
    const serviceBlock = isService
      ? '<div class="workbox"><div><b>Machine</b> ' + U.esc(record.machineType || '—') + (record.regNo ? ' (' + U.esc(record.regNo) + ')' : '') + '</div>' +
        '<div><b>Technician</b> ' + U.esc(record.technician || '—') + '</div>' +
        '<div><b>Work done</b> ' + U.esc(record.work || '—') + '</div></div>'
      : '';
    return '<!doctype html><html><head><meta charset="utf-8"><title>' + U.esc(record.no) + '</title><style>' + a4ShellCSS() + '</style></head><body>' +
      a4Header(title) +
      '<div class="meta"><span>Bill no: <b>' + U.esc(record.no) + '</b></span><span>Date: <b>' + U.esc(U.fmtDate(record.date)) + '</b></span>' +
      '<span>Customer: <b>' + U.esc(record.customerName || 'Walk-in customer') + '</b></span>' +
      (record.phone ? '<span>Phone: <b>' + U.esc(record.phone) + '</b></span>' : '') +
      '<span>Cashier: <b>' + U.esc(cashier ? cashier.name : '—') + '</b></span>' +
      (record.chequeNo ? '<span>Cheque: <b>' + U.esc(record.chequeNo) + '</b> due ' + U.esc(U.fmtDate(record.chequeDate)) + '</span>' : '') + '</div>' +
      serviceBlock +
      '<table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Amount</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="totals">' +
      '<div><span>Subtotal</span><span>' + U.esc(U.fmtNumber(record.subtotal, 2)) + '</span></div>' +
      (Number(record.discount) > 0 ? '<div><span>Discount</span><span>− ' + U.esc(U.fmtNumber(record.discount, 2)) + '</span></div>' : '') +
      '<div class="grand"><span>Total</span><span>' + U.esc(U.fmtNumber(record.total, 2)) + '</span></div>' +
      (Number(record.advanceUsed) > 0 ? '<div><span>Advance applied</span><span>' + U.esc(U.fmtNumber(record.advanceUsed, 2)) + '</span></div>' : '') +
      '<div><span>' + U.esc(methodLabel(record.method)) + '</span><span>' + U.esc(U.fmtNumber(record.paid, 2)) + '</span></div>' +
      '<div><span>Balance due</span><span>' + U.esc(U.money(record.balance)) + '</span></div></div>' +
      '<footer><span>' + U.esc(shop.footer || '') + '</span><span>' + U.esc(shop.shopName) + ' · Offline POS</span></footer>' +
      '<div class="credit">Design by R. Vakista · 0775834824</div>' +
      '</body></html>';
  }

  function receiptFor(kind, detail) {
    const paper = (WP.store.data.settings.printer) || 'thermal';
    if (kind === 'service') return a4BillHTML('service', detail);
    return paper === 'a4' ? a4BillHTML('invoice', detail) : receiptHTML('invoice', detail);
  }

  function jobCardHTML(job) {
    const shop = WP.store.data.settings;
    const cashier = job.cashierId ? WP.store.cashierById(job.cashierId) : null;
    const info = (label, value) => '<div class="receipt-line"><span class="nm">' + label + '</span><span class="amt" style="white-space:normal">' + value + '</span></div>';
    const html = '<!doctype html><html><head><meta charset="utf-8"><title>' + U.esc(job.no) + '</title><style>' +
      '@page{size:80mm auto;margin:4mm}*{box-sizing:border-box}body{font-family:"Cascadia Mono",Consolas,"Nirmala UI","Iskoola Pota","Noto Sans Sinhala",monospace;font-size:10px;color:#181818;margin:0;line-height:1.45;}' +
      '.shop{text-align:center;padding-bottom:8px;border-bottom:1px dashed #999}.name{font-family:Georgia,"Nirmala UI","Iskoola Pota","Noto Sans Sinhala",serif;font-size:20px;font-weight:700;letter-spacing:.02em}.tag{font-size:8px;text-transform:uppercase;letter-spacing:.08em;color:#555;margin-top:2px}.contact{font-size:8.5px;color:#555;margin-top:4px;white-space:pre-line}' +
      '.doctype{text-align:center;font-size:9px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;margin:8px 0 4px;color:#0f3a28}' +
      '.meta{display:flex;justify-content:space-between;gap:10px;font-size:8.5px;color:#444;padding-bottom:6px;border-bottom:1px dashed #bbb}.meta div{min-width:0}.meta b{color:#111}' +
      '.items{padding:5px 0;border-bottom:1px dashed #bbb}.line{display:flex;justify-content:space-between;gap:8px;padding:1.5px 0}.nm{flex:1;min-width:0}.amt{white-space:nowrap;text-align:right}' +
      '.work{margin:6px 0;font-size:8.5px;line-height:1.5}.work b{font-size:8px;text-transform:uppercase;letter-spacing:.06em;color:#555}' +
      '.foot{text-align:center;padding-top:8px;font-size:8px;color:#555;line-height:1.6}.foot .thanks{font-size:9.5px;color:#222;font-weight:700;margin-bottom:2px}.foot .credit{margin-top:6px;font-size:7.5px;color:#666;letter-spacing:.05em}' +
      '</style></head><body>' +
      '<div class="shop"><div class="name">' + U.esc(shop.shopName) + '</div><div class="tag">' + U.esc(shop.tagline) + '</div>' +
      (shop.address || shop.phone ? '<div class="contact">' + U.esc([shop.address, shop.phone].filter(Boolean).join('\n')) + '</div>' : '') + '</div>' +
      '<div class="doctype">Job card</div>' +
      '<div class="meta"><div><b>' + U.esc(job.no) + '</b><br>Opened ' + U.esc(U.fmtDate(job.date)) + ' · ' + U.esc(U.fmtTime(job.createdAt)) + '</div>' +
      '<div style="text-align:right">Goods received<br><b>' + U.esc(U.fmtDate(job.receivedDate)) + '</b></div></div>' +
      '<div class="work"><b>Customer</b><br>' + U.esc(job.customerName) +
      (job.phone ? '<br>' + U.esc(job.phone) : '') +
      (job.address ? '<br>' + U.esc(job.address) : '') + '</div>' +
      (job.machineType || job.regNo ? '<div class="work"><b>Machine</b><br>' + U.esc(job.machineType || '—') + (job.regNo ? ' (' + U.esc(job.regNo) + ')' : '') + '</div>' : '') +
      (job.work ? '<div class="work"><b>Work requested</b><br>' + U.esc(job.work) + '</div>' : '') +
      (job.technician ? '<div class="work"><b>Technician</b><br>' + U.esc(job.technician) + '</div>' : '') +
      '<div class="items">' +
      info('Advance paid', U.esc(U.money(job.advance))) +
      (Number(job.advance) > 0 ? info('Paid by', U.esc(methodLabel(job.advanceMethod))) : '') +
      (job.chequeNo ? info('Cheque no', U.esc(job.chequeNo) + ' · ' + U.esc(U.fmtDate(job.chequeDate))) : '') +
      info('Status', job.status === 'closed' ? 'Job closed' : 'Job open') +
      '</div>' +
      (job.note ? '<div class="work"><b>Note</b><br>' + U.esc(job.note) + '</div>' : '') +
      '<div class="foot"><div class="thanks">Please keep this job card</div>' +
      'Show this card when collecting the machine.<br>Cashier: ' + U.esc(cashier ? cashier.name : '—') +
      '<div class="credit">Design by R. Vakista · 0775834824</div></div>' +
      '</body></html>';
    return html;
  }

  function quotationHTML(q) {
    const shop = WP.store.data.settings;
    const rows = (q.lines || []).map(l => '<tr><td>' + U.esc(l.name) + (l.sku ? '<div class="sub">' + U.esc(l.sku) + '</div>' : '') + '</td>' +
      '<td class="r">' + U.fmtQty(l.qty) + '</td><td class="r">' + U.esc(U.fmtNumber(l.price, 2)) + '</td><td class="r">' + U.esc(U.fmtNumber(l.total, 2)) + '</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"><title>' + U.esc(q.no) + '</title><style>' + a4ShellCSS() + '</style></head><body>' +
      a4Header('Quotation') +
      '<div class="meta"><span>Quotation no: <b>' + U.esc(q.no) + '</b></span><span>Date: <b>' + U.esc(U.fmtDate(q.date)) + '</b></span>' +
      '<span>Customer: <b>' + U.esc(q.customerName || 'Walk-in customer') + '</b></span>' +
      (q.phone ? '<span>Phone: <b>' + U.esc(q.phone) + '</b></span>' : '') + '</div>' +
      '<table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Amount</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="totals">' +
      '<div><span>Subtotal</span><span>' + U.esc(U.fmtNumber(q.subtotal, 2)) + '</span></div>' +
      (Number(q.discount) > 0 ? '<div><span>Discount</span><span>− ' + U.esc(U.fmtNumber(q.discount, 2)) + '</span></div>' : '') +
      '<div class="grand"><span>Total</span><span>' + U.esc(U.fmtNumber(q.total, 2)) + '</span></div></div>' +
      (q.note ? '<div class="workbox"><b>Note</b> ' + U.esc(q.note) + '</div>' : '') +
      '<div class="workbox">This quotation is valid for 7 days from the date above. Prices may change after that.</div>' +
      '<footer><span>' + U.esc(shop.footer || '') + '</span><span>' + U.esc(shop.shopName) + ' · Offline POS</span></footer>' +
      '<div class="credit">Design by R. Vakista · 0775834824</div>' +
      '</body></html>';
  }

  function showReceipt(kind, detail, onNew) {
    const isService = kind === 'service';
    const record = isService ? detail.service : detail.invoice;
    const modalInstance = modal({
      title: isService ? 'Service bill ready' : 'Invoice ready',
      subtitle: record.no + ' · ' + U.money(record.total) + (Number(record.balance) > 0 ? ' · ' + U.money(record.balance) + ' due' : ' · fully settled'),
      size: 'md',
      body: '<div class="receipt-modal-body" style="padding:0;background:transparent">' + receiptPreviewHTML(kind, detail) + '</div>',
      footer: '<button type="button" class="btn" data-close-receipt>Done</button>' +
        '<button type="button" class="btn btn-primary" data-print-receipt>' + icon('printer', 15) + 'Print receipt</button>'
    });
    modalInstance.panel.querySelector('.modal-body').style.padding = '0';
    modalInstance.panel.querySelector('.receipt-paper').style.maxWidth = '360px';
    modalInstance.panel.querySelector('.receipt-modal-body').style.background = '#f3efe5';
    modalInstance.panel.querySelector('.receipt-modal-body').style.padding = '22px';
    modalInstance.panel.querySelector('[data-print-receipt]').addEventListener('click', () => {
      printHtml(receiptFor(kind, detail));
    });
    modalInstance.panel.querySelector('[data-close-receipt]').addEventListener('click', () => {
      modalInstance.close();
      if (typeof onNew === 'function') onNew();
    });
    return modalInstance;
  }

  /* ---------------- misc ---------------- */
  function initialsOptions() { return ''; }

  function statusDot(open) {
    return '<span class="cashier-state ' + (open ? 'open' : '') + '"></span>';
  }

  function pageDateLabel() {
    return U.fmtDate(U.todayISO(), { mode: 'long' });
  }

  function debounceSearch(fn, delay) { return U.debounce(fn, delay); }

  WP.ui = {
    icon, toast, modal, confirmDialog, setLoading, withLoading,
    pageHead, tabs, statusBadge, methodLabel, methodInline, METHOD_ICONS,
    emptyState, avatar, cashierOptions, customerOptions, option, formValues,
    printHtml, printDocument, receiptHTML, receiptPreviewHTML, showReceipt,
    receiptFor, a4BillHTML, jobCardHTML, quotationHTML, a4Header,
    statusDot, pageDateLabel
  };
})();
