interface tempInfo {
    tools: Array<toolTempInfo>
    bed?: {
        currentTemp: number
        targetTemp: number
    }
    chamber?: {
        currentTemp: number
        targetTemp: number
    }
    time?: number
}

interface toolTempInfo {
    name: number
    currentTemp: number
    targetTemp: number
}
