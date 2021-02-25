export default class device {
    name: string
    path: string
    width: number
    depth: number
    height: number
    baud: string

    constructor(
        name: string,
        path: string,
        width: number,
        depth: number,
        height: number,
        baud: string
    ) {
        this.name = name
        this.path = path
        this.width = width
        this.depth = depth
        this.height = height
        this.baud = baud
    }
}
