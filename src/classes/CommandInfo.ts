export default class CommandInfo {
    command: string
    sent: Date

    constructor(command: string) {
        this.command = command
        this.sent = new Date()
    }
}
