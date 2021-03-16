interface stateInfo {
    state: string
    description?: string | connectedStateDescription | ErrorStateDescription
}

interface connectedStateDescription {
    tempData: tempInfo[]
}

interface ErrorStateDescription {
    errorDescription: String
}
