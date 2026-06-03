import { TimeGraphAxis } from "timeline-chart/lib/layer/time-graph-axis";
import { TimeGraphChart } from "timeline-chart/lib/layer/time-graph-chart";
import { TimeGraphUnitController } from "timeline-chart/lib/time-graph-unit-controller";
import { TimeGraphRowController } from "timeline-chart/lib/time-graph-row-controller";
import { TimeGraphContainer } from "timeline-chart/lib/time-graph-container";
import { TimelineChart } from "timeline-chart/lib/time-graph-model";
import { TimeGraphStateStyle } from "timeline-chart/lib/components/time-graph-state";
import { TestDataProvider } from "./test-data-provider";

const styleConfig = {
    mainWidth: 1000,
    mainHeight: 300,
    naviBackgroundColor: 0xf7eaaf,
    chartBackgroundColor: 0xf9f6e8,
}

const styleMap = new Map<string, TimeGraphStateStyle>();

const container = document.getElementById('main');
if (!container) {
    throw new Error('No container available.');
}
container.innerHTML = '';
container.style.width = styleConfig.mainWidth + "px";

const testDataProvider = new TestDataProvider(styleConfig.mainWidth);
let timeGraph = testDataProvider.getData({});
const unitController = new TimeGraphUnitController(timeGraph.totalLength);
unitController.numberTranslator = (theNumber: bigint) => {
    let num = theNumber.toString();
    if (num.length > 6) {
        num = num.slice(0, -6) + ':' + num.slice(-6);
    }
    if (num.length > 3) {
        num = num.slice(0, -3) + ':' + num.slice(-3);
    }
    return num;
};

const rowHeight = 16;
const totalHeight = timeGraph.rows.length * rowHeight;
const rowController = new TimeGraphRowController(rowHeight, totalHeight);

const providers = {
    dataProvider: (range: TimelineChart.TimeGraphRange, resolution: number) => {
        const newResolution: number = resolution * 0.1;
        timeGraph = testDataProvider.getData({ range, resolution: newResolution });
        return {
            rows: timeGraph.rows,
            range,
            resolution: newResolution
        };
    },
    stateStyleProvider: (model: TimelineChart.TimeGraphState) => {
        const styles: TimeGraphStateStyle[] = [
            { color: 0x11ad1b, height: rowHeight * 0.8 },
            { color: 0xbc2f00, height: rowHeight * 0.7 },
            { color: 0xccbf5d, height: rowHeight * 0.6 }
        ];
        let style: TimeGraphStateStyle | undefined = styles[0];
        if (model.data && model.data.value) {
            const val = model.data.value;
            style = styleMap.get(val);
            if (!style) {
                style = styles[(styleMap.size % styles.length)];
                styleMap.set(val, style);
            }
        }
        return {
            color: style.color,
            height: style.height,
            borderWidth: model.selected ? 1 : 0,
            minWidthForLabels: 100
        };
    },
    rowStyleProvider: (row: TimelineChart.TimeGraphRowModel) => {
        return {
            backgroundColor: 0xe0ddcf,
            backgroundOpacity: row?.selected ? 0.6 : 0,
            lineColor: row?.data && row?.data.hasStates ? 0xdddddd : 0xaa4444,
            lineThickness: row?.data && row?.data.hasStates ? 1 : 3
        }
    },
    rowAnnotationStyleProvider: (annotation: TimelineChart.TimeGraphAnnotation) => {
        return {
            color: annotation.data?.color,
            size: 7 * (annotation.data && annotation.data.height ? annotation.data.height : 1.0),
            symbol: annotation.data?.symbol,
            verticalAlign: annotation.data?.verticalAlign,
            opacity: annotation.data?.opacity
        }
    }
}

// Axis container
const axisHTMLContainer = document.createElement('div');
axisHTMLContainer.id = 'main_axis';
container.appendChild(axisHTMLContainer);

const axisCanvas = document.createElement('canvas');
const timeGraphAxisContainer = new TimeGraphContainer({
    height: 30,
    width: styleConfig.mainWidth,
    id: timeGraph.id + '_axis',
    backgroundColor: 0xffffff
}, unitController, axisCanvas);
axisHTMLContainer.appendChild(timeGraphAxisContainer.canvas);

const timeAxisLayer = new TimeGraphAxis('timeGraphAxis', { color: styleConfig.naviBackgroundColor, verticalAlign: 'bottom'});
timeGraphAxisContainer.addLayers([timeAxisLayer]);

// Chart container
const chartHTMLContainer = document.createElement('div');
chartHTMLContainer.id = 'main_chart';
container.appendChild(chartHTMLContainer);

const chartCanvas = document.createElement('canvas');
chartCanvas.tabIndex = 1;

const timeGraphChartContainer = new TimeGraphContainer({
    id: timeGraph.id + '_chart',
    height: styleConfig.mainHeight,
    width: styleConfig.mainWidth,
    backgroundColor: styleConfig.chartBackgroundColor
}, unitController, chartCanvas);
chartHTMLContainer.appendChild(timeGraphChartContainer.canvas);

const timeGraphChart = new TimeGraphChart('timeGraphChart', providers, rowController);
timeGraphChartContainer.addLayers([timeGraphChart]);
