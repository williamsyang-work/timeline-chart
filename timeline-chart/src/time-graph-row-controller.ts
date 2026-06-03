export class TimeGraphRowController {

    protected totalHeightChangedHandlers: ((totalHeight: number) => void)[] = [];

    constructor(public rowHeight: number, private _totalHeight: number) {
    }

    protected handleTotalHeightChanged() {
        this.totalHeightChangedHandlers.forEach(h => h(this._totalHeight));
    }

    onTotalHeightChangedHandler(handler: (totalHeight: number) => void) {
        this.totalHeightChangedHandlers.push(handler);
    }

    removeTotalHeightChangedHandler(handler: (totalHeight: number) => void) {
        const index = this.totalHeightChangedHandlers.indexOf(handler);
        if (index > -1) {
            this.totalHeightChangedHandlers.splice(index, 1);
        }
    }

    get totalHeight(): number {
        return this._totalHeight;
    }

    set totalHeight(height: number) {
        this._totalHeight = height;
        this.handleTotalHeightChanged();
    }
}
