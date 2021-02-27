export default class File {
    name: string
    data?: Buffer
    uploaded: Date
    constructor(name: string, uploaded: Date, data: Buffer) {
        this.name = name
        this.data = data
        this.uploaded = uploaded
    }
}
