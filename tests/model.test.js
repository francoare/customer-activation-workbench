import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEMO_DAY, accountStatus, daysBetween, decision, initialState, interventionCount, loadState, openBlockers,
  recommendations, saveState, updateState,
} from '../docs/model.js';

const find = (state, id) => state.accounts.find(account => account.id === id);
const suggestions = state => recommendations(state).map(({ account }) => account.id);
const action = {
  text: 'Prepare the representative invoice', owner: 'Implementation specialist',
  followUp: '2026-11-25', reason: 'The scheduled work can bring first value closer.',
};
const approval = { reference: 'INV-ALPHA-DEMO-01', approvedOn: DEMO_DAY, representative: 'on' };

function apply(state, id, operation, data) {
  const result = updateState(state, id, operation, data);
  assert.equal(result.error, undefined);
  return result.state;
}

test('initial portfolio preserves the six competing cases and ranks Zeta before Alpha', () => {
  const state = initialState();
  assert.equal(state.accounts.length, 6);
  assert.deepEqual(suggestions(state), ['zeta', 'alpha']);
  assert.equal(decision(find(state, 'alpha')).score, 6);
  assert.equal(decision(find(state, 'beta')).score, 2);
  assert.equal(accountStatus(find(state, 'gamma')).label, 'Activated');
  assert.equal(accountStatus(find(state, 'delta')).label, 'On track');
  assert.equal(find(state, 'epsilon').owner, null);
  assert.equal(find(state, 'epsilon').action, null);
  assert.equal(daysBetween(DEMO_DAY, find(state, 'epsilon').target), -5);
});

test('urgency changes at the intended date boundaries including the month change', () => {
  const delta = find(initialState(), 'delta');
  const dates = ['2026-11-19', DEMO_DAY, '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-12-01', '2026-12-02'];
  assert.deepEqual(dates.map(target => decision({ ...delta, target }).urgency), [3, 3, 3, 2, 2, 1, 1, 0]);
});

test('a completed Beta milestone leaves the customer policy open', () => {
  const state = initialState();
  const updated = apply(state, 'beta', 'milestone', { label: 'Review imported invoice sample', state: 'done' });
  const beta = find(updated, 'beta');
  assert.equal(beta.milestone.state, 'done');
  assert.equal(find(state, 'beta').milestone.state, 'planned');
  assert.equal(openBlockers(beta)[0].type, 'customer');
  assert.equal(accountStatus(beta).label, 'Blocked');
});

test('two interventions validate ownership and dates, allow edits, and release on removal', () => {
  let state = initialState();
  assert.equal(updateState(state, 'alpha', 'action', { ...action, owner: '  ' }).error.field, 'owner');
  assert.equal(updateState(state, 'alpha', 'action', { ...action, followUp: '2026-11-23' }).error.field, 'followUp');
  assert.equal(updateState(state, 'gamma', 'action', action).error.message, 'This account already reached first value.');
  state = apply(state, 'alpha', 'action', action);
  assert.deepEqual(suggestions(state), ['zeta']);
  state = apply(state, 'zeta', 'action', action);
  assert.equal(interventionCount(state), 2);
  assert.deepEqual(suggestions(state), []);
  assert.match(updateState(state, 'beta', 'action', action).error.message, /Both intervention slots/);
  state = apply(state, 'alpha', 'action', { ...action, text: 'Rerun mapping' });
  assert.equal(find(state, 'alpha').action.text, 'Rerun mapping');
  state = apply(state, 'zeta', 'remove-action');
  assert.equal(interventionCount(state), 1);
  assert.deepEqual(suggestions(state), ['zeta']);
});

test('activation requires evidence, a valid approval date and attestation', () => {
  let state = initialState();
  assert.equal(updateState(state, 'alpha', 'activate', { ...approval, reference: ' ' }).error.field, 'reference');
  assert.equal(updateState(state, 'alpha', 'activate', { ...approval, approvedOn: '2026-11-25' }).error.field, 'approvedOn');
  assert.equal(updateState(state, 'alpha', 'activate', { ...approval, approvedOn: '2026-11-12' }).error.field, 'approvedOn');
  assert.equal(updateState(state, 'alpha', 'activate', { ...approval, representative: '' }).error.field, 'representative');
  state = apply(state, 'alpha', 'action', action);
  state = apply(state, 'alpha', 'activate', approval);
  const alpha = find(state, 'alpha');
  assert.equal(accountStatus(alpha).label, 'Activated');
  assert.deepEqual(alpha.evidence, { reference: approval.reference, approvedOn: DEMO_DAY, verifiedOn: DEMO_DAY });
  assert.equal(openBlockers(alpha).length, 1);
  assert.equal(interventionCount(state), 1);
  assert.deepEqual(suggestions(state), ['zeta']);
  assert.equal(daysBetween(alpha.kickoff, alpha.evidence.verifiedOn), 11);
});

test('local storage retains evidence, actions and independently resolved dependencies', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  let state = loadState(storage);
  state = apply(state, 'alpha', 'action', action);
  state = apply(state, 'alpha', 'resolve-blocker', { id: 'alpha-mapping' });
  assert.equal(accountStatus(find(state, 'alpha')).label, 'On track');
  state = apply(state, 'alpha', 'blocker', { type: 'customer', detail: 'Waiting for updated invoice sample' });
  assert.equal(openBlockers(find(state, 'alpha'))[0].owner, null);
  state = apply(state, 'alpha', 'activate', approval);
  saveState(storage, state);
  assert.deepEqual(loadState(storage), state);
  saveState(storage, { version: 2, accounts: [] });
  assert.throws(() => loadState(storage), /unsupported format/);
});
