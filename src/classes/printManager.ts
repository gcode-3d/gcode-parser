import globals from "../globals"
import StateManager from "../stateManager"
import CommandInfo from "./CommandInfo"
import File from "./file"
import PrintInfo from "./printInfo"
import { printDescription } from "../interfaces/stateInfo"
import { AnalysisResult } from "gcode_print_time_analyzer"
import LogPriority from "../enums/logPriority"
import path from "path"
import { Worker } from "worker_threads"
import crypto from "crypto"
export default class PrintManager {
    stateManager: StateManager
    currentPrint: PrintInfo
    currentPrintFile: string[]
    sentCommands: Map<number, CommandInfo> = new Map()
    analyzedResult?: AnalysisResult
    correctionFactor: number = 0
    printId = crypto.randomBytes(20).toString("hex")
    private worker: Worker

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
                if (this.worker != null) {
                    await new Promise<void>((resolve, reject) => {
                        this.worker
                            .terminate()
                            .then(() => {
                                this.worker.removeAllListeners()
                                this.worker = null
                                return resolve()
                            })
                            .catch((e) => {
                                console.error(e)
                                return reject(e)
                            })
                    })
                }
                this.worker = new Worker(
                    path.join(__dirname, "../analyzer_worker.js"),
                    {
                        workerData: {
                            file: file.data.toString("utf8"),
                            printId: this.printId,
                        },
                    }
                )
                this.worker.on("message", (result) => {
                    if (this.printId !== result.printId) {
                        return
                    }
                    if (!this.currentPrint) {
                        return
                    }
                    console.log("WORKER" + result.totalTimeTaken)
                    this.analyzedResult = new AnalysisResult(
                        result.layerBeginEndMap,
                        result.totalTimeTaken,
                        new Map()
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
            } catch (e) {
                this.stateManager.throwError(e)
                return reject(e)
            }

            this.currentPrintFile = this.parseFile(this.currentPrint.file)

            this.stateManager.updateState(globals.CONNECTIONSTATE.PRINTING, {
                printInfo: {
                    file: new File(
                        this.currentPrint.file.name,
                        this.currentPrint.file.uploaded,
                        null
                    ),
                    progress: (
                        (this.currentPrint.getCurrentRow() /
                            (this.currentPrintFile.length + 1)) *
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
    sendPrintRow() {
        if (!this.currentPrint) {
            return
        }
        if (this.stateManager.state !== globals.CONNECTIONSTATE.PRINTING) {
            return this.clearLastPrint()
        }

        if (this.currentPrint.getCurrentRow() > this.currentPrintFile.length) {
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
            this.sendPreparedString(
                this.currentPrint.getCurrentRow(),
                this.currentPrintFile[this.currentPrint.getCurrentRow() - 1],
                (result: parsedResponse) => {
                    if (!this.currentPrint) {
                        return
                    }

                    this.currentPrint.nextRow()
                    this.updateProgress()
                    this.sendPrintRow()
                }
            )
        }
    }
    private finishPrintActions(): Promise<void> {
        // todo: add notification thing
        console.log(this.analyzedResult.totalTimeTaken)
        console.log(this.currentPrint.getPredictedEndTime())
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
            (this.currentPrint.getCurrentRow() /
                (this.currentPrintFile.length + 1)) *
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
                let timeEstimated =
                    this.currentPrint.getPredictedEndTime().getTime() -
                    this.currentPrint.startTime.getTime()
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
        if (this.worker) {
            await this.worker.terminate()
            this.worker.removeAllListeners()
            this.worker = null
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

    parseFile(file?: File): string[] {
        if (!file.data) {
            this.stateManager.throwError("File object has no data specified")
            return
        }
        let lines = file.data.toString("utf8").split(/\r?\n/)

        return lines
            .map((line) => {
                return line.trim().replace(/;.*$/, "").replace(/\s*/g, "")
            })
            .filter((line) => {
                return line.length > 0
            })
    }
}
