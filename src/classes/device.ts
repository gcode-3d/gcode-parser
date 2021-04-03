export default class Device {
    name: string
    path: string
    width: number
    depth: number
    height: number
    baud: string
    heatedBed: boolean
    heatedChamber: boolean

    constructor(
        name: string,
        path: string,
        width: number,
        depth: number,
        height: number,
        heatedBed: boolean,
        heatedChamber: boolean,
        baud: string
    ) {
        this.name = name
        this.path = path
        this.width = width
        this.depth = depth
        this.height = height
        this.baud = baud
        this.heatedBed = heatedBed
        this.heatedChamber = heatedChamber
    }
}
