# Rendering Deep Dive

How the rendering pipeline works, when things are redrawn vs repositioned, and where the inefficiencies are.

---

## The Two-Tier Rendering Strategy

The system has two fundamentally different rendering modes:

1. **GPU transforms (cheap, immediate):** The PIXI container is shifted/scaled to give instant visual feedback during pan/zoom. No components are destroyed or recreated. This is what the `worldRange` optimization provides.

2. **Full rebuild (expensive, debounced):** When the user moves beyond the pre-rendered world, new data is fetched and all affected row components are destroyed and recreated from scratch. Every state gets a new `PIXI.Graphics` object.

The worldRenderFactor controls how often mode 2 kicks in. With `worldRenderFactor = 1`, the pre-rendered world is 3x the view width (one extra viewport buffered on each side), meaning the user can pan one full viewport in either direction before triggering a rebuild.

---

## The Render Controller (Frame Pump)

PIXI's ticker does NOT run continuously. It is demand-driven:

```
Component mutates graphics
  → calls RenderEvents.startRender()
    → throttled (450ms, leading edge) dispatches window event
      → TimeGraphRenderController.startRender()
        → PIXI.Ticker.shared.start()  ← frames now painting
        → debouncedStop() scheduled (1000ms)
          → after 1000ms of silence: PIXI.Ticker.shared.stop()  ← GPU idle
```

The ticker runs as long as activity continues (each start call resets the 1000ms stop timer). Once activity ceases for a full second, the ticker stops and no frames are rendered.

---

## What Happens When the User Pans

### Immediate response (GPU transform):

```
Mouse drag
  → compute pixel delta → convert to time offset
    → unitController.viewRange = { new start, new end }
      → updateScaleFactor handler fires
        → scaleFactor unchanged (same viewRangeLength) → scaleStage is no-op
      → container.calculatePositionOffset fires:
          x = -(viewRange.start - worldRange.start) * zoomFactor
            → stateController.positionOffset = { x, y: 0 }
              → shiftStage fires: layer.position.x = positionOffset.x
```

The entire PIXI container slides left/right. No geometry is redrawn. This is just a GPU transform on the already-rendered content.

### Deferred response (rebuild, only if needed):

```
viewRange change fires _debouncedMaybeFetchNewData (400ms debounce)
  → maybeFetchNewData() checks: does viewRange fit within rendered worldRange?
    → YES: nothing happens (common case during small pans)
    → NO: fetchRows() → dataProvider(...) → addOrUpdateRows → full rebuild
```

### What ensureRowLinesFitViewWidth does during panning:

Every view range change also calls `ensureRowLinesFitViewWidth()`, which iterates all rows and calls `update()` on each one. This clears and redraws each row's background rectangle and horizontal line at a new position/width to cover the viewport. The comment in the source says:

> "This is a hacky solution that triggers every view range change."

State children are NOT affected — they survive because `PIXI.Graphics.clear()` only erases drawn geometry, not child display objects.

---

## What Happens When the User Zooms

### Immediate response (GPU scale transform):

```
Scroll wheel + Ctrl
  → adjustZoom(mouseX, direction)
    → compute new viewRange (anchored to mouse position)
      → unitController.viewRange = { start, end }
        → updateScaleFactor: scaleFactor = oldLength / newLength * current
          → scaleStage: layer.scale.x = scaleFactor
            ← container stretches/compresses instantly on GPU
        → updateZoomFactor: zoomFactor = canvasWidth / viewRangeLength
          → _zoomRangeChangedHandler fires:
              ensureRowLinesFitViewWidth()  ← redraws row backgrounds
              stateController.handleOnWorldRender()  ← notifies downstream layers
```

### Deferred response (rebuild):

```
400ms after last zoom event:
  maybeFetchNewData()
    → checks resolution and range coverage
      → if zoom changed significantly: fetches new data at correct resolution
        → fetchRows():
            stateController.worldRange = request.worldRange
            stateController.worldZoomFactor = stateController.zoomFactor
            stateController.resetScale()  ← scaleFactor = 1, unscaledWidth = currentWidth
            addOrUpdateRows()  ← destroy and recreate all state components
            handleOnWorldRender()  ← notify other layers
```

The key insight: `resetScale()` sets `scaleFactor` back to 1, which triggers `scaleStage` to set `layer.scale.x = 1`. At this point, the freshly-rendered components are positioned at the correct world-relative pixel positions and no container scaling is needed.

### The scale/rebuild cycle:

```
Zoom begins → scaleFactor grows (e.g., 1.0 → 1.5)
  → PIXI container is stretched 1.5x (cheap but blurry)
Data fetch completes → resetScale() → scaleFactor = 1
  → container scale resets, new precise geometry replaces the stretched version
```

---

## What scaleComponents Does

On every scale factor change, `scaleComponents()` (line 1098) iterates all states and annotations:

```typescript
el.scaleLabel(this.stateController.scaleFactor);     // for states
el.scaleAnnotation(this.stateController.scaleFactor); // for annotations
```

This counter-scales labels and annotation symbols so they remain at constant visual size when the container is stretched. Without this, a 2x container scale would make text 2x wide and unreadable.

Labels are the one thing that gets **updated in place** rather than destroyed — `scaleLabel` reuses the existing `PIXI.BitmapText` object and just updates its `.scale.x` and visibility.

---

## The Full Rebuild: addOrUpdateRows

When new data arrives from the provider, the rebuild is total:

```typescript
rowData.rows.forEach(row => {
    const rowComponent = this.rowComponents.get(row.id);
    if (rowComponent) {
        this.removeChild(rowComponent);  // destroy old row + ALL its children
    }
    this.addRow(row.id, row, providedModel);  // create brand new everything
});
```

`removeChild` → `rowComponent.destroy()` → `displayObject.destroy({ children: true })` — recursively destroys the row's PIXI.Graphics and every child (state Graphics, BitmapText labels, annotation Graphics).

`addRow` → `updateRow` → for each state model, calls `createNewState()` which does `new TimeGraphStateComponent(...)` which does `new PIXI.Graphics()`.

**There is no object pooling, no diffing, no reuse.** Every fetch = destroy everything + allocate everything fresh.

---

## Coarse → Fine Resolution Pattern

When `_coarseResolutionFactor > 1`:

```
Pan/zoom stops
  → maybeFetchNewData(coarse resolution)  ← fast, less data
    → addOrUpdateRows (rough visualization)
      → 400ms later: maybeFetchNewData(fine resolution)  ← full detail
        → addOrUpdateRows AGAIN (destroy coarse, rebuild with fine data)
          → if filters active, 400ms later: deep search fetch
            → addOrUpdateRows AGAIN
```

With filters active, a single pan can trigger **three full destroy/rebuild cycles** in sequence.

---

## Summary: What's Efficient vs What's Wasteful

### Efficient (the worldRange optimization)

- **shiftStage** — panning within the world buffer is just `layer.position.x = offset`. Pure GPU. Cost: essentially zero.
- **scaleStage** — zooming stretches the container without redrawing. Cost: one transform update.
- **scaleLabel/scaleAnnotation** — labels counter-scaled in place without recreation.
- **Render controller start/stop** — PIXI ticker only runs when there's activity.

### Wasteful (defeats the purpose of PIXI)

| What | When | Impact |
|------|------|--------|
| `ensureRowLinesFitViewWidth` | Every view range change (pan AND zoom) | Clears and redraws the background rect + line for EVERY row. For 500 rows, that's 500 clear+render cycles per frame during interaction. |
| `addOrUpdateRows` full destroy/rebuild | Every data fetch (on leaving world buffer, or zoom resolution change) | All PIXI.Graphics objects destroyed and recreated. No reuse. With coarse+fine pattern, happens twice per interaction. |
| No object pooling | Every rebuild | `new PIXI.Graphics()` per state. For 500 rows × 10 states = 5000 allocations + GC pressure on every fetch. |
| `startPixiRender()` per draw call | Every rect(), hline(), vline() | Each primitive signals the render controller. A single row `render()` signals twice (rect + hline). 500 rows = 1000 signals (throttled, but still wasteful). |
| `scaleComponents` iterates all states | Every scale factor change (every zoom frame) | Walks every state in every row to update label scale. O(total_states). |

### The fundamental tension

The worldRange concept provides the RIGHT optimization: render a buffer of content wider than the viewport, then cheaply pan/zoom within it using GPU transforms. The problem is that **everything below the container level doesn't participate in this optimization**:

- Row backgrounds don't use the container transform — they're redrawn every frame via `ensureRowLinesFitViewWidth`.
- When a rebuild IS needed, there's no incremental update — it's nuclear (destroy everything, rebuild everything).
- Labels need individual counter-scaling because the container scale stretches them, requiring per-state iteration.
- The coarse/fine pattern means the nuclear rebuild fires 2-3 times per interaction.

---

## What an Ideal Architecture Would Look Like

For contrast, here's what PIXI is designed for:

1. **Create objects once.** Move them via `displayObject.position.x/y` and `displayObject.scale.x/y`. PIXI batches these transforms into a single GPU draw call.

2. **Row backgrounds** should be PIXI.Graphics drawn once at creation time, then repositioned via their `.position` and `.width` properties — not cleared and redrawn on every pan.

3. **States** should be allocated once and moved/hidden/shown as the viewport moves. An object pool would recycle offscreen states for new onscreen data rather than destroying and allocating.

4. **Labels** at fixed screen-space size should use a non-scalable layer (or `PIXI.Container` with `scale.x = 1/parentScale`) rather than per-state counter-scaling on every zoom frame.

5. **Incremental updates** — when new data arrives, diff against existing components. Only destroy states that disappeared and create states that are new. Update-in-place for states that just moved.

The current architecture gets the big picture right (world buffering + GPU transforms for the container), but at the component level it falls back to canvas-style "clear everything and redraw" on almost every interaction.
