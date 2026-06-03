
import { TimeGraphPerformanceTest } from "../unitTest/time-graph-performance-test";
import { NoLabelTestData } from "../unitTest/data/noLabels/settings";

describe('TimeGraphChart performance test without labels', () => {
    let timeGraph: TimeGraphPerformanceTest;

    beforeEach(() => {
        timeGraph = new TimeGraphPerformanceTest(
            NoLabelTestData.data,
            NoLabelTestData.viewRange);
    });

    it ('addOrUpdateRow() test', () => {
        const timeGraphChart = timeGraph.getTimeGraphChart();

        const start = performance.now();
        // @ts-ignore
        timeGraphChart.fetchAndRender();
        const end = performance.now();
        const time = end - start;
        console.log("fetchAndRender() - without labels running time", time, "ms");
        expect(time).toBeGreaterThan(0);
    })
})
