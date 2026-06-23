/** @jsxImportSource @opentui/solid */

import type { JSX } from "@opentui/solid"
import type {
  TuiPlugin, TuiPluginApi, TuiSlotContext,
  TuiPluginModule,
} from "@opencode-ai/plugin/tui"
import { createSignal } from "solid-js"
import { TriggerPanel } from "./panel"
import { addRuleFlow, editRuleFlow, removeRuleFlow } from "./dialogs"
import { loadTriggers, TriggerRule } from "./triggers"

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

  api.slots.register({
    order: 60,
    slots: {
      sidebar_content(
        ctx: TuiSlotContext,
        input: { session_id: string },
      ): JSX.Element {
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
      description: "显示/隐藏关键词触发器面板",
      slash: { name: "trigger-config" },
      onSelect: (dialog) => {
        togglePanel()
        dialog?.clear()
      },
    },
    {
      title: "Trigger: Add Rule",
      value: "trigger.add",
      description: "添加关键词触发规则",
      slash: { name: "trigger-add" },
      onSelect: (dialog) => {
        if (!dialog) return
        addRuleFlow(api, dialog, refresh, projectDir)
      },
    },
    {
      title: "Trigger: Edit Rule",
      value: "trigger.edit",
      description: "编辑关键词触发规则",
      slash: { name: "trigger-edit" },
      onSelect: (dialog) => {
        if (!dialog) return
        editRuleFlow(api, dialog, refresh, projectDir)
      },
    },
    {
      title: "Trigger: Remove Rule",
      value: "trigger.remove",
      description: "删除关键词触发规则",
      slash: { name: "trigger-remove" },
      onSelect: (dialog) => {
        if (!dialog) return
        removeRuleFlow(api, dialog, refresh)
      },
    },
    {
      title: "Trigger: List Rules",
      value: "trigger.list",
      description: "查看所有触发规则",
      slash: { name: "trigger-list" },
      onSelect: (dialog) => {
        const config = loadTriggers()
        if (config.triggers.length === 0) {
          api.ui.toast({ message: "暂无规则", variant: "info" })
        } else {
          const summary = config.triggers
            .map((r, i) =>
              `${i + 1}. [${r.keywords.join(", ")}] \u2192 ${r.skills.join(", ")}`,
            )
            .join("\n")
          api.ui.toast({
            title: `触发规则 (${config.triggers.length})`,
            message: summary,
            duration: 10000,
          })
        }
        dialog?.clear()
      },
    },
  ])
}

const mod: TuiPluginModule & { id: string } = {
  id: "opencode-trigger-panel",
  tui,
}

export default mod
