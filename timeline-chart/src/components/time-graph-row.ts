import { Container, Graphics } from "pixi.js";
import { TimelineChart } from "../time-graph-model";

export interface TimeGraphRowOptions {
    position: { x: number; y: number };
    width: number;
    height: number;
}

const DEFAULT_STYLE: TimelineChart.TimeGraphRowStyle = {
    lineOpacity: 0.5,
    lineThickness: 1,
    lineColor: 0xeeeeee,
    backgroundOpacity: 0,
};

export class TimeGraphRow {
    readonly childContainer: Container;
    private background: Graphics;
    private line: Graphics;
    private _style: TimelineChart.TimeGraphRowStyle;

    constructor(
        public readonly id: string,
        private _options: TimeGraphRowOptions,
        public readonly rowIndex: number,
        public readonly model?: TimelineChart.TimeGraphRowModel,
        style?: TimelineChart.TimeGraphRowStyle
    ) {
        this._style = { ...DEFAULT_STYLE, ...style };
        this.childContainer = new Container();
        this.childContainer.position.set(_options.position.x, _options.position.y);
        this.background = new Graphics();
        this.line = new Graphics();
        this.childContainer.addChild(this.background);
        this.childContainer.addChild(this.line);
        this.render();
    }

    get position() {
        return this._options.position;
    }

    set position(pos: { x: number; y: number }) {
        this._options.position = pos;
        this.childContainer.position.set(pos.x, pos.y);
    }

    get height() {
        return this._options.height;
    }

    get width() {
        return this._options.width;
    }

    set width(w: number) {
        this._options.width = w;
        this.render();
    }

    get style() {
        return this._style;
    }

    set style(style: TimelineChart.TimeGraphRowStyle) {
        this._style = { ...DEFAULT_STYLE, ...style };
        this.render();
    }

    private render() {
        const { width, height } = this._options;

        this.background.clear();
        if (this._style.backgroundOpacity && this._style.backgroundOpacity > 0) {
            this.background.rect(0, 0, width, height);
            this.background.fill({
                color: this._style.backgroundColor ?? 0x000000,
                alpha: this._style.backgroundOpacity,
            });
        }

        this.line.clear();
        const lineY = height / 2;
        this.line.moveTo(0, lineY);
        this.line.lineTo(width, lineY);
        this.line.stroke({
            width: this._style.lineThickness ?? 1,
            color: this._style.lineColor ?? 0xeeeeee,
            alpha: this._style.lineOpacity ?? 0.5,
        });
    }

    destroy() {
        this.childContainer.destroy({ children: true });
    }
}
