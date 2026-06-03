import { TimeGraphLayer } from './time-graph-layer';

export abstract class TimeGraphViewportLayer extends TimeGraphLayer {

    constructor(id: string) {
        super(id);
    }
}
