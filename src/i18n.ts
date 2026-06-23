export type Lang = "zh" | "en"

export interface Strings {
  title: string
  empty: string
  hint: string
  addTitle: string
  addDesc: string
  addPlaceholder: string
  editTitle: string
  selectSkill: string
  selected: string
  save: string
  cancel: string
  removeTitle: string
  confirmTitle: string
  saved: string
  removed: string
  noRules: string
  selectOne: string
  atLeast: string
  searchPlaceholder: string
}

export const ZH_T: Strings = {
  title:          "🎯 关键词触发器",
  empty:          "暂无规则，用 /trigger-add 添加",
  hint:           "💡 /trigger-add · /trigger-edit · /trigger-remove",
  addTitle:       "添加触发规则",
  addDesc:        "输入关键词，逗号分隔（如：审核, 方案）",
  addPlaceholder:  "审核, 方案",
  editTitle:      "编辑触发规则",
  selectSkill:    "选择触发的 Skill",
  selected:       "已选",
  save:           "✅ 完成并保存",
  cancel:         "❌ 取消",
  removeTitle:    "选择要删除的规则",
  confirmTitle:   "确认删除",
  saved:          "规则已保存",
  removed:        "规则已删除",
  noRules:        "当前没有任何规则",
  selectOne:      "至少选择一个 Skill",
  atLeast:        "至少输入一个关键词",
  searchPlaceholder: "搜索 skill...",
}

export const EN_T: Strings = {
  title:          "🎯 Keyword Triggers",
  empty:          "No rules yet. Use /trigger-add",
  hint:           "💡 /trigger-add · /trigger-edit · /trigger-remove",
  addTitle:       "Add Trigger Rule",
  addDesc:        "Enter keywords, comma-separated (e.g. review, plan)",
  addPlaceholder:  "review, plan",
  editTitle:      "Edit Trigger Rule",
  selectSkill:    "Select skill(s) to trigger",
  selected:       "selected",
  save:           "✅ Save",
  cancel:         "❌ Cancel",
  removeTitle:    "Select a rule to delete",
  confirmTitle:   "Confirm Delete",
  saved:          "Rule saved",
  removed:        "Rule deleted",
  noRules:        "No rules configured",
  selectOne:      "Select at least one skill",
  atLeast:        "Enter at least one keyword",
  searchPlaceholder: "Search skill...",
}

export function getLang(): Lang {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale
    return locale.startsWith("zh") ? "zh" : "en"
  } catch {
    return "en"
  }
}

export function getStrings(lang: Lang): Strings {
  return lang === "zh" ? ZH_T : EN_T
}
