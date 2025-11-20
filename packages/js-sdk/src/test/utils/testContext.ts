import { expect } from "vitest";

type Bag = Record<string | symbol, unknown>;
const store = new Map<string, Bag>();

function currentKey() {
  const s = expect.getState();
  if (!s.currentTestName) return undefined;
  return `${s.testPath ?? ""}::${s.currentTestName}`;
}

export const testContext: any = new Proxy<Bag>({} as Bag, {
  get(_target, prop) {
    const key = currentKey();
    if (!key) return null;
    const bag = store.get(key);
    return bag ? bag[prop] : null;
  },
  set(_target, prop, value) {
    const key = currentKey();
    if (!key) return false;
    const bag = store.get(key) ?? {};
    bag[prop] = value;
    store.set(key, bag);
    return true;
  },
});
