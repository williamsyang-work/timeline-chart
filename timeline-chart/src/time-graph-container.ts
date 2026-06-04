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

    private constructor() {}

    static async create(config: TimeGraphContainerOptions, unitController: TimeGraphUnitController, extCanvas?: HTMLCanvasElement): Promise<TimeGraphContainer> {
        const instance = new TimeGraphContainer();
        instance.config = config;
        instance.unitController = unitController;

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

        const app = new Application();
        await app.init({
            canvas,
            width: config.width,
            height: config.height,
            backgroundColor: config.backgroundColor ?? 0xffffff,
            antialias: true,
            resolution: window.devicePixelRatio,
            autoDensity: true,
        });

        instance.application = app;
        instance.stage = app.stage;
        instance._canvas = app.canvas as HTMLCanvasElement;

        instance.stateController = new TimeGraphStateController(canvas, unitController);

        return instance;
    }

    protected config: TimeGraphContainerOptions;
    protected unitController: TimeGraphUnitController;

    get canvas(): HTMLCanvasElement {
        return this._canvas;
    }

    addChild(child: ContainerChild) {
        this.stage.addChild(child);
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
