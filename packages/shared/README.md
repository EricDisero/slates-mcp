# @slatesvideo/shared

Internal shared layer for the [Slates](https://slates.video) MCP server and CLI: the auth/connection-file reader, the cloud and desktop HTTP clients, and the single operations array both surfaces register. You almost certainly want [@slatesvideo/mcp-server](https://www.npmjs.com/package/@slatesvideo/mcp-server) (MCP clients like Claude Desktop and Cursor) or [@slatesvideo/cli](https://www.npmjs.com/package/@slatesvideo/cli) (the `slates` command) instead — this package is published only as their dependency.

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

The downloadable Claude `.skill` is generated at `exports/slates-prompt-builder/generated/`. Its model, character, and content-policy references come directly from the resolved production files in `skills/`; its routing table derives from `MODEL_FACTS`; the portable wrapper owns only export-specific scope and output behavior.

```bash
npm run sync-prompt-builder   # regenerate markdown, manifest, and deterministic .skill
npm run typecheck             # fails if the committed export is stale
```

`scripts/build-prompt-builder.mjs --check` validates generated text content (normalizing LF/CRLF), keeps the archive byte-exact, opens it to verify its exact entry set, and enforces the runtime character contract (one sheet, the canonical `IDENTITY_PLATE_HEX`, flat/shadowless light, and the three-panel builder). Never edit `exports/slates-prompt-builder/generated/` directly.

The repository verification workflow runs both typecheck and build on every pull request and push to `main`, so stale exports cannot merge through the normal GitHub path.
