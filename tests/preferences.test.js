import assert from 'node:assert/strict';
import test from 'node:test';
import { createSidebarPreferences, DEFAULT_PREFERENCES, PREFERENCES_KEY } from '../src/preferences.js';
function environment(saved = new Map()) {
  const listeners = new Set();
  return { saved, listeners, localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) },
    addEventListener: (_, fn) => listeners.add(fn), removeEventListener: (_, fn) => listeners.delete(fn),
    storage(key = PREFERENCES_KEY) { for (const fn of listeners) fn({ key }); } };
}
test('sidebar preferences keep the existing default experience without writing on startup',()=>{
 const env=environment(),prefs=createSidebarPreferences(env);
 assert.deepEqual(prefs.getSnapshot(),{value:DEFAULT_PREFERENCES,error:null});assert.equal(env.saved.size,0);
});
test('preference changes survive restart and reset leaves session, reminder and order data intact',()=>{
 const env=environment(new Map([['dsh.inbox-sidebar.v1.session.s1','{"snoozedUntil":123}'],['dsh.inbox-sidebar.v1.order','["s1"]']]));
 const prefs=createSidebarPreferences(env);prefs.set('density','compact');prefs.set('settledExpanded',true);
 const reloaded=createSidebarPreferences(env);assert.equal(reloaded.getSnapshot().value.density,'compact');assert.equal(reloaded.getSnapshot().value.settledExpanded,true);
 reloaded.reset();assert.deepEqual(reloaded.getSnapshot().value,DEFAULT_PREFERENCES);
 assert.equal(env.saved.get('dsh.inbox-sidebar.v1.session.s1'),'{"snoozedUntil":123}');assert.equal(env.saved.get('dsh.inbox-sidebar.v1.order'),'["s1"]');
});
test('separate windows merge independent changes and follow storage updates until disposed',()=>{
 const saved=new Map(),one=environment(saved),two=environment(saved),a=createSidebarPreferences(one),b=createSidebarPreferences(two);
 const stopA=a.start(),stop=b.start();a.set('density','compact');b.set('sessionTooltips',false);one.storage();
 assert.equal(a.getSnapshot().value.density,'compact');assert.equal(a.getSnapshot().value.sessionTooltips,false);
 a.set('settledNotice',false);two.storage();assert.equal(b.getSnapshot().value.settledNotice,false);
 stop();assert.equal(two.listeners.size,0);a.reset();two.storage();assert.equal(b.getSnapshot().value.settledNotice,false);stopA();
});
test('invalid values do not enter the preference state and invalid saved data is preserved for explicit recovery',()=>{
 const env=environment(new Map([[PREFERENCES_KEY,'{broken']])),prefs=createSidebarPreferences(env);
 assert.ok(prefs.getSnapshot().error);assert.equal(env.saved.get(PREFERENCES_KEY),'{broken');assert.equal(prefs.set('sessionTooltips','false'),false);
 assert.equal(prefs.set('unknown',true),false);assert.equal(prefs.reset(),true);assert.equal(prefs.getSnapshot().error,null);
 env.saved.set(PREFERENCES_KEY,JSON.stringify({density:'tiny',settledNotice:'no',settledExpanded:true}));env.storage();
 const restored=createSidebarPreferences(env);assert.equal(restored.getSnapshot().value.density,'comfortable');assert.equal(restored.getSnapshot().value.settledNotice,true);assert.equal(restored.getSnapshot().value.settledExpanded,true);
});
test('failed writes keep accepted preferences, expose the error and can be retried',()=>{
 const env=environment(),prefs=createSidebarPreferences(env),write=env.localStorage.setItem;
 env.localStorage.setItem=()=>{throw Error('quota exceeded');};assert.equal(prefs.set('density','compact'),false);
 assert.equal(prefs.getSnapshot().value.density,'comfortable');assert.match(prefs.getSnapshot().error,/quota exceeded/);
 env.localStorage.setItem=write;assert.equal(prefs.set('density','compact'),true);assert.equal(prefs.getSnapshot().error,null);
});
