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

  const listState = { q: '' };
  const FORM_DEFAULTS = {
    customerId: '', customerName: '', phone: '',
    discount: '', note: '', search: '', lines: []
  };
  const form = Object.assign({}, FORM_DEFAULTS);

  function resetForm() {
    Object.assign(form, FORM_DEFAULTS, { lines: [] });
  }

  function chosenCustomer() {
    return form.customerId ? S().customerById(Number(form.customerId)) : null;
  }

  function quotes() {
    return U.sortBy(S().data.quotations, q => q.createdAt || q.date, 'desc');
  }

  function filteredQuotes() {
    const q = listState.q.trim().toLowerCase();
    if (!q) return quotes();
    return quotes().filter(qt => (qt.no + ' ' + qt.customerName + ' ' + (qt.phone || '') + ' ' + qt.note + ' ' +
      qt.lines.map(l => l.name).join(' ')).toLowerCase().includes(q));
  }

  function formTotals() {
    const subtotal = U.round2(U.sumBy(form.lines, l => Number(l.qty) * Number(l.price)));
    const discount = U.round2(U.clamp(U.toNum(form.discount, 0), 0, subtotal));
    return { subtotal, discount, total: U.round2(subtotal - discount) };
  }

  function statsHTML() {
    const all = quotes();
    const value = U.sumBy(all, q => Number(q.total) || 0);
    return '<div class="stat-grid mb-16">' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Quotations</span><span class="stat-icon green">' + UI.icon('receipt', 16) + '</span></div>' +
      '<div class="stat-value">' + all.length + '</div><div class="stat-meta">Issued to customers</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Total quoted</span><span class="stat-icon gold">' + UI.icon('chart', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(value) + '</div><div class="stat-meta">If every quote is accepted</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">This month</span><span class="stat-icon blue">' + UI.icon('calendar', 16) + '</span></div>' +
      '<div class="stat-value">' + all.filter(q => q.date >= U.monthStartISO()).length + '</div><div class="stat-meta">' + U.esc(U.monthLabel(U.monthKey(U.todayISO()))) + '</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Items quoted</span><span class="stat-icon grey">' + UI.icon('box', 16) + '</span></div>' +
      '<div class="stat-value">' + U.sumBy(all, q => q.lines.length) + '</div><div class="stat-meta">Lines across all quotes</div></div>' +
      '</div>';
  }

  function tableHTML(rows) {
    if (!rows.length) {
      return '<div class="card-body">' + UI.emptyState({
        icon: 'receipt',
        title: S().data.quotations.length ? 'No quotations match that search' : 'No quotations yet',
        text: S().data.quotations.length ? 'Try another quote number, customer or item.' : 'Give a customer a priced quotation on A4. Quotes do not touch stock — bill it as a normal sale if accepted.',
        action: '<a class="btn btn-primary" href="#/quotations/new">' + UI.icon('plus', 14) + 'New quotation</a>'
      }) + '</div>';
    }
    const body = rows.slice(0, 200).map(qt => {
      const customer = qt.customerId
        ? '<div class="customer-cell"><span class="avatar" style="width:26px;height:26px;font-size:9px">' + U.esc(U.initials(qt.customerName)) + '</span><div><div class="customer-name">' + U.esc(qt.customerName) + '</div><div class="customer-sub">' + U.esc(qt.phone || 'Saved customer') + '</div></div></div>'
        : '<span class="muted">' + U.esc(qt.customerName || 'Walk-in customer') + '</span>';
      return '<tr>' +
        '<td><div class="cell-stack"><span class="cell-main">' + U.esc(qt.no) + '</span><span class="cell-sub">' + U.fmtDate(qt.date, { mode: 'short' }) + '</span></div></td>' +
        '<td>' + customer + '</td>' +
        '<td><div class="cell-stack" style="max-width:260px"><span class="cell-main" style="font-weight:500">' + qt.lines.slice(0, 2).map(l => U.esc(l.name)).join(', ') + (qt.lines.length > 2 ? ' +' + (qt.lines.length - 2) + ' more' : '') + '</span><span class="cell-sub">' + qt.lines.length + ' line' + (qt.lines.length === 1 ? '' : 's') + '</span></div></td>' +
        '<td class="right num">' + U.money(qt.total) + '</td>' +
        '<td><div class="row-actions">' +
        '<button type="button" class="btn btn-sm" data-quote-print="' + qt.id + '">' + UI.icon('printer', 13) + 'Print</button>' +
        '<a class="btn btn-sm" href="#/billing/new" data-quote-bill="' + qt.id + '" title="Use this quote as a new sale">Bill it</a>' +
        (adminMode() ? '<button type="button" class="icon-btn danger" data-quote-delete="' + qt.id + '" title="Delete quotation">' + UI.icon('trash', 15) + '</button>' : '') +
        '</div></td></tr>';
    }).join('');
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Quotation</th><th>Customer</th><th>Items</th><th class="right">Total</th><th></th></tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<div class="card-foot flex-between"><span class="hint">Showing ' + Math.min(rows.length, 200) + ' of ' + rows.length + ' quotation' + (rows.length === 1 ? '' : 's') + '</span></div>';
  }

  function listScreen() {
    const rows = filteredQuotes();
    return UI.pageHead({
      eyebrow: 'Counter · Quotations',
      title: 'Quotations',
      subtitle: 'Priced quotes on A4 for customers who want a price before buying. Quotes never change stock — bill a sale when the customer agrees.',
      actions: '<a class="btn btn-primary" href="#/quotations/new">' + UI.icon('plus', 15) + 'New quotation</a>'
    }) +
      '<div id="quote-stats">' + statsHTML() + '</div>' +
      '<div class="card inventory-card"><div class="inv-toolbar">' +
      '<div class="search-box" style="max-width:330px">' + UI.icon('search', 16) + '<input class="input" id="quote-search" placeholder="Search quote no, customer or item…" value="' + U.attr(listState.q) + '"></div>' +
      '<span class="spacer"></span><span class="toolbar-label" id="quote-count">' + rows.length + ' quotes</span></div>' +
      '<div id="quote-table">' + tableHTML(rows) + '</div></div>';
  }

  /* ---------------- new quotation ---------------- */
  function pickerResultsHTML() {
    const q = form.search.trim().toLowerCase();
    if (!q) return '';
    const rows = S().activeItems().filter(i =>
      ((i.name || '').toLowerCase().includes(q) || (i.sku || '').toLowerCase().includes(q) || (i.compatible || '').toLowerCase().includes(q))).slice(0, 8);
    if (!rows.length) return '<div class="picker-empty">No item found. Add it under Spare parts or Machines first.</div>';
    return rows.map(item =>
      '<button type="button" class="picker-result" data-q-pick="' + item.id + '">' +
      '<span class="picker-result-main"><span class="picker-result-name">' + U.esc(item.name) + '</span>' +
      '<span class="picker-result-meta">' + U.esc(item.sku || '') + ' · ' + (item.category === 'machine' ? 'Machine' : 'Part') + '</span></span>' +
      '<span class="picker-result-price">' + U.money(item.retail) + '</span></button>').join('');
  }

  function lineRowHTML(line) {
    const item = S().itemById(line.itemId);
    if (!item) return '';
    const qty = Number(line.qty);
    return '<div class="pe-line" data-quote-line="' + item.id + '">' +
      '<div><div class="pe-name">' + U.esc(item.name) + '</div><div class="pe-meta">' + U.esc(item.sku || '') + '</div></div>' +
      '<div class="pe-total">' + U.money(qty * Number(line.price)) + '</div>' +
      '<div class="pe-controls">' +
      '<div class="qty-control"><button type="button" class="qty-btn" data-q-minus="' + item.id + '">−</button>' +
      '<span class="qty-input" style="display:grid;place-items:center">' + U.fmtQty(qty) + '</span>' +
      '<button type="button" class="qty-btn" data-q-plus="' + item.id + '">+</button></div>' +
      '<input class="price-edit" data-q-price="' + item.id + '" type="number" min="0" step="0.01" value="' + Number(line.price).toFixed(2) + '" title="Unit price">' +
      '<button type="button" class="line-remove" data-q-remove="' + item.id + '" title="Remove item">' + UI.icon('trash', 14) + '</button>' +
      '</div></div>';
  }

  function linesListHTML() {
    if (!form.lines.length) return '<div class="empty-inline">No items yet. Search above to price parts and machines.</div>';
    return form.lines.map(lineRowHTML).join('');
  }

  function totalsHTML() {
    const t = formTotals();
    return '<div class="total-row"><span>Subtotal</span><b id="q-subtotal">' + U.money(t.subtotal) + '</b></div>' +
      '<div class="total-row"><span>Discount</span><b id="q-discount-total">− ' + U.money(t.discount) + '</b></div>' +
      '<div class="total-row grand-total"><span>Quote total</span><b id="q-grand">' + U.money(t.total) + '</b></div>';
  }

  function newScreen() {
    const t = formTotals();
    return UI.pageHead({
      eyebrow: 'Counter · New quote',
      title: 'New quotation',
      subtitle: 'Price parts and machines for a customer. Nothing leaves stock until the quote becomes a sale.',
      actions: '<a class="btn" href="#/quotations">' + UI.icon('arrowLeft', 15) + 'Quotations</a>'
    }) +
      '<div class="service-layout">' +
      '<div class="service-main">' +
      '<div class="card card-pad"><div class="card-title mb-12">' + UI.icon('users', 18) + 'Customer <span class="opt">(optional)</span></div>' +
      '<div class="form-grid">' +
      '<div class="field"><label class="label" for="q-customer">Saved customer</label>' +
      '<div style="display:flex;gap:6px">' +
      '<select class="select" id="q-customer" style="flex:1">' +
      UI.option('', 'Walk-in customer', form.customerId) +
      U.sortBy(S().activeCustomers(), c => c.name.toLowerCase(), 'asc').map(c =>
        '<option value="' + c.id + '"' + (Number(form.customerId) === Number(c.id) ? ' selected' : '') + '>' + U.esc(c.name) + (c.phone ? ' · ' + U.esc(c.phone) : '') + '</option>').join('') +
      '</select>' +
      '<button type="button" class="btn" data-q-add-customer title="Add a new customer">' + UI.icon('userPlus', 15) + '</button>' +
      '</div></div>' +
      '<div class="field"><label class="label" for="q-walkin-name">Name <span class="opt">(if not saved)</span></label>' +
      '<input class="input" id="q-walkin-name" data-q-field="customerName" value="' + U.attr(form.customerName) + '" placeholder="Customer name" autocomplete="off"></div>' +
      '<div class="field"><label class="label" for="q-phone">Phone <span class="opt">(printed on quote)</span></label>' +
      '<input class="input" id="q-phone" data-q-field="phone" value="' + U.attr(form.phone) + '" placeholder="07X XXX XXXX" autocomplete="off"></div>' +
      '<div class="field"><label class="label" for="q-note">Note <span class="opt">(printed on quote)</span></label>' +
      '<input class="input" id="q-note" data-q-field="note" value="' + U.attr(form.note) + '" placeholder="e.g. price valid only with old battery return" autocomplete="off"></div>' +
      '</div></div>' +
      '<div class="card card-pad"><div class="card-title mb-12">' + UI.icon('box', 18) + 'Items <span class="badge grey" id="q-count">' + form.lines.length + '</span></div>' +
      '<div class="part-picker"><div class="search-box">' + UI.icon('search', 16) +
      '<input class="input" id="q-part-search" placeholder="Search a part or machine by name, SKU or model…" value="' + U.attr(form.search) + '" autocomplete="off"></div>' +
      '<div class="picker-results' + (form.search.trim() ? '' : ' hidden') + '" id="q-picker">' + pickerResultsHTML() + '</div></div>' +
      '<div class="pe-list mt-12" id="q-lines">' + linesListHTML() + '</div>' +
      '<div class="hint mt-8">Quantities on a quote do not reserve stock — sell normally when the customer accepts.</div></div>' +
      '</div>' +
      '<aside class="card service-side">' +
      '<div class="cart-head"><div><div class="cart-title">Quotation</div><div class="cart-sub" id="q-customer-label">' + U.esc(chosenCustomer() ? chosenCustomer().name : (form.customerName || 'Walk-in customer')) + '</div></div>' +
      '<span class="wholesale-flag">QUOTE</span></div>' +
      '<div class="service-bill-scroll"><div class="card-pad" style="padding-top:14px">' +
      '<div class="field"><label class="label" for="q-discount">Discount</label>' +
      '<div class="input-group"><span class="prefix">' + U.esc(U.symbol()) + '</span><input class="input" id="q-discount" data-q-field="discount" type="number" min="0" step="0.01" placeholder="0.00" value="' + U.attr(form.discount) + '"></div></div>' +
      '<div class="divider"></div>' +
      '<div class="totals" id="q-totals">' + totalsHTML() + '</div>' +
      '<div class="hint mt-8">' + UI.icon('printer', 12) + ' The quotation prints on A4 after saving.</div>' +
      '</div></div>' +
      '<div class="service-summary"><button type="button" class="btn btn-primary checkout-btn" data-q-submit>' + UI.icon('check', 16) + 'Save & print quotation · ' + U.money(t.total) + '</button>' +
      '<div class="hint center mt-8">Find the quote again under Quotations to reprint or bill it.</div></div>' +
      '</aside></div>';
  }

  function paintLines(scope) {
    const list = scope.querySelector('#q-lines');
    if (list) list.innerHTML = linesListHTML();
    const count = scope.querySelector('#q-count');
    if (count) count.textContent = form.lines.length;
  }

  function paintPicker(scope) {
    const picker = scope.querySelector('#q-picker');
    if (!picker) return;
    picker.innerHTML = pickerResultsHTML();
    picker.classList.toggle('hidden', !form.search.trim());
  }

  function paintTotals(scope) {
    const t = formTotals();
    const sub = scope.querySelector('#q-subtotal');
    if (sub) sub.textContent = U.money(t.subtotal);
    const disc = scope.querySelector('#q-discount-total');
    if (disc) disc.textContent = '− ' + U.money(t.discount);
    const grand = scope.querySelector('#q-grand');
    if (grand) grand.textContent = U.money(t.total);
    const submit = scope.querySelector('[data-q-submit]');
    if (submit) submit.innerHTML = UI.icon('check', 16) + 'Save & print quotation · ' + U.money(t.total);
  }

  function addLine(scope, itemId) {
    const item = S().itemById(Number(itemId));
    if (!item) return;
    const line = form.lines.find(l => Number(l.itemId) === Number(item.id));
    if (line) line.qty = U.round2(Number(line.qty) + 1);
    else form.lines.push({ itemId: item.id, qty: 1, price: Number(item.retail) });
    form.search = '';
    const search = scope.querySelector('#q-part-search');
    if (search) search.value = '';
    paintLines(scope);
    paintPicker(scope);
    paintTotals(scope);
    if (search) search.focus();
  }

  async function submitQuote(scope) {
    const t = formTotals();
    if (!form.lines.length) { UI.toast('Add at least one item to the quotation.', 'error'); return; }
    if (t.total <= 0) { UI.toast('The quotation total must be greater than zero.', 'error'); return; }
    const submit = scope.querySelector('[data-q-submit]');
    const customer = chosenCustomer();
    try {
      await UI.withLoading(submit, async () => {
        const quote = await S().addQuotation({
          customerId: customer ? customer.id : null,
          customerName: form.customerName,
          phone: form.phone,
          lines: form.lines.map(l => ({ itemId: l.itemId, qty: l.qty, price: l.price })),
          discount: form.discount,
          note: form.note,
          cashierId: WP.app.getActiveCashierId()
        });
        resetForm();
        UI.toast('Quotation ' + quote.no + ' saved.');
        APP().refresh();
        UI.printHtml(UI.quotationHTML(quote));
        APP().navigate('#/quotations');
      });
    } catch (err) {
      UI.toast(err.userMessage || err.message || 'Could not save the quotation.', 'error');
    }
  }

  V.quotations = {
    render(route) {
      if (route && route.sub === 'new') return newScreen();
      return listScreen();
    },
    mount(content, route) {
      const scope = content.querySelector('#view-root') || content;

      if (route && route.sub === 'new') {
        scope.addEventListener('input', e => {
          const field = e.target.closest('[data-q-field]');
          if (field) {
            form[field.dataset.qField] = field.value;
            if (field.dataset.qField === 'discount') paintTotals(scope);
          }
          if (e.target.id === 'q-part-search') {
            form.search = e.target.value;
            paintPicker(scope);
          }
          if (e.target.matches('[data-q-price]')) {
            const itemId = Number(e.target.dataset.qPrice);
            const line = form.lines.find(l => Number(l.itemId) === Number(itemId));
            if (line) {
              line.price = Math.max(0, U.toNum(e.target.value, 0));
              paintTotals(scope);
              const row = e.target.closest('.pe-line');
              const total = row ? row.querySelector('.pe-total') : null;
              if (total) total.textContent = U.money(Number(line.qty) * Number(line.price));
            }
          }
        });
        scope.addEventListener('change', e => {
          if (e.target.id === 'q-customer') {
            form.customerId = e.target.value;
            const customer = chosenCustomer();
            if (customer) {
              form.customerName = customer.name;
              form.phone = customer.phone || '';
              const name = scope.querySelector('#q-walkin-name');
              const phone = scope.querySelector('#q-phone');
              if (name) name.value = form.customerName;
              if (phone) phone.value = form.phone;
            }
            const label = scope.querySelector('#q-customer-label');
            if (label) label.textContent = customer ? customer.name : 'Walk-in customer';
          }
          if (e.target.matches('[data-q-price]')) {
            const itemId = Number(e.target.dataset.qPrice);
            const line = form.lines.find(l => Number(l.itemId) === Number(itemId));
            if (line) {
              line.price = Math.max(0, U.toNum(e.target.value, 0));
              paintTotals(scope);
            }
          }
        });
        scope.addEventListener('keydown', e => {
          if (e.target.id === 'q-part-search' && e.key === 'Escape') {
            form.search = '';
            e.target.value = '';
            paintPicker(scope);
          }
        });
        scope.addEventListener('click', e => {
          if (e.target.closest('[data-q-add-customer]')) {
            C.addCustomerModal({
              onSaved(customer) {
                form.customerId = String(customer.id);
                form.customerName = customer.name;
                form.phone = customer.phone || '';
                APP().renderRoute(true);
              }
            });
            return;
          }
          const pick = e.target.closest('[data-q-pick]');
          if (pick) { addLine(scope, pick.dataset.qPick); return; }
          const plus = e.target.closest('[data-q-plus]');
          if (plus) {
            const itemId = Number(plus.dataset.qPlus);
            const line = form.lines.find(l => Number(l.itemId) === itemId);
            if (line) { line.qty = U.round2(Number(line.qty) + 1); paintLines(scope); paintTotals(scope); }
            return;
          }
          const minus = e.target.closest('[data-q-minus]');
          if (minus) {
            const itemId = Number(minus.dataset.qMinus);
            const line = form.lines.find(l => Number(l.itemId) === itemId);
            if (!line) return;
            line.qty = U.round2(Number(line.qty) - 1);
            if (line.qty <= 0) form.lines = form.lines.filter(l => Number(l.itemId) !== itemId);
            paintLines(scope); paintTotals(scope);
            return;
          }
          const remove = e.target.closest('[data-q-remove]');
          if (remove) {
            const itemId = Number(remove.dataset.qRemove);
            form.lines = form.lines.filter(l => Number(l.itemId) !== itemId);
            paintLines(scope); paintTotals(scope);
            return;
          }
          if (e.target.closest('[data-q-submit]')) submitQuote(scope);
        });
        return;
      }

      const search = scope.querySelector('#quote-search');
      function paint() {
        const rows = filteredQuotes();
        const table = scope.querySelector('#quote-table');
        const count = scope.querySelector('#quote-count');
        const stats = scope.querySelector('#quote-stats');
        if (table) table.innerHTML = tableHTML(rows);
        if (count) count.textContent = rows.length + ' quotes';
        if (stats) stats.innerHTML = statsHTML();
      }
      if (search) search.addEventListener('input', U.debounce(() => { listState.q = search.value; paint(); }, 160));
      scope.addEventListener('click', async e => {
        const printBtn = e.target.closest('[data-quote-print]');
        if (printBtn) {
          const quote = S().data.quotations.find(q => Number(q.id) === Number(printBtn.dataset.quotePrint));
          if (quote) UI.printHtml(UI.quotationHTML(quote));
          return;
        }
        const deleteBtn = e.target.closest('[data-quote-delete]');
        if (deleteBtn) {
          if (!adminMode()) return;
          const quote = S().data.quotations.find(q => Number(q.id) === Number(deleteBtn.dataset.quoteDelete));
          if (!quote) return;
          const ok = await UI.confirmDialog({
            title: 'Delete ' + quote.no + '?',
            text: 'The quotation will be removed. This does not affect stock or any bill.',
            confirmText: 'Delete quotation'
          });
          if (!ok) return;
          try {
            await S().deleteQuotation(quote.id);
            UI.toast(quote.no + ' deleted.');
            APP().dataChanged();
          } catch (err) { UI.toast(err.message || 'Could not delete the quotation.', 'error'); }
        }
      });
    },
    refresh() {
      APP().renderRoute(true);
    }
  };
})();
