# Data Flow & Storage

Where server data lives after it arrives, and how it's duplicated across the component tree.

---

## The Data Path

```
dataProvider(worldRange, resolution, fetchArrows, rowIds)
  → returns { rows: TimeGraphRowModel[], range, resolution }
    → addOrUpdateRows(rowData)
      → for each row in rowData.rows:
          new TimeGraphRow(id, opts, rowIndex, row, style)
            → this._model = row  (the full TimeGraphRowModel)
          updateRow(rowComponent, row, providedModel)
            → for each state in row.states:
                new TimeGraphStateComponent(stateModel, ...)
                  → this._model = stateModel
                rowComponent.addState(el)
                  → rowComponent._rowStateComponents.set(id, el)
            → for each annotation in row.annotations:
                new TimeGraphAnnotationComponent(annotation, ...)
                  → this._model = annotation
                rowComponent.addAnnotation(el)
                  → rowComponent._rowAnnotationComponents.set(id, el)
          rowComponent.providedModel = { range, resolution }
          chart.rowComponents.set(rowId, rowComponent)
```

---

## Where the Data Lives (per row)

| Location | What's stored | Purpose |
|----------|--------------|---------|
| `rowComponent._model` (`TimeGraphRowModel`) | Full row model including `states[]`, `annotations[]`, `range`, `name`, `data` | Accessed by `getRowModel()`, selection logic, style providers |
| `rowComponent._rowStateComponents` (Map) | `TimeGraphStateComponent` instances keyed by state ID | PIXI rendering, hit testing, lookup by ID |
| `rowComponent._rowAnnotationComponents` (Map) | `TimeGraphAnnotationComponent` instances keyed by annotation ID | PIXI rendering, hit testing |
| `stateComponent._model` (`TimeGraphState`) | Individual state model (`id`, `range`, `label`, `data`, `selected`) | Accessed on click/selection, label rendering |
| `annotationComponent._model` (`TimeGraphAnnotation`) | Individual annotation model | Accessed on interaction |
| `rowComponent._providedModel` | `{ range, resolution, filterExpressionsMap }` | Used by `maybeFetchNewData` to decide if re-fetch is needed |
| `chart.rowComponents` (Map) | All `TimeGraphRow` instances keyed by row ID | Iteration, lookup, destroy/rebuild |

---

## Duplication Analysis

For a single state, the same data is reachable via:

1. **`rowComponent.model.states[i]`** — the `TimeGraphState` object sitting in the row model's array
2. **`stateComponent._model`** — the same object reference held on the component
3. **`rowComponent._rowStateComponents.get(id)`** — the component wrapper itself

Items 1 and 2 are the **same JS object reference** (not a deep clone), so memory isn't doubled for the state data itself. But the row model retains the full `states[]` array structure alongside the component Map that independently indexes the same states.

The structural duplication is:

```
TimeGraphRowModel.states[]          ← array of N state references
TimeGraphRow._rowStateComponents    ← Map of N component wrappers, each holding one of those references
```

Both survive for the lifetime of the row. Neither is ever released independently.

---

## What Gets Destroyed on Rebuild

When `addOrUpdateRows` fires:

1. `this.removeChild(rowComponent)` → `rowComponent.destroy()` → `displayObject.destroy({ children: true })`
2. This destroys the row's PIXI.Graphics and all child PIXI objects (state graphics, labels)
3. The `rowComponent` itself becomes unreferenced (removed from `chart.rowComponents`)
4. The `_model` (TimeGraphRowModel), the `_rowStateComponents` Map, and all `TimeGraphStateComponent` instances become eligible for GC

**There is no data cache that survives a rebuild.** The server response is stored only on the components. When components are destroyed, the data is gone. The next fetch must return everything again.

---

## Implications

- **No separation between data layer and view layer.** The components ARE the data store. Destroying the view destroys the data.
- **No incremental diffing is possible** because there's no stable data cache to diff against — the old data dies with the old components.
- **The `_model` on each component is used for**: selection state (`model.selected`), click handlers (passing model to callbacks), label text (`model.label`), and the `getStateById`/`getRowModel` API. It's not just a rendering input — it's the source of truth for the application state.
- **`providedModel` on each row** tracks what was fetched (range + resolution) so `maybeFetchNewData` can decide if a re-fetch is needed. This metadata lives on the view component rather than in a separate cache.

---

## When Is the Model Actually Referenced After Construction?

### State model (`stateComponent._model`)

| Access site | What's read | When it happens |
|-------------|------------|-----------------|
| `time-graph-state.ts:80,90,98` | `model.label` | Every `render()` and `scaleLabel()` call — draws text on the state rectangle |
| `time-graph-chart.ts:850` | `el.model` (whole object) | User clicks a state — passed to `selectState()` |
| `time-graph-chart.ts:871-893` | `el` (component with `.model`) | User click/hover/mousedown — passed to consumer's `mouseInteractions` callbacks for tooltips, detail panels, etc. |
| `time-graph-chart.ts:964,956` | `state.model.selected` | Selection toggle — directly mutates the model object |
| `time-graph-chart.ts:896-899` | `model` (whole object) | `updateStateStyle` passes model back into `stateStyleProvider` to recompute colors on selection change |

### Row model (`rowComponent._model`)

| Access site | What's read | When it happens |
|-------------|------------|-----------------|
| `time-graph-chart.ts:1100-1112` | `row.model.states[]`, `row.model.annotations[]` | `scaleComponents()` — iterates the arrays to find components by ID for label scaling. Uses the model as an index of what exists. |
| `time-graph-chart.ts:543-544` | `rowComponent.model` (whole object) | Moved row rebuild — feeds the model back into `addOrUpdateRows` to rebuild at a new Y position without re-fetching. Uses the model as a cached data source. |
| `time-graph-chart.ts:989` | `row.states.find(...)` | Keyboard navigation — searches states by time position to select during arrow-key nav |
| `time-graph-chart.ts:920` | `rowComponent.model` | `getRowModel(index)` API — exposes model to external consumers |
| `time-graph-chart.ts:1018` | `selectedRowComponent.model` | Navigation logic — reads selected row's model |

### What data is actually needed at runtime

| Data field | Used for | Needed continuously? | Could be fetched on demand? |
|-----------|----------|---------------------|---------------------------|
| `state.id` | Component lookup, selection identity | Yes — but it's just a string | No — must be retained |
| `state.label` | Drawing text on visible states | Yes, on every render | Yes — only needed for states with enough pixel width to show text |
| `state.range` | Navigation (find state at cursor time) | Only during keyboard nav | Yes — need an index or API call |
| `state.data` | Passed to consumer callbacks on click/hover | Only on interaction | Yes — could fetch on demand |
| `state.selected` | Visual style toggle | Continuous but it's view-state, not server data | N/A — shouldn't be on the model at all |
| `row.states[]` | Iterating for scaleComponents, navigation | On zoom and keyboard nav | The array is used as an index — `_rowStateComponents.values()` would work instead |
| `row.id`, `row.name` | Identity, display | Yes | No — must be retained |
| `row.annotations[]` | Iterating for scaleComponents | On zoom | Same — `_rowAnnotationComponents.values()` would work |

### Key insight

Most model data is only needed at **two moments**:

1. **Construction time** — to compute pixel positions, get styles from providers, draw labels
2. **User interaction** — to pass context to click/hover callbacks and find states during keyboard navigation

The only continuous runtime need is `state.label` (for rendering) and `state.id` (for lookup). Everything else could be fetched on-demand with an API that answers "give me the full state data for ID X" or "find the state at time T in row R."

The `row.model.states[]` array being used as an iteration index in `scaleComponents` is a clear sign of the problem — it walks the entire server response just to get a list of IDs, when `rowComponent._rowStateComponents.values()` would yield the same components directly without needing the model at all.

---

## Open Questions for Further Investigation

- Does the consumer (e.g., Theia Trace Extension) also keep its own copy of the data, making this a third copy?
- Could a data cache layer sit between `dataProvider` and the components, allowing incremental updates and object reuse?
- Is `model.selected` being mutated in place on the server-provided data objects? (Yes — see `selectState`/`selectRow` which set `model.selected = true` and `delete model.selected`)
