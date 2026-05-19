# read-friendly-order: Type annotations on class properties

## Problem

`read-friendly-order` does not detect type references in class property type annotations (`personal: ApplicantPersonal`). This causes two failures:

1. **Missing lint error:** When `export interface ApplicantPersonal` sits above `export class Applicant`, the rule sees no dependency and stays silent.
2. **Incorrect autofix:** The autofix sorts band 3 (local public API) by `kindPriority`, placing type aliases/interfaces before classes — the opposite of consumer-first order.

## Root Cause

In `ast-utils.ts`, `walkPropertyIds` walks `key` and `value` of property-like nodes, but **not** `typeAnnotation`. For `PropertyDefinition` nodes (class properties), the type annotation is stored in `typeAnnotation` and is invisible to dependency collection.

## Fix

Add one line to `walkPropertyIds` in `ast-utils.ts`:

```ts
function walkPropertyIds(node: unknown, ids: Set<string>, skip: string | null): void {
  if (prop(node, 'computed')) walkIds(prop(node, 'key'), ids, skip)
  walkIds(prop(node, 'value'), ids, skip)
  walkIds(prop(node, 'typeAnnotation'), ids, skip) // <-- NEW
}
```

This is safe:
- Non-TS code has no `typeAnnotation` → `prop` returns `undefined` → `walkIds` is a no-op.
- `walkFunctionLike` already handles parameter and return type annotations, so constructor/method signatures are already covered.
- TS-specific nodes like `implements`, `superTypeParameters`, and `typeParameters` on classes are already walked via `walkChildren` → `walkNodeChildren`.

## Test Scenarios

### 1. Interface above class with property type annotation → flagged and autofixed

```ts
export interface ApplicantPersonal {
  name: string
}

export class Applicant {
  personal: ApplicantPersonal
}
```

Expected: `moveHelperBelow` on `ApplicantPersonal`. Autofix moves class above interface.

### 2. Multiple interfaces above class → all flagged, class first in output

```ts
export interface A { x: number }
export interface B { y: string }

export class C {
  a: A
  b: B
}
```

Expected: Two errors. Autofix places `C` first, then `A`, then `B` (stable ordering).

### 3. Type above unrelated class → no error

```ts
export interface Config {
  enabled: boolean
}

export class Applicant {
  name: string
}
```

Expected: No error. `Config` is not referenced in `Applicant`.

### 4. Type in constructor parameter above class → error

```ts
export interface Config {
  enabled: boolean
}

export class Applicant {
  constructor(cfg: Config) {}
}
```

Expected: `moveHelperBelow` on `Config`. Constructor param types are already walked by `walkFunctionLike`, so this already works. Added as a regression guard.

### 5. Idempotency — already-correct class-first order → no edits

```ts
export class Applicant {
  personal: ApplicantPersonal
}

export interface ApplicantPersonal {
  name: string
}
```

Expected: No error.

## Files Changed

- `src/rules/read-friendly-order/ast-utils.ts` — one-line addition
- `src/rules/read-friendly-order/index.test.ts` — 4-5 new test scenarios
