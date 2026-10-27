(function () {
  'use strict';
  const WP = window.WP = window.WP || {};
  const U = WP.utils;
  const UI = WP.ui;
  const C = {};

  function store() { return WP.store; }
  function activeCashierId() { return WP.app && WP.app.getActiveCashierId ? WP.app.getActiveCashierId() : null; }
  function afterChange() { if (WP.app && WP.app.dataChanged) WP.app.dataChanged(); }
  function sid() { return 'f' + Math.random().toString(36).slice(2, 9); }

  function chequeFields(idPrefix, visible) {
    return '<div class="' + (visible ? '' : 'hidden') + '" data-cheque-fields>' +
      '<div class="form-grid">' +
      '<div class="field"><label class="label" for="' + idPrefix + '-cheque-no">Cheque number</label>' +
      '<input class="input" id="' + idPrefix + '-cheque-no" name="chequeNo" placeholder="e.g. 045812" autocomplete="off"></div>' +
      '<div class="field"><label class="label" for="' + idPrefix + '-cheque-date">Cheque date</label>' +
      '<input class="input" id="' + idPrefix + '-cheque-date" name="chequeDate" type="date" value="' + U.todayISO() + '"></div>' +
      '</div></div>';
  }

  function bindChequeToggle(panel, selectEl) {
    if (!selectEl) return;
    const wrap = panel.querySelector('[data-cheque-fields]');
    if (!wrap) return;
    const toggle = () => { wrap.classList.toggle('hidden', selectEl.value !== 'cheque'); };
    selectEl.addEventListener('change', toggle);
    toggle();
  }

  /* =========================================================
     Customer add / edit
     ========================================================= */
  C.addCustomerModal = function (options) {
    const opts = options || {};
    const editing = !!opts.customer;
    const customer = opts.customer || {};
    const m = UI.modal({
      title: editing ? 'Edit customer' : 'New customer',
      subtitle: editing ? 'Update contact details and carried balance.' : 'Save this customer for credit, advances and statements.',
      size: 'md',
      body:
        '<form id="customer-form">' +
        '<div class="form-grid">' +
        '<div class="field full"><label class="label" for="cf-name">Customer name</label>' +
        '<input class="input" id="cf-name" name="name" required autocomplete="off" placeholder="e.g. Nimal Perera" value="' + U.attr(customer.name || '') + '"></div>' +
        '<div class="field"><label class="label" for="cf-phone">Phone</label>' +
        '<input class="input" id="cf-phone" name="phone" autocomplete="off" placeholder="07X XXX XXXX" value="' + U.attr(customer.phone || '') + '"></div>' +
        '<div class="field"><label class="label" for="cf-opening">Opening balance <span class="opt">(due from customer)</span></label>' +
        '<div class="input-group"><span class="prefix">' + U.esc(U.symbol()) + '</span><input class="input" id="cf-opening" name="openingBalance" type="number" step="0.01" min="0" placeholder="0.00" value="' + (customer.openingBalance || '') + '"></div>' +
        '<div class="hint">Amount the customer already owes before starting in this system.</div></div>' +
        '<div class="field full"><label class="label" for="cf-address">Address <span class="opt">(optional)</span></label>' +
        '<input class="input" id="cf-address" name="address" autocomplete="off" placeholder="Town / address" value="' + U.attr(customer.address || '') + '"></div>' +
        '<div class="field full"><label class="label" for="cf-note">Note <span class="opt">(optional)</span></label>' +
        '<textarea class="textarea" id="cf-note" name="note" rows="2" placeholder="Anything useful to remember about this customer">' + U.esc(customer.note || '') + '</textarea></div>' +
        '</div></form>',
      footer: '<button type="button" class="btn" data-modal-close>Cancel</button>' +
        '<button type="submit" class="btn btn-primary" form="customer-form">' + UI.icon('check', 15) + (editing ? 'Save changes' : 'Save customer') + '</button>'
    });
    const form = m.panel.querySelector('#customer-form');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const submit = m.panel.querySelector('[type="submit"][form="customer-form"]');
      const values = UI.formValues(form);
      try {
        await UI.withLoading(submit, async () => {
          const result = editing ? await store().updateCustomer(customer.id, values) : await store().addCustomer(values);
          m.close();
          UI.toast(editing ? 'Customer updated.' : 'Customer saved.');
          if (typeof opts.onSaved === 'function') opts.onSaved(result);
          afterChange();
        });
      } catch (err) { UI.toast(err.userMessage || err.message || 'Could not save customer.', 'error'); }
    });
    return m;
  };

  /* =========================================================
     Receive payment (credit collection)
     ========================================================= */
  C.collectModal = function (options) {
    const opts = options || {};
    const customer = store().customerById(opts.customerId);
    if (!customer) { UI.toast('Customer not found.', 'error'); return; }
    const due = store().customerDue(customer.id);
    const advance = store().customerAdvance(customer.id);
    const prefix = sid();
    const suggested = opts.suggestedAmount !== undefined ? opts.suggestedAmount : due;
    const m = UI.modal({
      title: 'Receive payment',
      subtitle: customer.name + ' · outstanding ' + U.money(due),
      size: 'md',
      body:
        '<div class="statement-hero mb-16">' +
        '<div class="statement-fig"><span>Outstanding due</span><b class="text-danger">' + U.money(due) + '</b></div>' +
        '<div class="statement-fig"><span>Advance available</span><b class="text-success">' + U.money(advance) + '</b></div>' +
        (customer.phone ? '<div class="statement-fig"><span>Phone</span><b style="font-size:15px">' + U.esc(customer.phone) + '</b></div>' : '') +
        '</div>' +
        '<form id="collect-form">' +
        '<div class="form-grid">' +
        '<div class="field"><label class="label" for="' + prefix + '-amount">Amount received</label>' +
        '<div class="input-group"><span class="prefix">' + U.esc(U.symbol()) + '</span><input class="input" id="' + prefix + '-amount" name="amount" type="number" step="0.01" min="0.01" required value="' + (suggested > 0 ? suggested.toFixed(2) : '') + '"></div>' +
        '<div class="hint">' + (opts.targetLabel ? 'Collected for ' + U.esc(opts.targetLabel) + '. ' : '') + 'Extra above the due amount becomes customer advance.</div></div>' +
        '<div class="field"><label class="label" for="' + prefix + '-method">Payment method</label>' +
        '<select class="select" id="' + prefix + '-method" name="method">' +
        UI.option('cash', 'Cash', 'cash') + UI.option('card', 'Card', '') + UI.option('online', 'Online transfer', '') + UI.option('cheque', 'Cheque', '') +
        '</select></div>' +
        '<div class="field full" data-cheque-wrap>' + chequeFields(prefix, false) + '</div>' +
        '<div class="field full"><label class="label" for="' + prefix + '-note">Note <span class="opt">(optional)</span></label>' +
        '<input class="input" id="' + prefix + '-note" name="note" placeholder="Reference or remark" autocomplete="off"></div>' +
        '</div></form>',
      footer: '<button type="button" class="btn" data-modal-close>Cancel</button>' +
        '<button type="submit" class="btn btn-primary" form="collect-form">' + UI.icon('banknote', 15) + 'Receive payment</button>'
    });
    const form = m.panel.querySelector('#collect-form');
    const method = form.querySelector('[name="method"]');
    bindChequeToggle(m.panel, method);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const submit = m.panel.querySelector('[type="submit"][form="collect-form"]');
      const values = UI.formValues(form);
      try {
        await UI.withLoading(submit, async () => {
          const result = await store().collectPayment(customer.id, {
            amount: values.amount, method: values.method, note: values.note,
            chequeNo: values.chequeNo, chequeDate: values.chequeDate,
            cashierId: activeCashierId(),
            targetType: opts.targetType || null, targetId: opts.targetId || null
          });
          m.close();
          UI.toast(U.money(result.applied) + ' received' + (result.advance > 0 ? ' · ' + U.money(result.advance) + ' added to advance' : '') + '.');
          afterChange();
          if (typeof opts.onDone === 'function') opts.onDone(result);
        });
      } catch (err) { UI.toast(err.userMessage || err.message || 'Could not receive payment.', 'error'); }
    });
    return m;
  };

  /* =========================================================
     Customer advance
     ========================================================= */
  C.advanceModal = function (options) {
    const opts = options || {};
    const customer = store().customerById(opts.customerId);
    if (!customer) { UI.toast('Customer not found.', 'error'); return; }
    const due = store().customerDue(customer.id);
    const advance = store().customerAdvance(customer.id);
    const prefix = sid();
    const m = UI.modal({
      title: 'Record advance',
      subtitle: 'Money received now, before a sale or service.',
      size: 'md',
      body:
        '<div class="statement-hero mb-16">' +
        '<div class="statement-fig"><span>Customer</span><b style="font-size:17px">' + U.esc(customer.name) + '</b></div>' +
        '<div class="statement-fig"><span>Existing advance</span><b class="text-success">' + U.money(advance) + '</b></div>' +
        '<div class="statement-fig"><span>Outstanding due</span><b class="text-danger">' + U.money(due) + '</b></div>' +
        '</div>' +
        '<form id="advance-form"><div class="form-grid">' +
        '<div class="field"><label class="label" for="' + prefix + '-adv-amount">Advance amount</label>' +
        '<div class="input-group"><span class="prefix">' + U.esc(U.symbol()) + '</span><input class="input" id="' + prefix + '-adv-amount" name="amount" type="number" step="0.01" min="0.01" required autofocus></div></div>' +
        '<div class="field"><label class="label" for="' + prefix + '-adv-method">Received by</label>' +
        '<select class="select" id="' + prefix + '-adv-method" name="method">' + UI.option('cash', 'Cash', 'cash') + UI.option('card', 'Card', '') + UI.option('online', 'Online transfer', '') + UI.option('cheque', 'Cheque', '') + '</select></div>' +
        '<div class="field full">' + chequeFields(prefix, false) + '</div>' +
        '<div class="field full"><label class="label" for="' + prefix + '-adv-note">Note <span class="opt">(optional)</span></label><input class="input" id="' + prefix + '-adv-note" name="note" placeholder="e.g. deposit for machine repair" autocomplete="off"></div>' +
        '</div></form>' +
        '<div class="pay-note mt-12">This advance is saved against ' + U.esc(customer.name) + ' and can be used when creating a sale or service bill.</div>',
      footer: '<button type="button" class="btn" data-modal-close>Cancel</button>' +
        '<button type="submit" class="btn btn-primary" form="advance-form">' + UI.icon('coins', 15) + 'Save advance</button>'
    });
    const form = m.panel.querySelector('#advance-form');
    bindChequeToggle(m.panel, form.querySelector('[name="method"]'));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const submit = m.panel.querySelector('[type="submit"][form="advance-form"]');
      const values = UI.formValues(form);
      try {
        await UI.withLoading(submit, async () => {
          await store().addAdvance(customer.id, {
            amount: values.amount, method: values.method, note: values.note,
            chequeNo: values.chequeNo, chequeDate: values.chequeDate, cashierId: activeCashierId()
          });
          m.close();
          UI.toast('Advance saved for ' + customer.name + '.');
          afterChange();
          if (typeof opts.onDone === 'function') opts.onDone();
        });
      } catch (err) { UI.toast(err.userMessage || err.message || 'Could not save advance.', 'error'); }
    });
    return m;
  };

  /* =========================================================
     Customer statement
     ========================================================= */
  C.statementModal = function (customerId) {
    const st = store().customerStatement(customerId);
    if (!st) { UI.toast('Customer not found.', 'error'); return; }
    const c = st.customer;
    const invoiceRows = st.invoices.slice(0, 12).map(inv =>
      '<div class="mini-ledger-row"><div class="mini-ledger-main"><div class="mini-ledger-title">' + U.esc(inv.no) + ' <span class="badge ' + (inv.type === 'wholesale' ? 'gold' : 'grey') + '">' + (inv.type === 'wholesale' ? 'Wholesale' : 'Retail') + '</span></div>' +
      '<div class="mini-ledger-sub">' + U.esc(U.fmtDate(inv.date, { mode: 'short' })) + ' · ' + UI.methodLabel(inv.method) + '</div></div>' +
      '<div class="right"><div class="mini-ledger-amt">' + U.money(inv.total) + '</div><div class="mini-ledger-sub">' + (Number(inv.balance) > 0 ? 'Due ' + U.money(inv.balance) : UI.statusBadge(inv.status)) + '</div></div></div>'
    ).join('');
    const serviceRows = st.services.slice(0, 12).map(s =>
      '<div class="mini-ledger-row"><div class="mini-ledger-main"><div class="mini-ledger-title">' + U.esc(s.no) + ' · ' + U.esc(s.technician) + '</div>' +
      '<div class="mini-ledger-sub">' + U.esc(U.fmtDate(s.date, { mode: 'short' })) + ' · ' + U.esc(s.machineType || 'Service') + '</div></div>' +
      '<div class="right"><div class="mini-ledger-amt">' + U.money(s.total) + '</div><div class="mini-ledger-sub">' + (Number(s.balance) > 0 ? 'Due ' + U.money(s.balance) : UI.statusBadge(s.status)) + '</div></div></div>'
    ).join('');
    const paymentLabels = { collection: 'Payment received', advance: 'Advance received', advance_used: 'Advance applied' };
    const paymentRows = st.payments.slice(0, 14).map(p =>
      '<div class="mini-ledger-row"><div class="mini-ledger-main"><div class="mini-ledger-title">' + U.esc(paymentLabels[p.type] || p.type) + '</div>' +
      '<div class="mini-ledger-sub">' + U.esc(U.fmtDate(p.date, { mode: 'short' })) + ' · ' + UI.methodLabel(p.method) + (p.note ? ' · ' + U.esc(p.note) : '') + '</div></div>' +
      '<div class="mini-ledger-amt ' + (p.type === 'advance_used' ? 'muted' : 'credit') + '">' + (p.type === 'advance_used' ? '− ' : '+ ') + U.money(p.amount) + '</div></div>'
    ).join('');
    const returnRows = st.returns.slice(0, 8).map(r =>
      '<div class="mini-ledger-row"><div class="mini-ledger-main"><div class="mini-ledger-title">Return ' + U.esc(r.no) + ' against ' + U.esc(r.refNo) + '</div>' +
      '<div class="mini-ledger-sub">' + U.esc(U.fmtDate(r.date, { mode: 'short' })) + ' · ' + U.esc(r.reason || 'No reason given') + '</div></div>' +
      '<div class="right"><div class="mini-ledger-amt">' + U.money(r.refund) + '</div><div class="mini-ledger-sub">refunded</div></div></div>'
    ).join('');
    const m = UI.modal({
      title: 'Customer statement',
      subtitle: c.name + (c.phone ? ' · ' + c.phone : ''),
      size: 'lg',
      body:
        '<div class="statement-hero">' +
        '<div class="statement-fig"><span>Outstanding due</span><b class="text-danger">' + U.money(st.due) + '</b></div>' +
        '<div class="statement-fig"><span>Advance balance</span><b class="text-success">' + U.money(st.advance) + '</b></div>' +
        '<div class="statement-fig"><span>Opening balance</span><b>' + U.money(c.openingBalance) + '</b></div>' +
        '<div class="statement-fig"><span>Customer since</span><b style="font-size:16px">' + U.esc(U.fmtDate(c.createdAt, { mode: 'short' })) + '</b></div>' +
        '</div>' +
        (c.address ? '<div class="hint mt-8">' + U.esc(c.address) + '</div>' : '') +
        '<div class="statement-section"><h4>Invoices</h4><div class="mini-ledger">' + (invoiceRows || '<div class="empty-inline">No invoices yet.</div>') + '</div></div>' +
        '<div class="statement-section"><h4>Service jobs</h4><div class="mini-ledger">' + (serviceRows || '<div class="empty-inline">No service jobs yet.</div>') + '</div></div>' +
        '<div class="statement-section"><h4>Payments & advances</h4><div class="mini-ledger">' + (paymentRows || '<div class="empty-inline">No payments yet.</div>') + '</div></div>' +
        (returnRows ? '<div class="statement-section"><h4>Returns</h4><div class="mini-ledger">' + returnRows + '</div></div>' : '') +
        (c.note ? '<div class="statement-section"><h4>Note</h4><div class="detail-block"><p>' + U.esc(c.note) + '</p></div></div>' : ''),
      footer: '<button type="button" class="btn" data-modal-close>Close</button>' +
        '<button type="button" class="btn btn-primary" data-print-statement>' + UI.icon('printer', 15) + 'Print statement</button>'
    });
    m.panel.querySelector('[data-print-statement]').addEventListener('click', () => printStatement(st));
    return m;
  };

  function printStatement(st) {
    const c = st.customer;
    const invRows = st.invoices.map(i => '<tr><td>' + U.fmtDate(i.date, { mode: 'short' }) + '</td><td>' + U.esc(i.no) + '</td><td>' + U.esc(i.type === 'wholesale' ? 'Wholesale' : 'Retail') + '</td><td class="r">' + U.esc(U.fmtNumber(i.total)) + '</td><td class="r">' + U.esc(U.fmtNumber(i.paid)) + '</td><td class="r">' + U.esc(U.fmtNumber(i.balance)) + '</td></tr>').join('');
    const svcRows = st.services.map(s => '<tr><td>' + U.fmtDate(s.date, { mode: 'short' }) + '</td><td>' + U.esc(s.no) + '</td><td>' + U.esc(s.technician) + '</td><td class="r">' + U.esc(U.fmtNumber(s.total)) + '</td><td class="r">' + U.esc(U.fmtNumber(s.paid)) + '</td><td class="r">' + U.esc(U.fmtNumber(s.balance)) + '</td></tr>').join('');
    const payRows = st.payments.map(p => '<tr><td>' + U.fmtDate(p.date, { mode: 'short' }) + '</td><td>' + U.esc(p.type === 'advance_used' ? 'Advance applied' : p.type === 'advance' ? 'Advance received' : 'Payment') + '</td><td>' + U.esc(UI.methodLabel(p.method)) + '</td><td>' + U.esc(p.note || '') + '</td><td class="r">' + U.esc(U.fmtNumber(p.amount)) + '</td></tr>').join('');
    const content =
      '<div class="grid">' +
      '<div class="box"><span>Outstanding due</span><b>' + U.esc(U.money(st.due)) + '</b></div>' +
      '<div class="box"><span>Advance balance</span><b>' + U.esc(U.money(st.advance)) + '</b></div>' +
      '<div class="box"><span>Opening balance</span><b>' + U.esc(U.money(c.openingBalance)) + '</b></div>' +
      '<div class="box"><span>Phone</span><b style="font-size:12px">' + U.esc(c.phone || '—') + '</b></div>' +
      '</div>' +
      '<h3>Invoices</h3><table><thead><tr><th>Date</th><th>Invoice</th><th>Type</th><th class="r">Total</th><th class="r">Paid</th><th class="r">Balance</th></tr></thead><tbody>' + (invRows || '<tr><td colspan="6">No invoices.</td></tr>') + '</tbody></table>' +
      '<h3>Service jobs</h3><table><thead><tr><th>Date</th><th>Job</th><th>Technician</th><th class="r">Total</th><th class="r">Paid</th><th class="r">Balance</th></tr></thead><tbody>' + (svcRows || '<tr><td colspan="6">No service jobs.</td></tr>') + '</tbody></table>' +
      '<h3>Payments & advances</h3><table><thead><tr><th>Date</th><th>Type</th><th>Method</th><th>Note</th><th class="r">Amount</th></tr></thead><tbody>' + (payRows || '<tr><td colspan="5">No payments.</td></tr>') + '</tbody></table>';
    UI.printDocument({
      title: 'Customer statement',
      meta: '<span><b>Customer:</b> ' + U.esc(c.name) + '</span><span><b>Phone:</b> ' + U.esc(c.phone || '—') + '</span><span><b>Statement date:</b> ' + U.fmtDate(U.todayISO()) + '</span>',
      content
    });
  }

  /* =========================================================
     Invoice detail
     ========================================================= */
  C.invoiceDetailModal = function (invoiceId, options) {
    const opts = options || {};
    const d = store().invoiceDetail(invoiceId);
    if (!d) { UI.toast('Invoice not found.', 'error'); return; }
    const inv = d.invoice;
    const remaining = d.lines.reduce((s, l) => s + (Number(l.qty) - Number(l.returnedQty)), 0);
    const canReturn = remaining > 0.0001;
    const itemRows = d.lines.map(l => {
      const returned = Number(l.returnedQty) || 0;
      return '<tr><td><div class="cell-stack"><span class="cell-main">' + U.esc(l.name) + '</span><span class="cell-sub">' + U.esc(l.sku || '') + (returned > 0 ? ' · returned ' + U.fmtQty(returned) : '') + '</span></div></td>' +
        '<td class="right num">' + U.fmtQty(l.qty) + '</td><td class="right num">' + U.money(l.price) + '</td><td class="right num">' + U.money(l.total) + '</td></tr>';
    }).join('');
    const collections = d.payments.length
      ? '<div class="statement-section"><h4>Payments received later</h4><div class="mini-ledger">' + d.payments.map(p => {
        const alloc = (p.allocations || []).filter(a => a.type === 'invoice' && Number(a.id) === Number(inv.id)).reduce((s, a) => s + Number(a.amount), 0);
        return '<div class="mini-ledger-row"><div class="mini-ledger-main"><div class="mini-ledger-title">' + U.esc(UI.methodLabel(p.method)) + ' payment</div><div class="mini-ledger-sub">' + U.fmtDate(p.date, { mode: 'short' }) + (p.note ? ' · ' + U.esc(p.note) : '') + '</div></div><div class="mini-ledger-amt credit">+ ' + U.money(alloc) + '</div></div>';
      }).join('') + '</div></div>' : '';
    const returnSection = d.returns.length
      ? '<div class="statement-section"><h4>Returns</h4><div class="mini-ledger">' + d.returns.map(r =>
        '<div class="mini-ledger-row"><div class="mini-ledger-main"><div class="mini-ledger-title">' + U.esc(r.no) + (r.reason ? ' · ' + U.esc(r.reason) : '') + '</div><div class="mini-ledger-sub">' + U.fmtDate(r.date, { mode: 'short' }) + ' · ' + U.esc(UI.methodLabel(r.method)) + ' · refunded ' + U.money(r.refund) + '</div></div><div class="mini-ledger-amt">− ' + U.money(r.amount) + '</div></div>').join('') + '</div></div>' : '';
    const head =
      '<div class="modal-head"><div><div class="modal-title" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' + U.esc(inv.no) + UI.statusBadge(d.status) +
      (inv.type === 'wholesale' ? '<span class="badge gold">Wholesale</span>' : '') + '</div>' +
      '<div class="modal-sub">' + U.fmtDate(inv.date) + ' at ' + U.fmtTime(inv.createdAt) + ' · ' + (d.cashier ? U.esc(d.cashier.name) : 'No cashier') + '</div></div>' +
      '<button type="button" class="modal-close" data-modal-close aria-label="Close">' + UI.icon('x', 16) + '</button></div>';
    const m = UI.modal({
      size: 'lg',
      headHTML: head,
      body:
        '<div class="detail-grid">' +
        '<div class="detail-block"><h4>Customer</h4><p><b>' + U.esc(inv.customerName || 'Walk-in customer') + '</b>' + (inv.customerPhone ? '<br>' + U.esc(inv.customerPhone) : '') + '</p></div>' +
        '<div class="detail-block"><h4>Payment</h4><p>' + UI.methodInline(inv.method) + (inv.chequeNo ? '<br>Cheque ' + U.esc(inv.chequeNo) + ' · ' + U.esc(U.fmtDate(inv.chequeDate, { mode: 'short' })) : '') + (inv.note ? '<br>' + U.esc(inv.note) : '') + '</p></div>' +
        '</div>' +
        '<div class="table-wrap mt-16"><table class="table compact"><thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Price</th><th class="right">Total</th></tr></thead><tbody>' + itemRows + '</tbody></table></div>' +
        '<div class="detail-totals">' +
        '<div class="detail-total-row"><span>Subtotal</span><span>' + U.money(inv.subtotal) + '</span></div>' +
        (Number(inv.discount) > 0 ? '<div class="detail-total-row"><span>Discount</span><span>− ' + U.money(inv.discount) + '</span></div>' : '') +
        '<div class="detail-total-row total"><span>Total</span><b>' + U.money(inv.total) + '</b></div>' +
        (Number(inv.advanceUsed) > 0 ? '<div class="detail-total-row"><span>Advance applied</span><span>' + U.money(inv.advanceUsed) + '</span></div>' : '') +
        '<div class="detail-total-row"><span>Paid</span><span>' + U.money(inv.paid) + '</span></div>' +
        '<div class="detail-total-row"><span>Balance due</span><span class="' + (Number(inv.balance) > 0 ? 'text-danger' : 'text-success') + '"><b>' + U.money(inv.balance) + '</b></span></div>' +
        (Number(inv.returned) > 0 ? '<div class="detail-total-row"><span>Returned</span><span>− ' + U.money(inv.returned) + '</span></div>' : '') +
        '</div>' + collections + returnSection,
      footer: '<button type="button" class="btn" data-modal-close>Done</button>' +
        (canReturn ? '<button type="button" class="btn" data-return>' + UI.icon('archive', 14) + 'Return items</button>' : '') +
        (Number(inv.balance) > 0 && inv.customerId ? '<button type="button" class="btn" data-collect>' + UI.icon('banknote', 14) + 'Receive payment</button>' : '') +
        '<button type="button" class="btn btn-primary" data-print>' + UI.icon('printer', 14) + 'Print</button>'
    });
    m.panel.querySelector('[data-print]').addEventListener('click', () => UI.printHtml(UI.receiptFor('invoice', d)));
    const collectBtn = m.panel.querySelector('[data-collect]');
    if (collectBtn) collectBtn.addEventListener('click', () => {
      C.collectModal({
        customerId: inv.customerId, suggestedAmount: Number(inv.balance),
        targetType: 'invoice', targetId: inv.id, targetLabel: inv.no,
        onDone: () => { m.close(); if (typeof opts.onChanged === 'function') opts.onChanged(); }
      });
    });
    const returnBtn = m.panel.querySelector('[data-return]');
    if (returnBtn) returnBtn.addEventListener('click', () => {
      C.returnInvoiceModal(inv.id, () => { m.close(); if (typeof opts.onChanged === 'function') opts.onChanged(); });
    });
    return m;
  };

  /* =========================================================
     Invoice return
     ========================================================= */
  C.returnInvoiceModal = function (invoiceId, onDone) {
    const d = store().invoiceDetail(invoiceId);
    if (!d) { UI.toast('Invoice not found.', 'error'); return; }
    const inv = d.invoice;
    const rows = d.lines.filter(l => Number(l.qty) - Number(l.returnedQty) > 0.0001).map(l =>
      '<tr><td><div class="cell-stack"><span class="cell-main">' + U.esc(l.name) + '</span><span class="cell-sub">' + U.fmtQty(Number(l.qty) - Number(l.returnedQty)) + ' available to return</span></div></td>' +
      '<td class="right"><input class="input sm" style="width:80px;margin-left:auto" type="number" min="0" max="' + (Number(l.qty) - Number(l.returnedQty)) + '" step="0.01" value="0" data-return-qty="' + l.id + '"></td></tr>');
    if (!rows.length) { UI.toast('Every item on this invoice has already been returned.', 'info'); return; }
    const m = UI.modal({
      title: 'Return items',
      subtitle: inv.no + ' · ' + inv.customerName,
      size: 'md',
      body:
        '<div class="info-banner warning-banner" style="background:var(--warning-wash);border-color:#ecdab7;color:#71531f"><span class="banner-ico">' + UI.icon('info', 16) + '</span><span>Identify the returned items and quantities. Any outstanding balance is cleared first; the rest is refunded.</span></div>' +
        '<form id="return-invoice-form">' +
        '<div class="table-wrap"><table class="table compact"><thead><tr><th>Item</th><th class="right">Return qty</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>' +
        '<div class="form-grid mt-16">' +
        '<div class="field"><label class="label" for="ret-method">Refund method</label><select class="select" id="ret-method" name="method">' +
        UI.option('cash', 'Cash', 'cash') + UI.option('card', 'Card', '') + UI.option('online', 'Online transfer', '') + UI.option('credit', 'Credit note → customer advance', '') + '</select></div>' +
        '<div class="field"><label class="label" for="ret-reason">Reason</label><input class="input" id="ret-reason" name="reason" placeholder="e.g. wrong part / damaged" autocomplete="off"></div>' +
        '<div class="field full"><label class="check"><input type="checkbox" name="restock" checked> Add returned items back to stock</label></div>' +
        '</div></form>',
      footer: '<button type="button" class="btn" data-modal-close>Cancel</button>' +
        '<button type="submit" class="btn btn-primary" form="return-invoice-form">Confirm return</button>'
    });
    m.panel.querySelector('#return-invoice-form').addEventListener('submit', async e => {
      e.preventDefault();
      const submit = m.panel.querySelector('[type="submit"][form="return-invoice-form"]');
      const inputs = Array.from(m.panel.querySelectorAll('[data-return-qty]'));
      const lines = inputs.map(inp => ({ invoiceItemId: Number(inp.dataset.returnQty), qty: Number(inp.value) })).filter(l => l.qty > 0);
      if (!lines.length) { UI.toast('Enter a return quantity for at least one item.', 'error'); return; }
      const values = UI.formValues(e.target);
      try {
        await UI.withLoading(submit, async () => {
          const ret = await store().returnInvoice(inv.id, {
            lines, reason: values.reason, restock: !!values.restock,
            method: values.method, cashierId: activeCashierId()
          });
          m.close();
          UI.toast('Return ' + ret.no + ' saved · ' + U.money(ret.refund) + ' refunded.');
          afterChange();
          if (typeof onDone === 'function') onDone(ret);
        });
      } catch (err) { UI.toast(err.userMessage || err.message || 'Could not complete return.', 'error'); }
    });
    return m;
  };

  /* =========================================================
     Service detail
     ========================================================= */
  C.serviceDetailModal = function (serviceId, options) {
    const opts = options || {};
    const d = store().serviceDetail(serviceId);
    if (!d) { UI.toast('Service job not found.', 'error'); return; }
    const svc = d.service;
    const partRows = d.parts.length
      ? d.parts.map(l => '<tr><td><div class="cell-stack"><span class="cell-main">' + U.esc(l.name) + '</span><span class="cell-sub">' + U.fmtQty(l.qty) + ' × ' + U.money(l.price) + '</span></div></td><td class="right num">' + U.money(l.total) + '</td></tr>').join('')
      : '<tr><td colspan="2"><div class="empty-inline">No parts used on this job.</div></td></tr>';
    const payments = d.payments.length
      ? '<div class="statement-section"><h4>Payments received later</h4><div class="mini-ledger">' + d.payments.map(p =>
        '<div class="mini-ledger-row"><div class="mini-ledger-main"><div class="mini-ledger-title">' + U.esc(UI.methodLabel(p.method)) + ' payment</div><div class="mini-ledger-sub">' + U.fmtDate(p.date, { mode: 'short' }) + '</div></div><div class="mini-ledger-amt credit">+ ' + U.money((p.allocations || []).filter(a => a.type === 'service' && Number(a.id) === Number(svc.id)).reduce((s, a) => s + Number(a.amount), 0)) + '</div></div>').join('') + '</div></div>' : '';
    const returns = d.returns.length
      ? '<div class="statement-section"><h4>Returns</h4><div class="mini-ledger">' + d.returns.map(r =>
        '<div class="mini-ledger-row"><div class="mini-ledger-main"><div class="mini-ledger-title">' + U.esc(r.no) + ' · ' + U.esc(r.reason || 'Service return') + '</div><div class="mini-ledger-sub">' + U.fmtDate(r.date, { mode: 'short' }) + ' · refunded ' + U.money(r.refund) + '</div></div><div class="mini-ledger-amt">− ' + U.money(r.amount) + '</div></div>').join('') + '</div></div>' : '';
    const head =
      '<div class="modal-head"><div><div class="modal-title" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' + U.esc(svc.no) + UI.statusBadge(d.status) + '</div>' +
      '<div class="modal-sub">' + U.fmtDate(svc.date) + ' at ' + U.fmtTime(svc.createdAt) + ' · ' + (d.cashier ? U.esc(d.cashier.name) : 'No cashier') + '</div></div>' +
      '<button type="button" class="modal-close" data-modal-close aria-label="Close">' + UI.icon('x', 16) + '</button></div>';
    const m = UI.modal({
      size: 'lg',
      headHTML: head,
      body:
        '<div class="detail-grid">' +
        '<div class="detail-block"><h4>Service details</h4><p><b>' + U.esc(svc.technician) + '</b><br>' + U.esc(svc.machineType || 'Machine not specified') + (svc.regNo ? ' · ' + U.esc(svc.regNo) : '') + '</p></div>' +
        '<div class="detail-block"><h4>Customer</h4><p><b>' + U.esc(svc.customerName || 'Walk-in customer') + '</b>' + (svc.phone ? '<br>' + U.esc(svc.phone) : '') + '</p></div>' +
        '</div>' +
        '<div class="detail-block mt-12"><h4>Work done</h4><p class="work-note">' + U.esc(svc.work) + '</p></div>' +
        '<div class="table-wrap mt-16"><table class="table compact"><thead><tr><th>Part used</th><th class="right">Amount</th></tr></thead><tbody>' + partRows + '</tbody></table></div>' +
        '<div class="detail-totals">' +
        '<div class="detail-total-row"><span>Parts</span><span>' + U.money(svc.partsTotal) + '</span></div>' +
        '<div class="detail-total-row"><span>Labour</span><span>' + U.money(svc.labor) + '</span></div>' +
        (Number(svc.discount) > 0 ? '<div class="detail-total-row"><span>Discount</span><span>− ' + U.money(svc.discount) + '</span></div>' : '') +
        '<div class="detail-total-row total"><span>Service total</span><b>' + U.money(svc.total) + '</b></div>' +
        '<div class="detail-total-row"><span>Paid ' + (svc.method ? '(' + UI.methodLabel(svc.method) + ')' : '') + '</span><span>' + U.money(svc.paid) + '</span></div>' +
        '<div class="detail-total-row"><span>Balance due</span><span class="' + (Number(svc.balance) > 0 ? 'text-danger' : 'text-success') + '"><b>' + U.money(svc.balance) + '</b></span></div>' +
        (Number(svc.returned) > 0 ? '<div class="detail-total-row"><span>Returned</span><span>− ' + U.money(svc.returned) + '</span></div>' : '') +
        '</div>' + (svc.note ? '<div class="hint mt-8">Note: ' + U.esc(svc.note) + '</div>' : '') + payments + returns,
      footer: '<button type="button" class="btn" data-modal-close>Done</button>' +
        (Number(svc.total) - Number(svc.returned) > 0.009 ? '<button type="button" class="btn" data-return>' + UI.icon('archive', 14) + 'Return / refund</button>' : '') +
        (Number(svc.balance) > 0 && svc.customerId ? '<button type="button" class="btn" data-collect>' + UI.icon('banknote', 14) + 'Receive payment</button>' : '') +
        '<button type="button" class="btn btn-primary" data-print>' + UI.icon('printer', 14) + 'Print bill</button>'
    });
    m.panel.querySelector('[data-print]').addEventListener('click', () => UI.printHtml(UI.receiptFor('service', d)));
    const collectBtn = m.panel.querySelector('[data-collect]');
    if (collectBtn) collectBtn.addEventListener('click', () => C.collectModal({
      customerId: svc.customerId, suggestedAmount: Number(svc.balance),
      targetType: 'service', targetId: svc.id, targetLabel: svc.no,
      onDone: () => { m.close(); if (typeof opts.onChanged === 'function') opts.onChanged(); }
    }));
    const returnBtn = m.panel.querySelector('[data-return]');
    if (returnBtn) returnBtn.addEventListener('click', () => C.returnServiceModal(svc.id, () => {
      m.close(); if (typeof opts.onChanged === 'function') opts.onChanged();
    }));
    return m;
  };

  C.returnServiceModal = function (serviceId, onDone) {
    const d = store().serviceDetail(serviceId);
    if (!d) { UI.toast('Service job not found.', 'error'); return; }
    const svc = d.service;
    const max = U.round2(Number(svc.total) - Number(svc.returned || 0));
    if (max <= 0) { UI.toast('This service bill is already fully returned.', 'info'); return; }
    const m = UI.modal({
      title: 'Service return / refund',
      subtitle: svc.no + ' · ' + U.money(max) + ' maximum returnable',
      size: 'md',
      body:
        '<form id="return-service-form"><div class="form-grid">' +
        '<div class="field"><label class="label" for="rs-amount">Return amount</label>' +
        '<div class="input-group"><span class="prefix">' + U.esc(U.symbol()) + '</span><input class="input" id="rs-amount" name="amount" type="number" min="0.01" max="' + max + '" step="0.01" required value="' + max.toFixed(2) + '"></div>' +
        '<div class="hint">Outstanding balance is adjusted first. Any excess is refunded. Used parts are not restocked automatically.</div></div>' +
        '<div class="field"><label class="label" for="rs-method">Refund method</label><select class="select" id="rs-method" name="method">' +
        UI.option('cash', 'Cash', 'cash') + UI.option('card', 'Card', '') + UI.option('online', 'Online transfer', '') + UI.option('credit', 'Credit note → customer advance', '') + '</select></div>' +
        '<div class="field full"><label class="label" for="rs-reason">Reason</label><input class="input" id="rs-reason" name="reason" placeholder="e.g. service complaint adjustment" autocomplete="off"></div>' +
        '</div></form>' +
        '<div class="pay-note mt-12">Outstanding on this service job: <b>' + U.money(svc.balance) + '</b></div>',
      footer: '<button type="button" class="btn" data-modal-close>Cancel</button>' +
        '<button type="submit" class="btn btn-primary" form="return-service-form">Confirm return</button>'
    });
    m.panel.querySelector('#return-service-form').addEventListener('submit', async e => {
      e.preventDefault();
      const submit = m.panel.querySelector('[type="submit"][form="return-service-form"]');
      const values = UI.formValues(e.target);
      try {
        await UI.withLoading(submit, async () => {
          const ret = await store().returnService(svc.id, {
            amount: values.amount, method: values.method, reason: values.reason, cashierId: activeCashierId()
          });
          m.close();
          UI.toast('Return ' + ret.no + ' saved · ' + U.money(ret.refund) + ' refunded.');
          afterChange();
          if (typeof onDone === 'function') onDone(ret);
        });
      } catch (err) { UI.toast(err.userMessage || err.message || 'Could not complete return.', 'error'); }
    });
    return m;
  };

  /* =========================================================
     Items
     ========================================================= */
  C.itemModal = function (options) {
    const opts = options || {};
    const category = opts.category === 'machine' ? 'machine' : 'part';
    const item = opts.item || null;
    const editing = !!item;
    const groups = store().constants.PART_GROUPS;
    const groupField = category === 'part'
      ? '<div class="field"><label class="label" for="it-group">Part group</label><select class="select" id="it-group" name="group">' +
        groups.map(g => UI.option(g, g, item ? item.group : 'Engine')).join('') + '</select></div>'
      : '<input type="hidden" name="group" value="Machines">';
    const compatibleField = category === 'part'
      ? '<div class="field"><label class="label" for="it-compatible">Fits / compatible models <span class="opt">(optional)</span></label>' +
        '<input class="input" id="it-compatible" name="compatible" placeholder="e.g. Mahindra 575, Ford 3600" value="' + U.attr(item ? item.compatible : '') + '"></div>'
      : '<div class="field"><label class="label" for="it-compatible">Description <span class="opt">(optional)</span></label>' +
        '<input class="input" id="it-compatible" name="compatible" placeholder="e.g. 45 HP · 2WD · new" value="' + U.attr(item ? item.compatible : '') + '"></div>';
    const originField = '<div class="field"><label class="label" for="it-origin">' + (category === 'machine' ? 'Source' : 'Origin') + '</label><select class="select" id="it-origin" name="origin">' +
      UI.option('Import', 'Import', item ? item.origin : (category === 'machine' ? 'Import' : '')) +
      UI.option('Local', 'Local', item ? item.origin : (category === 'machine' ? '' : 'Local')) + '</select></div>';
    const qtyField = editing ? '' :
      '<div class="field"><label class="label" for="it-qty">Opening stock qty</label><input class="input" id="it-qty" name="qty" type="number" min="0" step="1" value="0"></div>';
    const m = UI.modal({
      title: editing ? 'Edit ' + (category === 'machine' ? 'machine' : 'part') : (category === 'machine' ? 'Add machine' : 'Add spare part'),
      subtitle: editing ? 'Prices and details can be changed at any time.' : (category === 'machine' ? 'Stock a tractor or machine for sale.' : 'Add a part to your stock catalogue.'),
      size: 'md',
      body:
        '<form id="item-form"><div class="form-grid">' +
        '<div class="field full"><label class="label" for="it-name">' + (category === 'machine' ? 'Machine model / name' : 'Part name') + '</label>' +
        '<input class="input" id="it-name" name="name" required autocomplete="off" placeholder="' + (category === 'machine' ? 'e.g. Mahindra 575 DI' : 'e.g. Hydraulic pump assembly') + '" value="' + U.attr(item ? item.name : '') + '"></div>' +
        '<div class="field"><label class="label" for="it-sku">SKU / code <span class="opt">(auto if blank)</span></label><input class="input" id="it-sku" name="sku" autocomplete="off" placeholder="' + (item && item.sku ? U.esc(item.sku) : 'Auto-generated') + '" value="' + U.attr(item ? item.sku : '') + '"></div>' +
        '<div class="field"><label class="label" for="it-brand">Brand</label><input class="input" id="it-brand" name="brand" autocomplete="off" placeholder="e.g. Mahindra / Bosch" value="' + U.attr(item ? item.brand : '') + '"></div>' +
        groupField + compatibleField + originField +
        '<div class="field"><label class="label" for="it-reorder">Low stock alert at</label><input class="input" id="it-reorder" name="reorder" type="number" min="0" step="1" value="' + (item ? item.reorder : (category === 'machine' ? 1 : store().data.settings.lowStockDefault)) + '"></div>' +
        (category === 'part' ? '' : '<div class="field"></div>') +
        qtyField +
        '<div class="field full"><div class="divider" style="margin:4px 0"></div></div>' +
        '<div class="field"><label class="label" for="it-cost">Cost price</label><div class="input-group"><span class="prefix">' + U.esc(U.symbol()) + '</span><input class="input" id="it-cost" name="cost" type="number" min="0" step="0.01" value="' + (item ? item.cost : '') + '" placeholder="0.00"></div></div>' +
        '<div class="field"><label class="label" for="it-retail">Selling price (retail)</label><div class="input-group"><span class="prefix">' + U.esc(U.symbol()) + '</span><input class="input" id="it-retail" name="retail" type="number" min="0" step="0.01" required value="' + (item ? item.retail : '') + '" placeholder="0.00"></div></div>' +
        '<div class="field"><label class="label" for="it-wholesale">Wholesale price</label><div class="input-group"><span class="prefix">' + U.esc(U.symbol()) + '</span><input class="input" id="it-wholesale" name="wholesale" type="number" min="0" step="0.01" value="' + (item ? item.wholesale : '') + '" placeholder="Same as retail"></div></div>' +
        (category === 'part' && editing ? '<div class="field"><label class="label" for="it-qty-edit">Current stock</label><input class="input" id="it-qty-edit" value="' + U.fmtQty(item.qty) + '" disabled></div>' : '<div class="field"></div>') +
        '</div></form>' +
        (editing ? '<div class="hint mt-12">To change stock quantity, use <b>Receive stock</b> or <b>Adjust stock</b> from the inventory list so the movement is recorded.</div>' : ''),
      footer: '<button type="button" class="btn" data-modal-close>Cancel</button>' +
        '<button type="submit" class="btn btn-primary" form="item-form">' + UI.icon('check', 15) + (editing ? 'Save changes' : 'Add to inventory') + '</button>'
    });
    const form = m.panel.querySelector('#item-form');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const submit = m.panel.querySelector('[type="submit"][form="item-form"]');
      const values = UI.formValues(form);
      values.category = category;
      try {
        await UI.withLoading(submit, async () => {
          const saved = editing ? await store().updateItem(item.id, values) : await store().addItem(values);
          m.close();
          UI.toast((editing ? 'Saved ' : 'Added ') + saved.name + '.');
          afterChange();
          if (typeof opts.onSaved === 'function') opts.onSaved(saved);
        });
      } catch (err) { UI.toast(err.userMessage || err.message || 'Could not save item.', 'error'); }
    });
    return m;
  };

  C.receiveStockModal = function (itemId, onDone) {
    const item = store().itemById(itemId);
    if (!item) { UI.toast('Item not found.', 'error'); return; }
    const m = UI.modal({
      title: 'Receive stock',
      subtitle: item.name + ' · currently ' + U.fmtQty(item.qty) + ' in stock',
      size: 'md',
      body:
        '<form id="stock-form"><div class="form-grid">' +
        '<div class="field"><label class="label" for="st-qty">Quantity received</label><input class="input" id="st-qty" name="qty" type="number" min="0.01" step="0.01" required autofocus></div>' +
        '<div class="field"><label class="label" for="st-cost">Unit cost</label><div class="input-group"><span class="prefix">' + U.esc(U.symbol()) + '</span><input class="input" id="st-cost" name="unitCost" type="number" min="0" step="0.01" value="' + Number(item.cost).toFixed(2) + '"></div></div>' +
        '<div class="field full"><label class="label" for="st-supplier">Supplier <span class="opt">(optional)</span></label><input class="input" id="st-supplier" name="supplier" placeholder="e.g. Perera Auto Traders" autocomplete="off"></div>' +
        '<div class="field full"><label class="label" for="st-note">Note <span class="opt">(optional)</span></label><input class="input" id="st-note" name="note" placeholder="Invoice / delivery reference" autocomplete="off"></div>' +
        '</div></form>' +
        '<div class="pay-note mt-12">Cost price will be updated to the weighted average of existing and new stock.</div>',
      footer: '<button type="button" class="btn" data-modal-close>Cancel</button>' +
        '<button type="submit" class="btn btn-primary" form="stock-form">' + UI.icon('download', 15) + 'Receive stock</button>'
    });
    m.panel.querySelector('#stock-form').addEventListener('submit', async e => {
      e.preventDefault();
      const submit = m.panel.querySelector('[type="submit"][form="stock-form"]');
      const values = UI.formValues(e.target);
      try {
        await UI.withLoading(submit, async () => {
          await store().receiveStock(item.id, { qty: values.qty, unitCost: values.unitCost, supplier: values.supplier, note: values.note, cashierId: activeCashierId() });
          m.close();
          UI.toast('Stock received for ' + item.name + '.');
          afterChange();
          if (typeof onDone === 'function') onDone();
        });
      } catch (err) { UI.toast(err.userMessage || err.message || 'Could not receive stock.', 'error'); }
    });
    return m;
  };

  C.adjustStockModal = function (itemId, onDone) {
    const item = store().itemById(itemId);
    if (!item) { UI.toast('Item not found.', 'error'); return; }
    const m = UI.modal({
      title: 'Adjust stock',
      subtitle: item.name + ' · system stock ' + U.fmtQty(item.qty),
      size: 'md',
      body:
        '<form id="adjust-form"><div class="form-grid">' +
        '<div class="field"><label class="label" for="adj-qty">New stock quantity</label><input class="input" id="adj-qty" name="qty" type="number" min="0" step="0.01" required value="' + item.qty + '" autofocus></div>' +
        '<div class="field"><label class="label" for="adj-reason">Reason</label><input class="input" id="adj-reason" name="reason" placeholder="e.g. stock count / damaged" autocomplete="off"></div>' +
        '</div></form>' +
        '<div class="pay-note mt-12">Use this only for corrections. Stock movements are recorded in the audit log.</div>',
      footer: '<button type="button" class="btn" data-modal-close>Cancel</button>' +
        '<button type="submit" class="btn btn-primary" form="adjust-form">Save stock count</button>'
    });
    m.panel.querySelector('#adjust-form').addEventListener('submit', async e => {
      e.preventDefault();
      const submit = m.panel.querySelector('[type="submit"][form="adjust-form"]');
      const values = UI.formValues(e.target);
      try {
        await UI.withLoading(submit, async () => {
          await store().setStock(item.id, values.qty, values.reason);
          m.close();
          UI.toast('Stock adjusted for ' + item.name + '.');
          afterChange();
          if (typeof onDone === 'function') onDone();
        });
      } catch (err) { UI.toast(err.userMessage || err.message || 'Could not adjust stock.', 'error'); }
    });
    return m;
  };

  C.confirmArchiveItem = async function (item) {
    const ok = await UI.confirmDialog({
      title: 'Remove ' + item.name + '?',
      text: 'This hides the item from the catalogue and billing screens. Past sales and stock history stay intact. You cannot undo this from the app.',
      confirmText: 'Remove item',
      danger: true
    });
    if (!ok) return false;
    try {
      await store().archiveItem(item.id);
      UI.toast(item.name + ' removed from the active catalogue.');
      afterChange();
      return true;
    } catch (err) {
      UI.toast(err.userMessage || err.message || 'Could not remove item.', 'error');
      return false;
    }
  };

  /* =========================================================
     Quick actions used from multiple views
     ========================================================= */
  C.quickSale = function () { window.location.hash = '#/billing/new'; };
  C.quickService = function () { window.location.hash = '#/service/new'; };

  WP.components = C;
})();
