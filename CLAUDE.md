# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A time graph / gantt chart library for rendering large trace data, built on PixiJS (pixi.js-legacy v5). Used by Eclipse CDT Cloud projects like the Theia Trace Extension. Part of the Eclipse Foundation.

## Build & Development Commands

```bash
yarn                    # Install dependencies and build all packages
yarn build              # Build all packages (lerna run build)
yarn start              # Start example app at localhost:8080
yarn test               # Run tests across all packages
```

Tests live in `timeline-chart/` and use Jest with ts-jest and jsdom:
```bash
cd timeline-chart
yarn test --verbose --watch           # Interactive test mode
yarn test --coverage --collectCoverageFrom='src/**/*.ts'  # Coverage report
```

## Monorepo Structure

Lerna monorepo with yarn workspaces. Two packages:
- **`timeline-chart/`** — The library (npm package `timeline-chart`). TypeScript compiled to `lib/` via `tsc`.
- **`example/`** — Demo app using webpack-dev-server. Consumes the library.

## Architecture

The library uses a layered rendering architecture on top of PixiJS:

**Controllers** (src/):
- `TimeGraphUnitController` — Manages time ranges (absolute, view, selection) using BigInt. The central state for what time span is visible. Emits change events via handler arrays.
- `TimeGraphStateController` — Translates between time-domain and pixel-domain. Manages zoom, pan, position offset, and canvas dimensions.
- `TimeGraphRowController` — Manages row selection, vertical scrolling, and total height.
- `TimeGraphContainer` — Creates the PixiJS Application/renderer, initializes layers, and handles canvas setup (WebGL2 with canvas fallback).

**Layer hierarchy** (src/layer/):
- `TimeGraphLayer` (abstract base) → `TimeGraphViewportLayer` → `TimeGraphChartLayer` → concrete layers
- `TimeGraphChart` — Main chart layer. Renders rows/states using a provider pattern (`dataProvider`, `stateStyleProvider`, `rowProvider`).
- Other layers: axis, cursors, grid, arrows, navigator, scrollbar, selection range, range events.

**Components** (src/components/):
- `TimeGraphComponent` — Base class wrapping PIXI.Graphics for individual visual elements.
- Concrete components: rows, states (rectangles within rows), arrows, cursors, annotations, axis scales, grid.

**Key design patterns:**
- All time values use `bigint` for precision with large traces. `BIMath` provides safe bigint arithmetic utilities.
- Event-driven updates via handler arrays (not EventEmitter) on controllers — `onViewRangeChanged`, `onSelectedRowChanged`, etc.
- The chart fetches data asynchronously via `dataProvider` which receives the visible range and resolution, enabling lazy loading of large traces.
- Layers are composited in a PixiJS stage; each layer manages its own PIXI.Container of components.

## TypeScript Configuration

- Target: ES5, Module: CommonJS
- Strict null checks enabled, no implicit any
- BigInt support via `esnext.bigint` lib
- JSX: react (for component tests using Enzyme)
