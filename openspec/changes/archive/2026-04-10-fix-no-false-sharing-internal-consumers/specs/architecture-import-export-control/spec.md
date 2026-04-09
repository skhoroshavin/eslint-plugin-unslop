## MODIFIED Requirements

### Requirement: no-false-sharing SHALL count consumers in directory mode only

`unslop/no-false-sharing` MUST count distinct consumer groups using directory-level grouping and apply the threshold to shared entrypoint-exported symbols. Both value imports and type-only imports count as consumers. Same-shared-module internal consumers count as one collapsed internal consumer group for the shared module instance, whether they import from the shared entrypoint file or a backing internal file for a re-exported symbol. An internal consumer group alone is insufficient to satisfy the sharing threshold.

#### Scenario: Symbol imported from one directory group

- **WHEN** a shared entrypoint-exported symbol is imported by files in only one directory-level consumer group
- **THEN** `unslop/no-false-sharing` MUST report that symbol as not truly shared

#### Scenario: Symbol imported from two directory groups

- **WHEN** a shared entrypoint-exported symbol is imported by files in at least two distinct directory-level consumer groups
- **THEN** `unslop/no-false-sharing` MUST allow that symbol

#### Scenario: Multiple internal consumers collapse to one shared-module group

- **WHEN** multiple files in the same shared module consume the same exported symbol through the shared entrypoint or its backing internal file
- **THEN** `unslop/no-false-sharing` MUST count those internal consumers as one consumer group for that shared module instance

#### Scenario: Internal-only consumer group is insufficient

- **WHEN** the only consumers of a shared entrypoint-exported symbol are files within that same shared module
- **THEN** `unslop/no-false-sharing` MUST report that symbol as not truly shared
