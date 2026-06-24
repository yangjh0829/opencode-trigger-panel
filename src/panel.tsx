/** @jsxImportSource @opentui/solid */

import type { JSX } from "@opentui/solid"
import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import { createSignal, createMemo, Show, onMount, onCleanup } from "solid-js"
import type { TriggerRule } from "./triggers"
import { getPalette, truncateVisual } from "./theme"
import { getStrings, getLang, type Strings } from "./i18n"

interface LoadedSkill {
  name: string
  tokens: number
}

interface PanelProps {
  theme: Record<string, unknown>
  rules: () => TriggerRule[]
  open: () => boolean
  setOpen: (v: boolean) => void
  api: TuiPluginApi
  sessionId: string
}

// 鈹€鈹€ Extract skill name from a tool part 鈹€鈹€
function extractSkillName(tp: any): string | null {
  let name: string | undefined = tp.state?.metadata?.name ?? tp.metadata?.name
  if (typeof name !== "string") {
    const output = typeof tp.state?.output === "string" ? tp.state.output : ""
    const m = output.match(/^#{1,2}\s*Skill:\s*(.+)/m)
    if (m) name = m[1].trim()
  }
  if (typeof name !== "string") {
    const title = typeof tp.state?.title === "string" ? tp.state.title : ""
    if (title) name = title.replace(/^skill:\s*/i, "").trim()
  }
  return typeof name === "string" && name ? name : null
}

export function TriggerPanel(props: PanelProps): JSX.Element {
  const [panelWidth, setPanelWidth] = createSignal(28)
  const [skillsOpen, setSkillsOpen] = createSignal(true)
  const [loadedSkills, setLoadedSkills] = createSignal<LoadedSkill[]>([])
  const t: Strings = getStrings(getLang())
  let boxEl: any

  const pal = createMemo(() => getPalette(props.theme))
  const sep = createMemo(() =>
    "\u2500".repeat(Math.max(1, panelWidth() - 6)),
  )

  // 鈹€鈹€ Incremental loaded-skills scan 鈹€鈹€
  const scannedIds = new Set<string>()
  const foundSkills = new Map<string, LoadedSkill>()

  function scanNewMessages() {
    // Skip when panel collapsed
    if (!props.open()) return

    try {
      const sid = props.sessionId
      const msgs = props.api.state.session.messages(sid)
      let changed = false

      for (const msg of msgs) {
        if (scannedIds.has(msg.id)) continue
        scannedIds.add(msg.id)

        if (msg.role !== "assistant") continue
        let parts: readonly any[] = []
        try { parts = props.api.state.part(msg.id) } catch { continue }

        for (const p of parts) {
          if (p.type !== "tool") continue
          const tp = p as any
          if (tp.tool !== "skill") continue
          if (tp.state?.status !== "completed") continue

          const name = extractSkillName(tp)
          if (!name) continue

          const output = typeof tp.state?.output === "string" ? tp.state.output : ""
          const tokens = output ? Math.ceil(output.length / 3.5) : 0
          const existing = foundSkills.get(name)
          if (!existing || existing.tokens < tokens) {
            foundSkills.set(name, { name, tokens })
            changed = true
          }
        }
      }

      if (changed) {
        setLoadedSkills([...foundSkills.values()])
      }
    } catch {
      // session state not ready
    }
  }

  // 鈹€鈹€ Debounced event listener (200ms) 鈹€鈹€
  onMount(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const debouncedScan = () => {
      clearTimeout(timer)
      timer = setTimeout(scanNewMessages, 200)
    }
    // Only listen to message.updated (not message.part.updated)
    const unsub = props.api.event.on("message.updated", debouncedScan)
    // Initial scan
    setTimeout(scanNewMessages, 300)
    onCleanup(() => { clearTimeout(timer); unsub() })
  })

  return (
    <box
      border={true}
      borderColor={pal().border}
      paddingLeft={2}
      paddingRight={2}
      flexDirection="column"
      gap={0}
      ref={boxEl}
      onSizeChange={() => {
        if (boxEl && typeof boxEl.width === "number" && boxEl.width > 0)
          setPanelWidth(Math.max(20, boxEl.width))
      }}
    >
      <text onMouseUp={() => props.setOpen(!props.open())}>
        <span style={{ fg: pal().muted }}>
          {props.open() ? "\u25bc " : "\u25b6 "}
        </span>
        <span style={{ fg: pal().primary }}>
          <b>{t.title}</b>
        </span>
        <Show when={props.open()}>
          <span style={{ fg: pal().muted }}> ({props.rules().length})</span>
        </Show>
      </text>

      <Show when={props.open()}>
        <text fg={pal().muted}>{sep()}</text>

        <Show
          when={props.rules().length > 0}
          fallback={
            <text>
              <span style={{ fg: pal().muted }}>{t.empty}</span>
            </text>
          }
        >
          {props.rules().map((rule: TriggerRule) => (
            <>
              <text>
                <span style={{ fg: pal().text }}>
                  {rule.keywords.map(k => `[${k}]`).join(" ")}
                </span>
              </text>
              {rule.skills.map((s: string) => {
                const maxW = panelWidth() - 8
                return (
                  <text>
                    <span style={{ fg: pal().muted }}>  {"\u2192"} </span>
                    <span style={{ fg: pal().accent }}>
                      {truncateVisual(s, maxW)}
                    </span>
                  </text>
                )
              })}
              <text fg={pal().muted}>{sep()}</text>
            </>
          ))}
        </Show>

        {/* 鈹€鈹€ Loaded Skills section (always visible) 鈹€鈹€ */}
        <text
          onMouseUp={() => setSkillsOpen(!skillsOpen())}
        >
          <span style={{ fg: pal().muted }}>
            {skillsOpen() ? "\u25bc " : "\u25b6 "}
          </span>
          <span style={{ fg: pal().primary }}>
            <b>{"\u{1F4E6}"} {"\u5DF2\u52A0\u8F7D"} Skill</b>
          </span>
          <span style={{ fg: pal().muted }}>
            {" (" + loadedSkills().length + ")"}
          </span>
        </text>

        <Show when={skillsOpen()}>
          <Show when={loadedSkills().length === 0} fallback={
            <>
              {loadedSkills().map((sk: LoadedSkill) => {
                const maxName = Math.max(4, panelWidth() - 14)
                return (
                  <text>
                    <span style={{ fg: pal().accent }}>
                      {"  " + truncateVisual(sk.name, maxName)}
                    </span>
                    <Show when={sk.tokens > 0}>
                      <span style={{ fg: pal().muted }}>
                        {" \u00b7 " + (sk.tokens >= 1000
                          ? (sk.tokens / 1000).toFixed(1) + "K"
                          : sk.tokens) + " tok"}
                      </span>
                    </Show>
                  </text>
                )
              })}
            </>
          }>
            <text>
              <span style={{ fg: pal().muted }}>{"  \u672a\u8c03\u7528 skill"}</span>
            </text>
          </Show>
          <text fg={pal().muted}>{sep()}</text>
        </Show>

        <text>
          <span style={{ fg: pal().muted }}>{t.hint}</span>
        </text>
      </Show>
    </box>
  )
}
