# Codebase Antipatterns & Improvement Opportunities

Analysis of the `timeline-chart` library identifying bugs, memory leaks, performance issues, and structural problems.

---

## Critical Bugs

### 1. Off-by-one in `removeChild`

**`src/layer/time-graph-layer.ts:70`**

```typescript
idx && this.children.splice(idx, 1);
```

If the child is at index 0, `idx` is falsy so the splice is skipped. The child remains in the internal array despite being visually removed from the display.

### 2. Wrong event type in cleanup

**`src/layer/time-graph-chart-cursors.ts:299`**

```typescript
this.removeOnCanvasEvent('mousedown', this._cursorKeyUpHandler);
```

The handler was registered with `'keyup'` but removal targets `'mousedown'`. The keyup listener leaks permanently.

### 3. Mismatched handler removal

**`src/layer/time-graph-chart-grid.ts:35`**

```typescript
this.unitController.removeSelectionRangeChangedHandler(this._updateHandler);
```

The handler was registered with `onViewRangeChanged`, not selection range. This removal is a no-op; the real handler leaks.

### 4. Font controller assigns wrong style

**`src/time-graph-font-controller.ts:60`**

```typescript
style2FontMap.set("white", blackFont.fontStyle);
```

White text gets the black font's style. Should be `whiteFont.fontStyle`.

### 5. `viewRange` setter fires handler even when invalid

**`src/time-graph-unit-controller.ts:103-120`**

When `newRange.end <= newRange.start`, the assignment is skipped but `handleViewRangeChange` still fires, sending listeners identical old/new values and triggering unnecessary re-renders.

### 6. `selectedRowIndex` and `selectedRow` are desynced

**`src/time-graph-row-controller.ts:101-104`**

Setting `selectedRowIndex` fires `handleSelectedRowChanged()` which notifies about `_selectedRow`, but `_selectedRow` is never updated from the index. Listeners receive stale data.

### 7. Duplicate handler removal

**`src/layer/time-graph-chart.ts:442-445`**

```typescript
this.unitController.removeViewRangeChangedHandler(this._viewRangeChangedHandler);
if (this._viewRangeChangedHandler) {
    this.unitController.removeViewRangeChangedHandler(this._viewRangeChangedHandler);
}
```

Same handler removed twice. The second call is a no-op.

---

## Memory Leaks

### Event listeners that can never be removed

| Location | Issue |
|----------|-------|
| `src/components/time-graph-component.ts:153-159` | `addEvent` uses `.bind(this)` creating anonymous closures. No `removeEvent` method exists. `destroy()` never calls `.off()`. |
| `src/layer/time-graph-chart.ts:222-227` | Anonymous stage `mouseover`/`mouseout` listeners cannot be unregistered. |
| `src/layer/time-graph-chart-cursors.ts:146-153` | `document.addEventListener('mouseup', ...)` inside mousedown handler is not tracked for cleanup. |
| `src/layer/time-graph-chart.ts:319` | Same pattern: document-level mouseup on right-click, no class-level reference for removal. |

### Missing disposal in destroy paths

| Location | Issue |
|----------|-------|
| `src/layer/time-graph-chart.ts:87-89` | Debounced functions (`_debouncedMaybeFetchNewData` etc.) never `.cancel()`'d in `destroy()`. Can fire after destruction. |
| `src/layer/time-graph-chart.ts:350` | `onVerticalOffsetChangedHandler` registered but never unregistered. |
| `src/layer/time-graph-chart-selection-range.ts:38` | `scaleFactorChange` handler registered, not removed in `destroy()`. |
| `src/time-graph-render-controller.ts:47-48` | Window event listeners only removed on `beforeunload`. In SPAs, they accumulate forever. |
| `src/components/time-graph-axis-scale.ts:33` | Lodash `throttle` never cancelled on destroy. |
| `src/layer/time-graph-chart-arrows.ts:23-25` | Anonymous `onVerticalOffsetChangedHandler` never removed. |

### Render controller global accumulation

**`src/time-graph-render-controller.ts`**

`TimeGraphUnitController` creates a `TimeGraphRenderController` in its constructor. Each instance adds window event listeners (`startPixiRender`/`stopPixiRender`) that are only removed on `beforeunload`. In single-page applications, these listeners accumulate with every mount/unmount cycle.

### Handler removal relies on reference identity

All `remove*Handler` methods use `indexOf`, requiring the exact same function reference. If consumers use `.bind(this)`, they produce a new reference each time and can never unsubscribe.

### No unified disposal pattern

All controllers lack a common `IDisposable` interface. Each implements a different incomplete subset of cleanup:
- `TimeGraphUnitController` — no dispose method at all
- `TimeGraphRowController` — no dispose method at all
- `TimeGraphStateController.removeHandlers()` — only removes two unit controller handlers, leaves its own handler arrays full
- `TimeGraphContainer.destroy()` — doesn't clean up render controller or worldRender handler

---

## Performance Issues

### O(n^2) operations

| Location | Issue |
|----------|-------|
| `src/layer/time-graph-chart.ts:495,500,518` | `this.rowIds.indexOf(rowId)` inside `rowComponents.forEach` — O(n) per row |
| `src/layer/time-graph-chart.ts:557` | `rowIds.sort((a,b) => this._allRowIds.indexOf(a) - ...)` — O(n^2 log n) |
| `src/layer/time-graph-chart.ts:923-931` | `getStateById` linear-scans all rows to find a single state |

**Fix:** Use `Set<number>` or `Map<id, index>` for row ID lookups.

### Expensive per-frame work

| Location | Issue |
|----------|-------|
| `src/layer/time-graph-chart.ts:537-538` | `isEqual` (lodash deep comparison) called per-row on every scroll debounce |
| `src/components/time-graph-component.ts:90-97` | Every draw call (`rect`, `hline`, `vline`) triggers `startPixiRender()`. A single axis render triggers it dozens of times per frame. |
| `src/components/time-graph-state.ts:79` | `PIXI.TextMetrics.measureText()` on every render for every state. Results never cached. |
| `src/components/time-graph-axis-scale.ts:85-126` | Unbounded loop creating `PIXI.Text` objects per tick mark. At extreme zoom, can iterate thousands of times with no max-iterations guard. |
| `src/layer/time-graph-chart.ts:1083-1096` | `ensureRowLinesFitViewWidth` iterates ALL rows and calls `update()` on every view range change, regardless of whether widths actually changed. |

### Render controller shared state conflicts

**`src/time-graph-render-controller.ts`**

Module-level singletons (`throttledStart`, `debouncedStop`) and `PIXI.Ticker.shared` mean multiple chart instances interfere with each other. One instance calling `stopRender` stops ALL instances.

### Debounce instance leak

**`src/layer/time-graph-chart.ts:843`**

```typescript
this._multiClickTimer = debounce(function(){ ... }, this._multiClickTime);
```

Called for every state/annotation element added. Overwrites `this._multiClickTimer` each time — previously created debounce instances are orphaned (never cancelled).

---

## Falsy vs. Undefined Checks (Recurring Bug Pattern)

The color value `0x000000` (black) is falsy in JavaScript. Multiple places use truthy checks on numeric values, preventing zero-values from being set:

| Location | Effect |
|----------|--------|
| `src/time-graph-container.ts:93` | `if (newColor)` — cannot set background to black |
| `src/components/time-graph-rectangle.ts:17` | `if (opts.color)` — cannot update rect color to black |
| `src/components/time-graph-row.ts:111-117` | `if (style.lineColor)` / `if (style.lineOpacity)` / `if (style.lineThickness)` — cannot set any to 0 |

**Fix:** All should use `!== undefined` instead of truthy checks.

---

## Type Safety Issues

### `Function` type (zero type safety)

- `src/layer/time-graph-chart.ts:70-72`: `_stageMouseDownHandler: Function`, `_stageMouseMoveHandler: Function`, `_stageMouseUpHandler: Function`
- `src/layer/time-graph-vertical-scrollbar.ts:81`: `_moveEndHandler` has no type annotation at all

### Thrown strings instead of Error objects

- `src/layer/time-graph-layer.ts:25`
- `src/layer/time-graph-viewport-layer.ts:24`
- `src/layer/time-graph-chart.ts:720`
- `src/layer/time-graph-chart-arrows.ts:59`
- `src/layer/time-graph-range-events-layer.ts:43`

These lose stack traces and break `catch (e) { e.message }` patterns.

### `_options` typed as `{}` then unsafely cast

The base `TimeGraphComponent` has `_options: TimeGraphComponentOptions` (which is `{}`). Subclasses either re-declare it with a different type or cast with `as` — no compile-time enforcement across the hierarchy.

### Precision loss in bigint multiply

**`src/bigint-utils.ts:34-39`**

```typescript
static readonly multiply = (a: bigint | number, b: bigint | number): bigint => {
    a = Number(a);  // loses precision beyond 2^53
    b = Number(b);
    let c = a * b;
    return BIMath.round(c);
}
```

Converts bigint to Number before multiplication, defeating the purpose of using bigint for large trace timestamps.

### String types where literal unions belong

- `TimeGraphAnnotationStyle.symbol` accepts any string but only `'circle' | 'cross' | 'plus' | 'diamond' | 'triangle' | 'inverted-triangle' | 'none'` are handled
- `TimeGraphAxisStyle.verticalAlign` accepts any string but only `'top' | 'bottom' | 'middle'` are valid

---

## Code Duplication

| What | Where |
|------|-------|
| Zoom-around-mouse-pointer logic | `src/layer/time-graph-chart.ts:109-132` and `src/layer/time-graph-axis.ts:59-72` |
| Cursor create-or-update pattern | `src/layer/time-graph-chart-cursors.ts:235-281`, `src/layer/time-graph-axis-cursors.ts:26-65`, `src/layer/time-graph-chart-selection-range.ts:47-84` |
| Bigint-to-pixel conversion formula | `src/layer/time-graph-layer.ts:73-78` and `src/layer/time-graph-viewport-layer.ts:22-36` |
| Context menu prevention | `src/layer/time-graph-chart.ts:304`, `src/layer/time-graph-navigator.ts:26`, `src/layer/time-graph-vertical-scrollbar.ts:28` |
| Hand-rolled handler arrays (push/indexOf/splice) | Every controller class |

---

## Architectural Antipatterns

### God methods

- **`time-graph-chart.ts:afterAddToContainer`** — 254 lines handling keyboard nav, mouse panning, zooming, scroll wheel, context menu, vertical offset, view range, scale factor, and initial fetch.
- **`time-graph-chart.ts:maybeFetchNewData`** — 144 lines handling row filtering, visibility, position updates, request deduplication, sequential fetching, and retry.

### Implicit state machine via boolean flags

**`src/layer/time-graph-chart.ts:60-68`**

`mousePanning`, `mouseZooming`, `mouseSelecting`, `mouseButtons`, `mouseDownButton` form a complex state machine that can reach invalid combinations. Should be a discriminated union or state enum.

### Swallowed errors

**`src/layer/time-graph-chart.ts:597-599`**

```typescript
} catch(error) {
    return;
}
```

All `fetchRows` errors silently disappear with no logging.

### Unused field

**`src/time-graph-unit-controller.ts:24,40`**

`_renderer: TimeGraphRenderController` is instantiated in the constructor but never used within the class. Each instance wastes a `TimeGraphRenderController` allocation (which also adds window event listeners).

### Public mutable fields breaking the observable pattern

**`src/time-graph-unit-controller.ts:29-30`**

```typescript
numberTranslator?: (theNumber: bigint) => string | undefined;
scaleSteps?: number[]
```

Fully public mutable fields with no change notification, unlike every other property in the class which uses getters/setters with handler callbacks.

### `var self = this`

**`src/layer/time-graph-chart.ts:842`**

Outdated pattern. Should use arrow functions.

---

## Recommendations

### 1. Introduce `IDisposable` interface

All controllers, layers, and components should implement a standard `dispose()` that clears handler arrays, cancels debounces/throttles, removes document/window listeners, and destroys PIXI objects.

### 2. Replace hand-rolled handler arrays with a Signal abstraction

Eliminate repeated push/indexOf/splice boilerplate and the reference-identity removal footgun. A simple `Signal<T>` class with `add(handler)` returning a disposable would solve both problems.

### 3. Fix all falsy numeric checks

Systematic replacement of truthy checks on color/opacity/thickness values with `!== undefined`.

### 4. Extract shared utilities

- Zoom math (zoom-around-point calculation)
- Bigint-to-pixel conversion
- Cursor update logic
- Context menu prevention

### 5. Decompose god methods

Split `afterAddToContainer` into focused setup methods: `setupKeyboard()`, `setupMousePanning()`, `setupMouseZooming()`, `setupScrollWheel()`, etc.

### 6. Add iteration guards

`renderVerticalLines` needs a max-iterations cap to prevent browser freezing at extreme zoom levels.

### 7. Cache text metrics

`TimeGraphStateComponent` should memoize `PIXI.TextMetrics.measureText` results per label string rather than recomputing on every render.

### 8. Use `Set<number>` for row ID lookups

Replace `Array.indexOf()` calls in hot paths with Set/Map lookups for O(1) membership testing.

### 9. Isolate render controller per instance

Move away from module-level singletons and shared ticker to support multiple independent chart instances without interference.
