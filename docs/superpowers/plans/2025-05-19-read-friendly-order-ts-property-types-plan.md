# Implementation Plan: read-friendly-order TS Property Type Annotations

## Overview

Add dependency collection for TypeScript type annotations on class property definitions (`PropertyDefinition.typeAnnotation`) so that exported types used by exported classes trigger `moveHelperBelow` and are reordered consumer-first by autofix.

---

### Task 1: Write tests for TS property type annotation ordering

**Files:**
- Create: `src/rules/read-friendly-order/ts-property-types.test.ts`

**Context:** `index.test.ts` is 530 lines. Adding 5 scenarios (~100+ lines) would exceed the 600-line file limit. The project already splits tests (see `class-and-phases.test.ts`). Create a new colocated test file.

- [ ] **Step 1: Create the test file**

Create `src/rules/read-friendly-order/ts-property-types.test.ts` with this content:

```ts
import rule from './index.js'
import { scenario } from '../../utils/test-fixtures/index.js'

// spec: read-friendly-order/spec.md
// TypeScript property type annotation dependency ordering.

scenario(
  'interface above class with property type annotation is flagged and autofixed',
  rule,
  {
    typescript: true,
    code: [
      'export interface ApplicantPersonal {',
      '  name: string',
      '}',
      '',
      'export class Applicant {',
      '  personal: ApplicantPersonal',
      '}',
    ].join('\n'),
    errors: [{ messageId: 'moveHelperBelow' }],
    output: [
      'export class Applicant {',
      '  personal: ApplicantPersonal',
      '}',
      '',
      'export interface ApplicantPersonal {',
      '  name: string',
      '}',
    ].join('\n'),
  },
)

scenario('multiple interfaces above class using them are flagged and reordered', rule, {
  typescript: true,
  code: [
    'export interface A {',
    '  x: number',
    '}',
    '',
    'export interface B {',
    '  y: string',
    '}',
    '',
    'export class C {',
    '  a: A',
    '',
    '  b: B',
    '}',
  ].join('\n'),
  errors: [{ messageId: 'moveHelperBelow' }, { messageId: 'moveHelperBelow' }],
  output: [
    'export class C {',
    '  a: A',
    '',
    '  b: B',
    '}',
    '',
    'export interface A {',
    '  x: number',
    '}',
    '',
    'export interface B {',
    '  y: string',
    '}',
  ].join('\n'),
})

scenario('type above unrelated class is allowed', rule, {
  typescript: true,
  code: [
    'export interface Config {',
    '  enabled: boolean',
    '}',
    '',
    'export class Applicant {',
    '  name: string',
    '}',
  ].join('\n'),
})

scenario('type in constructor parameter above class is flagged and autofixed', rule, {
  typescript: true,
  code: [
    'export interface Config {',
    '  enabled: boolean',
    '}',
    '',
    'export class Applicant {',
    '  constructor(cfg: Config) {}',
    '}',
  ].join('\n'),
  errors: [{ messageId: 'moveHelperBelow' }],
  output: [
    'export class Applicant {',
    '  constructor(cfg: Config) {}',
    '}',
    '',
    'export interface Config {',
    '  enabled: boolean',
    '}',
  ].join('\n'),
})

scenario(
  'already-correct class-first order with property type annotations produces no edits',
  rule,
  {
    typescript: true,
    code: [
      'export class Applicant {',
      '  personal: ApplicantPersonal',
      '}',
      '',
      'export interface ApplicantPersonal {',
      '  name: string',
      '}',
    ].join('\n'),
  },
)
```

**Note:** The constructor-parameter test (Test 4) already fails on current code because `walkFunctionLike` already collects constructor param types. Tests 1 and 2 are the ones that currently pass (no errors detected) but should fail. Tests 3 and 5 already pass and are regression guards.

---

### Task 2: Verify the new failing tests actually fail on current code

- [ ] **Step 1: Run Test 1 to confirm it incorrectly passes (no error detected)**

```bash
npx vitest run src/rules/read-friendly-order/ts-property-types.test.ts -t "interface above class with property type annotation is flagged and autofixed"
```

**Expected:** FAIL — assertion error, expected 1 error but got 0. The rule currently misses the dependency because `walkPropertyIds` does not walk `typeAnnotation`.

- [ ] **Step 2: Run Test 2 to confirm it incorrectly passes**

```bash
npx vitest run src/rules/read-friendly-order/ts-property-types.test.ts -t "multiple interfaces above class using them are flagged and reordered"
```

**Expected:** FAIL — assertion error, expected 2 errors but got 0.

- [ ] **Step 3: Run Tests 3 and 5 to confirm they already pass**

```bash
npx vitest run src/rules/read-friendly-order/ts-property-types.test.ts -t "type above unrelated class is allowed"
```

**Expected:** PASS.

```bash
npx vitest run src/rules/read-friendly-order/ts-property-types.test.ts -t "already-correct class-first order with property type annotations produces no edits"
```

**Expected:** PASS.

---

### Task 3: Add typeAnnotation to walkPropertyIds

**Files:**
- Modify: `src/rules/read-friendly-order/ast-utils.ts:216-219`

**Context:** `walkPropertyIds` is called by `walkIdsBody` for all property-like nodes (`Property`, `MethodDefinition`, `PropertyDefinition`). It currently walks `key` (if computed) and `value`, but not `typeAnnotation`. For `PropertyDefinition` nodes in class bodies, the type annotation (e.g., `personal: ApplicantPersonal`) is stored in `typeAnnotation` and is invisible to dependency collection.

- [ ] **Step 1: Apply the one-line addition**

Find this block in `src/rules/read-friendly-order/ast-utils.ts`:

```ts
function walkPropertyIds(node: unknown, ids: Set<string>, skip: string | null): void {
  if (prop(node, 'computed')) walkIds(prop(node, 'key'), ids, skip)
  walkIds(prop(node, 'value'), ids, skip)
}
```

Replace it with:

```ts
function walkPropertyIds(node: unknown, ids: Set<string>, skip: string | null): void {
  if (prop(node, 'computed')) walkIds(prop(node, 'key'), ids, skip)
  walkIds(prop(node, 'value'), ids, skip)
  walkIds(prop(node, 'typeAnnotation'), ids, skip)
}
```

**Why this is safe:** Non-TS code has no `typeAnnotation` property, so `prop` returns `undefined` and `walkIds` is a no-op. Constructor and method parameter/return types are already handled by `walkFunctionLike`.

---

### Task 4: Verify all tests pass after the fix

- [ ] **Step 1: Run the full new test file**

```bash
npx vitest run src/rules/read-friendly-order/ts-property-types.test.ts
```

**Expected:** All 5 tests PASS.

- [ ] **Step 2: Run all read-friendly-order tests to check for regressions**

```bash
npx vitest run src/rules/read-friendly-order/
```

**Expected:** All tests in the directory PASS.

---

### Task 5: Run project verification

- [ ] **Step 1: Run the verify script**

```bash
npm run verify
```

**Expected:** Exits clean (0). This checks prettier, knip, jscpd, tsc, tsup, and eslint.

- [ ] **Step 2: Run the full test suite**

```bash
npm run test
```

**Expected:** All tests PASS.

---

### Task 6: Commit

- [ ] **Step 1: Stage and commit**

```bash
git add src/rules/read-friendly-order/ast-utils.ts src/rules/read-friendly-order/ts-property-types.test.ts
git commit -m "fix(read-friendly-order): collect deps from class property type annotations

Type references in class property annotations (e.g. personal: ApplicantPersonal)
were invisible to dependency collection because walkPropertyIds did not walk
the typeAnnotation node. This caused missing lint errors and incorrect autofix
ordering when exported types sat above exported classes that used them."
```

---

## Summary

| Task | File | Change |
|------|------|--------|
| 1 | `ts-property-types.test.ts` | New test file with 5 scenarios |
| 2 | — | Verify Tests 1–2 fail, Tests 3 & 5 pass on current code |
| 3 | `ast-utils.ts` | Add `walkIds(prop(node, 'typeAnnotation'), ids, skip)` to `walkPropertyIds` |
| 4–6 | — | Verify all tests pass → run full suite → commit |
