#!/usr/bin/env node

/**
 * Install script for opencode-trigger-panel.
 *
 * 1. Copies skill/ to ~/.config/opencode/skills/keyword-trigger/
 * 2. Registers the TUI plugin in tui.json via file:// URL
 *
 * Usage:
 *   node install.mjs
 */

import { readFile, writeFile, mkdir, access, copyFile } from "node:fs/promises"
import { constants } from "node:fs"
import { homedir, platform } from "node:os"
import { join, dirname } from "node:path"
import { pathToFileURL } from "node:url"

const PLUGIN_NAME = "opencode-trigger-panel"

// ── config dir (cross-platform) ──

function configDir() {
  if (platform() === "win32") {
    return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "opencode")
  }
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "opencode")
}

async function exists(p) {
  try { await access(p, constants.F_OK); return true }
  catch { return false }
}

async function readJSON(p) {
  const raw = await readFile(p, "utf-8")
  return JSON.parse(raw.replace(/^\s*\/\/.*$/gm, ""))
}

// ── main ──

async function main() {
  const cfgDir = configDir()
  const skillsDir = join(cfgDir, "skills", "keyword-trigger")
  const projectRoot = dirname(new URL(".", import.meta.url).pathname.replace(/^\//, ""))
  const srcSkillDir = join(projectRoot, "skill")
  const srcIndex = join(projectRoot, "src", "index.tsx")

  // ── Step 1: Copy skill files ──

  await mkdir(skillsDir, { recursive: true })

  // SKILL.md: always overwrite (skill definition)
  await copyFile(join(srcSkillDir, "SKILL.md"), join(skillsDir, "SKILL.md"))
  console.log(`[✓] SKILL.md copied to ${skillsDir}`)

  // triggers.json: only copy if not exists (preserve user config)
  const triggersTarget = join(skillsDir, "triggers.json")
  if (!(await exists(triggersTarget))) {
    await copyFile(join(srcSkillDir, "triggers.json"), triggersTarget)
    console.log(`[✓] triggers.json copied (example config)`)
  } else {
    console.log(`[→] triggers.json already exists, keeping your config`)
  }

  // ── Step 2: Register TUI plugin ──

  const tuiPath = join(cfgDir, "tui.json")
  const fileUrl = pathToFileURL(srcIndex).href

  let tuiConfig
  if (await exists(tuiPath)) {
    tuiConfig = await readJSON(tuiPath)
  } else {
    tuiConfig = {
      "$schema": "https://opencode.ai/tui.json",
      "plugin": [],
    }
  }

  if (!tuiConfig.plugin) tuiConfig.plugin = []

  // Check if already registered (by file:// URL or package name)
  const alreadyRegistered = tuiConfig.plugin.some((p) => {
    const spec = typeof p === "string" ? p : Array.isArray(p) ? p[0] : ""
    return spec === fileUrl || spec === PLUGIN_NAME || spec === `${PLUGIN_NAME}@latest`
  })

  if (alreadyRegistered) {
    console.log(`[→] Plugin already registered in tui.json`)
  } else {
    tuiConfig.plugin.push(fileUrl)
    await mkdir(cfgDir, { recursive: true })
    await writeFile(tuiPath, JSON.stringify(tuiConfig, null, 2) + "\n", "utf-8")
    console.log(`[✓] Plugin registered in tui.json → ${fileUrl}`)
  }

  console.log("\nDone! Restart OpenCode to see the trigger panel.")
}

main().catch((err) => {
  console.error("Install failed:", err.message)
  process.exit(1)
})
