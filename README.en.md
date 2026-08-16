# dsh-file-picker

> DeepSeek Harness (DSH) Web GUI plugin: pick files **outside the workspace** for dsh web — a 📎 button in the composer tool row → native Windows file dialog (any folder, multi-select) → attachment card rail above the input → the host injects the absolute path list into the session context on send → the agent reads the files with the built-in `read` tool.

> ⚠️ **Platform**: the file dialog is built on PowerShell 7 (`pwsh`) + Windows Forms and currently supports **Windows only** (PowerShell 7 must be installed).
> ⚠️ **Compatibility**: relies on semi-public dsh APIs (`agent.inject`, `agent/inbox/inserted`), verified against **dsh rc.6 (2026-08)**. After a dsh upgrade, use the [Diagnostics](#diagnostics) section to self-check.

---

## ✨ Features

- **📎 One-click pick**: a 📎 button in the composer tool row opens the native Windows file dialog — no more hand-typing paths.
- **📂 Any folder**: browse and pick files **outside the workspace** from anywhere on disk. The `read` tool has no sandbox restriction on absolute paths; this plugin supplies the missing UI entry.
- **🗂️ Multi-select**: pick several files at once; all land in the attachment rail and ride one message.
- **🎴 Attachment card rail**: each file shows an icon + filename + containing folder, removable with ×. Removal syncs to the host immediately — nothing lingers.
- **🧹 Clean composer**: paths are **never written into the draft or the message text** — the composer content is completely untouched. This is the key difference from "paste paths into the input" style plugins.
- **📨 Rides your message**: the paths arrive as a "Context injection" context message in the **same turn** as your next message, covering typed prompts, slash commands, steer, and image-only sends alike.
- **📖 Agent reads by path**: the agent sees the absolute path list in context and reads the files with the existing `read` tool — the plugin itself never reads or uploads file contents.

## Requirements

| Item | Requirement |
|---|---|
| dsh | `0.1.0-rc.x` (verified on `0.1.0-rc.6`), `web` profile |
| OS | **Windows** (native dialog via PowerShell 7 + WinForms) |
| PowerShell | `pwsh` 7.x on PATH |
| Runtime deps | `@deepseek-ai/cordis`, `@deepseek-ai/dsh-llm`, `@deepseek-ai/dsh-client-runtime`, `@deepseek-ai/dsh-client-ui-*`, `react` — all peerDependencies, provided by the dsh host, nothing to install manually |

## Install

```bash
# Option 1: npm package (recommended)
dsh plugin --profile web add @jackeywilder/dsh-file-picker

# Option 2: GitHub repository
dsh plugin --profile web add git+https://github.com/JackeyWilder/dsh-file-picker.git

# Option 3: local link (development)
dsh plugin --profile web add link:"<path-to-this-package>"
```

> After installing, **fully quit dsh (launcher / tray / web process) and restart** so both the host and the browser load the new bundle; hard-refresh the browser (Ctrl+Shift+R) once if needed.

## Usage

1. Click the **📎** button in the composer tool row.
2. The native Windows file dialog opens — browse and multi-select files (the dialog remembers the last folder and reopens there next time).
3. Click "Open" — an **attachment card rail** appears above the input (📄/📁/🖼️/🗜️ icon + filename + containing folder + × remove), with the hint "sent with the next message".
4. **Send normally from the main composer** — the host detects the message entering the session, injects the staged absolute paths into the session context first, then the message goes through; the rail clears itself after the send.
5. A **"Context injection"** row appears in the conversation (files attached, read as needed + the absolute path list); the agent reads the files with the `read` tool and carries out your instruction.

## How it works

### Host half (Node process)

- **Routes**: `POST /api/dsh-file-picker/native-pick` (spawns pwsh to show the native dialog), `POST /api/dsh-file-picker/stage` (stage/replace the file list), `POST /api/dsh-file-picker/unstage` (clear the staged list), `GET /api/dsh-file-picker/status` (diagnostics).
- **Send signal**: listens to the agent-scoped event **`agent/inbox/inserted`** — a real user message (`source.kind === 'user'`) entering the session's inbox is the reliable "send accepted" signal, covering every send path (typed, slash, steer, image-only).
- **Injection**: `agent.inject(createUserMessage({ source: { kind: 'plugin', plugin: 'dsh-file-picker', form: 'notice', summary }, content: [path list] }))` — queues the paths as model context for the same turn's pre-step, so they arrive with the message that just went out.

### Client half (dsh web)

- **Entry**: a 📎 button (`FilePickerButton`) registered in the `conversation.input.left` slot; calls `/native-pick` on click.
- **Card rail**: the attachment cards (`AttachmentRail`) registered in the `conversation.input.dock` slot, state managed with `useSyncExternalStore`; on every add/remove the current list is mirrored to the host via `/stage` (added) or `/unstage` (cleared), so the host always mirrors what the user sees.
- **Auto-clear**: watches the conversation node count with the framework-standard `useSession` hook — once the message lands (host has injected by then) the rail clears itself, so the same batch never rides a second message.

### How file paths reach the model

```
pick files ──POST /stage──▶ host staging table (not the draft, not the message text)
user sends ──────────────▶ agent/inbox/inserted (kind=user)
                              │ host finds the staged list
                              ▼
                   agent.inject(path-list context message)
                              ▼
                  agent sees absolute paths in model context
                              ▼
                    read tool reads the file contents
```

## Diagnostics

- **Host log**: `<DSH_HOME>/logs/dsh-file-picker.log` (default `C:\Users\<you>\.dsh\logs\`), recording startup / staging / inbox-inserted / injection across the whole pipeline; rotates to `.log.1` past 1 MB; safe to delete at any time.
- **Status route**: `GET http://localhost:<dsh-port>/api/dsh-file-picker/status` returns the plugin version and the current staging table.
- **Troubleshooting**:
  - Log shows `inbox/inserted ... session=undefined` → the host is running an old bundle; fully quit dsh and restart.
  - Log shows `injected N file(s)` but no "Context injection" row → the browser cached the old client bundle; hard-refresh.
  - Full paths missing from the log → expected: logs are redacted by default (privacy default); set `DSH_FILE_PICKER_DEBUG=1` to log full paths.

## Known limitations

- **Windows only**: the native dialog is built on pwsh + WinForms; no macOS/Linux support yet (PRs welcome).
- **No drag-and-drop yet**: files are picked via the 📎 button only; coexists with drag-and-drop style plugins.
- **Rail renders above the input**: dsh has no attachment slot inside the textarea, so the rail lives in `conversation.input.dock`.
- **Semi-public APIs**: `agent.inject` / `agent/inbox/inserted` may change on dsh upgrades; self-check with [Diagnostics](#diagnostics) after upgrading.

## Development

```bash
pnpm install && pnpm build
npx vitest run
```

- Dual-entry build: host side `lib/index.js` (ESM) + browser side `lib/client.js` (CJS closure wrapped in `__ModuleLoader__.load`).
- `pnpm watch` for incremental builds; restart dsh to verify changes.
- Tests: `tests/` cover the card store, path redaction, injection text, the loopback fence, and the pwsh script/output parsing (all mocked — no real pwsh needed).

## Security

- **Trust fence**: every host route accepts loopback requests only (`isLoopbackRequest` checks remoteAddress / Host / sec-fetch-site / Origin, modeled after dsh-ssh).
- **Read-only capability**: provides native file *picking* only — never reads file contents, never writes files; the agent reads contents via the existing `read` tool.
- **No sidecar residue**: pwsh runs the dialog script inline via `-EncodedCommand` (UTF-16LE Base64) — no temp script files; the process is killed once the dialog closes (resolve-on-output + kill).
- **Injection surface closed**: `initialDir` is single-quote escaped + checked with `Test-Path -LiteralPath`; no injection vector.

## Privacy & data flow

- Picked file paths are **processed locally only**: the browser POSTs them to the local host process (`127.0.0.1`, loopback-only); nothing leaves the machine, and the plugin never reads or uploads file contents.
- Once injected, the paths are **visible to the agent, which may read the files** — that is the point of the plugin, so don't attach confidential files.
- The diagnostic log **records redacted paths by default** (drive + `...` + basename, e.g. `G:\...\README.md`); set the environment variable `DSH_FILE_PICKER_DEBUG=1` for full paths. The log rotates at 1 MB and can be deleted anytime.

## Comparison with similar plugins

| Plugin | Mechanism | Difference from this one |
|---|---|---|
| [lostpaidaxing/dsh-file-picker](https://github.com/lostpaidaxing/dsh-file-picker) | Native dialog → attachment cards → inject paths on send | Relies on `Agent.inject` + a `$DSH_HOME/uploads/attach-<sessionId>.txt` **sidecar file**; this plugin stages paths straight from the browser to the host (no sidecar residue, auto-clearing rail) |
| [omdsh-dev/dsh-at-file](https://github.com/omdsh-dev/dsh-at-file) | `@` search **inside the workspace**, `<workspace-reference>` refs into the message | Workspace-only; this plugin supports any file outside the workspace (native Windows dialog) |
| [omdsh-dev/dsh-drag-and-drop](https://github.com/omdsh-dev/dsh-drag-and-drop) | Drag & drop → path-location engine inserts real paths into the input | Paths land in the draft text; here paths never touch the draft or the message text — they arrive as a host-injected context message |

## Acknowledgements

- [lostpaidaxing/dsh-file-picker](https://github.com/lostpaidaxing/dsh-file-picker): the attachment card rail interaction model (icon + filename + × remove).
- [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)'s `dsh-ssh`: the loopback trust-fence (`isLoopbackRequest`) pattern.

## License

MIT © 2026 JackeyWilder
