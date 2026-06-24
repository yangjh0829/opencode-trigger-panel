/** @jsxImportSource @opentui/solid */

import type { JSX } from "@opentui/solid"
import type {
  TuiPlugin, TuiPluginApi, TuiSlotContext,
  TuiPluginModule,
} from "@opencode-ai/plugin/tui"
import { createSignal } from "solid-js"
import { TriggerPanel } from "./panel"
import { addRuleFlow, editRuleFlow, removeRuleFlow } from "./dialogs"
import { loadTriggers, matchTriggers, TriggerRule } from "./triggers"

const KV_PREFIX = "trigger_panel"

const tui: TuiPlugin = async (api: TuiPluginApi) => {
  const [rules, setRules] = createSignal<TriggerRule[]>(
    loadTriggers().triggers,
  )
  const [open, setOpen] = createSignal(
    Boolean(api.kv.get(`${KV_PREFIX}.open`, true)),
  )

  const refresh = () => setRules(loadTriggers().triggers)
  const togglePanel = () => {
    const v = !open()
    api.kv.set(`${KV_PREFIX}.open`, v)
    setOpen(v)
  }

  const projectDir = api.state.path.directory

  // 鈹€鈹€ Auto keyword match 鈫?toast on every user message 鈹€鈹€
  let currentSessionId = ""
  let lastProcessedMsgId = ""

  api.event.on("message.updated", () => {
    try {
      if (!currentSessionId) return
      const msgs = api.state.session.messages(currentSessionId)
      for (let i = msgs.length - 1; i >= 0; i--) {
        const msg = msgs[i]
        if (msg.role !== "user") continue
        if (msg.id === lastProcessedMsgId) break

        const parts = api.state.part(msg.id) as readonly any[]
        let text = ""
        for (const p of parts) {
          if (p.type === "text" && !p.synthetic && !p.ignored)
            text += p.text || ""
        }

        if (text.trim()) {
          const matches = matchTriggers(text)
          if (matches.length > 0) {
            const allSkills = [...new Set(matches.flatMap(r => r.skills))]
            const matchedKw = matches
              .flatMap(r => r.keywords.filter(k =>
                text.toLowerCase().includes(k.toLowerCase()),
              ))
            api.ui.toast({
              title: `\u{1F3AF} \u5339\u914D \u2192 ${allSkills.join(", ")}`,
              message: `[${matchedKw.join(", ")}]`,
              duration: 5000,
            })
          }
        }

        lastProcessedMsgId = msg.id
        break
      }
    } catch {
      // session state not ready
    }
  })

  api.slots.register({
    order: 60,
    slots: {
      sidebar_content(
        ctx: TuiSlotContext,
        input: { session_id: string },
      ): JSX.Element {
        currentSessionId = input.session_id
        return (
          <TriggerPanel
            theme={ctx.theme.current as Record<string, unknown>}
            rules={rules}
            open={open}
            setOpen={setOpen}
            api={api}
            sessionId={input.session_id}
          />
        )
      },
    },
  })

  api.command?.register(() => [
    {
      title: "Trigger: Toggle Panel",
      value: "trigger.config",
      description: "鏄剧ず/闅愯棌鍏抽敭璇嶈Е鍙戝櫒闈㈡澘",
      slash: { name: "trigger-config" },
      onSelect: (dialog) => {
        togglePanel()
        dialog?.clear()
      },
    },
    {
      title: "Trigger: Add Rule",
      value: "trigger.add",
      description: "娣诲姞鍏抽敭璇嶈Е鍙戣鍒?,
      slash: { name: "trigger-add" },
      onSelect: (dialog) => {
        if (!dialog) return
        addRuleFlow(api, dialog, refresh, projectDir)
      },
    },
    {
      title: "Trigger: Edit Rule",
      value: "trigger.edit",
      description: "缂栬緫鍏抽敭璇嶈Е鍙戣鍒?,
      slash: { name: "trigger-edit" },
      onSelect: (dialog) => {
        if (!dialog) return
        editRuleFlow(api, dialog, refresh, projectDir)
      },
    },
    {
      title: "Trigger: Remove Rule",
      value: "trigger.remove",
      description: "鍒犻櫎鍏抽敭璇嶈Е鍙戣鍒?,
      slash: { name: "trigger-remove" },
      onSelect: (dialog) => {
        if (!dialog) return
        removeRuleFlow(api, dialog, refresh)
      },
    },
    {
      title: "Trigger: List Rules",
      value: "trigger.list",
      description: "鏌ョ湅鎵€鏈夎Е鍙戣鍒?,
      slash: { name: "trigger-list" },
      onSelect: (dialog) => {
        const config = loadTriggers()
        if (config.triggers.length === 0) {
          api.ui.toast({ message: "鏆傛棤瑙勫垯", variant: "info" })
        } else {
          const summary = config.triggers
            .map((r, i) =>
              `${i + 1}. [${r.keywords.join(", ")}] \u2192 ${r.skills.join(", ")}`,
            )
            .join("\n")
          api.ui.toast({
            title: `瑙﹀彂瑙勫垯 (${config.triggers.length})`,
            message: summary,
            duration: 10000,
          })
        }
        dialog?.clear()
      },
    },
    {
      title: "Trigger: Test Match",
      value: "trigger.test",
      description: "娴嬭瘯杈撳叆鏄惁鍖归厤瑙﹀彂瑙勫垯",
      slash: { name: "trigger-test" },
      onSelect: (dialog) => {
        if (!dialog) return
        dialog.replace(() => (
          <api.ui.DialogPrompt
            title="娴嬭瘯鍏抽敭璇嶅尮閰?
            description={() => <text>杈撳叆娴嬭瘯璇彞锛屾煡鐪嬩細瑙﹀彂鍝簺 skill</text>}
            placeholder="渚嬪: 甯垜 debug 涓€涓?
            onConfirm={(val) => {
              const matches = matchTriggers(val)
              if (matches.length === 0) {
                api.ui.toast({
                  message: `\u2717 鏃犲尮閰? "${val}"`,
                  variant: "info",
                })
              } else {
                const allSkills = [...new Set(matches.flatMap(r => r.skills))]
                const detail = matches
                  .map(r => `[${r.keywords.join(", ")}] \u2192 ${r.skills.join(", ")}`)
                  .join(" | ")
                api.ui.toast({
                  title: `\u2705 鍖归厤 ${matches.length} 鏉?\u2192 ${allSkills.length} skills`,
                  message: detail,
                  duration: 10000,
                })
              }
              dialog.clear()
            }}
            onCancel={() => dialog.clear()}
          />
        ))
      },
    },
  ])
}

const mod: TuiPluginModule & { id: string } = {
  id: "opencode-trigger-panel",
  tui,
}

export default mod
