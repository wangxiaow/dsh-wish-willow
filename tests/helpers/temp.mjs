import { createFixtureRoot } from './isolation.mjs';

/** Fresh OS-temp fixture, deliberately retained: this task does not authorize rm. */
export async function temporary(_t) {
  return createFixtureRoot();
}
