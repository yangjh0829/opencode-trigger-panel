import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import type { TuiPluginApi } from "@opencode-ai/plugin/tui"

export interface SkillInfo {
  name: string
  description: string
  source: string
}

// 鈹€鈹€ Approach 1: Query opencode's internal skill registry via API 鈹€鈹€

export async function discoverSkillsViaApi(api: TuiPluginApi): Promise<SkillInfo[] | null> {
  try {
    const client = api.client as any
    // Try different possible API method names
    let skills: any[] | null = null

    if (typeof client?.app?.skills === "function") {
      const result = await client.app.skills()
      skills = Array.isArray(result) ? result : result?.data ?? null
    } else if (typeof client?.skills?.list === "function") {
      const result = await client.skills.list()
      skills = Array.isArray(result) ? result : result?.data ?? null
    } else if (typeof client?.GET === "function") {
      // Try raw HTTP method
      const result = await client.GET("/app/skills")
      skills = Array.isArray(result) ? result : result?.data ?? null
    }

    if (!skills) return null

    return skills
      .filter((s: any) => s && typeof s.name === "string")
      .filter((s: any) => s.name !== "keyword-trigger")
      .map((s: any) => ({
        name: s.name,
        description: s.description ?? "",
        source: "api",
      }))
      .sort((a: SkillInfo, b: SkillInfo) => a.name.localeCompare(b.name))
  } catch {
    return null
  }
}

// 鈹€鈹€ Approach 2: Comprehensive filesystem scan (fallback) 鈹€鈹€

/**
 * Recursively search a package directory for skills folders.
 * Handles git-based packages where node_modules is nested under
 * URL-expanded paths (e.g. github.com/obra/superpowers.git/).
 *
 * Finds any `<pkg>/skills/` that sits inside a `node_modules/` dir,
 * up to 5 levels deep. Skips nested node_modules to avoid dependency trees.
 */
function findSkillsDirsInDir(rootDir: string, maxDepth = 5): { dir: string; label: string }[] {
  const results: { dir: string; label: string }[] = []

  function walk(dir: string, depth: number) {
    if (depth > maxDepth) return
    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) }
    catch { return }

    // If this directory IS a node_modules, look for <pkg>/skills/ inside it
    if (path.basename(dir) === "node_modules") {
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        if (entry.name.startsWith(".")) continue

        // Direct: node_modules/<pkg>/skills/
        const skillsDir = path.join(dir, entry.name, "skills")
        if (fs.existsSync(skillsDir) && fs.existsSync(path.join(dir, entry.name, "package.json"))) {
          results.push({ dir: skillsDir, label: entry.name })
        }

        // Scoped: node_modules/@scope/<pkg>/skills/
        if (entry.name.startsWith("@")) {
          const scopeDir = path.join(dir, entry.name)
          let scopeEntries: fs.Dirent[]
          try { scopeEntries = fs.readdirSync(scopeDir, { withFileTypes: true }) }
          catch { continue }
          for (const se of scopeEntries) {
            if (!se.isDirectory()) continue
            const scopedSkills = path.join(scopeDir, se.name, "skills")
            if (fs.existsSync(scopedSkills)) {
              results.push({ dir: scopedSkills, label: `${entry.name}/${se.name}` })
            }
          }
        }
      }
      return // Don't recurse INTO node_modules packages (avoid dependency tree)
    }

    // Recurse into subdirectories to find nested node_modules
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name.startsWith(".")) continue
      walk(path.join(dir, entry.name), depth + 1)
    }
  }

  walk(rootDir, 0)
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
    // Recursively search each package for skills (handles git URL nesting)
    const found = findSkillsDirsInDir(pkgDir, 6)
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

  // All plugin packages in cache (handles git-based nesting)
  for (const p of findAllPluginSkills()) {
    paths.push(p)
  }

  // Project-level skills
  if (projectDir) {
    const projectSkillDir = path.join(projectDir, ".opencode", "skills")
    if (fs.existsSync(projectSkillDir))
      paths.push({ dir: projectSkillDir, label: "project" })
    // .claude/skills in project
    const projectClaudeDir = path.join(projectDir, ".claude", "skills")
    if (fs.existsSync(projectClaudeDir))
      paths.push({ dir: projectClaudeDir, label: "project-claude" })
    // .agents/skills in project
    const projectAgentsDir = path.join(projectDir, ".agents", "skills")
    if (fs.existsSync(projectAgentsDir))
      paths.push({ dir: projectAgentsDir, label: "project-agents" })
  }

  // Global alternative directories
  const claudeDir = path.join(home, ".claude", "skills")
  if (fs.existsSync(claudeDir))
    paths.push({ dir: claudeDir, label: "claude" })

  const agentsDir = path.join(home, ".agents", "skills")
  if (fs.existsSync(agentsDir))
    paths.push({ dir: agentsDir, label: "agents" })

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

// 鈹€鈹€ Main entry: try API first, fall back to filesystem 鈹€鈹€

export async function discoverAllSkills(
  api: TuiPluginApi,
  projectDir?: string,
): Promise<SkillInfo[]> {
  // Try API first (most complete)
  const apiSkills = await discoverSkillsViaApi(api)
  if (apiSkills && apiSkills.length > 0) {
    return apiSkills
  }

  // Fall back to comprehensive filesystem scan
  return discoverSkills(projectDir)
}
