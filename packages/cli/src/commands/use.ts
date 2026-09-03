import {
  SlatesDesktopClient,
  setDefaultProjectId,
  readDefaultProjectId,
} from '@slatesvideo/shared'
import { EXIT, exitFor } from '../exit-codes.js'

// `slates use <projectId|name>` — the session's default project.
//
// Every workspace op takes `projectId`, and an agent shelling out had to carry
// that UUID through the whole session by hand. A shell session is bad at
// holding state, so it went in the connection file, where the next command can
// read it. An explicit `--projectId` always wins; this only fills an omission.

interface ProjectRow {
  id: string
  name: string
}

export async function runUse(target: string | undefined): Promise<void> {
  if (!target) {
    const current = readDefaultProjectId()
    console.log(current ? `Default project: ${current}` : 'No default project set.')
    return
  }
  if (target === '--clear' || target === 'none') {
    setDefaultProjectId(null)
    console.log('Default project cleared.')
    return
  }

  let projects: ProjectRow[] = []
  try {
    const r = await new SlatesDesktopClient().get<{ projects: ProjectRow[] }>('/agent/projects')
    projects = r.projects ?? []
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(exitFor(err))
  }

  const byId = projects.find((p) => p.id === target)
  if (byId) {
    setDefaultProjectId(byId.id)
    console.log(`Default project: ${byId.name} (${byId.id})`)
    return
  }

  // Name match: exact first, then case-insensitive substring. An ambiguous
  // substring REFUSES rather than picking one — the wrong project is where a
  // generation lands on someone else's storyboard.
  const q = target.toLowerCase()
  const exact = projects.filter((p) => p.name.toLowerCase() === q)
  const partial = exact.length > 0 ? exact : projects.filter((p) => p.name.toLowerCase().includes(q))
  if (partial.length === 1) {
    setDefaultProjectId(partial[0].id)
    console.log(`Default project: ${partial[0].name} (${partial[0].id})`)
    return
  }
  if (partial.length === 0) {
    console.error(`No project matches "${target}".`)
    console.error(`Known projects: ${projects.map((p) => p.name).join(', ') || '(none)'}`)
    process.exit(EXIT.ERROR)
  }
  console.error(`"${target}" matches ${partial.length} projects — be more specific or pass the id:`)
  for (const p of partial) console.error(`  ${p.id}  ${p.name}`)
  process.exit(EXIT.ERROR)
}
