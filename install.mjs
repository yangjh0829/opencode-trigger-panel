#!/usr/bin/env node

/**
 * Install script for opencode-trigger-panel.
 *
 * 1. Copies skill/ to ~/.config/opencode/skills/keyword-trigger/
 * 2. Updates preload-skills.json to always-load keyword-trigger
 * 3. Registers the TUI plugin in tui.json via file:// URL
 * 4. Checks opencode-plugin-preload-skills dependency
 *
 * Usage:
 *   node install.mjs
 */

import { readFile, writeFile, mkdir, access, copyFile } from "node:fs/promises"
import { constants } from "node:fs"
import { homedir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const PLUGIN_NAME = "opencode-trigger-panel"
const SKILL_NAME = "keyword-trigger"

// 鈹€鈹€ config dir (cross-platform, opencode uses ~/.config on ALL platforms) 鈹€鈹€

function configDir() {
  return join(homedir(), ".config", "opencode")
}

async function exists(p) {
  try { await access(p, constants.F_OK); return true }
  catch { return false }
}

async function readJSON(p) {
  const raw = await readFile(p, "utf-8")
  return JSON.parse(raw.replace(/^\s*\/\/.*$/gm, ""))
}

// 鈹€鈹€ main 鈹€鈹€

async function main() {
  // Fix Bug 2: use fileURLToPath for cross-platform absolute path
  const projectRoot = dirname(fileURLToPath(import.meta.url))
  const srcSkillDir = join(projectRoot, "skill")
  const srcIndex = join(projectRoot, "src", "index.tsx")

  // Fix Bug 1: always use ~/.config/opencode/
  const cfgDir = configDir()
  const skillsDir = join(cfgDir, "skills", SKILL_NAME)

  // 鈹€鈹€ Step 1: Copy skill files 鈹€鈹€

  await mkdir(skillsDir, { recursive: true })

  await copyFile(join(srcSkillDir, "SKILL.md"), join(skillsDir, "SKILL.md"))
  console.log(`[鉁揮 SKILL.md 鈫?${skillsDir}`)

  const triggersTarget = join(skillsDir, "triggers.json")
  if (!(await exists(triggersTarget))) {
    await copyFile(join(srcSkillDir, "triggers.json"), triggersTarget)
    console.log(`[鉁揮 triggers.json 鈫?${triggersTarget} (example)`)
  } else {
    console.log(`[鈫抅 triggers.json already exists, keeping your config`)
  }

  // 鈹€鈹€ Step 2: Update preload-skills.json (Fix Bug 3) 鈹€鈹€

  const preloadPath = join(cfgDir, "preload-skills.json")
  let preloadConfig

  if (await exists(preloadPath)) {
    try {
      preloadConfig = await readJSON(preloadPath)
    } catch {
      preloadConfig = { skills: [], fileTypeSkills: {}, contentTriggers: {} }
    }
  } else {
    preloadConfig = { skills: [], fileTypeSkills: {}, contentTriggers: {} }
  }

  if (!Array.isArray(preloadConfig.skills)) {
    preloadConfig.skills = []
  }

  if (!preloadConfig.skills.includes(SKILL_NAME)) {
    preloadConfig.skills.push(SKILL_NAME)
    await writeFile(preloadPath, JSON.stringify(preloadConfig, null, 2) + "\n", "utf-8")
    console.log(`[鉁揮 "${SKILL_NAME}" added to preload-skills.json`)
  } else {
    console.log(`[鈫抅 "${SKILL_NAME}" already in preload-skills.json`)
  }

  // 鈹€鈹€ Step 3: Check opencode-plugin-preload-skills dependency 鈹€鈹€

  const opencodeJsonPath = join(cfgDir, "opencode.json")
  if (await exists(opencodeJsonPath)) {
    try {
      const ocConfig = await readJSON(opencodeJsonPath)
      const plugins = ocConfig.plugin || []
      const hasPreloadPlugin = plugins.some((p) => {
        const spec = typeof p === "string" ? p : Array.isArray(p) ? p[0] : ""
        return spec.includes("preload-skills")
      })
      if (!hasPreloadPlugin) {
        console.log(`\n[!] Warning: "opencode-plugin-preload-skills" not found in opencode.json`)
        console.log(`    keyword-trigger needs this plugin to auto-load on every session.`)
        console.log(`    Install it: Ctrl+P 鈫?"install plugin" 鈫?"opencode-plugin-preload-skills"`)
      }
    } catch {}
  }

  // 鈹€鈹€ Step 4: Register TUI plugin 鈹€鈹€

  const tuiPath = join(cfgDir, "tui.json")
  const fileUrl = pathToFileURL(srcIndex).href

  let tuiConfig
  if (await exists(tuiPath)) {
    try {
      tuiConfig = await readJSON(tuiPath)
    } catch {
      tuiConfig = { "$schema": "https://opencode.ai/tui.json", plugin: [] }
    }
  } else {
    tuiConfig = { "$schema": "https://opencode.ai/tui.json", plugin: [] }
  }

  if (!tuiConfig.plugin) tuiConfig.plugin = []

  const alreadyRegistered = tuiConfig.plugin.some((p) => {
    const spec = typeof p === "string" ? p : Array.isArray(p) ? p[0] : ""
    return spec === fileUrl || spec === PLUGIN_NAME || spec === `${PLUGIN_NAME}@latest`
  })

  if (alreadyRegistered) {
    console.log(`[鈫抅 Plugin already registered in tui.json`)
  } else {
    tuiConfig.plugin.push(fileUrl)
    await mkdir(cfgDir, { recursive: true })
    await writeFile(tuiPath, JSON.stringify(tuiConfig, null, 2) + "\n", "utf-8")
    console.log(`[鉁揮 Plugin registered in tui.json`)
  }

  console.log("\n鉁?Done! Restart OpenCode to see the trigger panel.")
}

main().catch((err) => {
  console.error("Install failed:", err.message)
  process.exit(1)
})
