---
name: slates-camera-language
description: Turn director vocabulary into real Blender camera rigs — orbits, floor rises, robo-arm whips, handheld, speed ramps, over-the-shoulder cuts — as bpy code. Use when building or refining the camera on a previs blocking pass, when a move needs to accelerate/hold/snap, or when someone asks for a "cinematic" camera and you need to convert that into an actual shot list.
---

# Camera language — from a shot list to a rig

Companion to `slates-previs-blocking`. That skill owns the workflow; this one owns the camera.

## The first rule

🚨 **Never build "a cinematic camera move." Brief the camera the way you would brief an operator:** rails, target, height, lens, and the frame each move starts and ends on. "Cinematic" is not a specification, and asking for one produces the drifting slop the whole blocking workflow exists to avoid.

Bad: *a dynamic cinematic orbit around the subject.*
Good: *a 3/4 orbit starting rear-left at 1.6m, ending front-right at 0.9m, frames 1–96, 35mm, easing out of the start and holding hard on the last 8 frames.*

If the user gives you the first, convert it to the second and say what you assumed.

## Look it up, don't recall it

Before any constraint or operator you are not certain of, call `slates_blender_docs` (e.g. `bpy.types.FollowPathConstraint`) or `slates_blender_search_docs`. Invented enum values are the most common failure here and they often fail *quietly* — the constraint gets added, the axis is wrong, and the camera points at nothing.

## The two primitives everything is built from

### Target-based aiming

Almost every move in this skill is *position on a path* plus *aim at a target*. Separating them is what lets framing vary while the subject stays in frame.

```python
import bpy

target = bpy.data.objects.new("CAM_TARGET", None)   # an Empty
target.empty_display_type = 'PLAIN_AXES'
bpy.context.collection.objects.link(target)

con = cam.constraints.new('TRACK_TO')
con.target = target
con.track_axis = 'TRACK_NEGATIVE_Z'   # cameras look down -Z
con.up_axis = 'UP_Y'
```

**Aim at a separate target, not at the subject's head.** A camera locked to the head produces dead, centred framing. Offset the target beside or ahead of the subject and the shot breathes — that small offset is most of what reads as "real operator."

For a subject that should notice the camera, keyframe the target's follow with a **few frames of lag** behind each camera move. Heads catch up; they don't teleport.

### Path-based movement

```python
curve = bpy.data.curves.new("CAM_PATH", 'CURVE')
curve.dimensions = '3D'
spline = curve.splines.new('BEZIER')
spline.bezier_points.add(len(points) - 1)
for bp, co in zip(spline.bezier_points, points):
    bp.co = co
    bp.handle_left_type = bp.handle_right_type = 'AUTO'

path = bpy.data.objects.new("CAM_PATH", curve)
bpy.context.collection.objects.link(path)

con = cam.constraints.new('FOLLOW_PATH')
con.target = path
con.use_curve_follow = False   # aiming is the Track To constraint's job

# Animate progress explicitly rather than relying on the default path animation.
curve.path_duration = 96
curve.eval_time = 0
curve.keyframe_insert("eval_time", frame=1)
curve.eval_time = 96
curve.keyframe_insert("eval_time", frame=96)
```

**Why a path and not raw location keys:** the user can drag a control point to retime or reshape the move without you regenerating anything. That is the difference between "re-prompt and hope" and "nudge it."

## Speed — the part that reads as production value

Movement at one constant speed is the tell of a machine. Real moves accelerate, hold, and snap.

Speed lives in the **f-curve handles** of `eval_time` (or of location, if you keyed it directly):

- **Long, near-horizontal handle** at a key → slow near that key.
- **Short, steep handle** → fast.
- `interpolation = 'CONSTANT'` → no movement at all until the next key. This is how you get an absolute dead stop.

```python
fc = curve.animation_data.action.fcurves.find("eval_time")
for kp in fc.keyframe_points:
    kp.interpolation = 'BEZIER'
    kp.handle_left_type = kp.handle_right_type = 'FREE'

a, b, c = fc.keyframe_points          # start, middle, end
# Speed ramp: fast in, sag in the middle, accelerate out.
a.handle_right = (a.co.x + 2,  a.co.y + 18)    # steep = launches fast
b.handle_left  = (b.co.x - 14, b.co.y)         # flat  = holds
b.handle_right = (b.co.x + 14, b.co.y)
c.handle_left  = (c.co.x - 2,  c.co.y - 18)    # steep = arrives fast
```

**Zero drift at a stop.** If a move is supposed to be locked off, it must be *actually* locked — a slow crawl at a "stop" reads as a mistake. Hold with `CONSTANT` interpolation, or duplicate the key so the segment is genuinely flat.

## The moves

### Orbit

Circle the subject on a path, target at subject height. Vary radius and height across the move so it does not read as a turntable. Half-orbits and 3/4 orbits look more intentional than full ones.

For a multi-scene continuous orbit, keep one unbroken `eval_time` curve and move the *world* under it — the camera never cuts, the set changes.

### Floor rise

Pure vertical translation, **no rotation**, smooth acceleration with a slow middle. Each "floor" is a different set stacked on Z at a fixed interval; the subject sits centre-frame at each pass.

```python
FLOOR_H = 4.0
for i in range(4):
    cam.location = (0, -6, i * FLOOR_H)
    cam.keyframe_insert("location", frame=1 + i * 48)
```

Rotation during a rise destroys the effect. Leave it out.

### Robo-arm

The whip-and-lock commercial move: a fast flight along a curved arc, an **absolute** dead stop at a completely different angle, repeat. Each relocation is roughly a third of a second; each stop is a distinct, readable frame.

Build it as a path with a control point per stop, then make the stops real:

```python
HOLD_FRAMES = 10
for kp in fc.keyframe_points:
    kp.interpolation = 'CONSTANT'      # hold dead still between flights
```

Keep the target separate and slightly offset per stop, so each lock-off is a different composition of the same subject rather than six centred portraits.

### Handheld

Applied **last**, on top of a finished move. Slow organic sway, not jitter: long waves plus a barely-perceptible tremor.

```python
for path in ("location", "rotation_euler"):
    for i in range(3):
        fc = cam.animation_data.action.fcurves.find(path, index=i)
        if fc is None:
            continue
        n = fc.modifiers.new('NOISE')
        n.scale = 120        # large scale = long lazy waves (4-6s at 24fps)
        n.strength = 0.035   # small; raise for rotation, lower for location
        n.phase = i * 7.3    # decorrelate the axes or it reads as a slide
```

**Never fast jitter, wobble or snap corrections.** Wrong-flavour handheld is more damaging than none.

### Over-the-shoulder cuts

Per cut: a camera position below shoulder height, a near-foreground body mass, and a target on the far face. Move barely — a slow sideways crawl. See `slates-dialogue-blocking` for who may occupy the foreground and why it matters.

### Lens

Animate focal length like any other channel; a slow lens breath under a move adds a lot for nothing.

```python
cam.data.lens = 35
cam.data.keyframe_insert("lens", frame=1)
cam.data.lens = 50
cam.data.keyframe_insert("lens", frame=96)
```

**But the lens must not drift across a cut.** Within a cut it can animate; on the cut frame it changes instantly with everything else.

## Multiple cameras and cuts

Two ways, and only one of them survives contact with a 19-shot edit:

- **One camera, jump-cut it.** Keyframe location/rotation/lens with `CONSTANT` interpolation on the cut frames. Fine up to a handful of cuts.
- **A camera per setup, bound to timeline markers.** Correct for anything bigger, because each setup stays independently editable.

```python
marker = bpy.context.scene.timeline_markers.new("SHOT_04", frame=188)
marker.camera = cam_shot_04
```

Either way the invariant is the same: **camera, target and lens all change on the cut frame, and no frame between two setups is interpolated.** One transition frame reads as a whip-pan, and the model will reproduce it faithfully.

## Verify before you render

```
slates_blender_scene
```

`cutSeconds` is your actual cut list in seconds. Check it against the shot list you were given — mismatches here become mismatched prompt timings, and the prompt is what you write next.

⚠️ **On a marker-bound rig, read `cutSeconds` or `markers`, never `camera.keyframeSeconds`.** The per-setup cameras are usually static (a Track To constraint does the aiming), so the active camera's action is empty and that field reads `[]` on a perfectly good three-cut edit. `cutSeconds` resolves to whichever the scene actually used.

## Related

`slates-previs-blocking` (the workflow) · `slates-blocking-to-prompt` (turning these moves into prompt text) · `slates-dialogue-blocking` (OTS and eyelines)
