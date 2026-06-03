import { TimeGraphRow, TimeGraphRowStyle } from "../components/time-graph-row";
import { TimeGraphStateComponent, TimeGraphStateStyle } from "../components/time-graph-state";
import { TimeGraphAnnotationComponent, TimeGraphAnnotationStyle } from "../components/time-graph-annotation";
import { TimelineChart } from "../time-graph-model";
import { TimeGraphRowController } from "../time-graph-row-controller";
import { TimeGraphChartLayer } from "./time-graph-chart-layer";

export interface TimeGraphChartProviders {
    dataProvider: (range: TimelineChart.TimeGraphRange, resolution: number) =>
        Promise<{ rows: TimelineChart.TimeGraphRowModel[], range: TimelineChart.TimeGraphRange, resolution: number }>
        | { rows: TimelineChart.TimeGraphRowModel[], range: TimelineChart.TimeGraphRange, resolution: number }
        | undefined
    stateStyleProvider?: (el: TimelineChart.TimeGraphState) => TimeGraphStateStyle | undefined
    rowAnnotationStyleProvider?: (el: TimelineChart.TimeGraphAnnotation) => TimeGraphAnnotationStyle | undefined
    rowStyleProvider?: (row?: TimelineChart.TimeGraphRowModel) => TimeGraphRowStyle | undefined
}

export class TimeGraphChart extends TimeGraphChartLayer {
    protected rowComponents: Map<number, TimeGraphRow> = new Map();

    constructor(id: string,
        protected providers: TimeGraphChartProviders,
        protected rowController: TimeGraphRowController) {
        super(id, rowController);
    }

    protected afterAddToContainer() {
        this.fetchAndRender();
    }

    update() {
        this.fetchAndRender();
    }

    protected async fetchAndRender() {
        const range = this.unitController.viewRange;
        const resolution = Number(this.unitController.viewRangeLength) / this.stateController.canvasDisplayWidth;

        const rowData = await this.providers.dataProvider(range, resolution);
        if (!rowData) {
            return;
        }

        this.removeChildren();
        this.renderRows(rowData.rows);
    }

    protected renderRows(rows: TimelineChart.TimeGraphRowModel[]) {
        rows.forEach((row, index) => {
            const rowStyle = this.providers.rowStyleProvider ? this.providers.rowStyleProvider(row) : undefined;
            const rowComponent = new TimeGraphRow('row_' + row.id, {
                position: { x: 0, y: this.rowController.rowHeight * index },
                width: this.stateController.canvasDisplayWidth,
                height: this.rowController.rowHeight
            }, index, row, rowStyle);

            this.addChild(rowComponent);
            this.rowComponents.set(row.id, rowComponent);

            this.renderStates(row, rowComponent);
            this.renderAnnotations(row, rowComponent);
        });
    }

    protected renderStates(row: TimelineChart.TimeGraphRowModel, rowComponent: TimeGraphRow) {
        row.states.forEach((stateModel: TimelineChart.TimeGraphState) => {
            if (!stateModel.data?.style) {
                return;
            }
            const xStart = this.getPixel(stateModel.range.start - this.unitController.viewRange.start);
            const xEnd = this.getPixel(stateModel.range.end - this.unitController.viewRange.start);
            const displayWidth = xEnd - xStart;
            const elementStyle = this.providers.stateStyleProvider ? this.providers.stateStyleProvider(stateModel) : undefined;
            const el = new TimeGraphStateComponent(stateModel.id, stateModel, xStart, xEnd, rowComponent, elementStyle, displayWidth, 1);
            rowComponent.addState(el);
        });
    }

    protected renderAnnotations(row: TimelineChart.TimeGraphRowModel, rowComponent: TimeGraphRow) {
        row.annotations.forEach((annotation: TimelineChart.TimeGraphAnnotation) => {
            const x = this.getPixel(annotation.range.start - this.unitController.viewRange.start);
            const elementStyle = this.providers.rowAnnotationStyleProvider ? this.providers.rowAnnotationStyleProvider(annotation) : undefined;
            const el = new TimeGraphAnnotationComponent(
                annotation.id, annotation,
                { position: { x, y: rowComponent.position.y + (rowComponent.height * 0.5) } },
                elementStyle, rowComponent, 1
            );
            rowComponent.addAnnotation(el);
        });
    }

    protected removeChildren(): void {
        this.rowComponents.clear();
        super.removeChildren();
    }

    destroy() {
        this.rowComponents.clear();
        super.destroy();
    }
}
