import Analyer from "gcode_print_time_analyzer"
import { parentPort, workerData, isMainThread } from "worker_threads"

if (!isMainThread) {
    let file = workerData.file as string
    let printId = workerData.printId as string
    let analyzer = new Analyer(file)
    let result = analyzer.analyze()
    parentPort.postMessage({
        layerBeginEndMap: result.layerBeginEndMap,
        totalTimeTaken: result.totalTimeTaken,
        printId,
    })
}
