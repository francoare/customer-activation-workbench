export const DEMO_DAY = '2026-11-24';
export const CAPACITY = 2;
export const STORAGE_KEY = 'customer-activation-workbench.v1';
export const FIRST_VALUE = 'The customer’s finance lead approves a representative invoice through the agreed workflow.';

export const dependencyTypes = {
  internal: 'Internal blocker',
  customer: 'Customer dependency',
  validation: 'Customer validation',
  discovery: 'Unknown owner or next step',
};

const leverage = { internal: 4, validation: 3, discovery: 1, customer: 0 };

const seed = [
  {
    id: 'alpha', name: 'Alpha', target: '2026-11-27', kickoff: '2026-11-13',
    owner: 'Implementation specialist', activity: 'Configuration and training completed.',
    milestone: { label: 'Resolve sample data mapping', state: 'in-progress' },
    blockers: [{ id: 'alpha-mapping', type: 'internal', detail: 'Sample data mapping needs a correction before the representative invoice can run.', owner: 'Implementation specialist', resolved: false }],
    proposedAction: 'Fix the sample data mapping and rerun a representative invoice.',
    proposedOwner: 'Implementation specialist', proposedFollowUp: '2026-11-25',
  },
  {
    id: 'beta', name: 'Beta', target: '2026-11-26', kickoff: '2026-11-14',
    owner: 'Customer finance lead', activity: 'Data import completed.',
    milestone: { label: 'Review imported invoice sample', state: 'planned' },
    blockers: [{ id: 'beta-policy', type: 'customer', detail: 'The customer still needs to provide its approval policy. The internal team depends on that decision.', owner: 'Customer finance lead', resolved: false }],
    proposedAction: 'Ask the customer finance lead for a date to share the approval policy.',
    proposedOwner: 'Onboarding manager', proposedFollowUp: '2026-11-25',
  },
  {
    id: 'gamma', name: 'Gamma', target: DEMO_DAY, kickoff: '2026-11-12',
    owner: 'Customer finance lead', activity: 'The first representative invoice was approved yesterday.',
    milestone: { label: 'Run representative invoice', state: 'done' }, blockers: [],
    evidence: { reference: 'INV-GAMMA-104 · recorded approval in agreed workflow', approvedOn: '2026-11-23', verifiedOn: '2026-11-23' },
  },
  {
    id: 'delta', name: 'Delta', target: '2026-12-01', kickoff: '2026-11-21',
    owner: 'Implementation specialist', activity: 'Configuration is incomplete. Internal work is scheduled for tomorrow.',
    milestone: { label: 'Complete scheduled configuration', state: 'planned' }, blockers: [],
    proposedAction: 'Check the scheduled configuration after the specialist’s work.',
    proposedOwner: 'Onboarding manager', proposedFollowUp: '2026-11-26',
  },
  {
    id: 'epsilon', name: 'Epsilon', target: '2026-11-19', kickoff: '2026-11-09',
    owner: null, activity: 'First value is unverified. The account owner and next action are unknown.',
    milestone: { label: '', state: 'unknown' },
    blockers: [{ id: 'epsilon-triage', type: 'discovery', detail: 'The accountable owner and next customer step are unknown.', owner: null, resolved: false }],
    proposedAction: 'Review the handoff and identify the person accountable for the next step.',
    proposedOwner: 'Onboarding manager', proposedFollowUp: DEMO_DAY,
  },
  {
    id: 'zeta', name: 'Zeta', target: '2026-11-25', kickoff: '2026-11-16',
    owner: 'Customer finance lead', activity: 'Training completed. The customer questions whether the sample matches its actual approval flow.',
    milestone: { label: 'Validate representative approval workflow', state: 'planned' },
    blockers: [{ id: 'zeta-fit', type: 'validation', detail: 'The customer needs to confirm that the example reflects its real approval workflow.', owner: 'Customer finance lead', resolved: false }],
    proposedAction: 'Walk through a real invoice example with the customer finance lead and agree on the approval path.',
    proposedOwner: 'Onboarding manager', proposedFollowUp: '2026-11-25',
  },
];

export function initialState() {
  return { version: 1, accounts: structuredClone(seed).map(account => ({ evidence: null, action: null, ...account })) };
}

export function loadState(storage) {
  const saved = storage.getItem(STORAGE_KEY);
  if (!saved) return initialState();
  const state = JSON.parse(saved);
  if (state?.version !== 1 || !Array.isArray(state.accounts) || state.accounts.length !== seed.length ||
    seed.some(initial => !state.accounts.some(account => account?.id === initial.id))) {
    throw new Error('The saved demo has an unsupported format.');
  }
  return state;
}

export function saveState(storage, state) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const DAY_MS = 86_400_000;
export function daysBetween(start, end) {
  return (Date.parse(end) - Date.parse(start)) / DAY_MS;
}

export function timing(account) {
  const days = daysBetween(DEMO_DAY, account.target);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days}d`;
}

export const openBlockers = account => account.blockers.filter(blocker => !blocker.resolved);

export function accountStatus(account) {
  if (account.evidence) return { label: 'Activated', tone: 'green' };
  const blockers = openBlockers(account);
  if (blockers.some(({ type }) => type === 'internal' || type === 'customer')) return { label: 'Blocked', tone: 'red' };
  if (blockers.length) return { label: 'Needs review', tone: 'amber' };
  if (daysBetween(DEMO_DAY, account.target) <= 1) return { label: 'At risk', tone: 'amber' };
  return { label: 'On track', tone: 'blue' };
}

export function decision(account) {
  const days = daysBetween(DEMO_DAY, account.target);
  const urgency = days <= 1 ? 3 : days <= 3 ? 2 : days <= 7 ? 1 : 0;
  const blockers = openBlockers(account);
  const barrier = blockers.reduce((best, blocker) => !best || leverage[blocker.type] > leverage[best.type] ? blocker : best, null);
  const unlock = barrier ? leverage[barrier.type] : 0;
  return { urgency, unlock, score: urgency + unlock, barrier };
}

export function interventionCount(state) {
  return state.accounts.filter(account => account.action).length;
}

export function recommendations(state) {
  return state.accounts
    .filter(account => !account.evidence && !account.action)
    .map(account => ({ account, ...decision(account) }))
    .sort((a, b) => b.score - a.score || a.account.target.localeCompare(b.account.target) || a.account.name.localeCompare(b.account.name))
    .slice(0, Math.max(0, CAPACITY - interventionCount(state)));
}

export function suggestedAction(account) {
  const { barrier } = decision(account);
  const sampleBlocker = account.blockers[0];
  if (account.proposedAction && (barrier && barrier.id === sampleBlocker?.id || !barrier && account.id === 'delta')) {
    return { text: account.proposedAction, owner: account.proposedOwner, followUp: account.proposedFollowUp };
  }
  return { text: '', owner: '', followUp: '' };
}

function validDay(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day ?? '')) return false;
  const parsed = new Date(day);
  return !Number.isNaN(+parsed) && parsed.toISOString().slice(0, 10) === day;
}

function requireFields(values) {
  for (const [field, value, message] of values) {
    if (!value?.trim()) return { field, message };
  }
  return null;
}

export function updateState(state, id, operation, data = {}) {
  const account = state.accounts.find(item => item.id === id);
  const reject = (field, message) => ({ error: { field, message } });
  if (!account) return reject(null, 'This account could not be found.');

  let changes;
  switch (operation) {
    case 'action': {
      const error = requireFields([
        ['text', data.text, 'Enter a next action.'],
        ['owner', data.owner, 'Enter an owner for the next action.'],
        ['followUp', data.followUp, 'Choose a follow-up date.'],
        ['reason', data.reason, 'Explain why this intervention is worth a slot.'],
      ]);
      if (error) return { error };
      if (!validDay(data.followUp) || data.followUp < DEMO_DAY) return reject('followUp', 'Choose a follow-up on or after the demo date.');
      if (!account.action && account.evidence) return reject(null, 'This account already reached first value.');
      if (!account.action && interventionCount(state) >= CAPACITY) return reject(null, 'Both intervention slots are in use. Remove an existing intervention to choose another account.');
      changes = { action: { text: data.text.trim(), owner: data.owner.trim(), followUp: data.followUp, reason: data.reason.trim() } };
      break;
    }
    case 'remove-action':
      changes = { action: null };
      break;
    case 'milestone': {
      if (!['unknown', 'planned', 'in-progress', 'done'].includes(data.state)) return reject('state', 'Choose a milestone status.');
      if (data.state !== 'unknown' && !data.label?.trim()) return reject('label', 'Enter a milestone before setting its status.');
      changes = { milestone: { label: data.label?.trim() || '', state: data.state } };
      break;
    }
    case 'blocker': {
      if (!Object.hasOwn(dependencyTypes, data.type)) return reject('type', 'Choose a dependency type.');
      if (!data.detail?.trim()) return reject('detail', 'Describe what is blocking progress.');
      changes = { blockers: [...account.blockers, { id: crypto.randomUUID(), type: data.type, detail: data.detail.trim(), owner: data.owner?.trim() || null, resolved: false }] };
      break;
    }
    case 'resolve-blocker':
      if (!account.blockers.some(blocker => blocker.id === data.id && !blocker.resolved)) return reject(null, 'This dependency is already resolved or unavailable.');
      changes = { blockers: account.blockers.map(blocker => blocker.id === data.id ? { ...blocker, resolved: true } : blocker) };
      break;
    case 'activate': {
      if (account.evidence) return reject(null, 'First value is already verified for this account.');
      if (!data.reference?.trim()) return reject('reference', 'Enter evidence of the approved representative invoice.');
      if (!validDay(data.approvedOn) || data.approvedOn < account.kickoff || data.approvedOn > DEMO_DAY) return reject('approvedOn', 'Choose an approval date from kickoff through the demo date.');
      if (data.representative !== 'on') return reject('representative', 'Confirm that the finance lead approved through the agreed workflow.');
      changes = { evidence: { reference: data.reference.trim(), approvedOn: data.approvedOn, verifiedOn: DEMO_DAY } };
      break;
    }
    default:
      return reject(null, 'This change is unavailable.');
  }
  return { state: { ...state, accounts: state.accounts.map(item => item.id === id ? { ...item, ...changes } : item) } };
}
