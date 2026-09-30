// notify-iphone.ts — drop-in opencode plugin: free iPhone push via ntfy.sh.
//
// Install: copy to ~/.config/opencode/plugins/ (global) or
// .opencode/plugins/ (per project), then restart opencode.
//
// iPhone setup (once): install "ntfy" from the App Store and subscribe to
// your topic. Find it with:  opencode-iphone-send --topic
// or:  cat ~/.config/opencode-iphone/topic
//
// Topic resolution: $NTFY_TOPIC > ~/.config/opencode-iphone/topic.
// (The darawi.opencode-iphone omarchy plugin owns that file and generates
// a random default on first load, so both sides always agree.)
//
// Pushes on:
//   session.idle       → task finished
//   permission.asked   → approval needed (also via the permission.ask hook)
//   question.asked     → opencode has a question (also via the question tool)
// Desktop omarchy notification + sound still fire alongside; set
// OPENCODE_IPHONE_DESKTOP=0 to make it iPhone-only.

import type { Plugin } from "@opencode-ai/plugin"
import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

const OMARCHY = "/usr/share/omarchy/bin/omarchy"
const PLAY = "/usr/bin/canberra-gtk-play"
const SOUND = "/usr/share/sounds/freedesktop/stereo/message-new-instant.oga"
const GLYPH = "\u{F17B}"
const DESKTOP = process.env.OPENCODE_IPHONE_DESKTOP !== "0"

function topic(): string {
  if (process.env.NTFY_TOPIC) return process.env.NTFY_TOPIC.trim()
  const home = process.env.HOME ?? ""
  const file = join(home, ".config", "opencode-iphone", "topic")
  try {
    if (home && existsSync(file)) {
      const t = readFileSync(file, "utf8").trim()
      if (t) return t
    }
  } catch {
    // fall through to empty — pushing is skipped, desktop still pings
  }
  return ""
}

function pushIphone(headline: string, kind: "done" | "perm" | "question") {
  const t = topic()
  if (!t) return
  const title =
    kind === "perm"
      ? "opencode: approval needed"
      : kind === "question"
        ? "opencode: question for you"
        : "opencode: task done"
  const priority = kind === "done" ? "3" : "5"
  const tags = kind === "done" ? "white_check_mark" : kind === "perm" ? "warning" : "question"
  // fire-and-forget, never block opencode
  fetch(`https://ntfy.sh/${t}`, {
    method: "POST",
    body: headline,
    headers: { Title: title, Priority: priority, Tags: tags },
  }).catch(() => {})
}

function desktop(replaceId: string, headline: string) {
  if (!DESKTOP) return
  const n = spawn(
    OMARCHY,
    ["notification", "send", "-r", replaceId, "--app-name", "opencode", "-g", GLYPH, "-u", "normal", "-t", "5000", "opencode", headline],
    { detached: true, stdio: "ignore" }
  )
  n.on("error", () => {})
  n.unref()
  const s = spawn(PLAY, ["--file", SOUND], { detached: true, stdio: "ignore" })
  s.on("error", () => {})
  s.unref()
}

let spin = 0
let lastPing = 0
const busy: Set<string> = new Set()

function pick(list: string[]): string {
  return list[spin++ % list.length]
}

function ping(replaceId: string, headline: string) {
  const now = Date.now()
  if (now - lastPing < 4000) return
  lastPing = now
  desktop(replaceId, headline)
  const kind = replaceId === "oc-perm" ? "perm" : replaceId === "oc-question" ? "question" : "done"
  pushIphone(headline, kind as "done" | "perm" | "question")
}

export default (async () => {
  return {
    event: async (input) => {
      const event: any = input.event
      const type = event?.type as string
      if (type === "session.status") {
        if (event.properties.status.type === "busy") {
          busy.add(event.properties.sessionID)
        } else if (event.properties.status.type === "idle") {
          busy.delete(event.properties.sessionID)
        }
        return
      }
      if (type === "permission.asked") {
        ping("oc-perm", pick(["your call", "approve?", "up to you", "you decide"]))
        return
      }
      if (type === "question.asked") {
        ping("oc-question", pick(["question for you", "need your take", "you're needed"]))
        return
      }
      if (type === "session.idle" && busy.size === 0) {
        ping("oc-done", pick(["your move", "you're up", "all yours", "take it away"]))
      }
    },
    "permission.ask": async () => {
      ping("oc-perm", pick(["your call", "approve?", "up to you", "you decide"]))
    },
    "tool.execute.before": async (input) => {
      if (input.tool === "question") {
        ping("oc-question", pick(["question for you", "need your take", "you're needed"]))
      }
    },
  }
}) satisfies Plugin
