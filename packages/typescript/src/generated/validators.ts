// Generated from Rust service DTO schemas. Run contracts:generate; do not edit.
import * as validators from './compiled-validators.js';
import type { WireContractName } from './wire-types.js';
export type { WireContractName } from './wire-types.js';

export function validateWire(name: WireContractName, value: unknown): boolean {
  return validators[name](value);
}
