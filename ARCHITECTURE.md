# Architecture & Patterns Reference

A quick reference for implementing code in a style consistent with this codebase.

See also:
- [RENDERING.md](RENDERING.md) — deep dive into how panning, zooming, and data fetching interact with the PIXI display tree.
- [DATA-FLOW.md](DATA-FLOW.md) — where server data lives after arrival and how it's duplicated across the component tree.

---

## Project Structure

```
timeline-chart/           ← The library (npm: timeline-chart)
  src/
    *.ts                  ← Controllers and core types
    components/           ← PIXI.Graphics wrappers for visual elements
    layer/                ← Layers that compose components into the stage
    layer/unitTest/       ← Test helpers and data stubs
    layer/__tests__/      ← Layer tests (performance)
    components/__tests__/ ← Component tests (snapshot)
example/                  ← Demo app (webpack-dev-server)
  src/
    index.ts              ← Wires up containers, layers, providers
    test-data-provider.ts ← Generates sample trace data
```

---

## Dependency Graph

```
TimeGraphUnitController       (no dependencies — owns time-domain state)
        ↑
TimeGraphStateController      (depends on UnitController — pixel-domain)
        ↑
TimeGraphContainer            (owns StateController, receives UnitController)
        ↑
TimeGraphLayer[]              (receive all controllers via initializeLayer)
        ↑
TimeGraphComponent[]          (created by layers, rendered into PIXI containers)

TimeGraphRowController        (independent — manages vertical/row state)
```

Controllers never depend on layers or components. Layers depend on controllers. Components are leaf nodes.

---

## Event/Handler System

The codebase uses **handler arrays** (not EventEmitter). Every subscribable event follows this three-part pattern:

```typescript
// 1. Protected handler array
protected viewRangeChangedHandlers: ((oldRange: TimelineChart.TimeGraphRange, newRange: TimelineChart.TimeGraphRange) => void)[];

// 2. Protected dispatch method
protected handleViewRangeChange(oldRange: TimelineChart.TimeGraphRange) {
    this.viewRangeChangedHandlers.forEach(handler => handler(oldRange, this._viewRange));
}

// 3. Public subscribe/unsubscribe pair
onViewRangeChanged(handler: (oldRange: TimelineChart.TimeGraphRange, viewRange: TimelineChart.TimeGraphRange) => void) {
    this.viewRangeChangedHandlers.push(handler);
}
removeViewRangeChangedHandler(handler: (oldRange: TimelineChart.TimeGraphRange, viewRange: TimelineChart.TimeGraphRange) => void) {
    const index = this.viewRangeChangedHandlers.indexOf(handler);
    if (index > -1) {
        this.viewRangeChangedHandlers.splice(index, 1);
    }
}
```

**Naming conventions:**
- Array: `<event>ChangedHandlers`
- Dispatch: `handle<Event>Change[d]()`
- Subscribe: `on<Event>Changed()` or `on<Event>ChangedHandler()`
- Unsubscribe: `remove<Event>ChangedHandler()`

---

## Getter/Setter State Pattern

State is managed through TypeScript accessors. Setters validate and dispatch:

```typescript
protected _viewRange: TimelineChart.TimeGraphRange;

get viewRange(): TimelineChart.TimeGraphRange {
    return this._viewRange;
}

set viewRange(newRange: TimelineChart.TimeGraphRange) {
    const oldRange = this._viewRange;
    // validation and clamping...
    this._viewRange = { start: newRange.start, end: newRange.end };
    this.handleViewRangeChange(oldRange);
}
```

---

## Access Modifier Conventions

| Modifier | Used for |
|----------|----------|
| `private` | Truly internal state that subclasses should never touch (`_scaleFactor`, `_worldRenderFactor`) |
| `protected` | Handler arrays, dispatch methods, backing fields subclasses may reference (`_viewRange`, `_canvasDisplayWidth`) |
| `public` (implicit) | Subscribe/unsubscribe methods, getters/setters forming the API |

---

## Layer Lifecycle

Layers follow a strict four-phase sequence:

### 1. Constructor — Configuration only
```typescript
constructor(protected id: string, protected rowController: TimeGraphRowController) {
    super(id);
    // Store config. Do NOT access controllers here.
}
```

### 2. `initializeLayer()` — Dependency injection (called by container)
```typescript
initializeLayer(canvas, stage, stateController, unitController) {
    // Sets all fields, adds to stage, calls afterAddToContainer()
}
```

### 3. `afterAddToContainer()` — Event subscriptions and first render
```typescript
afterAddToContainer() {
    this._updateHandler = (): void => this.update();
    this.unitController.onViewRangeChanged(this._updateHandler);
    this.stateController.onWorldRender(this._updateHandler);
    // Initial render...
}
```

### 4. `destroy()` — Symmetrical teardown
```typescript
destroy() {
    if (this.unitController) {
        this.unitController.removeViewRangeChangedHandler(this._updateHandler);
        this.stateController.removeWorldRenderHandler(this._updateHandler);
    }
    super.destroy();
}
```

---

## Layer Inheritance Hierarchy

```
TimeGraphLayer (abstract)
  → Manages PIXI.Container, children array, canvas events, pixel calculation
  → Provides: addChild(), removeChild(), removeChildren(), getPixel()

  └── TimeGraphViewportLayer (abstract)
        → Adds world-relative coordinate transforms
        → Provides: getWorldPixel(), shiftStage(), scaleStage(), isScalable flag

        └── TimeGraphChartLayer (abstract)
              → Adds TimeGraphRowController dependency for row-aware layers
```

Choose your base class based on what you need:
- **TimeGraphLayer** — For layers that position in pixel space only (grids, navigators)
- **TimeGraphViewportLayer** — For layers that render relative to world range (selection ranges, range events)
- **TimeGraphChartLayer** — For layers that also need row height/scroll info (chart, arrows, scrollbar)

---

## The `_updateHandler` Pattern

Layers store a reference to their update function in an arrow-function field. This ensures a stable reference for both subscription and removal:

```typescript
private _updateHandler: () => void;

afterAddToContainer() {
    this._updateHandler = (): void => this.update();
    this.unitController.onViewRangeChanged(this._updateHandler);
}

destroy() {
    this.unitController.removeViewRangeChangedHandler(this._updateHandler);
}
```

For layers needing distinct responses to different events, use separate named handler fields:

```typescript
private _verticalOffsetChangedHandler: () => void;
private _totalHeightChangedHandler: () => void;
```

---

## Component Lifecycle

Components follow `update() → clear() → render()`:

```typescript
// Base class
update(opts?: TimeGraphComponentOptions) {
    if (opts) { this._options = opts; }
    this.clear();
    this.render();
    this.startPixiRender();
}

// Each subclass implements:
abstract render(): void;
```

### Drawing Primitives (available in all components)

| Method | Purpose |
|--------|---------|
| `rect(opts)` | Filled rectangle with optional border |
| `roundedRect(opts)` | Rounded corners |
| `rectTruncated(opts)` | Chamfered corner when width > 20px |
| `hline(opts)` | Horizontal line (half-pixel offset for crispness) |
| `vline(opts)` | Vertical line (half-pixel offset for crispness) |

---

## Component Class Structure

```typescript
export class MyComponent extends TimeGraphComponent<MyModel> {
    protected _options: MyStyleType;

    constructor(id: string, model: MyModel, protected _style: MyComponentStyle) {
        super(id, undefined, model);
        this._options = { /* compute position/size from model */ };
    }

    get style(): MyComponentStyle { return this._style; }
    set style(style: MyComponentStyle) {
        // merge style → _options
        this.update();
    }

    render(): void {
        // use this.rect(), this.hline(), etc.
    }
}
```

---

## Parent/Child Component Pattern

`TimeGraphRow` implements `TimeGraphParentComponent` and manages typed Maps of children:

```typescript
export interface TimeGraphParentComponent {
    addChild(child: TimeGraphComponent<any>): void;
}
```

Row manages states and annotations:
```typescript
protected _rowStateComponents: Map<string, TimeGraphStateComponent> = new Map();
protected _rowAnnotationComponents: Map<string, TimeGraphAnnotationComponent> = new Map();
```

Higher-level typed methods (`addState`, `removeState`, `addAnnotation`) maintain the Maps and delegate to the generic `addChild`/`removeChild`.

---

## Provider Pattern (Data Fetching)

The chart layer uses a provider object injected at construction:

```typescript
export interface TimeGraphChartProviders {
    rowProvider: () => { rowIds: number[] }
    dataProvider: (range: TimelineChart.TimeGraphRange, resolution: number, fetchArrows: boolean, rowIds?: number[]) =>
        Promise<{ rows: TimeGraphRowModel[], range: TimeGraphRange, resolution: number }> | { ... } | undefined
    stateStyleProvider?: (el: TimelineChart.TimeGraphState) => TimeGraphStateStyle | undefined
    rowStyleProvider?: (row?: TimelineChart.TimeGraphRowModel) => TimeGraphRowStyle | undefined
    rowAnnotationStyleProvider?: (el: TimelineChart.TimeGraphAnnotation) => TimeGraphAnnotationStyle | undefined
}
```

Providers can return sync or async results. The chart handles both via conditional `await`.

---

## Naming Conventions

### Files
- `time-graph-<noun>.ts` for all source files (kebab-case)
- `time-graph-<noun>.test.ts` for tests

### Classes
- `TimeGraph<Noun>` — e.g., `TimeGraphContainer`, `TimeGraphChart`, `TimeGraphStateComponent`

### Interfaces/Types
- Style interfaces: `TimeGraph<Concept>Style` — e.g., `TimeGraphRowStyle`, `TimeGraphStateStyle`
- Options interfaces: `TimeGraph<Concept>Options` — e.g., `TimeGraphContainerOptions`, `TimeGraphCursorOptions`
- Positional types: `TimeGraph<Shape>` — e.g., `TimeGraphRect`, `TimeGraphStyledRect`

### Fields
- Private/protected backing fields: underscore prefix (`_viewRange`, `_displayObject`, `_model`)
- Public getters: bare name (`viewRange`, `displayObject`, `model`)
- Handler references: underscore prefix (`_updateHandler`, `_contextMenuHandler`)

### Composition types via intersection
```typescript
export type TimeGraphRect = TimeGraphHorizontalElement & TimeGraphVerticalElement;
export type TimeGraphStyledRect = TimeGraphRect & TimeGraphElementStyle;
export type TimeGraphHorizontalLine = TimeGraphHorizontalElement & TimeGraphLineStyle;
```

---

## BigInt Conventions

| Domain | Type | Examples |
|--------|------|---------|
| Time values | `bigint` | range.start, range.end, absoluteRange, offset, totalLength |
| Pixel values | `number` | zoomFactor, scaleFactor, positionOffset, canvasWidth |

- Use `BigInt(0)` not `0n` (broader compatibility)
- The time→pixel boundary lives in `TimeGraphStateController` and `getWorldPixel()`
- `BIMath` provides safe operations on `bigint | number` inputs, always returning `bigint`

---

## Model Namespace

All data model interfaces live in the `TimelineChart` namespace:

```typescript
export namespace TimelineChart {
    export interface TimeGraphRange { start: bigint; end: bigint }
    export interface TimeGraphModel { ... }
    export interface TimeGraphRowModel { ... }
    export interface TimeGraphState { ... }
    export interface TimeGraphArrow { ... }
    export interface TimeGraphAnnotation { ... }
}
```

Referenced as `TimelineChart.TimeGraphRange`, etc. The `readonly data?: { [key: string]: any }` field on most interfaces is the extensibility point for consumer metadata.

---

## Container Wiring Pattern (How to set up a chart)

```typescript
// 1. Create unit controller with absolute time range
const unitController = new TimeGraphUnitController(totalLength);

// 2. Create row controller with row dimensions
const rowController = new TimeGraphRowController(rowHeight, totalHeight);

// 3. Create container (creates StateController internally, sets up PixiJS)
const container = new TimeGraphContainer({
    id: 'my-chart', width: 1000, height: 300, backgroundColor: 0xf9f6e8
}, unitController, canvas);

// 4. Create layers
const grid = new TimeGraphChartGrid('grid', rowHeight);
const chart = new TimeGraphChart('chart', providers, rowController);
const cursors = new TimeGraphChartCursors('cursors', chart, rowController, { color: 0xb77f09 });

// 5. Add layers to container (calls initializeLayer → afterAddToContainer on each)
container.addLayers([grid, chart, cursors]);
```

Layer order in `addLayers` determines z-order (first = bottom).

---

## Test Patterns

### Component tests — Snapshot-based
```typescript
describe('TimeGraphArrow', () => {
    const component = new TimeGraphArrowComponent('Test', arrow, coords);

    it('Renders', () => { expect(component).toBeTruthy(); });
    it('Matches snapshot', () => { expect(component).toMatchSnapshot(); });
});
```

### Performance tests — Timing with `performance.now()`
```typescript
describe('Performance', () => {
    let timeGraph: TimeGraphPerformanceTest;

    beforeEach(() => {
        timeGraph = new TimeGraphPerformanceTest(testData, viewRange);
    });

    it('addOrUpdateRow()', () => {
        const start = performance.now();
        chart.addOrUpdateRows(data);
        const time = performance.now() - start;
        console.log("running time", time, "ms");
        expect(time).toBeGreaterThan(0);
    });
});
```

Performance tests use `TimeGraphPerformanceTest` which sets up a full chart in jsdom for benchmarking. They print timing to console and assert `> 0` (threshold depends on environment).

---

## Canvas Event Pattern

For DOM events not handled by PixiJS interaction:

```typescript
// In afterAddToContainer:
this._contextMenuHandler = (e: MouseEvent): void => { e.preventDefault(); };
this.onCanvasEvent('contextmenu', this._contextMenuHandler);

// In destroy:
this.removeOnCanvasEvent('contextmenu', this._contextMenuHandler);
```

Always store the handler reference for later removal.

---

## Arrow Function Convention for Callbacks

Use arrow functions (as class fields) when a method will be passed as a callback to preserve `this` binding:

```typescript
// Correct — stable reference, correct `this`
protected calculatePositionOffset = () => {
    this.stateController.positionOffset = { ... };
}

// Then pass directly:
this.unitController.onViewRangeChanged(this.calculatePositionOffset);
this.unitController.removeViewRangeChangedHandler(this.calculatePositionOffset);
```

Use regular methods for API that is called directly by consumers.
