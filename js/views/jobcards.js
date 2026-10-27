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

  const listState = { q: '', status: 'all' };
  const FORM_DEFAULTS = {
    customerId: '', customerName: '', phone: '', address: '',
    machineType: '', regNo: '', technician: '', work: '',
    receivedDate: U.todayISO(), advance: '', advanceMethod: 'cash',
    chequeNo: '', chequeDate: U.todayISO(), note: ''
  };
  const form = Object.assign({}, FORM_DEFAULTS);

  function resetForm() {
    Object.assign(form, FORM_DEFAULTS, { receivedDate: U.todayISO(), chequeDate: U.todayISO(), advanceMethod: 'cash' });
  }

  function chosenCustomer() {
    return form.customerId ? S().customerById(Number(form.customerId)) : null;
  }

  async function closeJobForBilling(job) {
    await S().setJobCardStatus(job.id, 'closed');
    if (V.services && V.services.startFromJob) V.services.startFromJob(job);
    UI.toast(job.no + ' closed — now raising the bill for it.');
    APP().navigate('#/service/new');
  }

  function technicianList() {
    const names = S().data.services.map(s => (s.technician || '').trim()).filter(Boolean);
    return U.unique(names).sort();
  }

  function machineTypeList() {
    const types = S().data.services.map(s => (s.machineType || '').trim()).filter(Boolean);
    return U.unique(types).sort();
  }

  function filteredJobs() {
    const q = listState.q.trim().toLowerCase();
    return U.sortBy(S().data.jobCards.filter(job => {
      if (listState.status === 'open' && job.status !== 'open') return false;
      if (listState.status === 'closed' && job.status !== 'closed') return false;
      if (!q) return true;
      const hay = (job.no + ' ' + job.customerName + ' ' + job.phone + ' ' + job.address + ' ' +
        job.machineType + ' ' + job.regNo + ' ' + job.technician + ' ' + job.work + ' ' + job.note).toLowerCase();
      return hay.includes(q);
    }), job => job.createdAt || job.date, 'desc');
  }

  function statsHTML(rows) {
    const open = rows.filter(j => j.status === 'open');
    const advances = U.sumBy(open, j => Number(j.advance) || 0);
    const cheques = rows.filter(j => j.advanceMethod === 'cheque' && j.status === 'open');
    return '<div class="stat-grid mb-16">' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Open job cards</span><span class="stat-icon green">' + UI.icon('fileText', 16) + '</span></div>' +
      '<div class="stat-value">' + open.length + '</div><div class="stat-meta">Machines in the workshop now</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Advances held</span><span class="stat-icon gold">' + UI.icon('coins', 16) + '</span></div>' +
      '<div class="stat-value sm"><span class="currency">' + U.esc(U.symbol()) + '</span>' + U.fmtNumber(advances) + '</div><div class="stat-meta">On open job cards</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Awaiting cheques</span><span class="stat-icon blue">' + UI.icon('fileText', 16) + '</span></div>' +
      '<div class="stat-value">' + cheques.length + '</div><div class="stat-meta">Cheque advances on open jobs</div></div>' +
      '<div class="stat-card"><div class="stat-top"><span class="stat-label">Closed</span><span class="stat-icon grey">' + UI.icon('check', 16) + '</span></div>' +
      '<div class="stat-value">' + rows.filter(j => j.status === 'closed').length + '</div><div class="stat-meta">All-time completed cards</div></div>' +
      '</div>';
  }

  function customerCell(job) {
    return '<div class="customer-cell"><span class="avatar" style="width:26px;height:26px;font-size:9px">' + U.esc(U.initials(job.customerName)) + '</span>' +
      '<div><div class="customer-name">' + U.esc(job.customerName) + '</div>' +
      '<div class="customer-sub">' + U.esc(job.phone || (job.address ? job.address : 'No phone')) + '</div></div></div>';
  }

  function tableHTML(rows) {
    if (!rows.length) {
      return '<div class="card-body">' + UI.emptyState({
        icon: 'fileText',
        title: S().data.jobCards.length ? 'No job cards match these filters' : 'No job cards yet',
        text: S().data.jobCards.length ? 'Try clearing the search or status filter.' : 'When a customer leaves a machine or part for repair, open a job card with the advance and print it for them.',
        action: '<a class="btn btn-primary" href="#/jobcards/new">' + UI.icon('plus', 14) + 'New job card</a>'
      }) + '</div>';
    }
    const body = rows.slice(0, 200).map(job => {
      const statusBadge = job.status === 'closed'
        ? '<span class="badge grey">Closed' + (job.closedAt ? ' · ' + U.esc(U.fmtDate(job.closedAt, { mode: 'short' })) : '') + '</span>'
        : '<span class="badge green">Open</span>';
      return '<tr class="row-click" data-job-row="' + job.id + '">' +
        '<td><div class="cell-stack"><span class="cell-main">' + U.esc(job.no) + '</span><span class="cell-sub">Opened ' + U.fmtDate(job.date, { mode: 'short' }) + ' ' + U.fmtTime(job.createdAt) + '</span></div></td>' +
        '<td><div class="cell-stack"><span class="cell-main">' + U.esc(U.fmtDate(job.receivedDate)) + '</span><span class="cell-sub">Goods received</span></div></td>' +
        '<td>' + customerCell(job) + '</td>' +
        '<td><div class="cell-stack" style="max-width:230px"><span class="cell-main" style="font-weight:500">' + U.esc(job.machineType || (job.work || 'Repair job')) + '</span><span class="cell-sub">' + U.esc([job.regNo, job.technician].filter(Boolean).join(' · ') || 'No machine noted') + '</span></div></td>' +
        '<td class="right num">' + (Number(job.advance) > 0 ? U.money(job.advance) + '<div class="cell-sub">' + U.esc(UI.methodLabel(job.advanceMethod)) + '</div>' : '<span class="muted">—</span>') + '</td>' +
        '<td>' + statusBadge + '</td>' +
        '<td><div class="row-actions">' +
        '<button type="button" class="icon-btn" data-job-print="' + job.id + '" title="Print job card">' + UI.icon('printer', 15) + '</button>' +
        (job.status === 'open'
          ? '<button type="button" class="icon-btn" data-job-close="' + job.id + '" title="Close job and go to billing">' + UI.icon('check', 15) + '</button>'
          : '<button type="button" class="icon-btn" data-job-open="' + job.id + '" title="Re-open job">' + UI.icon('refresh', 15) + '</button>') +
        (adminMode() ? '<button type="button" class="icon-btn danger" data-job-delete="' + job.id + '" title="Delete job card">' + UI.icon('trash', 15) + '</button>' : '') +
        '</div></td></tr>';
    }).join('');
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Job card</th><th>Received</th><th>Customer</th><th>Machine / work</th><th class="right">Advance</th><th>Status</th><th></th></tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<div class="card-foot flex-between"><span class="hint">Showing ' + Math.min(rows.length, 200) + ' of ' + rows.length + ' job card' + (rows.length === 1 ? '' : 's') + '</span>' +
      '<button class="link-btn" data-export-jobs>' + UI.icon('download', 13) + 'Export CSV</button></div>';
  }

  function exportJobs(rows) {
    if (!rows.length) { UI.toast('No job cards to export.', 'info'); return; }
    const data = [['Job no', 'Opened', 'Goods received', 'Customer', 'Phone', 'Address', 'Machine', 'Reg no', 'Technician', 'Work', 'Advance', 'Advance method', 'Cheque no', 'Cheque date', 'Status', 'Note']]
      .concat(rows.map(j => [j.no, j.date, j.receivedDate, j.customerName, j.phone, j.address, j.machineType, j.regNo, j.technician, j.work, j.advance, j.advanceMethod, j.chequeNo, j.chequeDate, j.status, j.note]));
    U.downloadFile('wijaya-job-cards.csv', U.toCSV(data), 'text/csv;charset=utf-8');
    UI.toast('Job cards exported.');
  }

  function listScreen() {
    const rows = filteredJobs();
    return UI.pageHead({
      eyebrow: 'Workshop · Job cards',
      title: 'Job cards',
      subtitle: 'A numbered card for every machine left for repair — with the advance, received date, customer contact and a printable card.',
      actions: '<a class="btn btn-primary" href="#/jobcards/new">' + UI.icon('plus', 15) + 'New job card</a>'
    }) +
      '<div id="job-stats">' + statsHTML(S().data.jobCards) + '</div>' +
      '<div class="card inventory-card"><div class="inv-toolbar">' +
      '<div class="search-box" style="max-width:330px">' + UI.icon('search', 16) + '<input class="input" id="job-search" placeholder="Search job no, customer, phone, machine or work…" value="' + U.attr(listState.q) + '"></div>' +
      '<div class="segmented" data-job-status>' +
      '<button class="seg-btn ' + (listState.status === 'all' ? 'active' : '') + '" data-status="all">All</button>' +
      '<button class="seg-btn ' + (listState.status === 'open' ? 'active' : '') + '" data-status="open">Open</button>' +
      '<button class="seg-btn ' + (listState.status === 'closed' ? 'active' : '') + '" data-status="closed">Closed</button></div>' +
      '<span class="spacer"></span><span class="toolbar-label" id="job-count">' + rows.length + ' cards</span></div>' +
      '<div id="job-table">' + tableHTML(rows) + '</div></div>';
  }

  /* ---------------- new job card ---------------- */
  function customerFieldHTML() {
    return '<div class="field"><label class="label" for="job-customer">Customer <span class="opt">(saved — advance goes to their account)</span></label>' +
      '<div style="display:flex;gap:6px">' +
      '<select class="select" id="job-customer" style="flex:1">' +
      UI.option('', 'Walk-in customer', form.customerId) +
      U.sortBy(S().activeCustomers(), c => c.name.toLowerCase(), 'asc').map(c =>
        '<option value="' + c.id + '"' + (Number(form.customerId) === Number(c.id) ? ' selected' : '') + '>' + U.esc(c.name) + (c.phone ? ' · ' + U.esc(c.phone) : '') + '</option>').join('') +
      '</select>' +
      '<button type="button" class="btn" data-job-add-customer title="Add a new customer">' + UI.icon('userPlus', 15) + '</button>' +
      '</div></div>';
  }

  function walkinFieldsHTML() {
    return '<div class="form-grid' + (form.customerId ? ' hidden' : '') + '" data-job-walkin>' +
      '<div class="field"><label class="label" for="job-walkin-name">Customer name</label>' +
      '<input class="input" id="job-walkin-name" data-job-field="customerName" value="' + U.attr(form.customerName) + '" placeholder="Customer name" autocomplete="off"></div>' +
      '<div class="field"><label class="label" for="job-walkin-phone">Phone</label>' +
      '<input class="input" id="job-walkin-phone" data-job-field="phone" value="' + U.attr(form.phone) + '" placeholder="07X XXX XXXX" autocomplete="off"></div>' +
      '<div class="field full"><label class="label" for="job-walkin-address">Address</label>' +
      '<input class="input" id="job-walkin-address" data-job-field="address" value="' + U.attr(form.address) + '" placeholder="Customer address" autocomplete="off"></div>' +
      '</div>';
  }

  function payFieldsHTML() {
    const advance = U.toNum(form.advance, 0);
    if (!advance) return '<div class="pay-note">No advance collected. You can still record the job and collect the advance later.</div>';
    if (form.advanceMethod === 'cheque') {
      return '<div class="form-grid"><div class="field"><label class="label" for="job-cheque-no">Cheque number</label>' +
        '<input class="input" id="job-cheque-no" data-job-field="chequeNo" value="' + U.attr(form.chequeNo) + '" placeholder="e.g. 045812" autocomplete="off"></div>' +
        '<div class="field"><label class="label" for="job-cheque-date">Cheque date</label>' +
        '<input class="input" id="job-cheque-date" data-job-field="chequeDate" type="date" value="' + U.attr(form.chequeDate) + '"></div></div>';
    }
    return '<div class="pay-note"><b>' + U.money(advance) + '</b> collected by ' + U.esc(UI.methodLabel(form.advanceMethod)) + '.</div>';
  }

  function summaryHTML() {
    const advance = U.toNum(form.advance, 0);
    return '<div class="total-row"><span>Advance</span><b id="job-sum-advance">' + U.money(advance) + '</b></div>' +
      '<div class="total-row"><span>Method</span><b id="job-sum-method">' + (advance > 0 ? U.esc(UI.methodLabel(form.advanceMethod)) : '—') + '</b></div>' +
      '<div class="hint mt-8">' + UI.icon('printer', 12) + ' The job card prints on the 80mm receipt printer after saving.</div>';
  }

  function newScreen() {
    const techs = technicianList();
    const types = machineTypeList();
    return UI.pageHead({
      eyebrow: 'Workshop · New card',
      title: 'New job card',
      subtitle: 'Numbered card for a machine left for repair. The customer keeps the printout and brings it back when collecting.',
      actions: '<a class="btn" href="#/jobcards">' + UI.icon('arrowLeft', 15) + 'Job cards</a>'
    }) +
      '<div class="service-layout">' +
      '<div class="service-main">' +
      '<div class="card card-pad"><div class="card-title mb-12">' + UI.icon('users', 18) + 'Customer</div>' +
      '<div class="form-grid">' +
      '<div class="full">' + customerFieldHTML() + '</div>' +
      '<div class="full">' + walkinFieldsHTML() + '</div>' +
      '</div></div>' +
      '<div class="card card-pad"><div class="card-title mb-12">' + UI.icon('truck', 18) + 'Machine & work</div>' +
      '<div class="form-grid">' +
      '<div class="field"><label class="label" for="job-machine">Machine / item <span class="opt">(optional)</span></label>' +
      '<input class="input" id="job-machine" data-job-field="machineType" value="' + U.attr(form.machineType) + '" placeholder="e.g. Mahindra 575 DI" autocomplete="off" list="job-machine-types">' +
      '<datalist id="job-machine-types">' + types.map(t => '<option value="' + U.attr(t) + '"></option>').join('') + '</datalist></div>' +
      '<div class="field"><label class="label" for="job-regno">Registration / serial <span class="opt">(optional)</span></label>' +
      '<input class="input" id="job-regno" data-job-field="regNo" value="' + U.attr(form.regNo) + '" placeholder="e.g. NP-1234" autocomplete="off"></div>' +
      '<div class="field full"><label class="label" for="job-technician">Technician <span class="opt">(optional)</span></label>' +
      (techs.length ? '<div class="tech-chips mb-8">' + techs.slice(0, 8).map(name =>
        '<button type="button" class="tech-chip' + (form.technician === name ? ' active' : '') + '" data-job-tech="' + U.attr(name) + '">' + U.esc(name) + '</button>').join('') + '</div>' : '') +
      '<input class="input" id="job-technician" data-job-field="technician" value="' + U.attr(form.technician) + '" placeholder="Type technician name" autocomplete="off"></div>' +
      '<div class="field full"><label class="label" for="job-work">Work requested <span class="opt">(printed on the card)</span></label>' +
      '<textarea class="textarea" id="job-work" data-job-field="work" rows="3" placeholder="What the customer asked for — e.g. repair hydraulic lift, replace clutch plates.">' + U.esc(form.work) + '</textarea></div>' +
      '<div class="field"><label class="label" for="job-received">Goods received on</label>' +
      '<input class="input" id="job-received" data-job-field="receivedDate" type="date" value="' + U.attr(form.receivedDate) + '"></div>' +
      '<div class="field"><label class="label" for="job-note">Note <span class="opt">(optional)</span></label>' +
      '<input class="input" id="job-note" data-job-field="note" value="' + U.attr(form.note) + '" placeholder="e.g. customer will call before collecting" autocomplete="off"></div>' +
      '</div></div>' +
      '</div>' +
      '<aside class="card service-side">' +
      '<div class="cart-head"><div><div class="cart-title">Job card</div><div class="cart-sub" id="job-customer-label">' + U.esc(chosenCustomer() ? chosenCustomer().name : (form.customerName || 'Walk-in customer')) + '</div></div>' +
      '<span class="wholesale-flag">JOB</span></div>' +
      '<div class="service-bill-scroll"><div class="card-pad" style="padding-top:14px">' +
      '<div class="field"><label class="label" for="job-advance">Advance collected</label>' +
      '<div class="input-group"><span class="prefix">' + U.esc(U.symbol()) + '</span><input class="input" id="job-advance" data-job-field="advance" type="number" min="0" step="0.01" placeholder="0.00" value="' + U.attr(form.advance) + '"></div></div>' +
      '<div class="pay-label"><span class="label">Advance method</span></div>' +
      '<div class="pay-methods">' +
      '<button type="button" class="pay-btn' + (form.advanceMethod === 'cash' ? ' active' : '') + '" data-job-method="cash">' + UI.icon('banknote', 13) + 'Cash</button>' +
      '<button type="button" class="pay-btn' + (form.advanceMethod === 'card' ? ' active' : '') + '" data-job-method="card">' + UI.icon('card', 13) + 'Card</button>' +
      '<button type="button" class="pay-btn' + (form.advanceMethod === 'online' ? ' active' : '') + '" data-job-method="online">' + UI.icon('globe', 13) + 'Online</button>' +
      '<button type="button" class="pay-btn' + (form.advanceMethod === 'cheque' ? ' active' : '') + '" data-job-method="cheque">' + UI.icon('fileText', 13) + 'Cheque</button>' +
      '</div>' +
      '<div class="pay-fields" id="job-payfields">' + payFieldsHTML() + '</div>' +
      '<div class="divider"></div>' +
      '<div class="totals" id="job-summary">' + summaryHTML() + '</div>' +
      '</div></div>' +
      '<div class="service-summary"><button type="button" class="btn btn-primary checkout-btn" data-job-submit>' + UI.icon('check', 16) + 'Save & print job card</button>' +
      '<div class="hint center mt-8">Saved cards appear under Job cards for closing and reprinting.</div></div>' +
      '</aside></div>';
  }

  function paintPayFields(scope) {
    const wrap = scope.querySelector('#job-payfields');
    if (wrap) wrap.innerHTML = payFieldsHTML();
    const sum = scope.querySelector('#job-summary');
    if (sum) sum.innerHTML = summaryHTML();
  }

  async function submitJob(scope) {
    const customer = chosenCustomer();
    const advance = U.toNum(form.advance, 0);
    if (advance > 0 && form.advanceMethod === 'cheque' && !form.chequeNo.trim()) {
      UI.toast('Enter the cheque number for the advance.', 'error'); return;
    }
    const submit = scope.querySelector('[data-job-submit]');
    try {
      await UI.withLoading(submit, async () => {
        const job = await S().addJobCard({
          customerId: customer ? customer.id : null,
          customerName: form.customerName,
          phone: form.phone,
          address: form.address,
          machineType: form.machineType,
          regNo: form.regNo,
          technician: form.technician,
          work: form.work,
          receivedDate: form.receivedDate || U.todayISO(),
          advance: form.advance,
          advanceMethod: form.advanceMethod,
          chequeNo: form.chequeNo,
          chequeDate: form.chequeDate,
          note: form.note,
          cashierId: WP.app.getActiveCashierId()
        });
        resetForm();
        UI.toast('Job card ' + job.no + ' saved.');
        APP().refresh();
        UI.printHtml(UI.jobCardHTML(job));
        APP().navigate('#/jobcards');
      });
    } catch (err) {
      UI.toast(err.userMessage || err.message || 'Could not save the job card.', 'error');
    }
  }

  function jobDetailModal(id) {
    const job = S().jobCardById(id);
    if (!job) { UI.toast('Job card not found.', 'error'); return; }
    const cashier = job.cashierId ? S().cashierById(job.cashierId) : null;
    const head =
      '<div class="modal-head"><div><div class="modal-title" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' + U.esc(job.no) +
      (job.status === 'closed' ? '<span class="badge grey">Closed</span>' : '<span class="badge green">Open</span>') + '</div>' +
      '<div class="modal-sub">Opened ' + U.esc(U.fmtDate(job.date)) + ' at ' + U.esc(U.fmtTime(job.createdAt)) + ' · ' + (cashier ? U.esc(cashier.name) : 'No cashier') + '</div></div>' +
      '<button type="button" class="modal-close" data-modal-close aria-label="Close">' + UI.icon('x', 16) + '</button></div>';
    const m = UI.modal({
      size: 'md',
      headHTML: head,
      body:
        '<div class="detail-grid">' +
        '<div class="detail-block"><h4>Customer</h4><p><b>' + U.esc(job.customerName) + '</b>' +
        (job.phone ? '<br>' + U.esc(job.phone) : '') + (job.address ? '<br>' + U.esc(job.address) : '') + '</p></div>' +
        '<div class="detail-block"><h4>Machine & technician</h4><p>' + U.esc(job.machineType || 'Machine not specified') +
        (job.regNo ? ' · ' + U.esc(job.regNo) : '') + (job.technician ? '<br>Technician: <b>' + U.esc(job.technician) + '</b>' : '') + '</p></div>' +
        '</div>' +
        '<div class="detail-block mt-12"><h4>Work requested</h4><p class="work-note">' + U.esc(job.work || 'No work description.') + '</p></div>' +
        '<div class="detail-totals mt-12">' +
        '<div class="detail-total-row"><span>Goods received on</span><span>' + U.esc(U.fmtDate(job.receivedDate)) + '</span></div>' +
        '<div class="detail-total-row"><span>Advance</span><b>' + U.money(job.advance) + '</b></div>' +
        (Number(job.advance) > 0 ? '<div class="detail-total-row"><span>Paid by</span><span>' + U.esc(UI.methodLabel(job.advanceMethod)) + '</span></div>' : '') +
        (job.chequeNo ? '<div class="detail-total-row"><span>Cheque</span><span>' + U.esc(job.chequeNo) + ' · ' + U.esc(U.fmtDate(job.chequeDate)) + '</span></div>' : '') +
        (job.status === 'closed' && job.closedAt ? '<div class="detail-total-row"><span>Closed on</span><span>' + U.esc(U.fmtDateTime(job.closedAt)) + '</span></div>' : '') +
        '</div>' +
        (job.note ? '<div class="hint mt-8">Note: ' + U.esc(job.note) + '</div>' : ''),
      footer: '<button type="button" class="btn" data-modal-close>Done</button>' +
        (job.status === 'open'
          ? '<button type="button" class="btn" data-job-close-modal>' + UI.icon('check', 14) + 'Close job & bill</button>'
          : '<button type="button" class="btn" data-job-open-modal>' + UI.icon('refresh', 14) + 'Re-open</button>') +
        '<button type="button" class="btn btn-primary" data-job-print-modal>' + UI.icon('printer', 14) + 'Print card</button>'
    });
    m.panel.querySelector('[data-job-print-modal]').addEventListener('click', () => UI.printHtml(UI.jobCardHTML(job)));
    const closeBtn = m.panel.querySelector('[data-job-close-modal]');
    if (closeBtn) closeBtn.addEventListener('click', async () => {
      try {
        m.close();
        await closeJobForBilling(job);
      } catch (err) { UI.toast(err.message || 'Could not close the job.', 'error'); }
    });
    const openBtn = m.panel.querySelector('[data-job-open-modal]');
    if (openBtn) openBtn.addEventListener('click', async () => {
      try {
        await S().setJobCardStatus(job.id, 'open');
        m.close();
        UI.toast(job.no + ' re-opened.');
        APP().dataChanged();
      } catch (err) { UI.toast(err.message || 'Could not re-open the job.', 'error'); }
    });
    return m;
  }

  V.jobcards = {
    render(route) {
      if (route && route.sub === 'new') return newScreen();
      return listScreen();
    },
    mount(content, route) {
      const scope = content.querySelector('#view-root') || content;

      if (route && route.sub === 'new') {
        scope.addEventListener('input', e => {
          const field = e.target.closest('[data-job-field]');
          if (!field) return;
          form[field.dataset.jobField] = field.value;
          if (field.dataset.jobField === 'advance') paintPayFields(scope);
        });
        scope.addEventListener('change', e => {
          if (e.target.id === 'job-customer') {
            form.customerId = e.target.value;
            const customer = chosenCustomer();
            if (customer) {
              form.customerName = customer.name;
              form.phone = customer.phone || '';
              form.address = customer.address || '';
              const name = scope.querySelector('#job-walkin-name');
              const phone = scope.querySelector('#job-walkin-phone');
              const address = scope.querySelector('#job-walkin-address');
              if (name) name.value = form.customerName;
              if (phone) phone.value = form.phone;
              if (address) address.value = form.address;
            }
            const walkin = scope.querySelector('[data-job-walkin]');
            if (walkin) walkin.classList.toggle('hidden', !!form.customerId);
            const label = scope.querySelector('#job-customer-label');
            if (label) label.textContent = customer ? customer.name : 'Walk-in customer';
          }
        });
        scope.addEventListener('click', e => {
          const method = e.target.closest('[data-job-method]');
          if (method) {
            form.advanceMethod = method.dataset.jobMethod;
            scope.querySelectorAll('[data-job-method]').forEach(btn => btn.classList.toggle('active', btn === method));
            paintPayFields(scope);
            return;
          }
          const techChip = e.target.closest('[data-job-tech]');
          if (techChip) {
            form.technician = techChip.dataset.jobTech;
            const input = scope.querySelector('#job-technician');
            if (input) input.value = form.technician;
            scope.querySelectorAll('[data-job-tech]').forEach(chip => chip.classList.toggle('active', chip === techChip));
            return;
          }
          if (e.target.closest('[data-job-add-customer]')) {
            C.addCustomerModal({
              onSaved(customer) {
                form.customerId = String(customer.id);
                form.customerName = customer.name;
                form.phone = customer.phone || '';
                form.address = customer.address || '';
                APP().renderRoute(true);
              }
            });
            return;
          }
          if (e.target.closest('[data-job-submit]')) submitJob(scope);
        });
        return;
      }

      const search = scope.querySelector('#job-search');
      function paint() {
        const rows = filteredJobs();
        const table = scope.querySelector('#job-table');
        const count = scope.querySelector('#job-count');
        if (table) table.innerHTML = tableHTML(rows);
        if (count) count.textContent = rows.length + ' cards';
      }
      if (search) search.addEventListener('input', U.debounce(() => { listState.q = search.value; paint(); }, 160));
      scope.addEventListener('click', async e => {
        const statusBtn = e.target.closest('[data-job-status] [data-status]');
        if (statusBtn) {
          listState.status = statusBtn.dataset.status;
          scope.querySelectorAll('[data-job-status] [data-status]').forEach(btn => btn.classList.toggle('active', btn === statusBtn));
          paint();
          return;
        }
        if (e.target.closest('[data-export-jobs]')) { exportJobs(filteredJobs()); return; }
        const printBtn = e.target.closest('[data-job-print]');
        if (printBtn) {
          const job = S().jobCardById(Number(printBtn.dataset.jobPrint));
          if (job) UI.printHtml(UI.jobCardHTML(job));
          return;
        }
        const closeBtn = e.target.closest('[data-job-close]');
        if (closeBtn) {
          const job = S().jobCardById(Number(closeBtn.dataset.jobClose));
          if (!job) return;
          const ok = await UI.confirmDialog({
            title: 'Close ' + job.no + '?',
            text: 'Mark this job as closed when the customer has collected the machine. You will then go straight to billing with the job details filled in.',
            confirmText: 'Close & bill', danger: false
          });
          if (!ok) return;
          try {
            await closeJobForBilling(job);
          } catch (err) { UI.toast(err.message || 'Could not close the job.', 'error'); }
          return;
        }
        const openBtn = e.target.closest('[data-job-open]');
        if (openBtn) {
          try {
            const job = await S().setJobCardStatus(Number(openBtn.dataset.jobOpen), 'open');
            UI.toast(job.no + ' re-opened.');
            APP().dataChanged();
          } catch (err) { UI.toast(err.message || 'Could not re-open the job.', 'error'); }
          return;
        }
        const deleteBtn = e.target.closest('[data-job-delete]');
        if (deleteBtn) {
          if (!adminMode()) return;
          const job = S().jobCardById(Number(deleteBtn.dataset.jobDelete));
          if (!job) return;
          const ok = await UI.confirmDialog({
            title: 'Delete ' + job.no + '?',
            text: 'The job card will be removed. The advance already added to a saved customer’s account is NOT reversed.',
            confirmText: 'Delete job card'
          });
          if (!ok) return;
          try {
            await S().deleteJobCard(job.id);
            UI.toast(job.no + ' deleted.');
            APP().dataChanged();
          } catch (err) { UI.toast(err.message || 'Could not delete the job card.', 'error'); }
          return;
        }
        const row = e.target.closest('[data-job-row]');
        if (row) jobDetailModal(Number(row.dataset.jobRow));
      });
    },
    refresh() {
      APP().renderRoute(true);
    }
  };
})();
