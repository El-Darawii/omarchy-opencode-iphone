# Opencode iPhone Notify

Free iPhone push notifications for [opencode](https://opencode.ai) on Omarchy:
get pinged when a task finishes, when opencode needs approval, or when it
asks you a question — even when you're away from your desk.

Free, no account, no API keys. Push goes through [ntfy.sh](https://ntfy.sh),
which relays to Apple's push network via the ntfy iOS app.

## How it works

```
opencode event → opencode plugin (fetch POST) → ntfy.sh → Apple Push → iPhone
                                            ↘ omarchy desktop toast + sound
```

This repo is an **Omarchy shell plugin** (`service` kind) that owns the
shared topic file, plus a **drop-in opencode plugin** that does the pushing.

| Path | What |
| --- | --- |
| `manifest.json` / `Service.qml` | Omarchy service: owns `~/.config/opencode-iphone/topic`, exposes `omarchy-shell opencodeIphone …` IPC |
| `bin/opencode-iphone-send` | CLI sender + tester (reads the same topic file) |
| `opencode-plugin/notify-iphone.ts` | Drop-in opencode plugin: `session.idle`, `permission.asked`, `question.asked` |

Topic resolution everywhere: `$NTFY_TOPIC` → `~/.config/opencode-iphone/topic`.

## Install

### 1. iPhone (once, 1 minute)

1. Install **ntfy** from the App Store.
2. Tap **+ Subscribe to topic**, enter your topic name
   (find it with `bin/opencode-iphone-send --topic` after step 2).
3. Allow notifications. For approvals that punch through Focus/mute, set the
   ntfy subscription to **Time Sensitive** — permission/question pushes send
   at max priority.

> Anyone who guesses your topic can read/send to it. The generated default
> (`opencode-iphone-<16 hex chars>`) is unguessable — treat it like a password.

### 2. Omarchy plugin

```bash
omarchy plugin add https://github.com/<you>/omarchy-opencode-iphone.git --enable
```

By hand:

```bash
cp -r . ~/.config/omarchy/plugins/darawi.opencode-iphone
omarchy-shell shell rescanPlugins
omarchy plugin enable darawi.opencode-iphone
```

First load creates `~/.config/opencode-iphone/topic` with a random topic.

### 3. Opencode plugin

```bash
cp opencode-plugin/notify-iphone.ts ~/.config/opencode/plugins/
# restart opencode — config loads once at startup
```

### 4. Test

```bash
bin/opencode-iphone-send --test
omarchy-shell opencodeIphone test
```

Your iPhone should show **opencode: test** within seconds.

## Events

| Opencode event | iPhone title | Priority |
| --- | --- | --- |
| `session.idle` (task done) | opencode: task done | default |
| `permission.asked` / `permission.ask` | opencode: approval needed | max |
| `question.asked` / `question` tool | opencode: question for you | max |

Desktop Omarchy toasts + sound still fire alongside. Set
`OPENCODE_IPHONE_DESKTOP=0` in your shell profile for iPhone-only.

Done-pings are throttled to one per 4 s; subagent chatter is collapsed via
the `session.status` busy-set so you only get pinged when *everything* is idle.

## Publishing checklist (plugins.omarchy.org)

- [ ] `omarchy plugin validate ./` passes (exit 0, no output)
- [ ] No symlinks in the folder, `Service.qml` exists, id is not `omarchy.*`
- [ ] Push to a public GitHub repo with this `manifest.json` at root
- [ ] Submit at https://plugins.omarchy.org/publish.html — automated checks
      run against your current commit before a maintainer approves

## License

MIT — see `LICENSE`.
