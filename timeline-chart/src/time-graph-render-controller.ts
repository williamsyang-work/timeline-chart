import { throttle, debounce } from 'lodash';
import * as PIXI from 'pixi.js-legacy';

const stopRender = debounce(() => {
    PIXI.Ticker.shared.stop();
}, 1000);

const startRender = throttle(() => {
    PIXI.Ticker.shared.start();
    stopRender();
}, 450, { leading: true });

export const RenderEvents = {
    startRender: () => { startRender(); },
    stopRender: () => { stopRender(); }
};
