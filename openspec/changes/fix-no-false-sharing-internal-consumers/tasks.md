## 1. Symbol Consumer Modeling

- [ ] 1.1 Update `src/rules/no-false-sharing/index.ts` to represent exported symbols with their public entrypoint target and optional backing internal file instead of tracking names alone.
- [ ] 1.2 Extend consumer discovery so same-shared-module imports from the shared entrypoint or a symbol's backing internal file count toward that exported symbol.

## 2. Consumer Group Semantics

- [ ] 2.1 Collapse multiple internal consuming files in the same shared module into one internal consumer group derived from the shared module instance.
- [ ] 2.2 Ensure internal-only usage still reports the symbol and that external imports of internal backing files do not satisfy sharing.

## 3. Rule Coverage

- [ ] 3.1 Add `RuleTester` scenarios in `src/rules/no-false-sharing/index.test.ts` for direct entrypoint exports with internal consumers, re-exported symbols with internal consumers, and multiple internal consumers collapsing to one group.
- [ ] 3.2 Add `RuleTester` scenarios covering internal-only consumers remaining errors and external deep imports of backing files not counting toward sharing.

## 4. Validation

- [ ] 4.1 Run `npm run fix` and address any remaining issues.
- [ ] 4.2 Run `npm run verify` and `npm run test` to confirm the rule and repository remain clean.
