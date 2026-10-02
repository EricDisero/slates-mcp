import { join, delimiter } from 'node:path'
import { homedir, platform } from 'node:os'
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { CODEX_MCP_SETUP, inspectCodexMcpConfig } from './mcp-config.js'

interface McpOptions {
  write?: boolean
}

// `slates mcp` — zero-to-configured MCP in one command.
//
// Detects installed MCP clients (Codex, Claude Code, Claude Desktop, Cursor) and
// prints the exact config for each one found. With --write, safely merges
// the "slates" mcpServers entry into Claude Desktop's and Cursor's config
// files (backing up the original to <file>.bak first). No interactive
// prompts — flags only.

const SLATES_ENTRY = {
  command: 'npx',
  args: ['-y', '@slatesvideo/mcp-server'],
}

const MCP_JSON_SNIPPET = JSON.stringify({ mcpServers: { slates: SLATES_ENTRY } }, null, 2)

function claudeDesktopConfigPath(): string {
  const os = platform()
  if (os === 'win32') {
    const appData = process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming')
    return join(appData, 'Claude', 'claude_desktop_config.json')
  }
  if (os === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
  }
  return join(homedir(), '.config', 'Claude', 'claude_desktop_config.json')
}

function cursorConfigPath(): string {
  return join(homedir(), '.cursor', 'mcp.json')
}

function binaryOnPath(name: string): boolean {
  const pathVar = process.env.PATH ?? ''
  const exts = platform() === 'win32' ? ['.cmd', '.exe', '.bat', ''] : ['']
  for (const dir of pathVar.split(delimiter)) {
    if (!dir) continue
    for (const ext of exts) {
      try {
        if (existsSync(join(dir, `${name}${ext}`))) return true
      } catch {
        // Unreadable PATH entry — skip.
      }
    }
  }
  return false
}

// Merge the "slates" key into an existing mcpServers JSON config file.
// Touches ONLY mcpServers.slates; everything else in the file is preserved.
// The original is backed up to <file>.bak before writing.
function mergeIntoConfig(file: string, label: string): boolean {
  let config: Record<string, unknown> = {}
  try {
    const text = readFileSync(file, 'utf8')
    config = text.trim().length > 0 ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch (err) {
    console.error(
      `  Could not parse ${label} config at ${file}: ${err instanceof Error ? err.message : String(err)}`
    )
    console.error('  Not writing — fix the JSON (or merge the snippet above by hand).')
    return false
  }
  copyFileSync(file, `${file}.bak`)
  const servers =
    config.mcpServers && typeof config.mcpServers === 'object'
      ? (config.mcpServers as Record<string, unknown>)
      : {}
  servers.slates = SLATES_ENTRY
  config.mcpServers = servers
  writeFileSync(file, JSON.stringify(config, null, 2) + '\n')
  console.log(`  Wrote "slates" into ${file} (backup at ${file}.bak)`)
  return true
}

function printClaudeCodeSection(): void {
  console.log('\n── Claude Code ──')
  console.log('  Run this in your terminal:')
  console.log('\n    claude mcp add slates -- npx -y @slatesvideo/mcp-server\n')
}

function printClaudeDesktopSection(file: string, detected: boolean): void {
  console.log('\n── Claude Desktop ──')
  console.log(`  Config file: ${file}${detected ? '' : ' (not found — create it)'}`)
  console.log('  Merge this into the file (or run `slates mcp --write`):\n')
  console.log(indent(MCP_JSON_SNIPPET, 4))
}

function printCursorSection(file: string, detected: boolean): void {
  console.log('\n── Cursor ──')
  console.log(`  Config file: ${file}${detected ? '' : ' (not found — create it)'}`)
  console.log('  Merge this into the file (or run `slates mcp --write`):\n')
  console.log(indent(MCP_JSON_SNIPPET, 4))
}

function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces)
  return text
    .split('\n')
    .map((l) => pad + l)
    .join('\n')
}

export function runMcp(opts: McpOptions): void {
  const desktopFile = claudeDesktopConfigPath()
  const cursorFile = cursorConfigPath()

  const codex = inspectCodexMcpConfig()
  const hasCodex = binaryOnPath('codex') || codex.files.length > 0
  const hasClaudeCode = binaryOnPath('claude')
  const hasClaudeDesktop = existsSync(desktopFile)
  const hasCursor = existsSync(cursorFile)
  const anyDetected = hasCodex || hasClaudeCode || hasClaudeDesktop || hasCursor

  if (anyDetected) {
    const found: string[] = []
    if (hasCodex) found.push('Codex')
    if (hasClaudeCode) found.push('Claude Code')
    if (hasClaudeDesktop) found.push('Claude Desktop')
    if (hasCursor) found.push('Cursor')
    console.log(`Detected: ${found.join(', ')}`)
  } else {
    console.log('No MCP client detected — showing setup for all clients.')
  }

  if (hasCodex || !anyDetected) {
    console.log('\n── Codex ──')
    console.log(`  Slates MCP entry: ${codex.configured ? 'configured' : codex.invalid.length ? 'config needs repair' : codex.disabled ? 'disabled' : 'not found'}`)
    if (codex.invalid.length) console.log(`  Could not parse: ${codex.invalid.join(', ')}`)
    console.log(`  Run in your terminal:\n\n    ${CODEX_MCP_SETUP}\n`)
  }
  if (hasClaudeCode || !anyDetected) printClaudeCodeSection()
  if (hasClaudeDesktop || !anyDetected) printClaudeDesktopSection(desktopFile, hasClaudeDesktop)
  if (hasCursor || !anyDetected) printCursorSection(cursorFile, hasCursor)

  if (opts.write) {
    console.log('\n── Writing configs ──')
    let wrote = 0
    if (hasClaudeDesktop) {
      if (mergeIntoConfig(desktopFile, 'Claude Desktop')) wrote++
    }
    if (hasCursor) {
      if (mergeIntoConfig(cursorFile, 'Cursor')) wrote++
    }
    if (!hasClaudeDesktop && !hasCursor) {
      console.log('  Nothing to write — no Claude Desktop or Cursor config file found.')
      console.log('  (--write only edits existing config files; Codex and Claude Code use the one-liners above.)')
    } else if (wrote > 0) {
      console.log('  Restart the client(s) to pick up the new server.')
    }
  }

  console.log('\n── Next steps ──')
  console.log('  1. Connect your account: open Slates → Settings → AI tools → Send link')
  console.log('     (or run `slates login`)')
  console.log('  2. Install the agent skills: `slates install-skills`')
}
