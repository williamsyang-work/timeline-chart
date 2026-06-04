import { TimeGraphUnitController } from "timeline-chart/lib/time-graph-unit-controller";
import { TimeGraphRowController } from "timeline-chart/lib/time-graph-row-controller";
import { TimeGraphContainer } from "timeline-chart/lib/time-graph-container";
import { TimeGraphChart } from "timeline-chart/lib/time-graph-chart";
import { TimelineChart } from "timeline-chart/lib/time-graph-model";
import { TestDataProvider } from "./test-data-provider";

const styleConfig = {
    mainWidth: 1000,
    mainHeight: 300,
    chartBackgroundColor: 0xf9f6e8,
}

const container = document.getElementById('main');
if (!container) {
    throw new Error('No container available.');
}
container.innerHTML = '';
container.style.width = styleConfig.mainWidth + "px";

const testDataProvider = new TestDataProvider(styleConfig.mainWidth);
const timeGraph = testDataProvider.getData({});
const unitController = new TimeGraphUnitController(timeGraph.totalLength);

const rowHeight = 16;
const totalHeight = timeGraph.rows.length * rowHeight;
const rowController = new TimeGraphRowController(rowHeight, totalHeight);

const providers: TimelineChart.TimeGraphChartProviders = {
    dataProvider: (range: TimelineChart.TimeGraphRange, resolution: number) => {
        const newResolution: number = resolution * 0.1;
        const data = testDataProvider.getData({ range, resolution: newResolution });
        return {
            rows: data.rows,
            range,
            resolution: newResolution
        };
    }
}

async function main() {
    const chartHTMLContainer = document.createElement('div');
    chartHTMLContainer.id = 'main_chart';
    container!.appendChild(chartHTMLContainer);

    const chartCanvas = document.createElement('canvas');
    chartCanvas.tabIndex = 1;

    const timeGraphChartContainer = await TimeGraphContainer.create({
        id: timeGraph.id + '_chart',
        height: styleConfig.mainHeight,
        width: styleConfig.mainWidth,
        backgroundColor: styleConfig.chartBackgroundColor
    }, unitController, chartCanvas);
    chartHTMLContainer.appendChild(timeGraphChartContainer.canvas);

    const chart = new TimeGraphChart(timeGraphChartContainer, rowController, providers);
    await chart.render();
}

main();
