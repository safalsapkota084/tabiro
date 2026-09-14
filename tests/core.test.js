import test from 'node:test';
import assert from 'node:assert/strict';
import { dictionaries, translate, resolveLocale } from '../assets/js/i18n.js';
import { routes, createPlan, planDays, validPlan } from '../assets/js/data.js';
import { readList, safeWrite } from '../assets/js/store.js';

test('every supported language translates every interface key', () => {
  const keys = Object.keys(dictionaries.en).sort();
  for (const lang of ['en', 'ja', 'fr']) {
    assert.deepEqual(Object.keys(dictionaries[lang]).sort(), keys);
    for (const value of Object.values(dictionaries[lang])) assert.equal(typeof value, 'string');
  }
});
test('locale resolution accepts supported language prefixes and rejects unsupported ones', () => {
  assert.equal(resolveLocale('ja-JP'), 'ja');
  assert.equal(resolveLocale('fr-CA'), 'fr');
  assert.equal(resolveLocale('de'), 'en');
  assert.equal(resolveLocale(null), 'en');
});
test('interpolation inserts values as data, including dollar signs', () => {
  assert.equal(translate('en', 'greeting', { name: '$&' }), 'Welcome back, $&.');
});
test('planner respects destination and day count across every language', () => {
  for (const route of routes) for (const days of [2, 4, 7]) {
    const plan = createPlan({ routeId: route.id, days, travelers: 2, pace: 'relaxed', interests: ['nature'] });
    assert.equal(plan.routeId, route.id);
    for (const lang of ['en', 'ja', 'fr']) {
      const result = planDays(plan, lang);
      assert.equal(result.length, days);
      assert.ok(result.every(day => day.title && day.description));
    }
  }
});
test('planner rejects unknown destinations and invalid duration or party size', () => {
  for (const input of [
    { routeId: 'unknown', days: 4, travelers: 2 },
    { routeId: 'kyoto', days: 0, travelers: 2 },
    { routeId: 'kyoto', days: 3.5, travelers: 2 },
    { routeId: 'kyoto', days: 4, travelers: 0 },
    { routeId: 'kyoto', days: 40, travelers: 2 },
  ]) assert.throws(() => createPlan(input));
});
test('planner preferences survive creation and influence itinerary descriptions', () => {
  const plan = createPlan({ routeId: 'kyoto', days: 4, travelers: 3, pace: 'active', interests: ['food'] });
  assert.equal(plan.travelers, 3);
  assert.equal(plan.pace, 'active');
  assert.deepEqual(plan.interests, ['food']);
  assert.match(planDays(plan, 'en')[0].description, /food|local|market/i);
});
test('storage handles malformed, unavailable, and incorrectly shaped content', () => {
  assert.deepEqual(readList({ getItem: () => '{' }, 'key', () => true), []);
  assert.deepEqual(readList({ getItem: () => '{}' }, 'key', () => true), []);
  assert.deepEqual(readList({ getItem: () => { throw Error(); } }, 'key', () => true), []);
  assert.deepEqual(readList({ getItem: () => '["kyoto",null,42]' }, 'key', x => typeof x === 'string'), ['kyoto']);
  assert.equal(safeWrite({ setItem: () => { throw Error(); } }, 'key', []), false);
});

test('persisted plans reject unnormalized fields that would break rendering', () => {
  const valid = createPlan({ routeId: 'kyoto', days: 4, travelers: 2, pace: 'balanced', interests: ['nature'] });
  assert.equal(validPlan(valid), true);
  for (const patch of [{ pace: undefined }, { interests: ['unknown'] }, { days: '4' }, { travelers: null }, { id: '' }]) {
    assert.equal(validPlan({ ...valid, ...patch }), false, JSON.stringify(patch));
  }
});
