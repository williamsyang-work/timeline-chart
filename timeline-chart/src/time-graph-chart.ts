import { Container } from "pixi.js";
import { TimelineChart } from "./time-graph-model";
import { TimeGraphRowController } from "./time-graph-row-controller";
import { TimeGraphContainer } from "./time-graph-container";
import { TimeGraphRow } from "./components/time-graph-row";

export class TimeGraphChart {
    private container: Container;
    private rowComponents: Map<number, TimeGraphRow> = new Map();

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
        this.rowComponents.clear();

        const width = this.chartContainer.width;
        const rowHeight = this.rowController.rowHeight;

        const data = await this.providers.dataProvider(
            { start: BigInt(0), end: BigInt(Number.MAX_SAFE_INTEGER) },
            1
        );
        if (!data) return;

        console.dir(data);

        data.rows.forEach((row, index) => {
            const rowStyle = this.providers.rowStyleProvider?.(row);
            const rowComponent = new TimeGraphRow(
                `row_${row.id}`,
                {
                    position: { x: 0, y: rowHeight * index },
                    width,
                    height: rowHeight,
                },
                index,
                row,
                rowStyle
            );
            this.container.addChild(rowComponent.childContainer);
            this.rowComponents.set(row.id, rowComponent);
        });
    }

}
