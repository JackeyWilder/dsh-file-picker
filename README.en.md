# dsh-file-picker — pick files outside the workspace, inject paths with your message

[![Release v0.1.0](https://img.shields.io/badge/release-v0.1.0-5B4CF0?style=flat-square)](https://github.com/JackeyWilder/dsh-file-picker/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-0B7285?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?style=flat-square&logo=nodedotjs&logoColor=white)](package.json)
[![DSH profiles](https://img.shields.io/badge/DSH-Web-5B4CF0?style=flat-square)](cordis.patch.yml)

**Install:** `dsh plugin --profile web add @jackeywilder/dsh-file-picker`

**A DeepSeek Harness Web UI plugin: click 📎 to pick files anywhere on disk (including outside the workspace) with a native Windows dialog; the absolute paths ride your next message as a "Context injection" context message and the agent reads them with the existing `read` tool — paths never touch the draft or the message text, and the files never leave the machine.**

[English](README.en.md) | [中文](README.md)

## Why this exists

DSH's `read` tool has **no sandbox restriction on absolute paths** — an agent can technically read any file outside the workspace (governance docs like `G:\Dev\backend\Club\...`). But dsh web has no UI entry to get a path into the session quickly:

- The composer's "+" button is taken by the image-attachment pipeline (`dsh-attachment` supports images only), so it can't host a file entry;
- Hand-typing a full path is error-prone, especially long ones;
- Drag-and-drop in the browser never exposes the real filesystem path (browsers hide it for security — they only hand out a local file URI, and often nothing at all).

This plugin closes that gap: native file dialog → attachment card rail → the host injects the absolute path list into the session context on send, and the agent reads the files with the existing `read` tool. **The files never leave their directory** — no reading, uploading, copying, or moving by the plugin.

## ✨ Features

- **📎 One-click pick**: a 📎 button in the composer tool row opens the native Windows file dialog.
- **📂 Any folder**: browse and pick files **outside the workspace** from anywhere on disk, multi-select supported.
- **🎴 Attachment card rail**: each file shows an icon + filename + containing folder, removable with ×; removal syncs to the host immediately — nothing lingers.
- **🧹 Clean composer**: paths are **never written into the draft or the message text** — the key difference from "paste paths into the input" style plugins.
- **📨 Rides your message**: the paths arrive as a "Context injection" context message in the **same turn** as your next message, covering typed prompts, slash commands, steer, and image-only sends alike.
- **📖 Agent reads by path**: the agent sees the absolute path list in context and reads the files with the existing `read` tool.
- **🔒 Processed locally**: paths flow only through the local host process (loopback-only), never over any external network.

## Requirements

| Item | Requirement |
|---|---|
| dsh | `0.1.0-rc.x` (verified on `0.1.0-rc.6`), `web` profile |
| OS | **Windows** (native dialog via PowerShell 7 + WinForms) |
| PowerShell | `pwsh` 7.x on PATH |
| Runtime deps | `@deepseek-ai/cordis`, `@deepseek-ai/dsh-llm`, `@deepseek-ai/dsh-client-runtime`, `@deepseek-ai/dsh-client-ui-*`, `react` — all peerDependencies, provided by the dsh host, nothing to install manually |

## Install

The plugin is a dsh **bundle** (`package.json` declares `dsh.bundle` + `dsh.client`), installed with the standard `dsh plugin` mechanism into the `web` profile — **no DSH source changes and no config.yaml needed**:

```sh
dsh plugin --profile web add @jackeywilder/dsh-file-picker
# or from the GitHub repository:
dsh plugin --profile web add git+https://github.com/JackeyWilder/dsh-file-picker.git
# or from a local checkout (development):
dsh plugin --profile web add link:"<path-to-this-package>"
```

After installing, **fully quit dsh (launcher / tray / web process) and restart**, then hard-refresh the browser (Ctrl+Shift+R) once — the client bundle only loads on a fresh page load with the plugin in the browser boot manifest (`__DSH_BOOT__`).

### Upgrade

```sh
dsh plugin --profile web update @jackeywilder/dsh-file-picker
```

For a local `link:` installation, run `add` again against the replacement checkout.

### Uninstall

```sh
dsh plugin --profile web remove @jackeywilder/dsh-file-picker
```

After uninstalling, restart the Web UI and hard-refresh the browser.

## Usage

1. Click the **📎** button in the composer tool row.
2. The native Windows file dialog opens — browse and multi-select files (the dialog remembers the last folder and reopens there next time).
3. Click "Open" — an **attachment card rail** appears above the input (📄/📁/🖼️/🗜️ icon + filename + containing folder + × remove), with the hint "sent with the next message".
4. **Send normally from the main composer** — the host detects the message entering the session, injects the staged absolute paths into the session context first, then the message goes through; the rail clears itself after the send.
5. A **"Context injection"** row appears in the conversation (files attached, read as needed + the absolute path list); the agent reads the files with the `read` tool and carries out your instruction.

## How it works

### Host half (Node process)

1. **Routes**: `POST /api/dsh-file-picker/native-pick` (spawns pwsh to show the native dialog), `POST /api/dsh-file-picker/stage` (stage/replace the file list), `POST /api/dsh-file-picker/unstage` (clear the staged list), `GET /api/dsh-file-picker/status` (diagnostics).
2. **Send signal**: listens to the agent-scoped event **`agent/inbox/inserted`** — a real user message (`source.kind === 'user'`) entering the session's inbox is the reliable "send accepted" signal, covering every send path.
3. **Injection**: `agent.inject(createUserMessage({ source: { kind: 'plugin', plugin: 'dsh-file-picker', form: 'notice', summary }, content: [path list] }))` — queues the paths as model context for the same turn's pre-step, so they arrive with the message that just went out.

### Client half (dsh web)

1. **Entry**: a 📎 button (`FilePickerButton`) registered in the `conversation.input.left` slot; calls `/native-pick` on click.
2. **Card rail**: the attachment cards (`AttachmentRail`) registered in the `conversation.input.dock` slot, state managed with `useSyncExternalStore`; on every add/remove the current list is mirrored to the host via `/stage` / `/unstage`, so the host always mirrors what the user sees.
3. **Auto-clear**: watches the conversation node count with the framework-standard `useSession` hook — once the message lands (host has injected by then) the rail clears itself, so the same batch never rides a second message.

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

## Troubleshooting

| Symptom | Resolution |
| --- | --- |
| No "Context injection" row after sending, but the log shows `injected N file(s)` | The browser cached the old client bundle — hard-refresh (Ctrl+Shift+R) and retry |
| Log shows `inbox/inserted ... session=undefined` | The host is running an old bundle — fully quit dsh (including launcher/tray) and restart |
| The card rail does not appear | Verify the bundle is in the profile (`dsh --profile web --dump-config \| grep dsh-file-picker`); restart the Web UI + hard-refresh after installing |
| The dialog does not open / spins forever | `pwsh` is missing from PATH or too old — confirm pwsh 7.x works; restart dsh and retry |
| Full paths missing from the log | Expected: logs are redacted by default (privacy default); set `DSH_FILE_PICKER_DEBUG=1` for full paths |
| Multiple duplicate cards for one selection | An old-version bug fixed in 0.1.0 — upgrade the plugin and restart |
| Plugin does not load after install | Restart the Web UI and hard-refresh — the client bundle only loads on a fresh page load with the plugin in `__DSH_BOOT__` |

## Known limitations

- **Windows only**: the native dialog is built on pwsh + WinForms; no macOS/Linux support yet (PRs welcome, see [Platform notes](#platform-notes)).
- **No drag-and-drop yet**: files are picked via the 📎 button only; coexists with drag-and-drop style plugins.
- **Rail renders above the input**: dsh has no attachment slot inside the textarea, so the rail lives in `conversation.input.dock`.
- **Semi-public APIs**: `agent.inject` / `agent/inbox/inserted` may change on dsh upgrades; self-check with [Troubleshooting](#troubleshooting) after upgrading.

## Development and verification

```sh
pnpm install
pnpm build       # dual entry: lib/index.js (host ESM) + lib/client.js (browser CJS closure)
npx vitest run   # tests
npx tsc --noEmit # type check
```

Repository layout:

- `src/` — host (node) half: native dialog (pwsh spawn), stage/unstage/status routes, loopback trust fence, inbox-inserted injection
- `src/client/` — browser half: 📎 button, attachment card rail (`useSyncExternalStore`), conversation-node watcher that clears the rail
- `tests/` — vitest suites: card store, path redaction, injection text, fence, pwsh script and output parsing (all mocked — no real pwsh needed)
- `lib/` — build output, **not committed** (built by CI; shipped in the published package)

## Security

- **Trust fence**: every host route accepts loopback requests only (`isLoopbackRequest` checks remoteAddress / Host / sec-fetch-site / Origin, modeled after dsh-ssh).
- **Read-only capability**: provides native file *picking* only — never reads file contents, never writes files; the agent reads contents via the existing `read` tool.
- **No sidecar residue**: pwsh runs the dialog script inline via `-EncodedCommand` (UTF-16LE Base64) — no temp script files; the process is killed once the dialog closes (resolve-on-output + kill).
- **Injection surface closed**: `initialDir` is single-quote escaped + checked with `Test-Path -LiteralPath`; no injection vector.

## Privacy & file access

The plugin **never**:

- uploads files
- copies files
- moves files
- modifies files
- deletes files
- transmits path data outside the machine

Data flow: the browser POSTs the picked paths to the **local host process** (`127.0.0.1`, loopback-only) → the host stages them → on inbox insert `agent.inject` injects them → the agent reads the files with `read`. Once injected, the paths are **visible to the agent, which may read the files** — that is the point of the plugin, so don't attach confidential files.

The diagnostic log (`<DSH_HOME>/logs/dsh-file-picker.log`, default `C:\Users\<you>\.dsh\logs\`) **records redacted paths by default** (drive + `...` + basename, e.g. `G:\...\README.md`); set `DSH_FILE_PICKER_DEBUG=1` for full paths. The log rotates at 1 MB (`.log.1`) and can be deleted anytime.

## Platform notes

### Windows

✅ Supported. Native file dialog (PowerShell 7 + WinForms), any folder, multi-select, remembers the last folder. Nothing extra to install (pwsh from the system is enough).

### macOS

❌ Not supported yet. The native dialog is built on Windows Forms and has no macOS implementation. PRs welcome (see the osascript approach in dsh-at-file / chituai).

### Linux

❌ Not supported yet. Same as above — no Linux implementation of the native dialog. PRs welcome (see chituai's zenity approach).

## Comparison with similar plugins

| Plugin | Mechanism | Difference from this one |
|---|---|---|
| [lostpaidaxing/dsh-file-picker](https://github.com/lostpaidaxing/dsh-file-picker) | Native dialog → attachment cards → inject paths on send | Relies on `Agent.inject` + a `$DSH_HOME/uploads/attach-<sessionId>.txt` **sidecar file**; this plugin stages paths straight from the browser to the host (no sidecar residue, auto-clearing rail) |
| [omdsh-dev/dsh-at-file](https://github.com/omdsh-dev/dsh-at-file) | `@` search **inside the workspace**, `<workspace-reference>` refs into the message | Workspace-only; this plugin supports any file outside the workspace (native Windows dialog) |
| [omdsh-dev/dsh-drag-and-drop](https://github.com/omdsh-dev/dsh-drag-and-drop) | Drag & drop → path-location engine inserts real paths into the input | Paths land in the draft text; here paths never touch the draft or the message text — they arrive as a host-injected context message |

## Community

- Use [GitHub Issues](https://github.com/JackeyWilder/dsh-file-picker/issues) for reproducible bugs, focused feature requests, and usage questions.

## Acknowledgements

- [lostpaidaxing/dsh-file-picker](https://github.com/lostpaidaxing/dsh-file-picker): the attachment card rail interaction model (icon + filename + × remove).
- [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)'s `dsh-ssh`: the loopback trust-fence (`isLoopbackRequest`) pattern.

## License

[MIT](https://opensource.org/licenses/MIT) © 2026 JackeyWilder
