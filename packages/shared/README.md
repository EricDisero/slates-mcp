# @slatesvideo/shared

Internal shared layer for the [Slates](https://slates.video) MCP server and CLI: the auth/connection-file reader, the cloud and desktop HTTP clients, and the single operations array both surfaces register. You almost certainly want [@slatesvideo/mcp-server](https://www.npmjs.com/package/@slatesvideo/mcp-server) (local MCP clients like Codex with your ChatGPT account, Claude Desktop, and Cursor) or [@slatesvideo/cli](https://www.npmjs.com/package/@slatesvideo/cli) (the `slates` command) instead — this package is published only as their dependency.

Source: [github.com/EricDisero/slates-mcp](https://github.com/EricDisero/slates-mcp)

## Prompt partials — how shared prompting prose stays de-forked

Prompting doctrine that applies to more than one model lives **once**, in `skills/_partials/<name>.md`. Every surface that needs it derives:

- **Skill markdown** (`skills/*.md`) carries a marker pair; `scripts/sync-partials.mjs` writes the resolved text between them and commits it, so each de-fork is visible in review and `install-skills` can keep writing the files verbatim to disk.

  ```markdown
  <!-- @inject:reference-rules-core -->
  …generated; do not edit between the markers…
  <!-- @end:reference-rules-core -->
  ```

- **TypeScript** reads the same text from the generated `PARTIALS` record (`src/prompts/partials.generated.ts`) — that is how `REFERENCE_RULES_TEXT` and the doctrine-bearing cards in `prompting-tips.ts` are built.

`npm run build` runs `sync-partials.mjs --check`, which fails with a diff if anything inside a marker block was hand-edited, if a skill references a partial that doesn't exist, if markers are unbalanced, or if a partial is referenced by nothing. Run `npm run sync-partials` to apply changes after editing a partial.

**To change shared prompting doctrine: edit the partial.** Never edit between markers, never edit `partials.generated.ts`, and never hand-copy a shared rule into a new skill — a copy is a fork with a delay fuse. Per-model levers (a vendor's own official consistency mechanism, its caps and transport quirks) stay hand-authored, below the injected block, under a `### For <model> specifically` heading.

## Portable Prompt Builder export

The downloadable Claude `.skill` is built into `exports/slates-prompt-builder/generated/`, which is gitignored and outside this package's `files`: its model, character and content-policy references are license-tier guides from the private brain (`slates-api/brain/`), so they never enter this public repo or the npm tarball. Its routing table derives from `MODEL_FACTS`; the portable wrapper (`prompt-builder.md`) owns only export-specific scope and output behavior.

```bash
npm run sync-prompt-builder   # build the markdown, manifest and deterministic .skill into generated/, and sync the vault mirror
```

`scripts/build-prompt-builder.mjs --check` (in build and typecheck) renders the export in memory, keeps the archive byte-exact, verifies its entry set and the runtime character contract (one sheet, the canonical `IDENTITY_PLATE_HEX`, flat/shadowless light, the three-panel builder), and fails if `generated/` could publish: tracked, not ignored, or in `files`. `scripts/brain-leak-check.mjs` (root build) fails on any tracked file holding a 90-character line of the brain. The download is served from the private slates-web repo (`public/slates-prompt-builder.skill`): refresh it by copying the built `.skill` there.
