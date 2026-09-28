/** Script document wire contract. Spoken text has one home: the scene string. */
export interface Block {
  id: string
  kind: 'paragraph' | 'heading' | 'direction'
  start: number
  end: number
  /** Only non-spoken blocks own text here. Paragraph text lives in Scene.script. */
  label?: string
  level?: number
  marks: Array<{ start: number; end: number; type: 'strong' | 'em' }>
}
export interface Scene { id: string; name: string; script: string; blocks: Block[] }
export interface Shot { id: string; sceneId: string; range: [number, number] | null; label: string; prompt: string; speaker: string }
export interface Document { storyboardId: string; recovered?: boolean; version: 1; revision: number; title: string; scenes: Scene[]; shots: Shot[] }

export interface DocumentEdit { sceneId: string; at: number; removed: number; text: string }
export interface DocumentWrite {
  expectedRevision: number
  edits: DocumentEdit[]
  structures?: Array<{ sceneId: string; blocks: Block[] }>
  move?: { sceneId: string; blockId: string; delta: -1 | 1 }
  makeShots?: Array<SectionFragment & { waitingShotId?: string }>
  restoreRevision?: number
  sceneAction?: { kind: 'split'; sceneId: string; at: number } | { kind: 'merge'; sceneId: string }
}

export interface SectionFragment { sceneId: string; start: number; end: number }
export interface Section {
  id: string; storyboardId: string; parentId: string | null; label: string; tags: string[]; fragments: SectionFragment[];
  activeAlternativeId: string | null; locallyChanged: boolean; sourceSectionId?: string | null; sourceRevisionId?: string | null;
  alternatives: Array<{ id: string; label: string; revisionId: string }>
}
/** `rename` and `archive` act on the section, or on one alternative when
 * alternativeId is given. Archiving a section keeps its words on the page. */
export interface SectionInput {
  expectedRevision: number; action: 'create' | 'alternative' | 'choose' | 'save' | 'reuse' | 'updateUses' | 'rename' | 'archive' | 'tags';
  sectionId?: string; alternativeId?: string; parentId?: string; label?: string; tags?: string[]; fragments?: SectionFragment[]
  target?: { sceneId: string; at: number; expectedRevision: number }
  uses?: Array<{ sectionId: string; expectedRevision: number }>
}

/** A proposed replacement for exact words. It moves with edits around it and
 * applies only while those words are unchanged (`stale` says they are not).
 * Suggesting never edits the document; accepting is one undoable write. */
export interface ScriptSuggestion {
  id: string; storyboardId: string; sceneId: string; start: number; end: number
  original: string; replacement: string; note: string; status: 'pending' | 'accepted' | 'dismissed'; stale: boolean; baseRevision: number
}
export interface SuggestionInput {
  expectedRevision: number; action: 'create' | 'accept' | 'dismiss'
  suggestions?: Array<{ sceneId: string; start: number; end: number; original: string; replacement: string; note?: string }>
  suggestionId?: string
}

export interface VariationChoice { sectionId: string; alternativeId: string }
/** Enumerate only on demand; even a large Cartesian set costs one row of memory. */
export function* variationCombinations(axes: VariationChoice[][], prefix: VariationChoice[] = []): Generator<VariationChoice[]> {
  if (!axes.length) { yield prefix; return }
  const [head, ...tail] = axes
  for (const choice of head) yield* variationCombinations(tail, [...prefix, choice])
}
export interface VariationInput {
  expectedRevision: number
  name: string
  choices: VariationChoice[]
  /** When present, this sequence replaces the arrangement: omission and repetition are deliberate. */
  arrangement?: VariationChoice[]
  itemOverrides?: Array<{ from: string; to: string; voice: 'keep' | 'replace' }>
  assetOverrides?: Array<{ from: string; to: string }>
  idempotencyKey?: string
}
