/** @jsxImportSource @opentui/solid */

import type { JSX } from "@opentui/solid"
import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import { createSignal, createMemo, Show, createEffect, onMount, onCleanup } from "solid-js"
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

export function TriggerPanel(props: PanelProps): JSX.Element {
  const [panelWidth, setPanelWidth] = createSignal(28)
  const [skillsOpen, setSkillsOpen] = createSignal(true)
  const [loadedSkills, setLoadedSkills] = createSignal<LoadedSkill[]>([])
  const [tick, setTick] = createSignal(0)
  const t: Strings = getStrings(getLang())
  let boxEl: any

  const pal = createMemo(() => getPalette(props.theme))
  const sep = createMemo(() =>
    "\u2500".repeat(Math.max(1, panelWidth() - 6)),
  )

  // ── detect loaded skills via session messages ──
  createEffect(() => {
    void tick()
    try {
      const sid = props.sessionId
      const msgs = props.api.state.session.messages(sid)
      const found = new Map<string, LoadedSkill>()

      for (const msg of msgs) {
        if (msg.role !== "assistant") continue
        let parts: readonly any[] = []
        try { parts = props.api.state.part(msg.id) } catch { continue }
        for (const p of parts) {
          if (p.type !== "tool") continue
          const tp = p as any
          if (tp.tool !== "skill") continue
          if (tp.state?.status !== "completed") continue

          let name: string | undefined =
            tp.state?.metadata?.name ??
            tp.metadata?.name

          if (typeof name !== "string") {
            const output = typeof tp.state?.output === "string"
              ? tp.state.output : ""
            const m = output.match(/^#{1,2}\s*Skill:\s*(.+)/m)
            if (m) name = m[1].trim()
          }

          if (typeof name !== "string") {
            const title = typeof tp.state?.title === "string"
              ? tp.state.title : ""
            if (title) name = title.replace(/^skill:\s*/i, "").trim()
          }

          if (typeof name === "string" && name) {
            const output = typeof tp.state?.output === "string"
              ? tp.state.output : ""
            const tokens = output
              ? Math.ceil(output.length / 3.5) : 0
            const existing = found.get(name)
            if (!existing || existing.tokens < tokens) {
              found.set(name, { name, tokens })
            }
          }
        }
      }

      setLoadedSkills([...found.values()])
    } catch {
      // session state not ready
    }
  })

  // ── listen for message updates to refresh ──
  onMount(() => {
    const unsub1 = props.api.event.on("message.updated", () =>
      setTick(v => v + 1),
    )
    const unsub2 = props.api.event.on("message.part.updated", () =>
      setTick(v => v + 1),
    )
    onCleanup(() => { unsub1(); unsub2() })
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

        {/* ── Loaded Skills section ── */}
        <Show when={loadedSkills().length > 0}>
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
            <text fg={pal().muted}>{sep()}</text>
          </Show>
        </Show>

        <text>
          <span style={{ fg: pal().muted }}>{t.hint}</span>
        </text>
      </Show>
    </box>
  )
}
