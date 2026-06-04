import { Application, Container, ContainerChild } from "pixi.js";
import { TimeGraphUnitController } from "./time-graph-unit-controller";
import { TimeGraphStateController } from "./time-graph-state-controller";

export interface TimeGraphContainerOptions {
    id: string;
    width: number;
    height: number;
    backgroundColor?: number;
    transparent?: boolean;
    classNames?: string;
}

export class TimeGraphContainer {

    protected stage: Container;
    protected application: Application;

    protected _canvas: HTMLCanvasElement;

    protected stateController: TimeGraphStateController;

    private _initPromise: Promise<void>;

    constructor(protected config: TimeGraphContainerOptions, protected unitController: TimeGraphUnitController, extCanvas?: HTMLCanvasElement) {
        let canvas: HTMLCanvasElement;
        if (!extCanvas) {
            canvas = document.createElement('canvas');
        } else {
            canvas = extCanvas;
        }

        canvas.style.width = config.width + 'px';
        canvas.style.height = config.height + 'px';
        canvas.width = config.width;
        canvas.height = config.height;
        canvas.id = config.id;
        canvas.className = `time-graph-canvas ${config.classNames || ''}`;

        this._canvas = canvas;
        this._initPromise = this.initPixiApp(canvas);
    }

    private async initPixiApp(canvas: HTMLCanvasElement): Promise<void> {
        const app = new Application();
        await app.init({
            canvas,
            width: this.config.width,
            height: this.config.height,
            backgroundColor: this.config.backgroundColor ?? 0xffffff,
            antialias: true,
            resolution: window.devicePixelRatio,
            autoDensity: true,
        });

        this.application = app;
        this.stage = app.stage;
        this.stateController = new TimeGraphStateController(canvas, this.unitController);
    }

    get initialized(): Promise<void> {
        return this._initPromise;
    }

    get canvas(): HTMLCanvasElement {
        return this._canvas;
    }

    addChild(child: ContainerChild) {
        this.stage.addChild(child);
    }

    addLayers(layers: { initializeLayer(canvas: HTMLCanvasElement, stage: Container, stateController: TimeGraphStateController, unitController: TimeGraphUnitController): void }[]) {
        layers.forEach(layer => this.addLayer(layer));
    }

    protected addLayer(layer: { initializeLayer(canvas: HTMLCanvasElement, stage: Container, stateController: TimeGraphStateController, unitController: TimeGraphUnitController): void }) {
        layer.initializeLayer(this._canvas, this.stage, this.stateController, this.unitController);
    }

    get width(): number {
        return this.config.width;
    }

    get height(): number {
        return this.config.height;
    }

    updateCanvas(newWidth: number, newHeight: number, newColor?: number) {
        this.config.width = newWidth;
        this.config.height = newHeight;
        if (newColor !== undefined) {
            this.config.backgroundColor = newColor;
        }

        this.application.renderer.resize(newWidth, newHeight);
        this.stateController.updateDisplayWidth();
        this.stateController.updateDisplayHeight();
    }

    destroy() {
        this.stateController.removeHandlers();
        this.application.destroy(true);
    }
}
