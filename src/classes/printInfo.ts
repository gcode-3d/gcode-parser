import File from "./file"

export default class PrintInfo {
    readonly file: File
    startTime: Date
    private estEndTime: Date
    private progress = 0.0
    private currentRow: number = 0
    private predictions: number[] = []
    private predictedFirstPrintLayer = 0
    private lastPercentage = 0
    private bytesSent = 0
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
    setPredictedEndTime(durationInSeconds: number) {
        this.estEndTime = new Date(
            this.startTime.getTime() + durationInSeconds * 1000
        )
    }

    getPredictedEndTime(): Date {
        return this.estEndTime
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
    addBytesSent(bytes: number) {
        this.bytesSent += bytes
    }
    getBytesSent(): number {
        return this.bytesSent
    }
}
