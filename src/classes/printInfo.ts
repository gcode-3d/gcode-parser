import File from "./file"

export default class PrintInfo {
    readonly file: File
    readonly startTime: Date
    private predictedEndTime: Date
    private progress = 0.0
    private currentRow: number = 0
    private predictedFirstPrintLayer = 0
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
    setPredictedEndTime(time: Date) {
        this.predictedEndTime = time
    }
    getPredictedEndTime(): Date {
        return this.predictedEndTime
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
