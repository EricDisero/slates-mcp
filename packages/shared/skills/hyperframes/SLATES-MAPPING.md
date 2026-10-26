# HyperFrames in Slates: what each command and Studio surface is here

The folders beside this file are HyperFrames' own skills, unmodified apart from the files `NOTICE` lists. They were
written for HyperFrames' CLI and its Studio, and they say `npx hyperframes <command>` and "the Studio
timeline" throughout. Inside Slates there is no HyperFrames project folder and no CLI to run: an HTML
clip is one HyperFrames composition (an HTML document with a GSAP timeline registered on
`window.__timelines`) drawn on an overlay track of a Slates cut. Read the craft in those skills; do
the work with the Slates tools below. Never run their scripts or `npx hyperframes`.

Slates' own guides direct the work and these carry the craft: for an ad, start with the Slates guide
(`slates_get_prompting_guide`, query: the brief), and come here when writing a layer or for editing
craft.

## Commands

| HyperFrames | In Slates |
|---|---|
| `render` (any quality, local or `--docker`) | Export the Cut: `slates_export_video` for one cut, `slates_export_cuts` for several cuts or delivery formats at once. HTML clips render with the cut, every frame at the timeline's rate (24, 30 or 60 fps, set with `slates_update_timeline_settings`). |
| `preview`, `play` | The Slates player: the Cut's Viewer. Open it for the user with `slates_set_view`. |
| `add <name>` | The registry picker in the Cut, or `slates_list_motion_blocks` then `slates_add_html_clip` with `block` set to the item's name. |
| `catalog --query` | `slates_list_motion_blocks` with `query`. It reads the registry at the HyperFrames version Slates runs; there is no on-device tier to offer. |
| `lint`, `check` (and the old `validate`, `inspect`, `layout`) | `slates_check_composition`. The same check runs on every `slates_add_html_clip` and `slates_update_html_clip`, and its findings come back in the result: fix every error before moving on. |
| `timeline --json` | `slates_get_timeline`: tracks, clips, their frames and the frame rate. |
| `tts` | Slates' text-to-speech seat, `inworld-tts-2`, through `slates_generate_audio` (craft: `slates_get_prompting_guide`, topic `tts`). It spends credits: quote first. |
| `beats` | A music clip's beat grid: `slates_find_beats` finds it, `slates_get_beat_grid` reads it (and where each beat lands on the cut), `slates_edit_beat_grid` corrects it, `slates_cut_to_beats` lands a lane's cuts on it. All free, on the user's machine. |
| `transcribe` | `slates_transcribe_asset` (free, on the user's machine), read back with `slates_get_asset_transcript`. Captions from it: `slates_add_captions`. |
| `doctor` | `slates doctor` in the Slates CLI checks the Slates setup. |
| `upgrade`, `info`, `docs`, `skills`, `compositions`, `clean`, `benchmark`, `browser` | Not needed: Slates ships one pinned HyperFrames version and these skills with it. |
| `cloud`, `lambda`, `cloudrun`, `auth`, `publish` | Not needed: Slates exports on the user's machine. |
| `feedback`, `telemetry`, `events`, `usage` | Do not run; they report to HyperFrames, not to Slates. |
| `open`, `catch-up` (the HyperFrames desktop app) | Not needed: the work is already in the Slates app. |

## Studio surfaces

| HyperFrames Studio | In Slates |
|---|---|
| A timeline row | A Slates track. Layers go on overlay tracks (`slates_add_timeline_track`, type overlay), one element kind per track; a transparent foreground and its background plate sit on separate tracks. |
| A clip's `data-start` and `data-duration` on the main timeline | The HTML clip's `startFrame` and `endFrame` (or `durationSec`) on the Slates timeline. Inside the composition, its own timing stays as the skills teach. |
| The caption track | The track `slates_add_captions` makes, or an overlay track you name. |
| The current selection (`preview --context`) | `slates_get_selection`. |
| The project's `assets/` folder | The Slates project's own folder. A composition loads its pictures, SVGs and fonts by their path there (`images/logo.svg`, `fonts/Brand.woff2`; the folder is the projects folder from `slates_get_app_settings`, then the project id) and nothing outside it. A picture can also be a declared variable of type image, given a project picture's asset id. On export a declared font that does not load fails the export by name. |
| Safe zones | Show safe area in the Cut. |
| The final preview before render | The Cut's Viewer; export only once the user approves, as the skills say. |

## What Slates lacks (the build list)

Each of these is named in the skills and has no Slates equivalent yet. When a skill calls for one, say
it is not in Slates yet and work without it.

- `remove-background`: cutting a subject out of footage.
- `snapshot`: frames of a composition before export, to look at a layer as it will draw.
- `compare`, `grade-compare`: comparing two renders or two grades frame by frame.
- `render --batch` with variables: one composition rendered once per row of values.
- `keyframes`: seek-safe keyframe diagnostics of a composition. Moving a whole clip over time on the Slates timeline (position, scale, rotation, opacity, crop) is `slates_set_clip_keyframes`.
- `media-treatment`: LUTs and other deterministic looks on footage. Grain, saturation and blend modes are a clip's `look` in `slates_update_clip`.
- `figma`: importing Figma assets, tokens and components.
- `capture`: capturing a website into a composition.
- `init` and sub-compositions: a multi-scene HyperFrames project. Slates holds one composition per HTML clip; nesting clips is the engine plan's compound clip, not built.
- `history begin` / `undo` for an agent's turn: the app has its own undo, with no tool for it.
- `present`: a navigable deck. Slates makes video, not slides.
