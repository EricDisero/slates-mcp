import { parseDocument } from 'yaml'

export interface SkillMetadata {
  name: string
  description: string
}

/** Portable discovery metadata, validated before embedding or choosing an install path. */
export function parseSkillMetadata(markdown: string, expectedName?: string): SkillMetadata {
  const label = expectedName ?? 'skill'
  const fail = (message: string): never => { throw new Error(`[skill-metadata] ${label}: ${message}`) }
  const frontmatter = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown)
  if (!frontmatter) return fail('missing YAML frontmatter')
  const document = parseDocument(frontmatter[1], { uniqueKeys: true })
  if (document.errors.length) return fail(`invalid YAML: ${document.errors[0].message}`)
  const fields = document.toJS({ maxAliasCount: 0 }) as Record<string, unknown> | null
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return fail('frontmatter must be a mapping')
  const { name, description } = fields
  if (typeof name !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64) {
    return fail('name must be 1-64 lowercase letters, digits and single hyphens')
  }
  if (expectedName && name !== expectedName) return fail(`name "${name}" must match its source key`)
  if (typeof description !== 'string' || !description.trim() || [...description].length > 1024) {
    return fail('description must be a nonempty string of at most 1024 characters')
  }
  if (fields.compatibility !== undefined && (typeof fields.compatibility !== 'string' || [...fields.compatibility].length > 500)) {
    return fail('compatibility must be a string of at most 500 characters')
  }
  return { name, description: description.trim() }
}
