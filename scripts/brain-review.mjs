#!/usr/bin/env node
// Nothing reaches the shared brain without Eric (second-brain plans/2026-10-25-slates-brain.md § Keeping it from
// turning into chaos, rule 9; Eric, 2026-10-25: "definitely I should have the final say on everything"; nothing ever
// auto-merges, skill changes wait on a ranked review page, evals reject any change that lowers the score). Every
// brain commit since the brain he last approved waits on his review page; the npm publish of shared refuses to ship
// a brain he has not approved, and the plugins carry only the approved skills (build-plugins.mjs).
//
// The approved brain is `approvedCommit` and `approvedBrainHash` in brain-eval/scoreboard.json: the commit, and the
// hash (brain-eval/brain-hash.mjs) of what its build hands an agent. A brain commit touches WATCHED below: the card
// and router, the shape that pins the layers, and the doctrine sources the build wraps around them. The playbooks,
// rules and model guides live in slates-api's brain/ (scripts/brain-source.mjs), served by tier from the commit its
// brain-approved.json pins; a commit there is a brain commit too, and --approve moves both pins together. The hash
// catches the rest.
//
// The two pins are watched too: scoreboard.json here and brain-approved.json there. A commit that changes either is
// a change waiting on Eric unless it is the record of the approval --approve wrote (isApproval), so a pin moved by
// hand, in either repo or both, shows on his page and stops the publish. That stops an agent drifting, not a
// determined attacker: a hand-written lastApproval with gate lines passes. What the whole guard stops and does not:
// slates-api src/lib/brain.ts.
//
//   node scripts/brain-review.mjs --spec <out.json> --notes <notes.json> [--craft <craft.json>] [--routing <routing.json>]…
//       The review page's items (build the page with the vault's tools/review_page.py), one per brain commit since the
//       approved brain, ranked by reach: router and doctrine, playbooks, rules, motion guides, model guides, then the
//       shape file, the bigger change first within a layer. Each item carries its sources and its added lines;
//       --notes ({"<hash>": "recommendation"}) must give the agents' call on every item; --craft and --routing put the
//       test results in the intro. Records the head commit and brain hash it was built from (`brain` in the spec).
//       Refuses while a brain file is uncommitted or the build is older than the skills on disk.
//   node scripts/brain-review.mjs --check
//       Fails while a brain commit since the approved brain waits, a brain file is uncommitted, the build is older than
//       the skills, or the build's brain hash is not approvedBrainHash. Shared's prepublishOnly runs it after the build.
//   node scripts/brain-review.mjs --approve --spec <spec.json> --decisions <decisions.json> --craft <craft.json> --routing <routing.json>…
//       After Eric answered every item on the page. decisions.json is exported from the page's database (README § Eric's
//       decisions): {"<item id>": "approve" | "hold"} for every item. Refuses unless every waiting commit has a decision,
//       every held commit is reverted, the only commits after the page's head are those reverts, packages/shared is
//       committed and the gate (brain-eval/gate.mjs) passes; then the approved brain becomes the page's head (with the
//       reverts of what he held) and approvedBrainHash this build's hash.
//   node scripts/brain-review.mjs --pin-approved-hash <checkout> [--baseline-brain <slates-api brain/ at the pin>]
//       Once, when scoreboard.json has no approvedBrainHash: records the hash of <checkout>, a built copy of
//       approvedCommit (a `git archive` export will do) whose sources match the commit. --approve keeps it current.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { compare, currentBrain, readResults } from './brain-eval/gate.mjs'
import { brainDir } from './brain-source.mjs'

const root = join(import.meta.dirname, '..')
const SKILLS = 'packages/shared/skills'
const SHAPE = 'scripts/brain-shape.json'
// The doctrine the build wraps around the skills (both surfaces' doctrine, the MCP instructions, the router notice and
// the guide index), all of which brainHash covers.
const DOCTRINE = ['packages/shared/src/prompts/agent-doctrine.ts', 'packages/shared/src/prompts/brain.ts', 'packages/shared/src/prompts/guide-discovery.ts']
const BOARD_PATH = 'scripts/brain-eval/scoreboard.json'
const API_PIN = 'brain-approved.json'
const WATCHED = [SKILLS, SHAPE, ...DOCTRINE, BOARD_PATH]
const watchedPath = (p) => p.startsWith(`${SKILLS}/`) || p === SHAPE || DOCTRINE.includes(p) || p === BOARD_PATH
const BOARD = join(root, BOARD_PATH)
const shape = JSON.parse(readFileSync(join(root, SHAPE), 'utf8'))
// Reach order: the router, the doctrine and the pins reach every job, a playbook or a motion guide one kind of job, a
// rule what links it, a model guide one model; the shape file pins the rest.
const LAYERS = ['router', 'playbook', 'rule', 'motion', 'model']
const RANK = { router: 0, doctrine: 0, pin: 0, playbook: 1, rule: 2, motion: 3, model: 4 }
const LABEL = { router: 'Router', doctrine: 'Doctrine', pin: 'Approval pin', playbook: 'Playbook', rule: 'Rule', motion: 'Motion guide', model: 'Model guide', other: 'Other file' }
// The brain's deep layers: slates-api's brain/, approved by the commit brain-approved.json pins there.
const BRAIN = brainDir({ optional: true })
if (!BRAIN) {
  // Single-repo CI (or any checkout without slates-api) cannot review: the review reads both repos, and nothing may publish.
  console.error('✗ brain review: slates-api is not beside this checkout, so the brain cannot be reviewed here. Publish from a machine with slates-api checked out beside slates-mcp (or SLATES_BRAIN_DIR set).')
  process.exit(1)
}
const API = dirname(BRAIN)
const BRAIN_PATH = basename(BRAIN)
const PIN = join(API, API_PIN)
const layerOf = (file) => {
  if (DOCTRINE.includes(file)) return 'doctrine'
  if (file === BOARD_PATH || file === API_PIN) return 'pin'
  const home = [`${SKILLS}/`, `${BRAIN_PATH}/`].find((p) => file.startsWith(p))
  if (!home) return 'other'
  const path = file.slice(home.length)
  if (/^(hyperframes|_partials)\//.test(path)) return path.startsWith('_partials/') ? 'rule' : 'motion'
  const name = path.replace(/\.md$/, '')
  return LAYERS.find((l) => shape.layers[l]?.includes(name)) ?? 'other'
}
const short = (p) => p.replace(`${SKILLS}/`, '').replace(`${BRAIN_PATH}/`, '').replace(/^hyperframes\//, 'motion/').replace('packages/shared/src/prompts/', 'doctrine: ')
const gitRaw = (args, opts = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opts })
const git = (...args) => gitRaw(args).trim()
const board = JSON.parse(readFileSync(BOARD, 'utf8'))
const approved = board.approvedCommit
if (!approved) throw new Error('scoreboard.json has no approvedCommit')
const pin = JSON.parse(readFileSync(PIN, 'utf8'))
if (!pin.commit) throw new Error(`${PIN} has no commit`)
/** The two homes of the brain: where each is, what it watches and the commit Eric approved there. */
const REPOS = {
  mcp: { cwd: root, watched: WATCHED, approved },
  // The files, the code that decides who reads which and what a locked file says, and the pin itself.
  api: { cwd: API, watched: [BRAIN_PATH, 'src/lib/brain.ts', 'src/lib/brain-notice.ts', 'src/lib/brain-served.ts', API_PIN], approved: pin.commit },
}
const gitAt = (repo, ...args) => gitRaw(args, { cwd: REPOS[repo].cwd }).trim()
const jsonAt = (repo, rev, path) => {
  try {
    return JSON.parse(gitAt(repo, 'show', `${rev}:${path}`))
  } catch {
    return null
  }
}
const APPROVAL = ['approvedCommit', 'approvedApiCommit', 'approvedBrainHash']
/**
 * True when commit `full` in `repo`, touching `files` of the watched set, is the record of the approval scoreboard.json
 * holds, as --approve wrote it, and so not a change waiting on one. Only --approve writes lastApproval, with the gate's
 * report, so the first baseline (none) has no approval commit. Here: the commit changes only scoreboard.json, to the
 * board's approval and lastApproval, and that lastApproval starts from the approved commit the board named before it.
 * In slates-api: the commit changes only brain-approved.json, to the board's slates-api commit and brain hash.
 */
function isApproval(repo, full, files) {
  const file = repo === 'mcp' ? BOARD_PATH : API_PIN
  if (!board.lastApproval?.gate?.length || !files.every((f) => f.path === file)) return false
  const now = jsonAt(repo, full, file)
  if (repo === 'api') return now?.commit === board.approvedApiCommit && now?.approvedBrainHash === board.approvedBrainHash
  const before = jsonAt(repo, `${full}^`, file)
  return APPROVAL.every((k) => now?.[k] === board[k]) &&
    JSON.stringify(now.lastApproval) === JSON.stringify(board.lastApproval) &&
    now.lastApproval.from === before?.approvedCommit
}
const argv = process.argv
const flag = (name) => { const k = argv.indexOf(`--${name}`); return k < 0 ? undefined : argv[k + 1] }
const flagAll = (name) => argv.flatMap((a, k) => (a === `--${name}` ? [argv[k + 1]] : [])).filter(Boolean)
const readJson = (file) => JSON.parse(readFileSync(resolve(file), 'utf8'))
const stop = (lines) => {
  console.error(`✗ brain review: ${lines.join('\n  ')}`)
  process.exit(1)
}

// What a reviewer reads of a commit's added lines: comments out (the sources are shown apart), blanks out, each line
// and the whole trimmed to a readable size.
const ADDED_LINES = 24, ADDED_CHARS = 2400, LINE_CHARS = 220
function addedLines(diff) {
  const byFile = new Map()
  let file = null
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) { file = line.replace(/^\+\+\+ (b\/)?/, ''); continue }
    if (file && line.startsWith('+')) byFile.set(file, [...(byFile.get(file) ?? []), line.slice(1)])
  }
  const shown = []
  let chars = 0, hidden = 0
  for (const [path, lines] of byFile) {
    const text = path.endsWith('.md') ? lines.join('\n').replace(/<!--[\s\S]*?(?:-->|$)/g, '') : lines.filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l)).join('\n')
    for (const raw of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
      const line = raw.length > LINE_CHARS ? `${raw.slice(0, LINE_CHARS - 1)}…` : raw
      if (shown.length >= ADDED_LINES || chars + line.length > ADDED_CHARS) { hidden++; continue }
      shown.push(`${short(path)} + ${line}`)
      chars += line.length
    }
  }
  return hidden ? [...shown, `… and ${hidden} more added lines (git show)`] : shown
}

/**
 * The brain commits in each home, from its approved commit to HEAD unless `ranges` ({ mcp, api: { from, to } }) says
 * otherwise, oldest first within a home, and the brain files not committed in either. Each commit names its `repo`.
 */
function pending(ranges = {}) {
  const commits = []
  const dirty = []
  for (const [repo, { cwd, watched, approved: since }] of Object.entries(REPOS)) {
    const { from = since, to = 'HEAD' } = ranges[repo] ?? {}
    const at = (args) => gitRaw(args, { cwd })
    const log = at(['log', '--reverse', '--format=%H%x09%h%x09%ad%x09%s', '--date=short', `${from}..${to}`, '--', ...watched]).trim()
    if (log) for (const line of log.split('\n')) {
      const [full, hash, date, subject] = line.split('\t')
      const files = at(['show', '--numstat', '--format=', full, '--', ...watched]).trim().split('\n').filter(Boolean).map((row) => {
        const [add, del, path] = row.split('\t')
        return { path, add: Number(add) || 0, del: Number(del) || 0, layer: layerOf(path) }
      })
      if (isApproval(repo, full, files)) continue
      const diff = at(['show', '--format=', '-U0', full, '--', ...watched])
      // The sources the commit's added lines carry (`<!-- src: … -->`, required since brain-shape.json's sourcesSince).
      const sources = [...new Set([...diff.matchAll(/^\+.*?<!--\s*src:\s*([^>]*?)\s*-->/gm)].map((m) => m[1]))]
      commits.push({ repo, full, hash, date, subject, files, sources, added: addedLines(diff) })
    }
    // Untrimmed: each porcelain line is two status letters, a space and the path, and the first letter is often
    // a space (" M file"), which a trim eats, cutting the first name one character short. A rename keeps its new name.
    dirty.push(...at(['status', '--porcelain', '--', ...watched]).split('\n').filter(Boolean).map((l) => short(l.slice(3).replace(/^.* -> /, ''))))
  }
  return { commits, dirty }
}

/** The build's brain, or the reason there is none to name. */
async function builtBrain(dir = root, brain) {
  try {
    return await currentBrain(dir, { brain })
  } catch (error) {
    return { error: `no build to hash under ${dir} (${String(error?.message ?? error).split('\n')[0]}); npm run build first` }
  }
}

if (argv.includes('--check')) {
  const { commits, dirty } = pending()
  const current = await builtBrain()
  const reasons = []
  if (commits.length) reasons.push(`${commits.length} brain commits since the brain Eric approved (${approved} here, ${pin.commit.slice(0, 7)} in slates-api) wait on his review page:\n${commits.map((c) => `    ${c.repo === 'api' ? 'slates-api ' : ''}${c.hash} ${c.subject.slice(0, 100)}`).join('\n')}`)
  if (dirty.length) reasons.push(`${dirty.length} brain files are not committed: ${dirty.join(', ')}`)
  if (current.error) reasons.push(current.error)
  else if (current.unbuilt.length) reasons.push(`the build is older than the skills on disk (${current.unbuilt.join(', ')}); npm run build first`)
  if (!board.approvedBrainHash) reasons.push('scoreboard.json has no approvedBrainHash, which the gate needs for its baseline: pin it from a clean build of the approved commit (--pin-approved-hash <checkout>, README § Running it)')
  else if (!current.error && current.brainHash !== board.approvedBrainHash) reasons.push(`this build hands agents brain ${current.brainHash}, not the approved ${board.approvedBrainHash}${commits.length || dirty.length ? '' : `; no brain commit explains it, so a change outside the watched files reached the doctrine (git log ${approved}..HEAD -- packages/shared/src)`}`)
  if (!reasons.length) {
    console.log(`✓ brain review: this build is the brain Eric approved (${approved}, brain ${current.brainHash})`)
    process.exit(0)
  }
  stop([...reasons, 'Build the page (scripts/brain-review.mjs --spec), get his answers, revert what he held, then --approve.'])
}

if (argv.includes('--pin-approved-hash')) {
  // <dir> is any copy of the approved commit (a `git archive` export needs no second clone): every source file the
  // build reads must match the commit byte for byte, which also proves no edit was made there.
  const dir = resolve(flag('pin-approved-hash') ?? '')
  const refuse = []
  const sources = git('ls-tree', '-r', '--name-only', approved, '--', 'packages/shared/skills', 'packages/shared/src', 'packages/shared/scripts').split('\n').filter(Boolean)
  const differs = sources.filter((p) => {
    try { return !readFileSync(join(dir, p)).equals(execFileSync('git', ['show', `${approved}:${p}`], { cwd: root, maxBuffer: 64 * 1024 * 1024 })) } catch { return true }
  })
  if (!sources.length) refuse.push(`the approved commit ${approved} has no packages/shared sources`)
  if (differs.length) refuse.push(`${dir} is not the approved commit ${approved}: ${differs.length} source files differ or are missing (${differs.slice(0, 5).join(', ')}${differs.length > 5 ? ', …' : ''})`)
  // A served build of the approved commit is hashed on its own brain: slates-api brain/ at the approved pin.
  const built = await builtBrain(dir, flag('baseline-brain') && resolve(flag('baseline-brain')))
  if (built.error) refuse.push(built.error)
  else if (built.unbuilt.length) refuse.push(`the build in ${dir} is older than its skills (${built.unbuilt.join(', ')}); npm run build there`)
  if (board.approvedBrainHash && !built.error && board.approvedBrainHash !== built.brainHash) refuse.push(`scoreboard.json already pins ${board.approvedBrainHash}; only --approve moves it`)
  if (refuse.length) stop(['approved brain hash not pinned', ...refuse])
  board.approvedBrainHash = built.brainHash
  writeFileSync(BOARD, JSON.stringify(board, null, 2) + '\n')
  console.log(`✓ brain review: the approved brain ${approved} hands agents brain ${built.brainHash}; pinned`)
  process.exit(0)
}

const pid = (diff) => (diff.trim() ? execFileSync('git', ['patch-id', '--stable'], { cwd: root, input: diff, encoding: 'utf8' }).trim().split(/\s+/)[0] : null)
/** True when commit r undoes held commit h, both in `repo`: all of it, or all of its brain files and nothing else. */
function reverts(r, h, repo = 'mcp') {
  const { cwd, watched } = REPOS[repo]
  const at = (args) => gitRaw(args, { cwd })
  const isWatched = repo === 'mcp' ? watchedPath : (p) => p.startsWith(`${BRAIN_PATH}/`) || watched.includes(p)
  if (pid(at(['show', '--format=', r])) === pid(at(['diff', h, `${h}^`]))) return true
  const touched = at(['show', '--name-only', '--format=', r]).trim().split('\n').filter(Boolean)
  const undo = pid(at(['diff', h, `${h}^`, '--', ...watched]))
  return touched.length > 0 && touched.every(isWatched) && undo !== null && pid(at(['show', '--format=', r, '--', ...watched])) === undo
}

if (argv.includes('--approve')) {
  if (!flag('spec') || !flag('decisions')) stop(['not approved: --approve needs --spec <the page\'s spec.json> and --decisions <decisions.json exported from the page\'s database> (README § Eric\'s decisions)'])
  const spec = readJson(flag('spec'))
  const decisions = readJson(flag('decisions'))
  const refuse = []
  const page = spec.brain
  if (!page?.head) stop(['not approved: the spec records no head commit; rebuild the page with this script'])
  if (page.approvedCommit !== approved) refuse.push(`the page was built against the approved brain ${page.approvedCommit}, and the approved brain is ${approved}; rebuild the page`)
  if (!page.api?.head) stop(['not approved: the spec records no slates-api head; rebuild the page with this script'])
  if (page.api.approvedCommit !== pin.commit) refuse.push(`the page was built against slates-api's approved brain ${page.api.approvedCommit.slice(0, 7)}, and brain-approved.json pins ${pin.commit.slice(0, 7)}; rebuild the page`)
  // Each home's page head, by repo.
  const heads = { mcp: page.head, api: page.api.head }
  for (const [repo, head] of Object.entries(heads)) {
    let ancestor = true
    try { execFileSync('git', ['merge-base', '--is-ancestor', head, 'HEAD'], { cwd: REPOS[repo].cwd, stdio: 'ignore' }) } catch { ancestor = false }
    if (!ancestor) stop([`not approved: the page's ${repo === 'api' ? 'slates-api ' : ''}head ${head.slice(0, 10)} is not in HEAD's history; rebuild the page`])
  }

  // Every commit that waits is on the page, and every item on the page waits.
  const waiting = pending({ mcp: { to: heads.mcp }, api: { to: heads.api } }).commits
  const items = spec.items ?? []
  const itemOf = (key) => items.find((it) => it.id === key || (key.length >= 7 && (it.commit ?? '').startsWith(key)))
  for (const c of waiting) if (!items.some((it) => it.commit === c.full || it.id === c.hash)) refuse.push(`${c.hash} waits but is not on the page; rebuild the page`)
  for (const it of items) if (!waiting.some((c) => it.commit === c.full || it.id === c.hash)) refuse.push(`${it.id} is on the page but does not wait between the approved brain and the page's head`)
  const decided = new Map()
  for (const [key, choice] of Object.entries(decisions)) {
    const it = itemOf(key)
    if (!it) refuse.push(`decisions.json decides ${key}, which is not on the page`)
    else if (choice !== 'approve' && choice !== 'hold') refuse.push(`decisions.json: ${key} is "${choice}"; each is "approve" or "hold"`)
    else decided.set(it.id, choice)
  }
  const undecided = items.filter((it) => !decided.has(it.id))
  if (undecided.length) refuse.push(`Eric has not decided ${undecided.length} items: ${undecided.map((it) => it.id).join(', ')}`)
  const held = items.filter((it) => decided.get(it.id) === 'hold')

  // What he held is out of HEAD, and nothing came in after the page that he did not see: in each home, its own
  // commits after the page's head there (slates-api's only those touching what it watches: the brain, its code, the pin).
  const repoOf = (it) => it.repo ?? 'mcp'
  const since = {}, after = {}
  for (const repo of Object.keys(REPOS)) {
    const scope = repo === 'api' ? ['--', ...REPOS.api.watched] : []
    since[repo] = gitAt(repo, 'rev-list', '--reverse', `${REPOS[repo].approved}..HEAD`, ...scope).split('\n').filter(Boolean)
    after[repo] = gitAt(repo, 'rev-list', '--reverse', `${heads[repo]}..HEAD`, ...scope).split('\n').filter(Boolean)
  }
  const revertOf = new Map()
  for (const it of held) {
    const repo = repoOf(it)
    const h = it.commit ?? gitAt(repo, 'rev-parse', it.id)
    const r = since[repo].filter((x) => x !== h).find((x) => reverts(x, h, repo))
    if (r) revertOf.set(r, it.id)
    else refuse.push(`${it.id} is held and still in ${repo === 'api' ? "slates-api's" : ''} HEAD: git revert ${it.id} (its brain files at least), then approve`)
  }
  for (const repo of Object.keys(REPOS)) for (const x of after[repo]) if (!revertOf.has(x)) refuse.push(`${repo === 'api' ? 'slates-api ' : ''}${x.slice(0, 10)} came after the page was built and is not the revert of a held item; rebuild the page so Eric sees it`)

  const dirty = [
    ...gitRaw(['status', '--porcelain', '--', 'packages/shared', ...WATCHED]).split('\n').filter(Boolean).map((l) => l.slice(3)),
    ...gitRaw(['status', '--porcelain', '--', ...REPOS.api.watched], { cwd: API }).split('\n').filter(Boolean).map((l) => `slates-api/${l.slice(3)}`),
  ]
  if (dirty.length) refuse.push(`commit or revert what is not committed under packages/shared and the brain files: ${dirty.slice(0, 8).join(', ')}${dirty.length > 8 ? ` and ${dirty.length - 8} more` : ''}`)

  // The gate: candidate against the approved brain, in the same batch, on exactly this build.
  const files = { routing: flagAll('routing'), craft: flagAll('craft') }
  if (!files.craft.length) refuse.push('pass --craft <craft.json> from a craft run of both arms on this build')
  if (!files.routing.length) refuse.push('pass --routing <routing.json> from at least one routing run of both arms on this build')
  const current = await builtBrain()
  let gate = { lines: [], fail: [] }
  if (current.error) refuse.push(current.error)
  else {
    gate = compare(board, readResults(files), current)
    if (!after.mcp.length && !after.api.length && page.brainHash !== current.brainHash) refuse.push(`this build hands agents brain ${current.brainHash}, not the ${page.brainHash} the page was built from; rebuild the page`)
  }
  if (gate.lines.length) console.log(gate.lines.join('\n'))
  refuse.push(...gate.fail.map((f) => `gate: ${f}`))
  if (refuse.length) stop(['not approved', ...refuse])

  // The page's head, plus only the reverts of what he held: what he approved and nothing else.
  board.approvedCommit = after.mcp.length ? git('rev-parse', '--short', 'HEAD') : page.headShort
  board.approvedBrainHash = current.brainHash
  // slates-api serves the brain at this commit from its next deploy (its build exports brain/ at the pin), and its
  // snapshot refuses a pin whose commit and hash are not these (approvedApiCommit, approvedBrainHash).
  pin.commit = after.api.length ? gitAt('api', 'rev-parse', 'HEAD') : heads.api
  // The hash of brain/ at that commit as the server serves it, which its build and its boot check the export against.
  const servedHash = execFileSync('node', ['scripts/brain-snapshot.mjs', '--served-hash', pin.commit], { cwd: API, encoding: 'utf8' }).trim()
  board.approvedApiCommit = pin.commit
  board.approvedOn = new Date().toISOString().slice(0, 10)
  delete board.firstBaseline
  board.lastApproval = {
    from: approved,
    page: page.headShort,
    approved: items.filter((it) => decided.get(it.id) === 'approve').map((it) => it.id),
    held: held.map((it) => it.id),
    reverts: [...revertOf.keys()].map((x) => x.slice(0, 10)),
    gate: gate.lines,
  }
  writeFileSync(BOARD, JSON.stringify(board, null, 2) + '\n')
  pin.approvedOn = board.approvedOn
  pin.approvedBrainHash = current.brainHash
  pin.servedHash = servedHash
  pin.standsFor = `the brain Eric approved with slates-mcp ${board.approvedCommit} (brain ${current.brainHash})`
  writeFileSync(PIN, JSON.stringify(pin, null, 2) + '\n')
  console.log(`✓ brain review: ${items.length - held.length} approved, ${held.length} held and reverted; the approved brain is now ${board.approvedCommit} here and ${pin.commit.slice(0, 7)} in slates-api (brain ${current.brainHash}). Next: npm run build:plugins, then commit scoreboard.json with plugins/** here, and brain-approved.json in slates-api.`)
  process.exit(0)
}

const specOut = flag('spec')
if (!specOut) {
  console.error('usage: brain-review.mjs --spec <out.json> --notes <notes.json> | --check | --approve --spec <spec.json> --decisions <decisions.json> --craft <craft.json> --routing <routing.json> | --pin-approved-hash <checkout> [--baseline-brain <dir>]')
  process.exit(2)
}
const { commits, dirty } = pending()
const current = await builtBrain()
const notes = flagAll('notes').reduce((all, file) => ({ ...all, ...readJson(file) }), {})
const noteFor = (hash) => Object.entries(notes).find(([k]) => hash.startsWith(k) || k.startsWith(hash))?.[1]
{
  const refuse = []
  if (dirty.length) refuse.push(`commit or revert the uncommitted brain files first, so the page names what ships: ${dirty.join(', ')}`)
  if (current.error) refuse.push(current.error)
  else if (current.unbuilt.length) refuse.push(`the build is older than the skills on disk (${current.unbuilt.join(', ')}); npm run build first`)
  const bare = commits.filter((c) => !String(noteFor(c.hash) ?? '').trim())
  if (bare.length) refuse.push(`--notes gives no recommendation for ${bare.length} items: ${bare.map((c) => c.hash).join(', ')}`)
  if (refuse.length) stop(['no page built', ...refuse])
}
const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch])
const pct = (x) => (x == null ? 'n/a' : `${Math.round(x * 100)}%`)
const tests = [
  ...flagAll('routing').map((file) => {
    const { model, arms = {} } = readJson(file)
    const arm = (a) => (a?.noRouter ? 'no router' : a ? `${a.hits} of ${a.answered}` : 'not run')
    return `routing on ${model}: ${arm(arms.candidate)} asks to the right playbook, against ${arm(arms.baseline)} for the approved brain`
  }),
  ...flagAll('craft').map((file) => {
    const { arms = {} } = readJson(file)
    const now = arms.candidate ?? {}, before = arms.baseline ?? {}
    return `craft ${now.craft?.toFixed(2)} of 2 on ${now.runs} runs against ${before.craft?.toFixed(2) ?? 'n/a'} for the approved brain, the router or playbook read before building in ${pct(now.readFirst)} (before ${pct(before.readFirst)}), ${now.forbiddenRuns} runs with a forbidden action (before ${before.forbiddenRuns ?? 'n/a'})`
  }),
]
// The doctrine also reads the model lists in operations/index.ts, so a commit outside WATCHED can change what agents
// read with no item of its own; the intro names those commits, so Eric sees them before approving the hash.
const outside = git('log', '--format=%h %s', `${approved}..HEAD`, '--', 'packages/shared/src', ...DOCTRINE.map((p) => `:(exclude)${p}`)).split('\n').filter(Boolean)
const outsideNote = outside.length && current.brainHash !== board.approvedBrainHash ? ` ${outside.length} other commits under packages/shared/src since the approved brain may also change what agents read (the doctrine reads the model lists in the ops file), and approving takes them too: ${outside.slice(0, 6).map((l) => l.slice(0, 80)).join('; ')}${outside.length > 6 ? `; and ${outside.length - 6} more (git log ${approved}..HEAD -- packages/shared/src)` : ''}.` : ''
const rank = (c) => Math.min(...c.files.map((f) => RANK[f.layer] ?? LAYERS.length))
const kind = (c) => {
  const top = c.files.map((f) => f.layer).filter((l) => (RANK[l] ?? LAYERS.length) === rank(c))
  return top.includes('router') ? 'router' : top[0] ?? 'other'
}
const size = (c) => c.files.reduce((n, f) => n + f.add + f.del, 0)
const ranked = [...commits].sort((a, b) => rank(a) - rank(b) || size(b) - size(a))
const items = ranked.map((c, i) => {
  const layer = kind(c)
  return {
    id: c.hash,
    commit: c.full,
    repo: c.repo,
    kind: layer,
    kind_label: `${i + 1}. ${LABEL[layer]}`,
    tone: { router: 3, doctrine: 3, pin: 3, playbook: 2, rule: 1, motion: 1 }[layer] ?? 0,
    title: c.subject.length > 160 ? `${c.subject.slice(0, 157)}…` : c.subject,
    meta: `${c.date} · ${c.repo === 'api' ? 'slates-api ' : ''}${c.hash} · +${c.files.reduce((n, f) => n + f.add, 0)} −${c.files.reduce((n, f) => n + f.del, 0)}`,
    src: [...new Set(c.files.map((f) => short(f.path).replace(/\.md$/, '')))].join(', '),
    callout: `<b>Recommendation:</b> ${esc(noteFor(c.hash))}`,
    flags: c.sources.length ? c.sources.map((x) => `Source: ${x}`) : ['Source: the commit message (before sources were required)'],
    evidence_label: 'What changed, and the lines it adds',
    evidence: [c.subject, ...c.files.map((f) => `${short(f.path)}: ${LABEL[f.layer]}, +${f.add} −${f.del}`), ...c.added],
  }
})
const head = git('rev-parse', 'HEAD')
const spec = {
  intro: `${items.length} changes to the brain every Slates user's agent reads, since the brain you last approved (${approved}). They are ranked by reach, so the ones that change the most jobs come first: a router, doctrine or approval pin change reaches every job an agent does (a pin edited by hand moves what is served without this page), then playbooks (one kind of job each), rules (every job that links them), motion guides, model guides (one model each), then the shape file; within a layer the bigger change comes first.${tests.length ? ` Tests of the brain with all of them, against the approved brain in the same batch: ${tests.join('; ')}.` : ''} Approve sends a change out with the next shared release; Hold keeps it out (it is reverted before anything ships).${outsideNote}`,
  collection: 'review',
  choices: [{ id: 'approve', label: 'Approve' }, { id: 'hold', label: 'Hold' }],
  note_placeholder: 'What to change before it ships…',
  filters: [
    { id: 'router', label: 'Router', kind: 'router' },
    { id: 'doctrine', label: 'Doctrine', kind: 'doctrine' },
    { id: 'pin', label: 'Approval pins', kind: 'pin' },
    { id: 'playbook', label: 'Playbooks', kind: 'playbook' },
    { id: 'rule', label: 'Rules', kind: 'rule' },
    { id: 'motion', label: 'Motion guides', kind: 'motion' },
    { id: 'model', label: 'Model guides', kind: 'model' },
  ],
  // What --approve checks the decisions against: the page names these commits and this build, nothing later.
  brain: {
    approvedCommit: approved, head, headShort: git('rev-parse', '--short', 'HEAD'), brainHash: current.brainHash,
    api: { approvedCommit: pin.commit, head: gitAt('api', 'rev-parse', 'HEAD') },
  },
  items,
}
writeFileSync(resolve(specOut), JSON.stringify(spec, null, 2) + '\n')
console.log(`✓ brain review: ${items.length} items since ${approved}, built from ${spec.brain.headShort} (brain ${current.brainHash})`)
