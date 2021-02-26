export default class File {
    name: string
    data?: Buffer
    created: Date
    constructor(name: string, data: Buffer, created: Date) {
        this.name = name
        this.data = data
        this.created = created
    }
}
