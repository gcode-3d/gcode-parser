import LogPriority from "../enums/logPriority"

export default class LogEntry {
    priority: LogPriority
    details: string
    shortDescription: string
    date: Date
    constructor(
        priority: LogPriority,
        details: string,
        shortDescription: string,
        date: Date
    ) {
        this.priority = priority
        this.details = details
        this.shortDescription = shortDescription
        this.date = date
    }
}
