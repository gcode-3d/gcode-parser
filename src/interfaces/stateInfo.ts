interface stateInfo {
    state: string
    description?: string | connectedStateDescription
}

interface connectedStateDescription {
    tempData: tempInfo[]
}
