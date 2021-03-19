import File from "../classes/file"
import PrintInfo from "../classes/printInfo"

export default interface stateInfo {
    state: string
    description?:
        | string
        | connectedStateDescription
        | ErrorStateDescription
        | printDescription
        | disconnectionDescription
}

interface connectedStateDescription {
    tempData: tempInfo[]
}

interface ErrorStateDescription {
    errorDescription: String
}

export interface printDescription {
    printInfo: {
        file: File
        progress: string
        startTime: Date
    }
}

interface disconnectionDescription {
    disconnectionInfo: {
        time: number
    }
}
