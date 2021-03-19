import File from "./file"

export default class PrintInfo {
    readonly file: File
    readonly startTime: Date
    private currentRow: number = 0
    constructor(file: File) {
        this.file = file

        this.startTime = new Date()
    }
    nextRow() {
        this.currentRow += 1
    }
    getCurrentRow() {
        return this.currentRow
    }
}
