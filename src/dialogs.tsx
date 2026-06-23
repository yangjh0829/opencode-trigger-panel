/** @jsxImportSource @opentui/solid */

import type { TuiPluginApi, TuiDialogStack } from "@opencode-ai/plugin/tui"
import {
  loadTriggers, addRule, updateRule, removeRule,
} from "./triggers"
import { discoverSkills } from "./skills"
import { getStrings, getLang, type Strings } from "./i18n"

const t: Strings = getStrings(getLang())

function selectSkillsStep(
  api: TuiPluginApi,
  dialog: TuiDialogStack,
  keywords: string[],
  selected: string[],
  onDone: (keywords: string[], skills: string[]) => void,
  projectDir?: string,
) {
  const skills = discoverSkills(projectDir)

  dialog.replace(() => (
    <api.ui.DialogSelect
      title={`${t.selectSkill} (${t.selected} ${selected.length})`}
      placeholder={t.searchPlaceholder}
      options={[
        ...skills.map(s => ({
          title: `${selected.includes(s.name) ? "\u2713 " : "  "}${s.name}`,
          value: s.name,
          description: s.description,
        })),
        { title: t.save, value: "__save__" },
        { title: t.cancel, value: "__cancel__" },
      ]}
      onSelect={(opt) => {
        if (opt.value === "__cancel__") { dialog.clear(); return }
        if (opt.value === "__save__") {
          if (selected.length === 0) {
            api.ui.toast({ message: t.selectOne, variant: "warning" })
            return
          }
          onDone(keywords, selected)
          return
        }
        const idx = selected.indexOf(opt.value)
        const next = idx >= 0
          ? selected.filter(s => s !== opt.value)
          : [...selected, opt.value]
        selectSkillsStep(api, dialog, keywords, next, onDone, projectDir)
      }}
    />
  ))
}

export function addRuleFlow(
  api: TuiPluginApi,
  dialog: TuiDialogStack,
  refresh: () => void,
  projectDir?: string,
) {
  dialog.replace(() => (
    <api.ui.DialogPrompt
      title={t.addTitle}
      description={() => <text>{t.addDesc}</text>}
      placeholder={t.addPlaceholder}
      onConfirm={(val) => {
        const keywords = val.split(",").map(s => s.trim()).filter(Boolean)
        if (keywords.length === 0) {
          api.ui.toast({ message: t.atLeast, variant: "warning" })
          return
        }
        selectSkillsStep(api, dialog, keywords, [], (kw, sk) => {
          addRule(kw, sk)
          api.ui.toast({
            message: `${t.saved}: [${kw.join(", ")}] \u2192 ${sk.join(", ")}`,
            variant: "success",
          })
          refresh()
          dialog.clear()
        }, projectDir)
      }}
      onCancel={() => dialog.clear()}
    />
  ))
}

export function editRuleFlow(
  api: TuiPluginApi,
  dialog: TuiDialogStack,
  refresh: () => void,
  projectDir?: string,
) {
  const config = loadTriggers()
  if (config.triggers.length === 0) {
    api.ui.toast({ message: t.noRules, variant: "info" })
    dialog.clear()
    return
  }

  dialog.replace(() => (
    <api.ui.DialogSelect
      title={t.editTitle}
      options={config.triggers.map((r, i) => ({
        title: `[${r.keywords.join(", ")}] \u2192 ${r.skills.join(", ")}`,
        value: String(i),
      }))}
      onSelect={(opt) => {
        const idx = parseInt(opt.value)
        const rule = config.triggers[idx]
        dialog.replace(() => (
          <api.ui.DialogPrompt
            title={t.editTitle}
            description={() => <text>{t.addDesc}</text>}
            value={rule.keywords.join(", ")}
            onConfirm={(val) => {
              const keywords = val.split(",").map(s => s.trim()).filter(Boolean)
              if (keywords.length === 0) {
                api.ui.toast({ message: t.atLeast, variant: "warning" })
                return
              }
              selectSkillsStep(api, dialog, keywords, rule.skills, (kw, sk) => {
                updateRule(idx, kw, sk)
                api.ui.toast({
                  message: `${t.saved}: [${kw.join(", ")}] \u2192 ${sk.join(", ")}`,
                  variant: "success",
                })
                refresh()
                dialog.clear()
              }, projectDir)
            }}
            onCancel={() => dialog.clear()}
          />
        ))
      }}
    />
  ))
}

export function removeRuleFlow(
  api: TuiPluginApi,
  dialog: TuiDialogStack,
  refresh: () => void,
) {
  const config = loadTriggers()
  if (config.triggers.length === 0) {
    api.ui.toast({ message: t.noRules, variant: "info" })
    dialog.clear()
    return
  }

  dialog.replace(() => (
    <api.ui.DialogSelect
      title={t.removeTitle}
      options={config.triggers.map((r, i) => ({
        title: `[${r.keywords.join(", ")}] \u2192 ${r.skills.join(", ")}`,
        value: String(i),
      }))}
      onSelect={(opt) => {
        const idx = parseInt(opt.value)
        const rule = config.triggers[idx]
        dialog.replace(() => (
          <api.ui.DialogConfirm
            title={t.confirmTitle}
            message={`[${rule.keywords.join(", ")}] \u2192 ${rule.skills.join(", ")}`}
            onConfirm={() => {
              removeRule(idx)
              api.ui.toast({ message: t.removed, variant: "success" })
              refresh()
              dialog.clear()
            }}
            onCancel={() => dialog.clear()}
          />
        ))
      }}
    />
  ))
}
