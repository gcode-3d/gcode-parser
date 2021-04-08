import File from "./file"

export default class PrintInfo {
    readonly file: File
    startTime: Date
    private progress = 0.0
    private currentRow: number = 0
    private predictions: number[] = []
    private predictedFirstPrintLayer = 0
    private lastPercentage = 0
    constructor(file: File) {
        this.file = file

        this.startTime = new Date()
    }
    setPredictedFirstPrintLayer(layer: number) {
        this.predictedFirstPrintLayer = layer
    }
    getPredictedFirstPrintLayer() {
        return this.predictedFirstPrintLayer
    }
    setPredictedEndTime(durationInSeconds: number, percentage?: number) {
        if (!this.predictions.length && percentage) {
            return
        }
        if (!percentage) {
            this.predictions = new Array(30)
            this.predictions = this.predictions.fill(durationInSeconds, 0, 30)
        }
        if (percentage === this.lastPercentage) {
            return
        }
        this.lastPercentage = percentage

        if (percentage) {
            this.predictions[Math.round(percentage) + 10] = durationInSeconds
        }
        let newAvg =
            this.predictions.reduce((a, x) => a + x, 0) /
            this.predictions.length
        console.log(`[${newAvg}]`, percentage, Math.round(percentage) + 10)
        // console.log(
        //     `[${percentage}] ${oldAvg}s (${(oldAvg / 60).toFixed(
        //         2
        //     )}m) vs ${newAvg}s (${(newAvg / 60).toFixed(2)}m)`
        // )
    }

    getPredictedEndTime(index?: number): Date {
        if (this.predictions.length == 0) {
            return null
        }
        return new Date(
            this.startTime.getTime() +
                (this.predictions.reduce((a, x) => a + x, 0) /
                    this.predictions.length) *
                    1000
        )
    }
    nextRow() {
        this.currentRow += 1
    }
    getCurrentRow() {
        return this.currentRow
    }
    setProgress(progress: number) {
        this.progress = progress
    }
    getProgress(): number {
        return this.progress
    }
}
