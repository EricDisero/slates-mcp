---
name: slates-previs-blocking
description: Build a 3D blocking pass in Blender, render it grey-box, and use it as a reference video so the generated shot follows a camera path you designed instead of one the model invented. Use when the user wants precise camera control, a multi-cut sequence, a one-take move, spatial consistency across shots, or says the camera keeps drifting / they keep burning credits re-rolling.
---

# Previs blocking — design the shot, then generate it

The spine of the whole workflow. Read this first; the other four previs skills are branches off it.

## The mechanism (why this works at all)

A text prompt asks the model to *invent* camera motion, so it invents differently every roll. You cannot iterate on a variable you do not control, so you re-roll and pay again.

A **reference video** removes the invention. You build the shot in Blender as untextured grey boxes — free, instant, deterministic — render the camera's path to mp4, and hand the model that clip alongside the prompt. **Blender locks the motion; the model builds the world.** Iteration moves to the free half, and the paid half usually lands first try.

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

### 2. Geometry and light — grey, simple, named

Proxies only. A person is a box or a capsule with a sphere head. A car is a stretched cube. A can is a cylinder. **Neutral grey, one light, a floor and enough wall that the space reads.** Anything you spend on materials here you pay for twice, because the model repaints every surface anyway.

**Name every object for what it *is* in the story**, not `Cube.003`. The name is how you refer to it later, and it is how you keep your own timeline honest.

Two conventions that cost nothing now and save a re-roll later:

- **Colour is identity.** Give each character a distinct viewport colour and *write the mapping down* — `red = the boss, green = the kid, blue = the driver`. The generation prompt will restate that mapping so the model knows which grey body is which person across cuts. Without it, characters swap.
- **Encode facing on featureless proxies.** A box has no front. Mark one face red, the back black, the sides green, and say so in the prompt: `RED face = the direction he faces`. Otherwise the model guesses which way people are looking.

```python
mat = bpy.data.materials.new("ID_Red")
mat.diffuse_color = (0.8, 0.1, 0.1, 1.0)   # viewport colour
obj.data.materials.append(mat)
obj.color = (0.8, 0.1, 0.1, 1.0)           # what Workbench renders
```

Workbench (what the blocking render uses) draws `object.color` when the shading colour type is `OBJECT`, so set both.

### 3. Camera

The whole of `slates-camera-language`. Build the rig, then keyframe it. Then **read back what you built** with `slates_blender_scene` — its `camera.keyframeSeconds` is your cut list, and it is the number you will write timings against.

### 4. Handheld, last

Add it after the moves are right, never before — noise on top of a wrong path just hides the wrong path.

### 5. Verify the cuts

The one check that catches the most damage: on a multi-cut blocking, camera position, target and focal length must all change **exactly on the cut frame, with no transition frame between**. One interpolated frame reads as a whip-pan the model will faithfully reproduce.

```python
# Every camera f-curve keyframe on a cut frame must be CONSTANT out of the
# previous key, or the cut smears.
for fc in cam.animation_data.action.fcurves:
    for kp in fc.keyframe_points:
        if int(kp.co[0]) in CUT_FRAMES:
            kp.interpolation = 'CONSTANT'
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

Renders the **scene camera** through scene settings — never the user's viewport, so the result does not depend on where they left their mouse — imports the mp4 into the project, and returns `assetId` + `durationSeconds`.

Then:

```
slates_generate_video {
  model: "seedance-2.5",
  videoReferenceAssetIds: [<the blocking asset>],
  videoReferenceSecondsEach: [<durationSeconds>],
  characterAssetIds: [...], environmentAssetIds: [...], styleAssetIds: [...],
  prompt: <written per slates-blocking-to-prompt>
}
```

**Four inputs, and that is the entire stack:** a character sheet each, one location/style reference, the blocking clip, and a prompt written against the blocking. Resist adding a fifth.

Model note: seedance-2.5 is the seat for this — 10 reference videos at up to 30s each. seedance-2 and minimax-h3 take 3 at 15s. Route per `slates-model-selection`.

## Leaving holes on purpose

Where the model outperforms any blockout you could build — liquid, smoke, fire, cloth — **block a black gap instead** and say so in the prompt: `CUT 7 (14.5-17.0, black gap in the reference)`. You are reserving a slot, not forgetting one.

## What not to do

- **Don't texture, light or material the blocking.** Grey is the specification. The reference supplies motion; the references supply look.
- **Don't animate what you don't need.** Heads especially — a proxy head turning wrong is worse than one that never turns.
- **Don't build the camera before the geometry.** It has nothing to aim at, and every value you set gets redone.
- **Don't skip reading the scene back.** Write timings from `slates_blender_scene`, never from what you intended to build.
- **Don't exceed the model's reference-video ceiling.** A 40s blocking against a 30s cap silently truncates.

## Related

`slates-camera-language` (rigs and moves) · `slates-blocking-to-prompt` (writing the prompt against the clip) · `slates-dialogue-blocking` (multi-character continuity) · `slates-restyle-from-blocking` (one blocking, many worlds) · `slates-model-selection` (routing)
