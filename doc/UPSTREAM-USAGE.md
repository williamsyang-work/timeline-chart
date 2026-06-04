# How `react-components` Uses `timeline-chart`

Analysis of how the upstream `traceviewer-libs/react-components` codebase consumes
the `timeline-chart` library. Documents every layer, every provider, every
imperative mutation, and where the intended architectural boundaries dissolved.

See also:
- [ARCHITECTURE.md](ARCHITECTURE.md) — the intended design of timeline-chart itself
- [DATA-FLOW.md](DATA-FLOW.md) — how data moves inside the library
- [ANTIPATTERNS.md](ANTIPATTERNS.md) — known design issues in the library

---

## The Intended Architecture

`timeline-chart` was designed with a clean separation:

```
TimeGraphUnitController     ← owns the time domain (absolute range, view range, selection)
    │
TimeGraphContainer          ← owns a <canvas>, manages rendering loop
    │
    ├── TimeGraphLayer[]    ← each layer draws one concern onto the canvas
    │     │
    │     └── uses TimeGraphChartProviders (callbacks) to pull data on demand
    │
    └── TimeGraphRowController  ← owns vertical state (scroll offset, row heights, selection)
```

The intended data flow is **pull-based**:
1. The `UnitController` changes view range
2. The container tells each layer to re-render
3. Layers that need data call their `providers.dataProvider(range, resolution)` callback
4. The callback returns `{rows, range, resolution}` and the layer renders it

---

## What Actually Happens

The `AbstractGanttOutputComponent` (~1600 lines) is doing **three conflicting jobs**
simultaneously, and the boundary between React and timeline-chart no longer exists
in a coherent way.

### Job 1: Provider Factory (correct pattern)

Lines 154–181 define `TimeGraphChartProviders` callbacks that close over `this` and
delegate to `this.fetchChartData()` / `this.fetchMarkersData()`. This is the
correct pull-based pattern.

### Job 2: Imperative Layer Controller (bypasses the pull model)

`componentDidUpdate` and various signal handlers directly mutate layers:

| Call | Lines | What it does |
|------|-------|-------------|
| `chartLayer.updateChart(filterMap)` | 122, 289, 1239 | Tells chart to re-fetch via its provider (pull) |
| `chartLayer.update()` | 299 | Re-render without re-fetching |
| `markersChartLayer.updateChart()` | 290, 307 | Same for markers |
| `rangeEventsLayer.update()` | 291 | Re-render range events |
| `rangeEventsLayer.addRangeEvents(data)` | 1057 | **Push** — shoves data directly into the layer |
| `arrowLayer.update()` | 292, 300 | Re-render arrows |
| `arrowLayer.addArrows(data, rowIds)` | 1084 | **Push** — shoves data directly into the layer |
| `chartLayer.selectAndReveal(idx)` | 1487, 1535, 1604 | Imperative scroll + highlight |
| `chartLayer.selectRow(undefined)` | 1538 | Imperative deselect |
| `chartCursors.maybeCenterCursor()` | 478 | Imperative cursor manipulation |

### Job 3: Side-Effect Data Transformer (inside a provider callback)

`fetchChartData()` (line 1025) IS the `dataProvider` callback — it's supposed to
just return data. But it also:

- Calls `this.rangeEventsLayer.addRangeEvents()` (line 1057) — pushing data to a
  sibling layer inside another layer's provider
- Calls `this.arrowLayer.addArrows()` (line 1084) — same
- Calls `this.setState({ emptyNodes })` (line 1089) — triggers React re-renders
  from inside a timeline-chart callback
- Calls `this.selectAndReveal()` (line 1095) — imperatively scrolls the chart
  from inside its own data fetch
- Manipulates DOM spinner visibility via `document.getElementById` (lines 1033–1063)

---

## Every Layer Instance

| Layer Class | Instance Variable | Canvas Container | How It Gets Data | External Mutations |
|-------------|-------------------|------------------|------------------|--------------------|
| `TimeGraphChart` | `this.chartLayer` | Main chart | **Pull**: `providers.dataProvider` → `fetchChartData()` | `.update()`, `.updateChart()`, `.selectAndReveal()`, `.selectRow()` |
| `TimeGraphChart` | `this.markersChartLayer` | Markers container | **Pull**: `markersProvider.dataProvider` → `fetchMarkersData()` (returns pre-computed state) | `.updateChart()`, `.selectAndReveal()` |
| `TimeGraphChartArrows` | `this.arrowLayer` | Main chart | **Push**: `fetchChartData()` calls `.addArrows(data)` | `.update()` from `componentDidUpdate` |
| `TimeGraphRangeEventsLayer` | `this.rangeEventsLayer` | Main chart | **Push**: `fetchChartData()` calls `.addRangeEvents(data)` | `.update()` from `componentDidUpdate` |
| `TimeGraphChartCursors` | `this.chartCursors` | Main chart | Self-driven (reads `unitController.selectionRange`) | `.maybeCenterCursor()` |
| `TimeGraphMarkersChartCursors` | `this.markerChartCursors` | Markers container | Self-driven | None |
| `TimeGraphChartGrid` | local variable | Main chart | Self-driven (reads rowHeight + theme color) | None (recreated every render) |
| `TimeGraphChartSelectionRange` | local variable | Main chart | Self-driven (reads `unitController`) | None (recreated every render) |
| `TimeGraphVerticalScrollbar` | `this.vscrollLayer` | Scrollbar container | Reads from `rowController` | None |
| `TimeGraphNavigator` | local variable | Navigator container | Reads from `unitController` | None (recreated every render) |
| `TimeGraphAxis` | local variable | Axis container | Reads from `unitController` | None (recreated every render) |
| `TimeGraphAxisCursors` | local variable | Axis container | Reads from `unitController` | None (recreated every render) |

---

## Every Provider Callback

| Provider Field | Defined At | Serves | Implementation |
|----------------|-----------|--------|----------------|
| `providers.dataProvider` | L161 | `chartLayer` | `fetchChartData()` → TSP via `TspDataProvider.getData()`, **plus side-effects into arrows and range events layers** |
| `providers.rowProvider` | L155 | `chartLayer` | Returns `{rowIds}` — which entry IDs are currently visible (expanded, not empty) |
| `providers.stateStyleProvider` | L169 | `chartLayer` | `getStateStyle()` — resolves color/height/border from `StyleProvider` + `OutputElementStyle` |
| `providers.rowAnnotationStyleProvider` | L170 | `chartLayer` | `getAnnotationStyle()` — resolves symbol type/color/size |
| `providers.rowStyleProvider` | L172 | `chartLayer` | `getRowStyle()` — selected row highlight background |
| `markersProvider.dataProvider` | L177 | `markersChartLayer` | `fetchMarkersData()` — just returns `this.state.markerLayerData` (pre-computed as side-effect of main fetch) |
| `markersProvider.rowProvider` | L176 | `markersChartLayer` | Returns marker row IDs (empty if collapsed) |
| `markersProvider.stateStyleProvider` | L179 | `markersChartLayer` | `getMarkerStateStyle()` — annotation color at row height |
| `markersProvider.rowStyleProvider` | L180 | `markersChartLayer` | Same `getRowStyle()` as main chart |

---

## The `TspDataProvider` (Backend Caller)

`tsp-data-provider.ts` is the only class that talks to the TSP engine. It:

1. Fires `fetchTimeGraphStates()` + `fetchAnnotations()` in parallel
2. Optionally fires `fetchTimeGraphArrows()`
3. Transforms TSP response models into `TimelineChart.TimeGraphModel`:
   - `rows: TimelineChart.TimeGraphRowModel[]` — row data with states
   - `arrows: TimelineChart.TimeGraphArrow[]` — arrow connections between rows
   - `rangeEvents: TimelineChart.TimeGraphAnnotation[]` — global markers
4. Handles tooltip fetches (`fetchStateTooltip`, `fetchAnnotationTooltip`)

This is the cleanest part of the upstream code — it returns a flat data object.
The mess happens in the caller (`fetchChartData`) which tears the result apart
and distributes it across layers and React state imperatively.

---

## The `ReactTimeGraphContainer` Bridge

The React↔PixiJS bridge component:

1. Renders a bare `<canvas>` element
2. On mount: creates `TimeGraphContainer(options, unitController, canvasRef)`,
   then `container.addLayers(layers)`
3. On resize: calls `container.updateCanvas(w, h, bg, lineColor)`
4. On unmount: does NOT destroy the container automatically (the parent must call
   `destroyContainer()` manually)
5. `shouldComponentUpdate` only checks `height`, `width`, `backgroundColor` —
   layer array changes after mount are **silently ignored**

Implication: `grid` and `selectionRange` layers created inline in
`getChartContainer()` are re-instantiated on every render call, but `addLayers`
was only called on mount. Since `shouldComponentUpdate` prevents re-mounting,
the originally-passed layer references are captured once.

---

## Three Canvas Containers

The abstract gantt component renders three separate `ReactTimeGraphContainer`
instances, each with its own `TimeGraphContainer` and canvas:

### Main Chart Container
```
layers: [grid, chartLayer, selectionRange, chartCursors, arrowLayer, rangeEventsLayer]
rowController: this.rowController
height: computed (total - markers - searchBar)
```

### Markers Container
```
layers: [markersChartLayer, markerChartCursors]
rowController: this.markerRowController
height: getMarkersLayerHeight() (0 if ≤1 category, else rows*20 + 10)
```

### Vertical Scrollbar Container
```
layers: [vscrollLayer]
width: 10px fixed
height: full component height
```

Additional containers exist in sibling components (shared `unitController`):
- **TimeAxisComponent** — `[timeGraphAxis, timeGraphAxisCursors]`
- **TimeNavigatorComponent** — `[timeGraphNavigator]`

---

## Where the Boundary Dissolved

The original design had:
- **Layers pull data via providers** (clean)
- **UnitController drives re-renders** (clean)
- **React owns the DOM, timeline-chart owns the canvas** (clean)

What happened in practice:

### 1. Arrows and range events couldn't fit the pull model
They arrive as a side-product of the main states fetch (single TSP call returns
all three). Someone shoved them directly into their layers from inside the main
chart's provider callback. Now one layer's data-fetch has side effects on two
other layers.

### 2. Marker data is pre-computed and stashed in React state
The markers chart's "provider" just reads `this.state.markerLayerData`, which was
populated as a side-effect of the main chart's provider via `updateMarkersData()`.
It's pull-on-paper, push-in-practice.

### 3. React `componentDidUpdate` became a second update loop
Calling `.update()` / `.updateChart()` imperatively based on state diffs,
duplicating logic that should live in the layers themselves or be driven by the
unit controller.

### 4. Selection/scroll got imperative
`selectAndReveal()`, `selectRow()`, `maybeCenterCursor()` are all React-driven
imperative calls into the canvas layer, bypassing the provider model entirely.

### Result
Two competing update loops (React lifecycle + timeline-chart's internal render
loop) with three data flow patterns (pull via providers, push via
`addArrows`/`addRangeEvents`, and pre-compute-into-state) all intersecting in
one 1600-line class. No single pattern is authoritative; you have to trace through
all three to understand when any given pixel updates.

---

## Inheritance Hierarchy

```
AbstractOutputComponent             ← base (title bar, tooltips, close button)
    └── AbstractTreeOutputComponent ← adds tree panel, show/hide tree toggle
        └── AbstractGanttOutputComponent  ← the 1600-line monster (all layers, providers, data flow)
            ├── TimegraphOutputComponent  ← just implements renderTree() with EntryTree
            └── GanttChartOutputComponent ← same, adds initialViewRange snapshot
```

All layer creation, provider wiring, and imperative mutation lives in
`AbstractGanttOutputComponent`. The concrete subclasses are thin shells that
only define the tree panel layout.
