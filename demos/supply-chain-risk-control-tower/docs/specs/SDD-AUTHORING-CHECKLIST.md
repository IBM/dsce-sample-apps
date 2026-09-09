# SDD Authoring Checklist for Bob-Ready Specs

Use this checklist before asking Bob to implement any spec in this folder.

## Spec Quality

- [ ] Business goal is clear and written in outcome language.
- [ ] Scope and non-goals are explicit.
- [ ] Files Bob may create or modify are listed.
- [ ] Input contracts name topics, schemas, triggers, and filters.
- [ ] Output contracts name API calls, records, documents, files, or telemetry produced.
- [ ] Configuration variables have placeholder-safe examples.
- [ ] Runtime behavior is deterministic enough for Bob to implement without guessing.
- [ ] Failure behavior is defined for missing credentials, API errors, timeouts, bad payloads, and retries.
- [ ] Security/privacy expectations are explicit.
- [ ] Acceptance criteria are testable.

## Bob Implementation Rules

- [ ] Do not implement from memory if the repository already has a matching pattern.
- [ ] Reuse existing utilities and style.
- [ ] Keep external integration logic isolated.
- [ ] Mock external services in tests.
- [ ] Preserve the base demo path when optional integrations are not configured.
- [ ] Do not commit secrets.
- [ ] Summarize assumptions and changed files before PR creation.

## Testing Rules

- [ ] Unit tests cover pure mapping/building functions.
- [ ] External API calls are mocked.
- [ ] Missing/invalid configuration is tested.
- [ ] Non-triggering severities are tested.
- [ ] Failure paths are tested.
- [ ] Manual verification steps are included for real external systems.
