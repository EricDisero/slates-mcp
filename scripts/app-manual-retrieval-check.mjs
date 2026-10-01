// check:app-manual-retrieval — a user's question lands on the section that answers it, cheaply.
//
// Users ask their agent instead of reading the manual (Eric, 2026-09-30: progressive disclosure "needs to
// be absolutely perfect, very token efficient"). So the question is the unit: each row below is phrased
// the way a person asks, names the section (or sections) that answer it, and must come back first, within
// the token ceiling. It reads slate's SOURCE manual through the same reader the op uses, so it runs
// before build:llm-docs has copied the manual here.
//
//   node scripts/app-manual-retrieval-check.mjs            # fails under 90% first-hit, or over the ceiling
//   node scripts/app-manual-retrieval-check.mjs --verbose  # every question, what came back, its cost
//
// Decision: second-brain plans/2026-09-30-slates-manual-for-llms-1-6-1-decisions.md § 0.

import { readFileSync } from 'node:fs'
import { manualReader } from '../packages/shared/dist/index.js'
import { desktopSource } from './desktop-source.mjs'

const manual = readFileSync(desktopSource('docs/slates-llm-manual.md'), 'utf8')
const reader = manualReader(manual)
const verbose = process.argv.includes('--verbose')

/** An answer is one section, or two that fit together: ~1.5k tokens, plus the Related line. */
const ANSWER_TOKENS = 1800
const FIRST_HIT = 0.9

// [question, any of these heading fragments is a right first answer]
const QUESTIONS = [
  ['how do I export my video as an mp4', ['Timeline: export an MP4']],
  ['send my edit to davinci resolve to color grade', ['Timeline: export for DaVinci']],
  ['how do I make a video from a picture', ['make a video from a picture', 'first frame and last frame']],
  ['how do I buy more credits', ['Buy credits']],
  ['how do I delete a project', ['Home: delete a project']],
  ['rename my project', ['rename a project', 'titlebar left']],
  ['keep the same character in every shot', ['keep a character', 'Library']],
  ['what does Not sent mean on a reference tile', ['Not sent']],
  ['how do I hide the prompt box', ['Prompt box: hide']],
  ['how do I open the timeline', ['Timeline: open, close']],
  ['why does the timeline cover the whole board', ['Timeline: size and resize']],
  ['how do I split a clip in the timeline', ['Timeline: split a clip']],
  ['add a marker on the timeline', ['Timeline: markers']],
  ['change the timeline frame rate to 30 fps', ['Timeline: settings button']],
  ['how do I connect Claude Desktop to Slates', ['connect Claude', 'Claude Desktop']],
  ['make images with my ChatGPT account', ['ChatGPT']],
  ['what keyboard shortcuts are there', ['Keys anywhere', 'KEYS AND COMMANDS']],
  ['select all the images in media', ['Media: select cards', 'Keys on Media']],
  ['move pictures to another project', ['Move or copy', 'send media to another project']],
  ['make a folder for my pictures', ['Folders', 'file media into']],
  ['where do my new pictures get saved', ['folder dot', 'Folders']],
  ['generate every shot on the board that has no video yet', ['Generate panel', 'price and generate']],
  ['what is a shot', ['What a Shot is']],
  ['make cheap previews of every shot first', ['Previews', 'cheap previews', 'try ideas cheaply']],
  ['break my script into shots', ['Break into', 'cut it into Shots', 'write the script', 'break script into shots']],
  ['undo a change in the script', ['Script: undo and redo']],
  ['save different versions of a passage', ['sections and versions', 'keep versions']],
  ['the studio agent tab disappeared', ['turn it on or off', 'Studio Agent tab is gone', 'app, files and sign-in']],
  ['does the studio agent cost credits', ['credits and cost']],
  ['can the studio agent think on my claude plan', ['where it thinks']],
  ['use codex with my chatgpt plan for the studio agent', ['where it thinks']],
  ['stop the agent while it is running', ['stop or cancel a run']],
  ['import my own video files', ['import your own files']],
  ['my iphone photos will not import', ['importable file types', 'app, files and sign-in']],
  ['what happens if I close the app while it is generating', ['Recovery', 'close the app during a generation']],
  ['can I use slates offline', ['Offline', 'use Slates offline']],
  ['which video model should I use', ['WHICH MODEL TO USE', 'Which model should I use']],
  ['how many credits per second does seedance cost', ['MODEL REFERENCE TABLE', 'Video Models']],
  ['add a voice to a character', ['voices on items', 'attach a voice']],
  ['use my own voice recording for a voiceover', ['own voice recording', 'Clips and Describe']],
  ['compare two images side by side', ['Compare']],
  ['change something in a picture by describing it', ['Edit box', 'edit a picture', 'edit an image']],
  ['trim a clip to a shorter length', ['Trim & split']],
  ['save a still frame from a video', ['Extract a frame', 'grab a still']],
  ['make a character lip sync to speech', ['lip sync']],
  ['what exactly gets sent to the model', ['See what gets sent']],
  ['change which tab new projects open on', ['General']],
  ['move all my projects to a new computer', ['move to a new computer', 'move projects']],
  ['report a failed generation to support', ['report a failed generation', 'Generation logs']],
  ['point at the export button for me', ['controls you can point at', 'Export']],
  // Held out while tuning (2026-09-30), then kept so a later heading edit cannot quietly break them.
  ['how do I duplicate a shot', ['Duplicate', 'Shot card strip']],
  ['how do I pin a reference image', ['Pinned', 'pin picker']],
  ['where is the generate button', ['Generate button']],
  ['my generation failed what do I do', ['generation failed', 'generation errors']],
  ['how do I sign out', ['sign in and sign out', 'Account pane']],
  ['change the order of scenes', ['scene header', 'drag to reorder']],
  ['what is the animatic', ['the animatic']],
  ['delete a folder but keep the pictures', ['folder menu', 'delete a folder']],
  ['how do I zoom into the timeline', ['Timeline: zoom']],
  ['make the cards bigger on the board', ['View panel', 'View sizes']],
  ['turn off sound on a video generation', ['video settings', 'Audio inside a video clip']],
  ['how do I rename a board', ['Boards', 'board name']],
  ['export several cuts at once', ['Export several cuts']],
]

let hits = 0
let worst = 0
const misses = []
for (const [question, wanted] of QUESTIONS) {
  const answer = reader.sections(question)
  const tokens = Math.round(answer.length / 4)
  worst = Math.max(worst, tokens)
  // The first section's heading: the `###` under the context `##`, else the `##` itself.
  const heading = (answer.match(/^### (.+)$/m) ?? answer.match(/^## (.+)$/m))?.[1] ?? ''
  const hit = wanted.some((w) => heading.toLowerCase().includes(w.toLowerCase()))
  if (hit) hits++
  else misses.push(`  "${question}"\n    got:  ${heading}\n    want: ${wanted.join(' | ')}`)
  if (tokens > ANSWER_TOKENS) misses.push(`  "${question}": ${tokens} tokens, over ${ANSWER_TOKENS}`)
  if (verbose) console.log(`${hit ? '✓' : '✖'} ${String(tokens).padStart(5)} tok  ${question}\n           → ${heading}`)
}
const index = Math.round(reader.index().length / 4)
const rate = hits / QUESTIONS.length
console.log(`app-manual retrieval: ${hits}/${QUESTIONS.length} first hits (${Math.round(rate * 100)}%), largest answer ${worst} tokens, index ${index} tokens, whole manual ${Math.round(manual.length / 4)} tokens`)
if (rate < FIRST_HIT || misses.some((m) => m.includes(' over '))) {
  console.error(`✖ app-manual retrieval:\n${misses.join('\n')}`)
  process.exit(1)
}
if (misses.length) console.log(`misses (under the ${Math.round(FIRST_HIT * 100)}% floor, reported):\n${misses.join('\n')}`)
