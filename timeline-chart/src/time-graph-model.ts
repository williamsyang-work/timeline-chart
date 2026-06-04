export namespace TimelineChart {
    export interface TimeGraphRange {
        start: bigint
        end: bigint
    }

    export interface TimeGraphModel {
        id: string
        totalLength: bigint
        rows: TimeGraphRowModel[]
        rangeEvents: TimeGraphAnnotation[]
        arrows: TimeGraphArrow[]
        readonly data?: { [key: string]: any }
    }

    export interface TimeGraphRowModel {
        id: number
        name: string
        range: TimeGraphRange
        states: TimeGraphState[]
        annotations: TimeGraphAnnotation[]
        selected?: boolean
        readonly data?: { [key: string]: any }
        prevPossibleState: bigint
        nextPossibleState: bigint
        gapStyle?: any;
    }

    export interface TimeGraphState {
        readonly id: string
        readonly range: TimeGraphRange
        readonly label?: string
        selected?: boolean
        readonly data?: { [key: string]: any }
    }

    export interface TimeGraphArrow {
        sourceId: number
        destinationId: number
        range: TimeGraphRange
        data?: { [key: string]: any }
    }

    export interface TimeGraphAnnotation {
        readonly id: string
        readonly category: string
        readonly range: TimeGraphRange
        readonly label: string
        selected?: boolean
        readonly data?: { [key: string]: any }
    }

    export interface TimeGraphStateStyle {
        color?: number
        opacity?: number
        height?: number
        borderWidth?: number
        borderColor?: number
        scale?: number
    }

    export interface TimeGraphAnnotationStyle {
        symbol?: string
        size?: number
        color?: number
        opacity?: number
        verticalAlign?: string
    }

    export interface TimeGraphRowStyle {
        backgroundColor?: number
        backgroundOpacity?: number
        lineThickness?: number
        lineColor?: number
        lineOpacity?: number
    }

    export interface TimeGraphChartProviders {
        dataProvider: (range: TimeGraphRange, resolution: number) =>
            Promise<{ rows: TimeGraphRowModel[], range: TimeGraphRange, resolution: number }>
            | { rows: TimeGraphRowModel[], range: TimeGraphRange, resolution: number }
            | undefined
        stateStyleProvider?: (el: TimeGraphState) => TimeGraphStateStyle | undefined
        rowAnnotationStyleProvider?: (el: TimeGraphAnnotation) => TimeGraphAnnotationStyle | undefined
        rowStyleProvider?: (row?: TimeGraphRowModel) => TimeGraphRowStyle | undefined
    }
}
