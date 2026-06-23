/** @jsxImportSource @opentui/solid */

import type { TuiPluginApi, TuiDialogStack } from "@opencode-ai/plugin/tui"
import {
  loadTriggers, addRule, updateRule, removeRule,
} from "./triggers"
import { discoverAllSkills, type SkillInfo } from "./skills"
import { getStrings, getLang, type Strings } from "./i18n"

const t: Strings = getStrings(getLang())

// 鈹€鈹€ Skills cache: avoid re-fetching on every dialog re-render 鈹€鈹€
let skillsCache: SkillInfo[] | null = null

async function getSkills(api: TuiPluginApi, projectDir?: string): Promise<SkillInfo[]> {
  if (skillsCache) return skillsCache
  skillsCache = await discoverAllSkills(api, projectDir)
  return skillsCache
}

export function clearSkillsCache() {
  skillsCache = null
}

// 鈹€鈹€ Manual skill name input step 鈹€鈹€
function manualSkillInputStep(
  api: TuiPluginApi,
  dialog: TuiDialogStack,
  keywords: string[],
  selected: string[],
  onDone: (keywords: string[], skills: string[]) => void,
  backToSelect: () => void,
) {
  dialog.replace(() => (
    <api.ui.DialogPrompt
      title={"鉁忥笍 " + t.selectSkill}
      description={() => <text>{"杈撳叆 skill 鍚嶇О锛堜笌 SKILL.md 涓?name 瀛楁涓€鑷达級"}</text>}
      placeholder="渚嬪: webapp-testing"
      value=""
      onConfirm={(val) => {
        const name = val.trim()
        if (!name) {
          api.ui.toast({ message: t.atLeast, variant: "warning" })
          return
        }
        if (selected.includes(name)) {
          api.ui.toast({ message: `${name} 宸插湪鍒楄〃涓璥, variant: "info" })
          backToSelect()
          return
        }
        const next = [...selected, name]
        backToSelectWithSelected(next)
      }}
      onCancel={() => backToSelect()}
    />
  ))

  function backToSelectWithSelected(newSelected: string[]) {
    backToSelect()
    // Note: backToSelect re-renders the select step with updated selected
    // We need to pass the new selected through closure
  }
}

// 鈹€鈹€ Multi-select Skill step (async, API-first) 鈹€鈹€
async function selectSkillsStep(
  api: TuiPluginApi,
  dialog: TuiDialogStack,
  keywords: string[],
  selected: string[],
  onDone: (keywords: string[], skills: string[]) => void,
  projectDir?: string,
) {
  const skills = await getSkills(api, projectDir)

  const options = [
    ...skills.map(s => ({
      title: `${selected.includes(s.name) ? "\u2713 " : "  "}${s.name}`,
      value: s.name,
      description: s.description,
    })),
    { title: "鉁忥笍 鎵嬪姩杈撳叆 skill 鍚?..", value: "__manual__" },
    { title: t.save, value: "__save__" },
    { title: t.cancel, value: "__cancel__" },
  ]

  dialog.replace(() => (
    <api.ui.DialogSelect
      title={`${t.selectSkill} (${t.selected} ${selected.length})`}
      placeholder={t.searchPlaceholder}
      options={options}
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
        if (opt.value === "__manual__") {
          // Manual input
          dialog.replace(() => (
            <api.ui.DialogPrompt
              title={"鉁忥笍 " + t.selectSkill}
              description={() => <text>{"杈撳叆 skill 鍚嶇О锛堜笌 skill tool 涓殑鍚嶇О涓€鑷达級"}</text>}
              placeholder="渚嬪: webapp-testing"
              onConfirm={(val) => {
                const name = val.trim()
                if (!name) {
                  api.ui.toast({ message: "skill 鍚嶄笉鑳戒负绌?, variant: "warning" })
                  return
                }
                const next = selected.includes(name)
                  ? selected
                  : [...selected, name]
                // Return to select step with updated selection
                selectSkillsStep(api, dialog, keywords, next, onDone, projectDir)
              }}
              onCancel={() => {
                // Return to select step without changes
                selectSkillsStep(api, dialog, keywords, selected, onDone, projectDir)
              }}
            />
          ))
          return
        }
        // Toggle selection
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
  clearSkillsCache()
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
  clearSkillsCache()
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
