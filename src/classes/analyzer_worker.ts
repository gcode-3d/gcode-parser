import Analyer from "gcode_print_time_analyzer"
import { Readable } from "stream"
import { parentPort, workerData, isMainThread } from "worker_threads"

if (!isMainThread) {
    let stream = new Readable({
        read: () => {
            return true
        },
    })
    parentPort.on("message", (data: { type: string; data?: any }) => {
        if (data.type === "chunk") {
            stream.push(data.data)
        }
        if (data.type == "end") {
            stream.emit("end")
        }
    })
    let printId = workerData.printId as string
    let analyzer = new Analyer()
    analyzer
        .analyze(stream)
        .then((result) => {
            parentPort.postMessage({
                layerBeginEndMap: result.layerBeginEndMap,
                totalTimeTaken: result.totalTimeTaken,
                printId,
            })
        })
        .catch((e) => {
            throw e
        })
}
