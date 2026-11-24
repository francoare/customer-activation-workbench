import {
  CAPACITY, DEMO_DAY, FIRST_VALUE, STORAGE_KEY, accountStatus, daysBetween, decision, dependencyTypes, initialState,
  interventionCount, loadState, openBlockers, recommendations, saveState, suggestedAction, timing, updateState,
} from './model.js';

const get = id => document.getElementById(id);
const accountDialog = get('account-dialog');
const dateFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const statuses = { unknown: 'Unknown', planned: 'Planned', 'in-progress': 'In progress', done: 'Completed' };
const dateLabel = date => dateFormat.format(new Date(date));
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const ownerLabel = owner => escape(owner || 'Unknown');
let state;
let selectedId;
let panel;
let returnFocus;

try {
  state = loadState(localStorage);
} catch {
  state = initialState();
  workspaceMessage('Saved data could not be loaded. The original demo is shown.', true);
}

function showNotice(element, message, isError = false) {
  element.textContent = message;
  if (message) element.classList.toggle('notice-error', isError);
  element.hidden = !message;
}

function workspaceMessage(message, isError) {
  showNotice(get('workspace-message'), message, isError);
}

function statusBadge(account) {
  const { label, tone } = accountStatus(account);
  return `<span class="pill ${tone}">${label}</span>`;
}

function avatar(account) {
  return `<span class="avatar avatar-${account.id}" aria-hidden="true">${escape(account.name[0])}</span>`;
}

function renderSummary() {
  const activated = state.accounts.filter(account => account.evidence).length;
  const overdue = state.accounts.filter(account => !account.evidence && account.target < DEMO_DAY).length;
  const used = interventionCount(state);
  get('portfolio-summary').innerHTML = `
    <article class="metric"><p>Verified first value</p><strong>${activated}<span> / ${state.accounts.length}</span></strong><span class="metric-caption">Accounts activated</span></article>
    <article class="metric"><p>Overdue and unverified</p><strong>${overdue}</strong><span class="metric-caption">Past the target date</span></article>
    <article class="metric"><p>Intervention slots</p><strong>${used}<span> / ${CAPACITY}</span></strong><span class="metric-caption">Committed this week</span></article>`;
}

function suggestedReason(account, score) {
  const { barrier } = score;
  const why = {
    internal: 'The team can act on an internal blocker.',
    validation: 'The team can arrange validation with the customer.',
    discovery: 'An owner or next step needs to be identified.',
    customer: 'Progress depends on a customer-owned decision.',
  };
  return `${timing(account)}. ${barrier ? why[barrier.type] : 'There is no open dependency to resolve.'}`;
}

function interventionCard(account, score, committed) {
  const action = committed ? account.action : suggestedAction(account);
  const label = committed ? (account.evidence ? 'First value verified' : 'Planned') : 'Suggested';
  return `<article class="intervention-card">
    <div class="card-top"><div class="account-name">${avatar(account)}<h3>${escape(account.name)}</h3></div><span class="pill ${committed ? 'green' : 'blue'}">${label}</span></div>
    <p class="card-reason">${escape(committed ? action.reason : suggestedReason(account, score))}</p>
    <p class="card-action">${escape(action.text || score.barrier?.detail || 'Review the next step with the account owner.')}</p>
    <div class="card-footer"><span>${escape(action.owner || score.barrier?.owner || account.owner || 'Owner unknown')}${committed ? ` · Follow up ${dateLabel(action.followUp)}` : ''}</span>
      <button class="button ${committed ? 'secondary' : 'primary'}" type="button" data-account="${account.id}" data-start="action" aria-label="${committed ? 'Edit' : 'Plan'} ${escape(account.name)} intervention">${committed ? 'Edit plan' : 'Plan intervention'}</button></div>
  </article>`;
}

function renderInterventions() {
  const committed = state.accounts.filter(account => account.action).map(account => interventionCard(account, decision(account), true));
  const suggested = recommendations(state).map(record => interventionCard(record.account, record, false));
  const empty = Array.from({ length: CAPACITY - committed.length - suggested.length }, () => '<article class="intervention-card empty-slot"><h3>Open slot</h3><p>There are no unverified accounts left to select.</p></article>');
  get('intervention-grid').innerHTML = [...committed, ...suggested, ...empty].join('');
}

function renderAccounts() {
  const search = get('account-search').value.trim().toLowerCase();
  const filter = get('status-filter').value;
  const accounts = state.accounts.filter(account => {
    if (!account.name.toLowerCase().includes(search)) return false;
    if (filter === 'unverified') return !account.evidence;
    if (filter === 'overdue') return !account.evidence && account.target < DEMO_DAY;
    return filter === 'all' || accountStatus(account).label === filter;
  });
  get('account-count').textContent = `${accounts.length} of ${state.accounts.length} accounts`;
  get('empty-state').hidden = accounts.length !== 0;
  get('account-rows').innerHTML = accounts.map(account => {
    const { barrier } = decision(account);
    const dependency = barrier ? dependencyTypes[barrier.type] : 'None open';
    const dateNote = account.evidence ? `Verified ${dateLabel(account.evidence.verifiedOn)}` : timing(account);
    return `<tr role="row">
      <th role="rowheader" scope="row"><span class="account-name">${avatar(account)}${escape(account.name)}</span></th>
      <td role="cell">${statusBadge(account)}</td>
      <td role="cell"><span class="mobile-label" aria-hidden="true">Target</span><time datetime="${escape(account.target)}">${dateLabel(account.target)}</time><span class="table-sub ${!account.evidence && account.target < DEMO_DAY ? 'overdue' : ''}">${dateNote}</span></td>
      <td role="cell"><span class="mobile-label" aria-hidden="true">Next dependency</span>${dependency}</td>
      <td role="cell"><span class="mobile-label" aria-hidden="true">Account owner</span>${ownerLabel(account.owner)}</td>
      <td role="cell"><button class="button view-button" type="button" data-account="${account.id}" aria-label="View ${escape(account.name)}">View</button></td>
    </tr>`;
  }).join('');
}

function renderPortfolio() {
  renderSummary();
  renderInterventions();
  renderAccounts();
}

function renderOverview(account) {
  const { urgency, unlock, score } = decision(account);
  const count = openBlockers(account).length;
  get('account-title').textContent = account.name;
  get('account-overview').innerHTML = `
    <div class="detail-status">${statusBadge(account)} <span>${count} open ${count === 1 ? 'dependency' : 'dependencies'}</span></div>
    <p class="detail-outcome"><strong>Expected outcome</strong>${FIRST_VALUE}</p>
    <dl class="detail-facts">
      <div><dt>Target</dt><dd>${dateLabel(account.target)} · ${timing(account)}</dd></div>
      <div><dt>Account owner</dt><dd>${ownerLabel(account.owner)}</dd></div>
      <div><dt>Activity so far</dt><dd>${escape(account.activity)}</dd></div>
      <div><dt>Current milestone</dt><dd>${account.milestone.label ? `${escape(account.milestone.label)} · ` : ''}${statuses[account.milestone.state]}</dd></div>
      ${account.evidence ? `<div><dt>Evidence</dt><dd>${escape(account.evidence.reference)}</dd></div>` : `<div><dt>Evidence</dt><dd>Awaiting a representative invoice approval</dd></div><div><dt>Decision rule</dt><dd>${score} points · ${urgency} urgency + ${unlock} ability to move</dd></div>`}
    </dl>`;
}

const formError = '<p class="form-error" role="alert"></p>';

function renderAction(account) {
  const { barrier } = decision(account);
  const action = account.action || { ...suggestedAction(account), reason: '' };
  if (account.evidence && !account.action) return '<h3>Intervention</h3><p>This account reached verified first value. No intervention is needed.</p>';
  const open = CAPACITY - interventionCount(state);
  const details = barrier ? `${escape(dependencyTypes[barrier.type])} · ${ownerLabel(barrier.owner)}. ${escape(barrier.detail)}` : 'There are no open dependencies.';
  return `<h3>${account.action ? 'Edit intervention' : 'Plan intervention'}</h3>
    <p>${escape(suggestedReason(account, decision(account)))} ${details}</p>
    ${!account.action && open === 0 ? '<p class="notice">Both slots are in use. Remove an existing intervention to select this account.</p>' : ''}
    <form data-operation="action" novalidate>
      <label>Next action<textarea name="text" rows="2" maxlength="300" required>${escape(action.text)}</textarea></label>
      <div class="form-grid">
        <label>Action owner<input name="owner" maxlength="100" value="${escape(action.owner)}" required></label>
        <label>Follow-up date<input name="followUp" type="date" min="${DEMO_DAY}" value="${escape(action.followUp)}" required></label>
      </div>
      <label>Why intervene now?<textarea name="reason" rows="2" maxlength="300" placeholder="Include what can move and who needs to act" required>${escape(action.reason)}</textarea></label>
      ${formError}
      <div class="form-buttons"><button class="button primary" type="submit">Save intervention</button>${account.action ? '<button class="button secondary" type="button" data-operation="remove-action">Remove intervention</button>' : ''}</div>
    </form>`;
}

function renderProgress(account) {
  const blockerList = account.blockers.map(blocker => `<li class="dependency-item">
    <div><strong>${dependencyTypes[blocker.type]}</strong> <span class="pill ${blocker.resolved ? 'green' : 'amber'}">${blocker.resolved ? 'Resolved' : 'Open'}</span></div>
    <p>${escape(blocker.detail)}</p>
    <div class="dependency-footer"><span>Owner · ${ownerLabel(blocker.owner)}</span>${blocker.resolved ? '' : `<button class="button secondary" type="button" data-operation="resolve-blocker" data-blocker="${escape(blocker.id)}" aria-label="Resolve ${escape(dependencyTypes[blocker.type].toLowerCase())}">Resolve</button>`}</div></li>`).join('');
  return `<h3>Milestone</h3>
    <form data-operation="milestone" novalidate>
      <div class="form-grid milestone-fields">
        <label>Milestone name<input name="label" maxlength="120" value="${escape(account.milestone.label)}"></label>
        <label>Milestone status<select name="state">${Object.entries(statuses).map(([key, label]) => `<option value="${key}" ${account.milestone.state === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      </div>${formError}<div class="form-buttons"><button class="button primary" type="submit">Save milestone</button></div>
    </form>
    <div class="panel-divider"></div><h3>Dependencies</h3>
    ${blockerList ? `<ul class="dependency-list">${blockerList}</ul>` : '<p>There are no recorded dependencies.</p>'}
    <form data-operation="blocker" novalidate>
      <div class="form-grid">
        <label>Dependency type<select name="type" required><option value="">Choose a type</option>${Object.entries(dependencyTypes).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}</select></label>
        <label>Dependency owner <span class="optional">(if known)</span><input name="owner" maxlength="100"></label>
      </div>
      <label>What’s blocking progress?<textarea name="detail" rows="2" maxlength="300" required></textarea></label>${formError}
      <div class="form-buttons"><button class="button primary" type="submit">Add dependency</button></div>
    </form>`;
}

function renderEvidence(account) {
  if (account.evidence) {
    const { reference, approvedOn, verifiedOn } = account.evidence;
    return `<h3>Verified first value</h3>
      <dl class="detail-facts evidence-facts"><div><dt>Simulated approval evidence</dt><dd>${escape(reference)}</dd></div>
      <div><dt>Approved</dt><dd>${dateLabel(approvedOn)}</dd></div><div><dt>Verified</dt><dd>${dateLabel(verifiedOn)}</dd></div>
      <div><dt>Time to verified first value</dt><dd>${daysBetween(account.kickoff, verifiedOn)} days from kickoff on ${dateLabel(account.kickoff)}</dd></div></dl>`;
  }
  return `<h3>Confirm first value</h3><p>Record a simulated approval from the customer’s finance lead. Open dependencies remain visible.</p>
    <form data-operation="activate" novalidate>
      <label>Approval evidence<textarea name="reference" rows="2" maxlength="300" placeholder="Invoice reference and approval record" required></textarea></label>
      <label>Approval date<input name="approvedOn" type="date" min="${account.kickoff}" max="${DEMO_DAY}" value="${DEMO_DAY}" required></label>
      <label class="checkbox-label"><input name="representative" type="checkbox" required> The finance lead approved a representative invoice through the agreed workflow.</label>
      ${formError}<div class="form-buttons"><button class="button primary" type="submit">Confirm first value</button></div>
    </form>`;
}

const panels = { action: renderAction, progress: renderProgress, evidence: renderEvidence };

function renderDetail() {
  const account = state.accounts.find(item => item.id === selectedId);
  renderOverview(account);
  for (const button of accountDialog.querySelectorAll('[data-panel]')) {
    button.setAttribute('aria-pressed', String(panel === button.dataset.panel));
  }
  get('account-panel').innerHTML = panels[panel](account);
}

function openAccount(button) {
  selectedId = button.dataset.account;
  returnFocus = { id: selectedId, start: button.dataset.start };
  const account = state.accounts.find(item => item.id === selectedId);
  panel = button.dataset.start || (account.evidence ? 'evidence' : 'progress');
  showNotice(get('account-flash'), '');
  renderDetail();
  accountDialog.showModal();
  get('account-title').focus();
}

accountDialog.addEventListener('close', () => {
  const buttons = [...document.querySelectorAll(`[data-account="${returnFocus.id}"]`)];
  const original = buttons.find(button => button.dataset.start === returnFocus.start);
  (original || buttons.at(-1) || get('accounts-title')).focus();
});

function commit(nextState) {
  try {
    saveState(localStorage, nextState);
  } catch {
    return false;
  }
  state = nextState;
  renderPortfolio();
  return true;
}

const feedback = {
  action: 'Intervention saved.', 'remove-action': 'Intervention removed. The slot is available.',
  milestone: 'Milestone saved.', blocker: 'Dependency added.', 'resolve-blocker': 'Dependency resolved.',
  activate: 'First value verified. The evidence was saved.',
};

function changeAccount(operation, data, form) {
  const flash = get('account-flash');
  showNotice(flash, '');
  if (form) {
    form.querySelector('.form-error').textContent = '';
    form.querySelector('[aria-invalid]')?.removeAttribute('aria-invalid');
  }
  const { state: nextState, error } = updateState(state, selectedId, operation, data);
  if (error) {
    if (form) {
      form.querySelector('.form-error').textContent = error.message;
      const field = error.field ? form.elements.namedItem(error.field) : null;
      if (field) {
        field.setAttribute('aria-invalid', 'true');
        field.focus();
      }
    } else {
      showNotice(flash, error.message, true);
    }
    return;
  }
  if (!commit(nextState)) {
    showNotice(flash, 'Changes could not be saved. Check that browser storage is available and retry.', true);
    flash.scrollIntoView({ block: 'nearest' });
    return;
  }
  renderDetail();
  showNotice(flash, feedback[operation]);
  flash.tabIndex = -1;
  flash.focus();
}

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.hasAttribute('data-close')) button.closest('dialog').close();
  if (button.dataset.account) openAccount(button);
  if (button.dataset.panel) {
    panel = button.dataset.panel;
    showNotice(get('account-flash'), '');
    renderDetail();
  }
  if (button.dataset.operation) changeAccount(button.dataset.operation, { id: button.dataset.blocker });
});

accountDialog.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.target;
  changeAccount(form.dataset.operation, Object.fromEntries(new FormData(form)), form);
});

function clearFilters() {
  get('account-search').value = '';
  get('status-filter').value = 'all';
  renderAccounts();
}

get('account-search').addEventListener('input', renderAccounts);
get('status-filter').addEventListener('change', renderAccounts);
get('clear-filters').addEventListener('click', () => { clearFilters(); get('account-search').focus(); });
get('show-rules').addEventListener('click', () => get('rules-dialog').showModal());
get('show-reset').addEventListener('click', () => get('reset-dialog').showModal());
get('reset-data').addEventListener('click', () => {
  get('reset-dialog').close();
  if (!commit(initialState())) {
    workspaceMessage('The demo could not be reset. Check that browser storage is available and retry.', true);
    get('workspace-message').scrollIntoView({ block: 'nearest' });
    return;
  }
  clearFilters();
  workspaceMessage('Demo reset. The six original accounts have been restored.');
  get('workspace-message').scrollIntoView({ block: 'nearest' });
});

window.addEventListener('storage', event => {
  if (event.key && event.key !== STORAGE_KEY) return;
  if (accountDialog.open) accountDialog.close();
  try {
    state = loadState(localStorage);
    renderPortfolio();
    workspaceMessage('The demo was updated in another tab.');
  } catch {
    workspaceMessage('Changes in another tab could not be loaded.', true);
  }
});

renderPortfolio();
