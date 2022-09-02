import { TimelineChart } from "./time-graph-model";
import { TimeGraphUnitController } from "./time-graph-unit-controller";

export class TimeGraphStateController {
    oldPositionOffset: {
        x: number;
        y: number;
    };
    
    snapped: boolean;

    protected ratio: number;

    protected _canvasDisplayWidth: number;
    protected _canvasDisplayHeight: number;

    protected _zoomFactor: number;
    protected _initialZoomFactor: number;
    protected _positionOffset: {
        x: number;
        y: number;
    };

    private _worldRenderedHandlers: ((worldRange: TimelineChart.TimeGraphRange) => void)[] = [];
    protected zoomChangedHandlers: ((zoomFactor: number) => void)[] = [];
    protected positionChangedHandlers: (() => void)[] = [];
    protected canvasDisplayWidthChangedHandlers: (() => void)[] = [];


    constructor(protected canvas: HTMLCanvasElement, protected unitController: TimeGraphUnitController) {
        this.ratio = window.devicePixelRatio;
        this._canvasDisplayWidth = this.canvas.width / this.ratio;
        this._canvasDisplayHeight = this.canvas.height / this.ratio;
        this._initialZoomFactor = this.zoomFactor;
        this._positionOffset = { x: 0, y: 0 };
        this.oldPositionOffset = { x: 0, y: 0 };
        this.snapped = false;

        this.unitController.onViewRangeChanged(this.updateZoomFactor);
    }

    protected handleZoomChange(zoomFactor: number) {
        this.zoomChangedHandlers.forEach(handler => handler(zoomFactor));
    }
    protected handlePositionChange() {
        this.positionChangedHandlers.forEach(handler => handler());
    }
    protected handleCanvasDisplayWidthChange() {
        this.canvasDisplayWidthChangedHandlers.forEach(handler => handler());
    }

    onZoomChanged(handler: (zoomFactor: number) => void) {
        this.zoomChangedHandlers.push(handler);
    }
    onPositionChanged(handler: () => void) {
        this.positionChangedHandlers.push(handler);
    }
    onCanvasDisplayWidthChanged(handler: () => void) {
        this.canvasDisplayWidthChangedHandlers.push(handler);
    }

    removeOnZoomChanged(handler: (zoomFactor: number) => void) {
        const index = this.zoomChangedHandlers.indexOf(handler);
        if (index > -1) {
            this.zoomChangedHandlers.splice(index, 1);
        }
    }

    /**
        It is not the width of the canvas display buffer but of the canvas element in browser. Can be different depending on the display pixel ratio.
    */
    get canvasDisplayWidth() {
        return this._canvasDisplayWidth;
    }

    updateDisplayWidth() {
        this._canvasDisplayWidth = this.canvas.width / this.ratio;
    }

    /**
        It is not the heigth of the canvas display buffer but of the canvas element in browser. Can be different depending on the display pixel ratio.
    */
    get canvasDisplayHeight() {
        return this._canvasDisplayHeight;
    }

    updateDisplayHeight() {
        this._canvasDisplayHeight = this.canvas.height / this.ratio;
    }

    get initialZoomFactor(): number {
        return this._initialZoomFactor;
    }

    updateZoomFactor = () => {
        let newZoom = this.canvasDisplayWidth / Number(this.unitController.viewRangeLength);
        if (this._zoomFactor !== newZoom) {
            this.handleZoomChange(this._zoomFactor = newZoom);
        }
    }

    get zoomFactor(): number {
        this.updateZoomFactor();
        return this._zoomFactor;
    }

    get absoluteResolution(): number {
        return this.canvasDisplayWidth / Number(this.unitController.absoluteRange);
    }

    get positionOffset(): {
        x: number;
        y: number;
    } {
        return this._positionOffset;
    }
    set positionOffset(value: {
        x: number;
        y: number;
    }) {
        this._positionOffset = value;
        this.handlePositionChange();
    }

    onWorldRender = (handler: (worldRange: TimelineChart.TimeGraphRange) => void) => {
        this._worldRenderedHandlers.push(handler);
    }
    
    handleOnWorldRender = () => {
        this._worldRenderedHandlers.forEach(handler => handler(this.unitController.worldRange));
    }

    removeWorldRenderHandler = (handler: (worldRange: TimelineChart.TimeGraphRange) => void) => {
        const index = this._worldRenderedHandlers.indexOf(handler);
        if (index > -1) {
            this._worldRenderedHandlers.splice(index, 1);
        }
    }

}