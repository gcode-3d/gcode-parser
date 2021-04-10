import { ReadStream } from "fs"

export default class File {
    name: string
    data?: ReadStream
    uploaded: Date
    size: number
    constructor(name: string, uploaded: Date, size: number, data: ReadStream) {
        this.name = name
        this.data = data
        this.uploaded = uploaded
        this.size = size
    }
}
