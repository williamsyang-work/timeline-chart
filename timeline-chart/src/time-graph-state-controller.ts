import { TimeGraphUnitController } from "./time-graph-unit-controller";

// TODO - maybe this should be called 'SizeController' because 'state' is vague
export class TimeGraphStateController {

    protected ratio: number;
    protected _canvasDisplayWidth: number;
    protected _canvasDisplayHeight: number;
    protected _zoomFactor: number;

    protected zoomChangedHandlers: ((zoomFactor: number) => void)[] = [];

    constructor(protected canvas: HTMLCanvasElement, protected unitController: TimeGraphUnitController) {
        this.ratio = window.devicePixelRatio;
        this._canvasDisplayWidth = this.canvas.width / this.ratio;
        this._canvasDisplayHeight = this.canvas.height / this.ratio;
        this._zoomFactor = this._canvasDisplayWidth / Number(this.unitController.viewRangeLength);
        this.unitController.onViewRangeChanged(this.updateZoomFactor);
    }

    protected handleZoomChange(zoomFactor: number) {
        this.zoomChangedHandlers.forEach(handler => handler(zoomFactor));
    }

    onZoomChanged(handler: (zoomFactor: number) => void) {
        this.zoomChangedHandlers.push(handler);
    }

    removeOnZoomChanged(handler: (zoomFactor: number) => void) {
        const index = this.zoomChangedHandlers.indexOf(handler);
        if (index > -1) {
            this.zoomChangedHandlers.splice(index, 1);
        }
    }

    get canvasDisplayWidth() {
        return this._canvasDisplayWidth;
    }

    get canvasDisplayHeight() {
        return this._canvasDisplayHeight;
    }

    updateDisplayWidth() {
        this._canvasDisplayWidth = this.canvas.width / this.ratio;
        this.updateZoomFactor();
    }

    updateDisplayHeight() {
        this._canvasDisplayHeight = this.canvas.height / this.ratio;
    }

    get zoomFactor(): number {
        return this._zoomFactor;
    }

    updateZoomFactor = () => {
        const newZoom = this._canvasDisplayWidth / Number(this.unitController.viewRangeLength);
        if (this._zoomFactor !== newZoom) {
            this._zoomFactor = newZoom;
            this.handleZoomChange(newZoom);
        }
    }

    removeHandlers() {
        this.unitController.removeViewRangeChangedHandler(this.updateZoomFactor);
    }
}
