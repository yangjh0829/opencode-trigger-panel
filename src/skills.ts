import * as fs from "fs"
import * as path from "path"
import * as os from "os"

export interface SkillInfo {
  name: string
  description: string
  source: string
}

function findSuperpowersSkillsDir(): string | null {
  const packagesDir = path.join(os.homedir(), ".cache", "opencode", "packages")
  let entries: fs.Dirent[]
  try { entries = fs.readdirSync(packagesDir, { withFileTypes: true }) }
  catch { return null }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (!entry.name.startsWith("superpowers")) continue
    const skillsDir = path.join(
      packagesDir, entry.name, "node_modules", "superpowers", "skills",
    )
    if (fs.existsSync(skillsDir)) return skillsDir
  }
  return null
}

function getSkillSearchPaths(projectDir?: string): { dir: string; label: string }[] {
  const home = os.homedir()
  const paths: { dir: string; label: string }[] = [
    { dir: path.join(home, ".config", "opencode", "skills"), label: "global" },
  ]

  const spDir = findSuperpowersSkillsDir()
  if (spDir) paths.push({ dir: spDir, label: "superpowers" })

  if (projectDir) {
    const projectSkillDir = path.join(projectDir, ".opencode", "skills")
    if (fs.existsSync(projectSkillDir))
      paths.push({ dir: projectSkillDir, label: "project" })
  }

  const claudeDir = path.join(home, ".claude", "skills")
  if (fs.existsSync(claudeDir))
    paths.push({ dir: claudeDir, label: "claude" })

  return paths
}

function parseSkillMd(filePath: string): { name: string; description: string } | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8")
    const nameMatch = content.match(/^name:\s*(.+)/m)
    const descMatch = content.match(/^description:\s*(.+)/m)
    const name = nameMatch?.[1]?.trim().replace(/^["']|["']$/g, "")
    const desc = descMatch?.[1]?.trim().replace(/^["']|["']$/g, "")
    if (!name) return null
    return { name, description: desc ?? "" }
  } catch {
    return null
  }
}

export function discoverSkills(projectDir?: string): SkillInfo[] {
  const skills: SkillInfo[] = []
  const seen = new Set<string>()

  for (const { dir, label } of getSkillSearchPaths(projectDir)) {
    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) }
    catch { continue }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name === "keyword-trigger") continue

      const mdPath = path.join(dir, entry.name, "SKILL.md")
      if (!fs.existsSync(mdPath)) continue

      const parsed = parseSkillMd(mdPath)
      if (!parsed || seen.has(parsed.name)) continue
      seen.add(parsed.name)

      skills.push({ name: parsed.name, description: parsed.description, source: label })
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name))
}
