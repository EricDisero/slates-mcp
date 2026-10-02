---
name: slates-previs-blocking
description: "Build and render a Blender blocking pass for precise camera paths, cut timing or spatial continuity, then guide video generation with the clip. Use when those controls are required or prompting has failed to hold them."
---

# Previs blocking — design the shot, then generate it

The spine of the whole workflow. Read this first; the other four previs skills are branches off it.

## The mechanism (why this works at all)

A text prompt asks the model to *invent* camera motion, so it invents differently every roll. You cannot iterate on a variable you do not control, so you re-roll and pay again.

A **reference video** removes the invention. You build the shot in Blender as untextured proxies — a neutral grey set with colour-coded figures, free, instant, deterministic — render the camera's path to mp4, and hand the model that clip alongside the prompt. **Blender locks the motion; the model builds the world.** Iteration moves to the free half, and the paid half usually lands first try.

Two halves, and keeping them separate is the whole discipline:

| Half | Lives in | Changes when |
|---|---|---|
| **Structure** — cuts, camera, timing, who is where | the blocking clip | you re-block |
| **Style** — what any of it looks like | references + prompt text | you restyle (see `slates-restyle-from-blocking`) |

## Before you start

1. `slates_blender_status` — confirms the bridge is up and returns fps, frame range, existing camera. If it reports `connected: false`, relay its hint and stop; nothing else here works.
2. Settle **format first**, because the blocking render *is* the film's format: fps, aspect, duration. 24fps is the default and makes cut times land on clean frames. Duration ≤ 30s (seedance-2.5's reference-video ceiling; 15s on the others).
3. Know the shot count. "One take" and "19 cuts" are different builds.

## Build order

Do these in order. Each stage is verifiable on its own, and a camera built before the geometry has nothing to frame.

### 1. Set the format

```python
scene = bpy.context.scene
scene.render.fps = 24
scene.render.fps_base = 1.0
scene.render.resolution_x, scene.render.resolution_y = 1920, 1080
scene.frame_start, scene.frame_end = 1, 720   # 30s at 24fps
result = {"seconds": 720 / 24}
```

Frame maths, stated once so you never redo it in your head: **frame = seconds × fps + 1**. A cut at 7.79s is frame 188.

### 2. Geometry and light — grey set, coded figures, named

Proxies only. A person is a box or a capsule with a sphere head. A car is a stretched cube. A can is a cylinder. **The SET is neutral grey — one light, a floor and enough wall that the space reads.** Colour is reserved for the figures, where it carries meaning (below); a grey set is what makes those few colours legible as notation rather than décor. Anything you spend on materials here you pay for twice, because the model repaints every surface anyway.

**Name every object for what it *is* in the story**, not `Cube.003`. The name is how you refer to it later, and it is how you keep your own timeline honest.

Two conventions that cost nothing now and save a re-roll later:

- **Colour is identity.** Give each character a distinct viewport colour and *write the mapping down* — `red = the boss, green = the kid, blue = the driver`. The generation prompt will restate that mapping so the model knows which grey body is which person across cuts. Without it, characters swap.
- **Encode facing on featureless proxies.** A box has no front. Mark one face red, the back black, the sides green, and say so in the prompt: `RED face = the direction he faces`. Otherwise the model guesses which way people are looking.
- **Checker a surface when SCALE or SPEED has to read.** Flat grey gives a model no parallax cue, so a fast move over a featureless floor reads as slow, and a big room reads as a small one. A black-and-white checker on the ground (or the wall a camera races past) gives it something to measure against. ⚠️ **Build it as GEOMETRY, never as a Checker Texture node.** The blocking render is Workbench, which draws one flat colour per material and never evaluates a shader node tree — a `TEX_CHECKER` comes out flat grey and you lose the cue without being told. Subdivide the plane and alternate `material_index` per face. Like every other colour here it is notation, so it goes in the translation list and gets dressed over.

```python
# Two materials, alternated per face. `TILE` is the square size in metres.
dark = bpy.data.materials.new("Checker_Dark")
dark.diffuse_color = (0.05, 0.05, 0.05, 1.0)
light = bpy.data.materials.new("Checker_Light")
light.diffuse_color = (0.80, 0.80, 0.80, 1.0)
floor.data.materials.append(dark)    # material_index 0
floor.data.materials.append(light)   # material_index 1
# Subdivide first (edit mode or a Subdivide modifier applied) so there ARE
# faces to alternate — a 2-triangle plane can only ever be one colour.
for face in floor.data.polygons:
    cx, cy = face.center.x, face.center.y
    face.material_index = (int(cx // TILE) + int(cy // TILE)) % 2
```

And the identity colour on each proxy:

```python
mat = bpy.data.materials.new("ID_Red")
mat.diffuse_color = (0.8, 0.1, 0.1, 1.0)   # what the blocking render draws
obj.data.materials.append(mat)
obj.color = (0.8, 0.1, 0.1, 1.0)           # same value, for viewport parity
```

The blocking render pins Workbench to `MATERIAL` shading, so **`mat.diffuse_color` is the value that reaches the clip** — and an object with no material at all falls back to a neutral grey, which is why an unpainted set still reads correctly. Set `obj.color` to the same value anyway: it costs one line, it makes the user's viewport match what renders, and keeping the two equal means you never have to remember which one is authoritative.

### 3. Camera

The whole of `slates-camera-language`. Build the rig, then keyframe it. Then **read back what you built** with `slates_blender_scene` — its `cutSeconds` is your cut list, and it is the number you will write timings against. That field is the authoritative one on EITHER rig — marker frames when cameras are bound to markers, the active camera's own keyframes when they are not. `camera.keyframeSeconds` is empty on a marker-bound edit, which is the rig `slates-camera-language` recommends for anything past a handful of cuts.

### 4. Handheld, last

Add it after the moves are right, never before — noise on top of a wrong path just hides the wrong path.

<!-- @inject:blender-action-curves -->
## Read animation curves from the active action layout

Blender 5 uses layered actions: curves belong to the channelbag for `animation_data.action_slot`, inside each layer's strips. A direct `action.fcurves` lookup failed on Blender 5.2.1 in the 2026-08-28 blocking run. Feature-detect the layout before changing interpolation or noise; an unanimated object can legitimately have no curves.

The snippets below use this small Blender-side iterator. It runs inside Blender; no add-on code is imported into the MCP package.

```python
def action_curves(datablock):
    anim = getattr(datablock, "animation_data", None)
    action = getattr(anim, "action", None)
    if action is None:
        return
    if hasattr(action, "fcurves"):
        yield from action.fcurves
    elif getattr(anim, "action_slot", None) is not None:
        for layer in action.layers:
            for strip in layer.strips:
                if hasattr(strip, "channelbag"):
                    bag = strip.channelbag(anim.action_slot)
                    if bag is not None:
                        yield from bag.fcurves
```

Use the datablock that owns the keyed property: the curve data for `eval_time`, the object for location and rotation, the camera data for lens. Confirm a named channel exists before assuming a keyframe operation created it.
<!-- @end:blender-action-curves -->

### 5. Verify the cuts

The one check that catches the most damage: on a multi-cut blocking, camera position, target and focal length must all change **exactly on the cut frame, with no transition frame between**. One interpolated frame reads as a whip-pan the model will faithfully reproduce.

```python
# On a jump-cut camera, key the final pre-cut pose at cut_frame - 1.
# CONSTANT belongs to that preceding key: interpolation controls its OUTGOING segment.
# Check object transforms and camera data (including lens). Repeat for a keyed target.
for owner in (cam, cam.data):
    for fc in action_curves(owner):
        keys = list(fc.keyframe_points)
        for previous, current in zip(keys, keys[1:]):
            if current.co[0] in CUT_FRAMES:
                assert previous.co[0] == current.co[0] - 1, "Key the final pre-cut state first"
                previous.interpolation = 'CONSTANT'
```

Also check nothing interpenetrates — proxies through floors, clones through the hero object, letters through each other. The model renders intersections as faithfully as it renders everything else.

### 6. Save a backup after every stage

Cheap, and blocking is iterative by nature.

```python
bpy.ops.wm.save_as_mainfile(filepath=path, copy=True)
```

## Render and generate

```
slates_blender_render_blocking { projectId, fps: 24 }
```

Renders the **scene camera** through scene settings and imports the mp4 into the project. The result does not depend on where the user left their viewport or mouse. It returns `asset.id` + `durationSeconds`.

Then:

```
slates_generate_video {
  model: "seedance-2.5",
  videoReferenceAssetIds: [<asset.id>],
  videoReferenceSecondsEach: [<durationSeconds>],
  characterAssetIds: [...], environmentAssetIds: [...], styleAssetIds: [...],
  prompt: <written per slates-blocking-to-prompt>
}
```

**A focused reference stack:** one identity sheet per character, any location or look reference the brief needs, the blocking clip, and a prompt written against it. Add a reference only for a distinct requirement; more competing references add variables rather than guaranteeing fidelity. An audio reference is valid when voice or sound continuity needs it and the selected endpoint supports it.

Choose a model that accepts video references using `slates-model-selection`, then read its current reference caps. Video duration limits apply to the combined reference clips, not to each clip independently; quote each actual input duration.

## Leaving holes on purpose

Where the model outperforms any blockout you could build — liquid, smoke, fire, cloth — **block a black gap instead** and say so in the prompt: `CUT 7 (14.5-17.0, black gap in the reference)`. You are reserving a slot, not forgetting one. Keep these exact times in the blocking record, then translate model-facing time cues through `slates-blocking-to-prompt`; not every endpoint accepts fractional timestamps.

## What not to do

- **Don't texture, light or material the blocking.** Grey is the specification. The reference supplies motion; the references supply look.
- **Don't animate what you don't need.** Heads especially — a proxy head turning wrong is worse than one that never turns.
- **Don't build the camera before the geometry.** It has nothing to aim at, and every value you set gets redone.
- **Don't skip reading the scene back.** Write timings from `slates_blender_scene`'s `cutSeconds`, never from what you intended to build.
- **Don't exceed the model's reference-video ceiling.** A 40s blocking against a 30s cap is rejected; trim it first.

## Related

`slates-camera-language` (rigs and moves) · `slates-blocking-to-prompt` (writing the prompt against the clip) · `slates-dialogue-blocking` (multi-character continuity) · `slates-restyle-from-blocking` (one blocking, many worlds) · `slates-model-selection` (routing)
