
import { TimeGraphPerformanceTest } from "../unitTest/time-graph-performance-test";
import { WithLabelTestData } from "../unitTest/data/withLabels/settings";

describe('TimeGraphChart performance test with labels', () => {
    let timeGraph: TimeGraphPerformanceTest;

    beforeEach(() => {
        timeGraph = new TimeGraphPerformanceTest(
            WithLabelTestData.data,
            WithLabelTestData.viewRange);
    });

    it ('fetchAndRender() test', () => {
        expect(timeGraph.getAbsoluteStart()).toEqual(WithLabelTestData.traceStart);
        expect(timeGraph.getTotalLength()).toEqual(WithLabelTestData.totalLength);

        const timeGraphChart = timeGraph.getTimeGraphChart();

        const start = performance.now();
        // @ts-ignore
        timeGraphChart.fetchAndRender();
        const end = performance.now();
        const time = end - start;
        console.log("fetchAndRender() - with labels running time", time, "ms");
        expect(time).toBeGreaterThan(0);
    })
})
