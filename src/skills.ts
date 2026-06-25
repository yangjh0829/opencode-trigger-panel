import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import type { TuiPluginApi } from "@opencode-ai/plugin/tui"

export interface SkillInfo {
  name: string
  description: string
  source: string
}

// 鈹€鈹€ Iterative directory scan (no recursion, prevents stack overflow) 鈹€鈹€

const MAX_DIRS = 300
const MAX_DEPTH = 6

function findSkillsDirsInDir(rootDir: string): { dir: string; label: string }[] {
  const results: { dir: string; label: string }[] = []
  const stack: { dir: string; depth: number }[] = [{ dir: rootDir, depth: 0 }]
  let count = 0

  while (stack.length > 0 && count < MAX_DIRS) {
    const item = stack.pop()!
    count++

    if (item.depth > MAX_DEPTH) continue

    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(item.dir, { withFileTypes: true }) }
    catch { continue }

    // If this IS a node_modules, look for <pkg>/skills/ inside
    if (path.basename(item.dir) === "node_modules") {
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith(".")) continue
        count++
        if (count > MAX_DIRS) break

        const pkgDir = path.join(item.dir, entry.name)

        // Direct: node_modules/<pkg>/skills/
        const skillsDir = path.join(pkgDir, "skills")
        try {
          if (fs.existsSync(skillsDir) && fs.existsSync(path.join(pkgDir, "package.json"))) {
            results.push({ dir: skillsDir, label: entry.name })
          }
        } catch {}

        // Scoped: node_modules/@scope/<pkg>/skills/
        if (entry.name.startsWith("@")) {
          let scopeEntries: fs.Dirent[]
          try { scopeEntries = fs.readdirSync(pkgDir, { withFileTypes: true }) }
          catch { continue }
          for (const se of scopeEntries) {
            if (!se.isDirectory()) continue
            const scopedSkills = path.join(pkgDir, se.name, "skills")
            try {
              if (fs.existsSync(scopedSkills)) {
                results.push({ dir: scopedSkills, label: `${entry.name}/${se.name}` })
              }
            } catch {}
          }
        }
      }
      continue // Don't push children of node_modules
    }

    // Push subdirectories for further scanning
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue
      stack.push({ dir: path.join(item.dir, entry.name), depth: item.depth + 1 })
    }
  }

  return results
}

function findAllPluginSkills(): { dir: string; label: string }[] {
  const packagesDir = path.join(os.homedir(), ".cache", "opencode", "packages")
  if (!fs.existsSync(packagesDir)) return []

  const results: { dir: string; label: string }[] = []
  let entries: fs.Dirent[]
  try { entries = fs.readdirSync(packagesDir, { withFileTypes: true }) }
  catch { return results }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const pkgDir = path.join(packagesDir, entry.name)
    const found = findSkillsDirsInDir(pkgDir)
    for (const f of found) {
      if (!results.some(r => r.dir === f.dir)) {
        results.push(f)
      }
    }
  }
  return results
}

function getSkillSearchPaths(projectDir?: string): { dir: string; label: string }[] {
  const home = os.homedir()
  const paths: { dir: string; label: string }[] = [
    { dir: path.join(home, ".config", "opencode", "skills"), label: "global" },
  ]

  for (const p of findAllPluginSkills()) {
    paths.push(p)
  }

  if (projectDir) {
    const dirs = [
      { d: path.join(projectDir, ".opencode", "skills"), l: "project" },
      { d: path.join(projectDir, ".claude", "skills"), l: "project-claude" },
      { d: path.join(projectDir, ".agents", "skills"), l: "project-agents" },
    ]
    for (const { d, l } of dirs) {
      try { if (fs.existsSync(d)) paths.push({ dir: d, label: l }) } catch {}
    }
  }

  const globalDirs = [
    { d: path.join(home, ".claude", "skills"), l: "claude" },
    { d: path.join(home, ".agents", "skills"), l: "agents" },
  ]
  for (const { d, l } of globalDirs) {
    try { if (fs.existsSync(d)) paths.push({ dir: d, label: l }) } catch {}
  }

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
      try { if (!fs.existsSync(mdPath)) continue } catch { continue }

      const parsed = parseSkillMd(mdPath)
      if (!parsed || seen.has(parsed.name)) continue
      seen.add(parsed.name)

      skills.push({ name: parsed.name, description: parsed.description, source: label })
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name))
}

// 鈹€鈹€ Main entry: filesystem scan only (API removed for stability) 鈹€鈹€

export async function discoverAllSkills(
  _api: TuiPluginApi,
  projectDir?: string,
): Promise<SkillInfo[]> {
  return discoverSkills(projectDir)
}
