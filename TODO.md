# TODO

## Team lanes
- **Agent lane (Person 1):** AI chat, context assembly, apply-edits flow
- **Compiler lane (Person 2):** LaTeX build pipeline, log parsing, IPC compile APIs
- **Display lane (Person 3):** Monaco editor UX, PDF preview UX, panel-level UI polish

## Phase 1: Core MVP (must-have)
- [ ] **COMP-1 (Compiler):** Compile active/main `.tex` via IPC (`main` -> `compile` -> result)
- [ ] **COMP-2 (Compiler):** Parse LaTeX errors to `file:line:message` diagnostics payload
- [ ] **DISP-1 (Display):** Monaco basic LaTeX editing + show diagnostics
- [ ] **DISP-2 (Display):** PDF panel loads latest compiled PDF + refreshes on success
- [ ] **AGENT-1 (Agent):** Send prompt with context (current file + selection + latest errors)
- [ ] **AGENT-2 (Agent):** "Apply" action maps model output to Monaco edit(s)
- [ ] **INT-1 (All):** End-to-end loop works: edit -> compile -> preview, then agent fix -> apply -> recompile

## Phase 2: Developer experience (should-have)
- [ ] **COMP-3 (Compiler):** Better compile feedback states (running/success/fail + timing)
- [ ] **DISP-3 (Display):** PDF zoom + page navigation controls
- [ ] **AGENT-3 (Agent):** Quick actions (Fix errors / Explain selection / Summarize section)
- [ ] **INT-2 (All):** Basic regression checklist for compile, diagnostics, and apply-edit flow

## Phase 3: Nice-to-have
- [ ] **DISP-4 (Display):** Multi-file UX (tabs or file tree)
- [ ] **AGENT-4 (Agent):** Streaming responses + clearer edit preview before apply
- [ ] **COMP-4 (Compiler):** Optional SyncTeX hooks (source <-> PDF)
- [ ] **PROD-1 (All):** Settings + packaging polish (`electron-builder`)

## Notes template (fill per task)
- Owner:
- Status: `todo | doing | blocked | done`
- Definition of done:
- Dependencies:
