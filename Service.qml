// darawi.opencode-iphone — free iPhone push for opencode via ntfy.sh.
//
// Companion to opencode-plugin/notify-iphone.ts (the opencode side, which
// does the actual per-event pushing). This service owns one thing: the
// shared topic file ~/.config/opencode-iphone/topic — created on first load
// with a random unguessable default — and exposes a shell-wide sender:
//
//   omarchy-shell opencodeIphone test
//   omarchy-shell opencodeIphone send "<title>" "<body>" [done|perm|question]
//   omarchy-shell opencodeIphone topic
//
// No account, no API keys. Install the "ntfy" app from the App Store on your
// iPhone and subscribe to the topic printed by the `topic` call above.

import QtQuick
import Quickshell
import Quickshell.Io

Scope {
  id: root

  // Injected by omarchy-shell.
  property var shell: null
  property var manifest: null
  property string omarchyPath: Quickshell.env("OMARCHY_PATH")

  readonly property string home: Quickshell.env("HOME")
  readonly property string configDir: home + "/.config/opencode-iphone/"
  readonly property string topicPath: configDir + "topic"
  readonly property string ntfyBase: "https://ntfy.sh/"

  property string topicName: ""

  function topicUrl() {
    return ntfyBase + topicName
  }

  // Fire-and-forget curl. Argv-based, no shell, so spaces/unicode in
  // titles and bodies are safe.
  function push(title, body, kind) {
    if (topicName === "") return
    var k = String(kind || "done")
    var priority = k === "done" ? "3" : "5"
    var tags = k === "done" ? "white_check_mark" : (k === "perm" ? "warning" : "question")
    Quickshell.execDetached([
      "curl", "-sS", "--max-time", "15",
      "-H", "Title: " + String(title || "opencode"),
      "-H", "Priority: " + priority,
      "-H", "Tags: " + tags,
      "-d", String(body || ""),
      topicUrl()
    ])
  }

  function test() {
    push("opencode: test", "iPhone push works — topic: " + topicName, "done")
  }

  IpcHandler {
    target: "opencodeIphone"
    function send(title: string, body: string, kind: string): void {
      root.push(title, body, kind)
    }
    function test(): void {
      root.test()
    }
    function topic(): string {
      return root.topicName
    }
  }

  // Create the topic file with a random default on first run, then read it
  // back. Single shot, quiet on failure — a missing topic just disables
  // pushing until the next shell start.
  Process {
    id: ensureTopic
    command: [
      "bash", "-lc",
      "d=\"$HOME/.config/opencode-iphone\"; mkdir -p \"$d\" 2>/dev/null; f=\"$d/topic\";"
      + " if [ ! -s \"$f\" ]; then printf 'opencode-iphone-%s' \"$(openssl rand -hex 8 2>/dev/null || echo $RANDOM$RANDOM)\" > \"$f\"; fi;"
      + " cat \"$f\" 2>/dev/null"
    ]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        root.topicName = String(text || "").trim()
      }
    }
  }

  Component.onCompleted: ensureTopic.running = true
}
