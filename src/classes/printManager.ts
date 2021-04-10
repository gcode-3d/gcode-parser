import globals from "../globals"
import StateManager from "../stateManager"
import CommandInfo from "./CommandInfo"
import File from "./file"
import PrintInfo from "./printInfo"
import { printDescription } from "../interfaces/stateInfo"
import LogPriority from "../enums/logPriority"
import crypto from "crypto"
import Analyzer, { AnalysisResult } from "gcode_print_time_analyzer"
export default class PrintManager {
    stateManager: StateManager
    currentPrint: PrintInfo
    currentPrintFile: { originalSize: number; cleanedLine: string }[] = []
    sentCommands: Map<number, CommandInfo> = new Map()
    analyzedResult?: AnalysisResult
    correctionFactor: number = 0
    printId = crypto.randomBytes(20).toString("hex")
    private remainder = ""
    private readFileDone = false

    constructor(stateManager: StateManager) {
        this.stateManager = stateManager
    }

    startPrint(fileName: string): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                this.stateManager.updateState(
                    globals.CONNECTIONSTATE.PREPARING,
                    null
                )
                this.remainder = ""
                this.readFileDone = false
                this.printId = crypto.randomBytes(20).toString("hex")
                let file = await this.stateManager.storage.getFileByName(
                    fileName
                )
                if (!file) {
                    throw (
                        "Creating new print: Specified file " +
                        fileName +
                        " does not exist."
                    )
                }
                this.stateManager.storage
                    .log(LogPriority.Debug, "PRINT_START", file.name)
                    .catch((e) => {
                        return this.stateManager.updateState(
                            globals.CONNECTIONSTATE.ERRORED,
                            { errorDescription: e }
                        )
                    })

                this.currentPrint = new PrintInfo(file)
                let id = (" " + this.printId).slice(1)
                this.stateManager.storage
                    .getFileByName(this.currentPrint.file.name)
                    .then((file) => {
                        let analyzer = new Analyzer()
                        analyzer.analyze(file.data).then((result) => {
                            if (this.printId !== id) {
                                return
                            }
                            if (!this.currentPrint) {
                                return
                            }
                            this.analyzedResult = new AnalysisResult(
                                result.layerBeginEndMap,
                                result.totalTimeTaken
                            )

                            this.stateManager.storage.log(
                                LogPriority.Debug,
                                "PRINT_ANALYZED",
                                "Estimated " +
                                    result.totalTimeTaken +
                                    " seconds for print " +
                                    file.name
                            )
                            if (this.analyzedResult.layerBeginEndMap.size > 0) {
                                this.currentPrint.setPredictedFirstPrintLayer(
                                    Array.from(
                                        this.analyzedResult.layerBeginEndMap.values()
                                    )
                                        .map((i) => i.beginLineNr)
                                        .sort((a, b) => (a > b ? 1 : -1))[0]
                                )
                            }
                        })
                    })
                    .catch((e) => {
                        this.stateManager.throwError(e)
                        this.stateManager.storage.log(
                            LogPriority.Error,
                            "GCODE_ANALYZE",
                            e
                        )
                    })
            } catch (e) {
                this.stateManager.throwError(e)
                return reject(e)
            }
            this.currentPrint.file.data!.on("data", (chunk: string) => {
                chunk = this.remainder + chunk.replace(/\r\n?|\n/g, "\n")
                this.remainder = ""
                if (!chunk.endsWith("\n")) {
                    let lastIndex = chunk.lastIndexOf("\n")
                    this.remainder = chunk.substr(lastIndex)
                    chunk = chunk.substr(0, lastIndex)
                }
                let parsedStrings = this.sanitizeLines(chunk)
                this.currentPrintFile = [
                    ...this.currentPrintFile,
                    ...parsedStrings,
                ]
                this.currentPrint.file.data!.pause()
            })

            this.currentPrint.file.data!.on("end", () => {
                this.readFileDone = true
                this.currentPrint.file.data!.destroy()
            })
            this.currentPrint.file.data!.resume()

            this.stateManager.updateState(globals.CONNECTIONSTATE.PRINTING, {
                printInfo: {
                    file: new File(
                        this.currentPrint.file.name,
                        this.currentPrint.file.uploaded,
                        this.currentPrint.file.size,
                        null
                    ),
                    progress: (
                        (this.currentPrint.getBytesSent() /
                            this.currentPrint.file.size) *
                        100
                    ).toFixed(2),
                    startTime: this.currentPrint.startTime,
                    estEndTime: this.currentPrint.getPredictedEndTime(),
                },
                tempData:
                    this.stateManager.printer != null
                        ? this.stateManager.printer.temperatureInfo
                        : [],
            })
            this.currentPrint.setProgress(0)
            this.sendPrintRow()
            resolve()
        })
    }
    private getLatestPrintRow(): Promise<{
        originalSize: number
        cleanedLine: string
    }> {
        if (this.currentPrintFile.length == 0 && this.readFileDone) {
            return Promise.resolve(null)
        }
        if (
            this.currentPrintFile.length < 200 &&
            this.currentPrint.file.data!.isPaused()
        ) {
            this.currentPrint.file.data!.resume()
        }
        return new Promise((resolve, reject) => {
            if (this.currentPrintFile.length == 0) {
                if (this.currentPrintFile.length > 0) {
                    return resolve(this.currentPrintFile.shift())
                }
                let iv = setInterval(() => {
                    if (this.currentPrintFile.length > 0) {
                        clearInterval(iv)
                        return resolve(this.currentPrintFile.shift())
                    }
                })
            } else {
                resolve(this.currentPrintFile.shift())
            }
        })
    }
    async sendPrintRow() {
        if (!this.currentPrint) {
            return
        }
        if (this.stateManager.state !== globals.CONNECTIONSTATE.PRINTING) {
            return this.clearLastPrint()
        }
        if (
            this.currentPrintFile.filter((i) => i.cleanedLine.trim() !== "")
                .length <= 1 &&
            this.readFileDone
        ) {
            this.finishPrintActions()
                .then(() => {
                    this.clearLastPrint()
                    return this.stateManager.updateState(
                        globals.CONNECTIONSTATE.CONNECTED,
                        null
                    )
                })
                .catch((e) => {
                    console.error(e)
                    return this.stateManager.updateState(
                        globals.CONNECTIONSTATE.ERRORED,
                        { errorDescription: e.message }
                    )
                })
        } else if (this.currentPrint.getCurrentRow() == 0) {
            let line = "M110 N0"
            this.stateManager.connectionManager.send(line, () => {
                if (!this.currentPrint) {
                    return
                }
                this.currentPrint.nextRow()
                this.updateProgress()
                this.sendPrintRow()
            })
        } else {
            if (
                this.analyzedResult &&
                this.currentPrint.getPredictedEndTime() == null &&
                this.currentPrint.getPredictedFirstPrintLayer() <
                    this.currentPrint.getCurrentRow() - 1
            ) {
                if (
                    this.analyzedResult.totalTimeTaken &&
                    !isNaN(this.analyzedResult.totalTimeTaken)
                ) {
                    this.currentPrint.startTime = new Date()
                    this.currentPrint.setPredictedEndTime(
                        this.analyzedResult.totalTimeTaken *
                            this.correctionFactor +
                            this.analyzedResult.totalTimeTaken
                    )
                    this.notifyNewPredictedEndTime()
                }
            }
            let line = await this.getLatestPrintRow()
            if (line === null) {
                console.log("line = null")
                return null
            }
            if (typeof line != "object") {
                console.log(typeof line)
            }
            while (line.cleanedLine.trim() == "") {
                this.currentPrint.addBytesSent(line.originalSize)
                line = await this.getLatestPrintRow()
            }
            this.sendPreparedString(
                this.currentPrint.getCurrentRow(),
                line.cleanedLine,
                () => {
                    if (!this.currentPrint) {
                        return
                    }
                    this.currentPrint.addBytesSent(line.originalSize)
                    this.currentPrint.nextRow()
                    this.updateProgress()
                    this.sendPrintRow()
                }
            )
        }
    }
    private finishPrintActions(): Promise<void> {
        // todo: add notification thing
        return new Promise(async (resolve, reject) => {
            await this.stateManager.storage.log(
                LogPriority.Debug,
                "PRINT_FINISH",
                `FILE: ${this.currentPrint.file.name} | CorrectionFactorUsed: ${
                    this.correctionFactor
                } | CorrectionFactorNeeded: ${(
                    1 -
                    (this.analyzedResult.totalTimeTaken * 1000) /
                        (new Date().getTime() -
                            this.currentPrint.startTime.getTime())
                ).toFixed(2)}`
            )
            console.log(
                `FILE: ${this.currentPrint.file.name} | CorrectionFactorUsed: ${
                    this.correctionFactor
                } | CorrectionFactorNeeded: ${(
                    1 -
                    (this.analyzedResult.totalTimeTaken * 1000) /
                        (new Date().getTime() -
                            this.currentPrint.startTime.getTime())
                ).toFixed(2)} `
            )
            return resolve()
        })
    }
    private updateProgress() {
        if (this.stateManager.state !== globals.CONNECTIONSTATE.PRINTING) {
            return
        }
        let currentProgress =
            (this.currentPrint.getBytesSent() / this.currentPrint.file.size) *
            100
        if (
            this.currentPrint.getProgress().toFixed(2) !==
            currentProgress.toFixed(2)
        ) {
            this.currentPrint.setProgress(currentProgress)
            let currentDescription = this.stateManager.getCurrentStateInfo()
                .description as printDescription
            currentDescription.printInfo.progress = currentProgress.toFixed(2)
            this.stateManager.updateState(
                globals.CONNECTIONSTATE.PRINTING,
                currentDescription
            )
            if (this.currentPrint.getPredictedEndTime() != null) {
                let timeBusy =
                    new Date().getTime() - this.currentPrint.startTime.getTime()
                let estimatedBasedOnCurrentProgress =
                    (timeBusy / parseFloat(currentProgress.toFixed(2))) * 100
                this.currentPrint.setPredictedEndTime(
                    estimatedBasedOnCurrentProgress / 1000,
                    Math.floor(currentProgress)
                )
                this.notifyNewPredictedEndTime()
            }
        }
    }

    private notifyNewPredictedEndTime() {
        if (this.stateManager.state !== globals.CONNECTIONSTATE.PRINTING) {
            return
        }
        let currentDescription = this.stateManager.getCurrentStateInfo()
            .description as printDescription
        currentDescription.printInfo.estEndTime = this.currentPrint.getPredictedEndTime()
        this.stateManager.updateState(
            globals.CONNECTIONSTATE.PRINTING,
            currentDescription
        )
    }

    private async clearLastPrint() {
        this.printId = crypto.randomBytes(20).toString("hex")
        if (this.currentPrint && this.currentPrint.file.data) {
            this.currentPrint.file.data.destroy()
        }
        this.sentCommands = new Map()
        this.currentPrint = null
        this.currentPrintFile = []
        this.analyzedResult = null
    }

    cancel() {
        this.stateManager.storage
            .log(LogPriority.Debug, "PRINT_CANCEL", this.currentPrint.file.name)
            .then(() => {
                if (
                    this.stateManager.state === globals.CONNECTIONSTATE.PRINTING
                ) {
                    this.clearLastPrint()
                    this.stateManager.connectionManager.send("M104 S0")
                    if (this.stateManager.printer.temperatureInfo[0]?.bed) {
                        this.stateManager.connectionManager.send("M140 S0")
                    }
                    if (this.stateManager.printer.temperatureInfo[0]?.chamber) {
                        this.stateManager.connectionManager.send("M141 S0")
                    }
                    return this.stateManager.updateState(
                        globals.CONNECTIONSTATE.CONNECTED,
                        null
                    )
                }
            })
            .catch((e) => {
                return this.stateManager.updateState(
                    globals.CONNECTIONSTATE.ERRORED,
                    { errorDescription: e }
                )
            })
    }

    sendPreparedString(
        linenr: number,
        command: string,
        callback: (response: parsedResponse) => void
    ) {
        this.sentCommands.set(linenr, new CommandInfo(command))
        let preparedString = `N${linenr}${command}`
        preparedString +=
            "*" + this.stateManager.parser.calculateChecksum(preparedString)
        this.stateManager.connectionManager.send(preparedString, callback)
    }

    sanitizeLines(
        lineString: string
    ): { originalSize: number; cleanedLine: string }[] {
        let lines = lineString.split("\n")
        return lines.map((line) => {
            return {
                originalSize: line.length + 1,
                cleanedLine: line.replace(/;.*$/, "").replace(/\s*/g, ""),
            }
        })
    }
}
