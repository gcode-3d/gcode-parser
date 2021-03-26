interface baudRateResponses {
    isWorking: boolean
    responses: string[]
}

interface connectionInfo {
    baudRate: number
    capabilities: Map<string, string | boolean>
}
