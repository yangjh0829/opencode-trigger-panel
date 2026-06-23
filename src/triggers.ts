import * as fs from "fs"
import * as path from "path"
import * as os from "os"

export interface TriggerRule {
  keywords: string[]
  skills: string[]
}

export interface TriggersConfig {
  triggers: TriggerRule[]
}

const TRIGGERS_PATH = path.join(
  os.homedir(), ".config", "opencode", "skills",
  "keyword-trigger", "triggers.json",
)

export function loadTriggers(): TriggersConfig {
  try {
    if (!fs.existsSync(TRIGGERS_PATH)) return { triggers: [] }
    const raw = fs.readFileSync(TRIGGERS_PATH, "utf-8")
    const parsed = JSON.parse(raw) as TriggersConfig
    if (!parsed.triggers || !Array.isArray(parsed.triggers))
      return { triggers: [] }
    return parsed
  } catch {
    return { triggers: [] }
  }
}

export function saveTriggers(config: TriggersConfig): void {
  const dir = path.dirname(TRIGGERS_PATH)
  if (!fs.existsSync(dir))
    fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(TRIGGERS_PATH, JSON.stringify(config, null, 2), "utf-8")
}

export function addRule(keywords: string[], skills: string[]): TriggersConfig {
  const config = loadTriggers()
  config.triggers.push({ keywords, skills })
  saveTriggers(config)
  return config
}

export function updateRule(
  index: number,
  keywords: string[],
  skills: string[],
): TriggersConfig {
  const config = loadTriggers()
  if (index < 0 || index >= config.triggers.length)
    throw new Error(`Rule index ${index} out of range`)
  config.triggers[index] = { keywords, skills }
  saveTriggers(config)
  return config
}

export function removeRule(index: number): TriggersConfig {
  const config = loadTriggers()
  if (index < 0 || index >= config.triggers.length)
    throw new Error(`Rule index ${index} out of range`)
  config.triggers.splice(index, 1)
  saveTriggers(config)
  return config
}

export function matchTriggers(input: string): TriggerRule[] {
  const config = loadTriggers()
  const lower = input.toLowerCase()
  return config.triggers.filter(rule =>
    rule.keywords.some(kw => lower.includes(kw.toLowerCase())),
  )
}
