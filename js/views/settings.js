(function () {
  'use strict';
  const WP = window.WP = window.WP || {};
  const U = WP.utils;
  const UI = WP.ui;
  const V = WP.views = WP.views || {};

  function S() { return WP.store; }
  function APP() { return WP.app; }

  function settingsRow(label, value, cls) {
    return '<div class="report-list-row"><span class="report-list-label">' + label + '</span><span class="report-list-amt ' + (cls || '') + '">' + value + '</span></div>';
  }

  function formCard(shop) {
    return '<div class="card card-pad"><div class="card-title mb-12">' + UI.icon('building', 18) + 'Shop identity</div>' +
      '<form id="settings-form"><div class="form-grid">' +
      '<div class="field full"><label class="label" for="set-name">Shop name</label>' +
      '<input class="input" id="set-name" name="shopName" required value="' + U.attr(shop.shopName) + '" placeholder="විජය පත්තලාය" autocomplete="off" lang="si">' +
      '<div class="hint" style="margin-top:5px">Sinhala Unicode is supported here and on receipts, reports and printouts. Type with a Sinhala Unicode keyboard (e.g. විජය පත්තලාය), not legacy-font text.</div></div>' +
      '<div class="field full"><label class="label" for="set-tagline">Tagline</label>' +
      '<input class="input" id="set-tagline" name="tagline" value="' + U.attr(shop.tagline) + '" placeholder="Tractor Spare Parts · Service · Machines" autocomplete="off"></div>' +
      '<div class="field"><label class="label" for="set-phone">Phone</label>' +
      '<input class="input" id="set-phone" name="phone" value="' + U.attr(shop.phone) + '" placeholder="07X XXX XXXX" autocomplete="off"></div>' +
      '<div class="field"><label class="label" for="set-email">Email <span class="opt">(optional)</span></label>' +
      '<input class="input" id="set-email" name="email" type="email" value="' + U.attr(shop.email) + '" placeholder="shop@example.com" autocomplete="off"></div>' +
      '<div class="field full"><label class="label" for="set-address">Address</label>' +
      '<input class="input" id="set-address" name="address" value="' + U.attr(shop.address) + '" placeholder="Shop address for invoices" autocomplete="off"></div>' +
      '<div class="field full"><label class="label" for="set-footer">Receipt footer</label>' +
      '<textarea class="textarea" id="set-footer" name="footer" rows="2">' + U.esc(shop.footer || '') + '</textarea></div>' +
      '<div class="field"><label class="label" for="set-currency">Currency symbol</label>' +
      '<input class="input" id="set-currency" name="currency" required value="' + U.attr(shop.currency) + '" placeholder="Rs." autocomplete="off"></div>' +
      '<div class="field"><label class="label" for="set-low">Default low-stock alert</label>' +
      '<input class="input" id="set-low" name="lowStockDefault" type="number" min="0" step="1" value="' + U.attr(shop.lowStockDefault) + '"></div>' +
      '<div class="field"><label class="label" for="set-inv-prefix">Invoice prefix</label>' +
      '<input class="input" id="set-inv-prefix" name="invoicePrefix" required value="' + U.attr(shop.invoicePrefix) + '" placeholder="INV" autocomplete="off"></div>' +
      '<div class="field"><label class="label" for="set-svc-prefix">Service prefix</label>' +
      '<input class="input" id="set-svc-prefix" name="servicePrefix" required value="' + U.attr(shop.servicePrefix) + '" placeholder="SRV" autocomplete="off"></div>' +
      '<div class="field"><label class="label" for="set-job-prefix">Job card prefix</label>' +
      '<input class="input" id="set-job-prefix" name="jobPrefix" required value="' + U.attr(shop.jobPrefix) + '" placeholder="JOB" autocomplete="off"></div>' +
      '<div class="field"><label class="label" for="set-quote-prefix">Quotation prefix</label>' +
      '<input class="input" id="set-quote-prefix" name="quotePrefix" required value="' + U.attr(shop.quotePrefix) + '" placeholder="QT" autocomplete="off"></div>' +
      '<div class="field"><label class="label" for="set-grn-prefix">Supplier bill prefix</label>' +
      '<input class="input" id="set-grn-prefix" name="purchasePrefix" required value="' + U.attr(shop.purchasePrefix) + '" placeholder="GRN" autocomplete="off"></div>' +
      '<div class="field"><label class="label" for="set-printer">Sales bill printer</label>' +
      '<select class="select" id="set-printer" name="printer">' +
      UI.option('thermal', '80mm thermal receipt', shop.printer) +
      UI.option('a4', 'A4 sheet', shop.printer) + '</select>' +
      '<div class="hint" style="margin-top:5px">Shop sales print on this paper. Service bills always print on A4; job cards always print on 80mm.</div></div>' +
      '</div>' +
      '<div class="flex-between mt-16"><span class="hint">Shop details print on every receipt and A4 document. Prefix changes apply to new bills only.</span>' +
      '<button type="submit" class="btn btn-primary">' + UI.icon('save', 15) + 'Save settings</button></div></form></div>';
  }

  function backupCard(shop) {
    return '<div class="card card-pad"><div class="backup-box"><div class="backup-title">' + UI.icon('database', 16) + ' Back up your shop</div>' +
      '<div class="hint">Everything lives inside this browser profile. Download a backup file regularly and keep it on a pen drive or another computer.</div>' +
      '<div class="flex-between mt-12"><div><div class="section-title-sm" style="margin:0">Last backup</div><b data-last-backup>' + (shop.lastBackupAt ? U.esc(U.fmtDateTime(shop.lastBackupAt)) : 'Never') + '</b></div>' +
      '<button type="button" class="btn btn-primary" data-download-backup>' + UI.icon('download', 14) + 'Download backup</button></div></div>' +
      '<div class="divider"></div>' +
      '<div class="section-title-sm">Restore from a backup</div>' +
      '<div class="hint">Restoring <b>replaces all current items, invoices, services, customers, cashiers and expenses</b> with the contents of the backup file. Download a fresh backup first.</div>' +
      '<input type="file" id="restore-file" accept=".json,application/json" class="hidden">' +
      '<button type="button" class="btn mt-12" data-restore-backup>' + UI.icon('upload', 14) + 'Choose backup file…</button>' +
      '<div class="hint danger mt-12">Only restore files created by Wijaya Pattalaya POS.</div></div>';
  }

  function securityCard() {
    const user = WP.auth && WP.auth.getUser ? WP.auth.getUser() : null;
    if (!user) return '';
    const cashiers = S().activeCashiers();
    const withLogin = cashiers.filter(c => WP.auth.hasLogin(c.id)).length;
    return '<div class="card card-pad"><div class="card-title mb-12">' + UI.icon('shield', 18) + 'Sign-in & security</div>' +
      '<div class="account-hero compact">' + UI.avatar(user.name) +
      '<div class="account-hero-info"><div class="account-hero-name">' + U.esc(user.name) + '</div>' +
      '<div class="account-hero-sub">@' + U.esc(user.username) + ' · ' + (user.role === 'admin' ? 'Administrator' : 'Cashier') + '</div></div>' +
      '<span class="badge gold">Admin</span></div>' +
      '<div class="divider"></div>' +
      settingsRow('Cashier sign-ins', withLogin + ' of ' + cashiers.length + ' cashiers ready') +
      settingsRow('Signed in since', user.signedInAt ? U.esc(U.fmtDateTime(user.signedInAt)) : '—') +
      '<div class="btn-row mt-12">' +
      '<button type="button" class="btn btn-sm" data-my-account>' + UI.icon('user', 13) + 'My account</button>' +
      '<a class="btn btn-sm" href="#/cashiers">' + UI.icon('key', 13) + 'Cashier sign-ins</a>' +
      '<button type="button" class="btn btn-sm btn-danger" data-sign-out>' + UI.icon('logout', 13) + 'Sign out</button>' +
      '</div>' +
      '<div class="hint mt-12">Passwords are salted and hashed on this device. The admin controls stock, prices, expenses and reports; cashiers can take sales, service and their own drawer.</div></div>';
  }

  function dataCard() {
    const stats = S().stats();
    const meta = S().meta;
    const storage = meta.storageMode === 'local' ? 'localStorage fallback' : 'IndexedDB';
    return '<div class="card card-pad"><div class="card-title mb-12">' + UI.icon('shield', 18) + 'Data on this device</div>' +
      '<div class="data-stats">' +
      '<div class="data-stat"><span>Invoices</span><b>' + stats.invoices + '</b></div>' +
      '<div class="data-stat"><span>Service jobs</span><b>' + stats.services + '</b></div>' +
      '<div class="data-stat"><span>Items</span><b>' + stats.items + '</b></div>' +
      '<div class="data-stat"><span>Customers</span><b>' + stats.customers + '</b></div>' +
      '<div class="data-stat"><span>Payments</span><b>' + stats.payments + '</b></div>' +
      '<div class="data-stat"><span>Expenses</span><b>' + stats.expenses + '</b></div>' +
      '<div class="data-stat"><span>Returns</span><b>' + stats.returns + '</b></div>' +
      '<div class="data-stat"><span>Cashiers</span><b>' + stats.cashiers + '</b></div>' +
      '</div>' +
      '<div class="divider"></div>' +
      settingsRow('Storage engine', U.esc(storage)) +
      settingsRow('Last autosave', meta.lastSavedAt ? U.esc(U.fmtDateTime(meta.lastSavedAt)) : '—') +
      settingsRow('Internet required', '<span class="badge green">Never</span>') +
      (meta.storageError ? '<div class="hint danger mt-8">Storage warning: ' + U.esc(meta.storageError) + '</div>' : '') +
      '<div class="hint mt-8">Data is tied to this browser + profile. Use the same Windows user and Chrome profile every day, and never clear site data before taking a backup.</div></div>';
  }

  function offlineCard() {
    return '<div class="card card-pad"><div class="card-title mb-12">' + UI.icon('globe', 18) + 'Working offline</div>' +
      '<div class="hint" style="line-height:1.7">This POS never sends data to the internet. It runs from the local project folder and saves to this browser profile.<br><br>' +
      '<b>Open it with start.bat</b> so Chrome uses the dedicated profile supplied with the app. If you open the HTML with a different browser or profile, you will see different (empty) data.<br><br>' +
      'For a second computer, copy the whole project folder and restore a backup file there.<br><br>' +
      'Printing uses the browser print dialog — choose an 80mm receipt printer for bills and A4 for reports.</div></div>';
  }

  function screen() {
    const shop = S().data.settings;
    return UI.pageHead({
      eyebrow: 'System · Setup',
      title: 'Settings',
      subtitle: 'Shop details, numbering, low-stock alerts and offline backups.',
      actions: '<button class="btn" data-print-test>' + UI.icon('printer', 15) + 'Test print</button>'
    }) +
      '<div class="settings-grid">' +
      '<div>' + formCard(shop) + '</div>' +
      '<div class="stack">' + securityCard() + backupCard(shop) + dataCard() + offlineCard() + '</div>' +
      '</div>';
  }

  async function restoreFromFile(file) {
    if (!file) return;
    let text;
    try { text = await U.readFileAsText(file); } catch (err) { UI.toast('Could not read that file.', 'error'); return; }
    const ok = await UI.confirmDialog({
      title: 'Replace all current data?',
      text: 'Restoring this backup will overwrite every item, invoice, service job, customer, cashier, expense and setting in this browser. This cannot be undone.',
      confirmText: 'Restore backup'
    });
    if (!ok) return;
    try {
      const stats = await S().importBackup(text);
      const summary = stats.invoices + ' invoices, ' + stats.services + ' service jobs, ' + stats.items + ' items.';
      if (WP.auth && WP.auth.restart) {
        WP.auth.restart('Backup restored · ' + summary + ' Sign in with an account from that backup.');
        return;
      }
      APP().settingsSaved();
      UI.toast('Backup restored · ' + summary);
    } catch (err) {
      UI.toast(err.userMessage || err.message || 'Could not restore that backup.', 'error');
    }
  }

  V.settings = {
    render() {
      return screen();
    },
    mount(content) {
      const scope = content.querySelector('#view-root') || content;
      const form = scope.querySelector('#settings-form');
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const submit = form.querySelector('[type="submit"]');
        const values = UI.formValues(form);
        values.lowStockDefault = Math.max(0, Math.round(U.toNum(values.lowStockDefault, 5)));
        values.invoicePrefix = (values.invoicePrefix || 'INV').trim().toUpperCase();
        values.servicePrefix = (values.servicePrefix || 'SRV').trim().toUpperCase();
        values.jobPrefix = (values.jobPrefix || 'JOB').trim().toUpperCase();
        values.quotePrefix = (values.quotePrefix || 'QT').trim().toUpperCase();
        values.purchasePrefix = (values.purchasePrefix || 'GRN').trim().toUpperCase();
        values.printer = values.printer === 'a4' ? 'a4' : 'thermal';
        values.currency = (values.currency || 'Rs.').trim();
        if (!values.shopName.trim()) { UI.toast('Shop name is required.', 'error'); return; }
        if (!values.currency) { UI.toast('Currency symbol is required.', 'error'); return; }
        try {
          await UI.withLoading(submit, async () => {
            await S().saveSettings(values);
            APP().settingsSaved();
            UI.toast('Settings saved.');
          });
        } catch (err) { UI.toast(err.userMessage || err.message || 'Could not save settings.', 'error'); }
      });

      scope.addEventListener('click', async e => {
        if (e.target.closest('[data-my-account]')) {
          if (WP.auth) WP.auth.openAccountModal();
          return;
        }
        if (e.target.closest('[data-sign-out]')) {
          if (WP.auth) WP.auth.confirmSignOut();
          return;
        }
        if (e.target.closest('[data-download-backup]')) {
          const btn = e.target.closest('[data-download-backup]');
          try {
            await UI.withLoading(btn, async () => {
              const backup = await S().prepareBackup();
              U.downloadFile(backup.filename, backup.json);
              const label = scope.querySelector('[data-last-backup]');
              if (label) label.textContent = U.fmtDateTime(S().data.settings.lastBackupAt);
              UI.toast('Backup downloaded · ' + backup.filename);
            });
          } catch (err) { UI.toast(err.userMessage || err.message || 'Could not create backup.', 'error'); }
          return;
        }
        if (e.target.closest('[data-restore-backup]')) {
          const input = scope.querySelector('#restore-file');
          if (input) { input.value = ''; input.click(); }
          return;
        }
        if (e.target.closest('[data-print-test]')) {
          UI.printDocument({
            title: 'Print test',
            meta: '<span><b>Shop:</b> ' + U.esc(S().data.settings.shopName) + '</span><span><b>Date:</b> ' + U.esc(U.fmtDate(U.todayISO())) + '</span>',
            content: '<div class="grid"><div class="box"><span>Printer test</span><b>OK</b></div><div class="box"><span>Currency</span><b>' + U.esc(S().data.settings.currency) + '</b></div><div class="box"><span>Cashier</span><b style="font-size:12px">' + U.esc((APP().getActiveCashier() || {}).name || '—') + '</b></div><div class="box"><span>Status</span><b style="font-size:12px">Offline POS ready</b></div></div>' +
              '<p style="font-size:11px;color:#555;line-height:1.6">This page was printed from Wijaya Pattalaya POS. Receipt bills use 80mm paper; A4 reports use portrait A4. If you can read this, printing is working.</p>'
          });
        }
      });

      scope.addEventListener('change', e => {
        if (e.target.id === 'restore-file' && e.target.files && e.target.files[0]) restoreFromFile(e.target.files[0]);
      });
    },
    refresh() {
      APP().renderRoute(true);
    }
  };
})();
