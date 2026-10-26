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
