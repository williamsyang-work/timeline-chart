import { TimeGraphStateStyle } from "../../components/time-graph-state";
import { TimeGraphContainer } from "../../time-graph-container";
import { TimelineChart } from "../../time-graph-model";
import { TimeGraphRowController } from "../../time-graph-row-controller";
import { TimeGraphUnitController } from "../../time-graph-unit-controller";
import { TimeGraphChart } from "../time-graph-chart";
import { TestDataProvider, TimeGraphPerformanceTestDataStubJsonImp } from "./test-data-provider";

const styleConfig = {
    mainWidth: 1418,
    mainHeight: 820,
    chartBackgroundColor: 0xf9f6e8,
}

export class TimeGraphPerformanceTest {
    private testDataProvider: TestDataProvider;
    private timeGraphChart: TimeGraphChart;
    private unitController: TimeGraphUnitController;
    private timeGraphChartContainer: TimeGraphContainer;

    constructor(data: any[], viewRange: TimelineChart.TimeGraphRange) {
        document.body.innerHTML = `<div id="main"><div/>`;

        const styleMap = new Map<string, TimeGraphStateStyle>();
        const rowHeight = 20;

        const container = document.getElementById('main');
        if (!container) {
            throw new Error('No container available.');
        }
        container.innerHTML = '';
        container.style.width = styleConfig.mainWidth + "px";

        const dataStub = new TimeGraphPerformanceTestDataStubJsonImp(data);
        this.testDataProvider = new TestDataProvider(styleConfig.mainWidth, dataStub);
        let timeGraph = this.testDataProvider.fetchTimeGraphData({});

        this.unitController = new TimeGraphUnitController(timeGraph.totalLength, viewRange);
        this.unitController.numberTranslator = (theNumber: bigint) => {
            const originalStart = this.testDataProvider.absoluteStart;
            theNumber += originalStart;
            const zeroPad = (num: bigint) => String(num).padStart(3, '0');
            const seconds = theNumber / BigInt(1000000000);
            const millis = zeroPad((theNumber / BigInt(1000000)) % BigInt(1000));
            const micros = zeroPad((theNumber / BigInt(1000)) % BigInt(1000));
            const nanos = zeroPad(theNumber % BigInt(1000));
            return seconds + '.' + millis + ' ' + micros + ' ' + nanos;
        };

        const providers = {
            dataProvider: (range: TimelineChart.TimeGraphRange, resolution: number) => {
                const newResolution: number = resolution * 0.1;
                timeGraph = this.testDataProvider.fetchTimeGraphData({ range, resolution: newResolution });
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
                if (row) {
                    return {
                        backgroundColor: 0xe0ddcf,
                        backgroundOpacity: row.selected ? 0.6 : 0,
                        lineColor: row.data && row.data.hasStates ? 0xdddddd : 0xaa4444,
                        lineThickness: row.data && row.data.hasStates ? 1 : 3
                    }
                }
                return {};
            }
        }

        const totalHeight = timeGraph.rows.length * rowHeight;
        const rowController = new TimeGraphRowController(rowHeight, totalHeight);

        const chartCanvas = document.createElement('canvas');
        chartCanvas.tabIndex = 1;

        this.timeGraphChartContainer = new TimeGraphContainer({
            id: timeGraph.id + '_chart',
            height: styleConfig.mainHeight,
            width: styleConfig.mainWidth,
            backgroundColor: styleConfig.chartBackgroundColor
        }, this.unitController, chartCanvas);

        this.timeGraphChart = new TimeGraphChart('timeGraphChart', providers, rowController);
        this.timeGraphChartContainer.addLayers([this.timeGraphChart]);
    }

    setViewRange(start: bigint, end: bigint) {
        this.unitController.viewRange = { start, end };
    }

    getTimeGraphChart(): TimeGraphChart {
        return this.timeGraphChart;
    }

    getTotalLength(): bigint {
        return this.testDataProvider.totalLength;
    }

    getAbsoluteStart(): bigint {
        return this.testDataProvider.absoluteStart;
    }

    toNextDataSet(): any {
        this.testDataProvider.toNextDataSet();
    }

    getData(): any {
        return this.testDataProvider.fetchTimeGraphData({});
    }
}
