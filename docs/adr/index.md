# Architecture Decision Records

ADRs record architecture choices that should not be changed silently. This entry is a curated reading path into the full record set; the [ADR index](/adr/README) lists every decision, and the [Chinese mirror](/zh-CN/adr/) translates each record at the same relative path. Decision IDs, statuses, and the English records remain the source of truth for both locales.

## Key decisions

| Decision | Description |
|---|---|
| [ADR 0001: Electron desktop shell](/adr/0001-use-electron) | The carrier layer for desktop windows and platform capabilities |
| [ADR 0005: Local plugin system](/adr/0005-user-installable-plugin-system) | Phase-one boundary for user-installable plugins |
| [ADR 0009: English-first globalization](/adr/0009-english-first-globalization) | Source language, terminology, and collaboration rules |
| [ADR 0010: Rust host core](/adr/0010-rust-backend-host-core) | Host boundary for the privileged process, RPC, and persistence |
| [ADR 0053: Plan checkpoint](/adr/0053-plan-checkpoint-artifact-and-execution-epoch) | Plan approval, artifacts, and execution epochs |
| [ADR 0079: VitePress documentation site](/adr/0079-vitepress-documentation-site) | Structure and deployment of the bilingual documentation site |
| [ADR 0083: Custom global UI font](/adr/0083-custom-global-ui-font) | Settings font picker, bundled open-source fonts, and system font enumeration |
| [ADR 0089: Proactive background subagent delegation](/adr/0089-proactive-background-subagent-delegation) | Non-blocking Task, TaskWait/TaskList/TaskStop lifecycle, and permission scoping |
| [ADR 0090: User-configurable close behavior](/adr/0090-user-configurable-close-behavior-close-to-tray) | Ask only once on first close, close to tray or quit, changeable in settings |
| [ADR 0095: Sign in with vendor account](/adr/0095-vendor-account-oauth-login) | Use subscription accounts instead of API keys; credentials stay in the main process, and the sidecar fetches short-lived tokens per request |
| [ADR 0106: The core five built-in commands](/adr/0106-core-five-builtin-commands) | Freeze the command palette and composer `/` menu to five first-party commands |
| [ADR 0108: Remove the built-in interactive terminal](/adr/0108-remove-built-in-interactive-terminal) | The work panel no longer hosts a PTY; interactive shells are handled by external terminals, and Agent Bash stays non-interactive |
| [ADR 0128: Bounded retries for transient provider failures](/adr/0128-bounded-transient-provider-retry) | Share a bounded retry budget for transient provider failures: four retries shared across request setup and streaming phases |
| [ADR 0131: Large composer pastes written to the session temp directory](/adr/0131-large-text-paste-session-reference) | Plain-text pastes above a configurable threshold are saved as session temp files, with an inline `@` reference inserted in place |
| [ADR 0137: Retained session panes](/adr/0137-retained-session-panes) | Each recently visited session retains one mounted pane (up to three); switching is a visibility swap rather than rebuilding the transcript |
| [ADR 0141: Expanded sidebar width is resizable](/adr/0141-sidebar-width-resize) | The expanded sidebar is resized from 240–520px via a right-edge handle, with the preferred value persisted |
| [ADR 0142: Allow non-loopback HTTP MCP endpoints](/adr/0142-allow-non-loopback-http-mcp) | Support LAN MCP while clearly warning about plaintext connection risk; plugins remain constrained by the network allowlist |
| [ADR 0145: Publish native macOS Intel artifacts](/adr/0145-native-macos-intel-release-lane) | Publish arm64 and Intel x64 DMG/ZIP via matching native macOS runners, and merge the update feeds |
| [ADR 0148: Explicitly disable keyboard shortcuts](/adr/0148-explicitly-disable-keyboard-shortcuts) | A missing override uses the default; `null` means unbound and disables dispatch across the renderer, menu, and launcher |
| [ADR 0174: Host-owned plugin completion and session context](/adr/0174-plugin-host-owned-completion-and-session-context) | Plugins can list signed-in models, read the in-progress tool session, and have the host perform one-shot completion via a public API |
| [ADR 0175: Explain quiet in-progress turns](/adr/0175-live-agent-activity-status) | Use waiting-model / retrying / waiting-subagents status lines to explain pauses |
| [ADR 0176: Per-provider User-Agent](/adr/0176-per-provider-user-agent) | Each AI service/OAuth row can set an optional User-Agent (superseded by the headers map in 0178) |
| [ADR 0177: User-configurable outbound proxy](/adr/0177-user-configurable-outbound-proxy) | Settings offer system/direct/custom proxy overrides for model requests, the marketplace, updates, and the built-in browser |
| [ADR 0178: Per-provider custom HTTP headers](/adr/0178-per-provider-custom-headers) | Each AI service/OAuth row can edit arbitrary non-sensitive request headers in advanced options |
| [ADR 0179: Import model configuration from local agent storage](/adr/0179-import-model-configuration) | Settings → Import explicitly scans Claude Code / Codex / OpenCode / Pi provider configurations and copies API keys |
| [ADR 0180: Custom global text scaling](/adr/0180-custom-reading-font-size) | Settings → Appearance scales all UI text proportionally, without px; window zoom remains independent |
| [ADR 0181: Main-process-owned file picker capabilities](/adr/0181-main-owned-picker-capabilities) | File picker paths stay in the main process, the import boundary is protected by one-time tokens, and unsupported folder picking is removed |
| [ADR 0182: Traditional Chinese application shell](/adr/0182-traditional-chinese-shell-locale) | Provide a separate Traditional Chinese shell, system language resolution, and release log directory |
| [ADR 0183: P0 international application shell locales](/adr/0183-p0-international-shell-locales) | Provide complete German, Spanish, and French shell catalogs and release logs |
| [ADR 0184: Context usage inspector in the composer toolbar](/adr/0184-composer-context-usage-inspector) | Move the remaining capacity inspector to the left of the model selector, keeping only the model badge below answers |
 | [ADR 0185: Korean application shell](/adr/0185-korean-shell-locale) | Provide a complete Korean shell, system language resolution, and Korean release log directory |
 | [ADR 0186: Show provider reason for in-progress retries](/adr/0186-retry-cause-in-active-turn-status) | Hovering or focusing the retry status line shows the error summary, error code, and safe provider message |
 | [ADR 0187: Separate task and interactive native notification delivery](/adr/0187-separate-task-and-interactive-native-notification-delivery) | Terminal tasks remain unfocused-only delivery, while interactive prompts can notify other focused sessions |
| [ADR 0188: Preserve distinct credentials during model configuration import](/adr/0188-preserve-distinct-import-credentials) | Same-endpoint profiles with different API keys import as separate providers; identical credentials stay idempotent |
| [ADR 0188: Import WorkBuddy sessions](/adr/0188-workbuddy-session-import) | Import WorkBuddy sessions with prompts, tool results, and AI titles preserved |
| [ADR 0189: Complete the Chinese documentation mirror](/adr/0189-complete-chinese-documentation-mirror) | Mirror every documented page to Chinese at the same relative path |

## When to read ADRs

- The spec tells you how the system should work.
- The ADR tells you why this boundary was chosen and which alternatives were abandoned.
- The decisions log records finer frozen clauses and later revisions.

Go to the [ADR index](/adr/README) for the full records, or open the [decisions log](/spec/08-meta/decisions-log) to look up entries by number.
