import { Graphics, Container } from "pixi.js";
import { TimelineChart } from "./time-graph-model";
import { TimeGraphRowController } from "./time-graph-row-controller";
import { TimeGraphContainer } from "./time-graph-container";

export class TimeGraphChart {
    private container: Container;

    constructor(
        private chartContainer: TimeGraphContainer,
        private rowController: TimeGraphRowController,
        private providers: TimelineChart.TimeGraphChartProviders
    ) {
        this.container = new Container();
        this.chartContainer.addChild(this.container);
    }

    async render() {
        this.container.removeChildren();

        const width = this.chartContainer.width;
        const rowHeight = this.rowController.rowHeight;

        const data = await this.providers.dataProvider(
            { start: BigInt(0), end: BigInt(Number.MAX_SAFE_INTEGER) },
            1
        );
        if (!data) return;

        data.rows.forEach((_row, index) => {
            const y = index * rowHeight + rowHeight / 2;
            const line = new Graphics();
            line.moveTo(0, y);
            line.lineTo(width, y);
            line.stroke({ width: 1, color: 0x000000 });
            this.container.addChild(line);
        });
    }
}
