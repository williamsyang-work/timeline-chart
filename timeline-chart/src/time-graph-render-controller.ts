import { throttle, debounce } from 'lodash';
import { Ticker } from 'pixi.js';

const stopRender = debounce(() => {
    Ticker.shared.stop();
}, 1000);

const startRender = throttle(() => {
    Ticker.shared.start();
    stopRender();
}, 450, { leading: true });

export const RenderEvents = {
    startRender: () => { startRender(); },
    stopRender: () => { stopRender(); }
};
