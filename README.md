# Opencode iPhone Notify

Free iPhone push notifications for [opencode](https://opencode.ai) on Omarchy:
get pinged when a task finishes, when opencode needs approval, or when it
asks you a question — even when you're away from your desk.

No account, no API keys. Push goes through [ntfy](https://ntfy.sh), which
relays to Apple's push network via the ntfy iOS app.

## How it works

```
opencode event → opencode plugin (fetch POST) → ntfy → Apple Push → iPhone
                                            ↘ omarchy desktop toast + sound
```

This repo is an **Omarchy shell plugin** (`service` kind) that owns the shared
topic file, plus a **drop-in opencode plugin** that does the pushing.

| Path | What |
| --- | --- |
| `manifest.json` / `Service.qml` | Omarchy service: owns `~/.config/opencode-iphone/topic`, exposes `omarchy-shell opencodeIphone …` IPC |
| `bin/opencode-iphone-send` | CLI sender + tester (reads the same topic file) |
| `opencode-plugin/notify-iphone.ts` | Drop-in opencode plugin: `session.idle`, `permission.asked`, `question.asked` |

Resolution everywhere:

| Setting | Default | Override with |
| --- | --- | --- |
| Push server | `https://ntfy.sh` | `NTFY_BASE` (self-hosted ntfy) |
| Topic | `~/.config/opencode-iphone/topic` | `NTFY_TOPIC` |

## Install

### 1. iPhone (once, 1 minute)

1. Install **ntfy** from the App Store.
2. Tap **+ Subscribe to topic**, enter your topic name
   (find it with the `--topic` command in step 4).
3. Allow notifications. For approvals that punch through Focus/mute, set the
   ntfy subscription to **Time Sensitive** — permission/question pushes send
   at max priority.

> Anyone who guesses your topic can read/send to it. The generated default
> (`opencode-iphone-<16 hex chars>`) is unguessable — treat it like a password.

### 2. Omarchy plugin

```bash
omarchy plugin add https://github.com/El-Darawii/omarchy-opencode-iphone.git --enable
```

By hand:

```bash
cp -r . ~/.config/omarchy/plugins/io.github.eldarawii.opencode-iphone
omarchy-shell shell rescanPlugins
omarchy plugin enable io.github.eldarawii.opencode-iphone
```

First load creates `~/.config/opencode-iphone/topic` with a random topic.

### 3. Opencode plugin

```bash
cp opencode-plugin/notify-iphone.ts ~/.config/opencode/plugins/
# restart opencode — config loads once at startup
```

### 4. Test

```bash
# topic your iPhone subscribed to
~/.config/omarchy/plugins/io.github.eldarawii.opencode-iphone/bin/opencode-iphone-send --topic

# send one
~/.config/omarchy/plugins/io.github.eldarawii.opencode-iphone/bin/opencode-iphone-send --test
# or drive the shell IPC directly
omarchy-shell opencodeIphone test
```

Your iPhone should show **opencode: test** within seconds.

To keep the CLI handy, add it to `PATH`:

```bash
export PATH="$HOME/.config/omarchy/plugins/io.github.eldarawii.opencode-iphone/bin:$PATH"
```

## Events

| Opencode event | iPhone title | Priority |
| --- | --- | --- |
| `session.idle` (task done) | opencode: task done | default |
| `permission.asked` / `permission.ask` | opencode: approval needed | max |
| privilege prompt (`sudo`, `pkexec`, …) | opencode: sudo approval needed 🚨 | max |
| `question.asked` / `question` tool | opencode: question for you | max |

## Privilege gate (sudo / pkexec)

Pair this plugin with ask-rules so privilege escalation always prompts
(and therefore always pushes). In `~/.config/opencode/opencode.json`:

```json
{
  "permission": {
    "bash": {
      "*": "allow",
      "sudo": "ask",
      "sudo *": "ask",
      "sudoedit": "ask",
      "sudoedit *": "ask",
      "pkexec": "ask",
      "pkexec *": "ask",
      "doas": "ask",
      "doas *": "ask",
      "su": "ask",
      "su *": "ask",
      "run0": "ask",
      "run0 *": "ask"
    }
  }
}
```

Put `"*": "allow"` first — opencode evaluates the **last** matching rule,
so narrow rules go last. Restart opencode after editing.

Security note: the plugin only forces the approval dialog and labels the
push. It never sees, asks for, or handles passwords — root authentication
stays entirely between you and your terminal (sudo) or system dialog
(polkit).

Desktop Omarchy toasts + sound still fire alongside. Set
`OPENCODE_IPHONE_DESKTOP=0` in your shell profile for iPhone-only.

## Dependencies and privacy

Nothing to install on Linux beyond the Omarchy plugin itself; the plugin shells
out to `curl` and `openssl` (both already present on Omarchy) and the opencode
plugin uses Bun/Node's built-in `fetch`.

Pushes are relayed through **ntfy.sh**, a free public server, unless you set
`NTFY_BASE` to a server you control:

```bash
export NTFY_BASE="https://ntfy.example.com"
```

With the public relay, notification titles and bodies pass through ntfy's
servers in plain text — they are not end-to-end encrypted. Keep task content
out of them if that matters, or self-host ntfy. The topic name is the only
secret; with a self-hosted server it is also the only credential.

The plugin writes only its own state file (`~/.config/opencode-iphone/topic`)
and never edits your shell, Hyprland, or opencode configuration.

## Debugging

```bash
export OPENCODE_IPHONE_DEBUG=1
# restart opencode, reproduce, then:
cat /tmp/opencode-iphone-debug.log
```

Traces every bus event, hook call and push result (HTTP status or error).

Done-pings are throttled to one per 4 s; subagent chatter is collapsed via
the `session.status` busy-set so you only get pinged when *everything* is idle.

## Remove

```bash
omarchy plugin remove io.github.eldarawii.opencode-iphone
rm -f ~/.config/opencode/plugins/notify-iphone.ts
rm -rf ~/.config/opencode-iphone   # optional: drops your topic file
```

Removing the shell plugin disables its IPC sender; the opencode plugin keeps
working on its own as long as it can read the topic file. Restart opencode
after deleting `notify-iphone.ts`.

## License

MIT — see `LICENSE`.