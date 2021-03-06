export default class Permissions {
    raw: number
    binary: string
    reversedBinary: string[]
    permissions: string[]

    constructor(raw: number) {
        this.raw = raw
        // To maintain backwards compatibility, don't remove or reorder items in this list. Only add new entries.
        this.permissions = [
            "admin",
            "connection.edit",
            "file.access",
            "file.edit",
            "print_state.edit",
            "settings.edit",
            "permissions.edit",
            "terminal.read",
            "terminal.send",
            "webcam.view",
            "update.check",
            "update.manage",
        ]
        this.binary =
            "0".repeat(this.permissions.length - this.raw.toString(2).length) +
            this.raw.toString(2)
        this.reversedBinary = this.binary.split("").reverse()
    }
    serialize() {
        let permissions: any = {}
        this.reversedBinary.forEach((value, index) => {
            permissions[this.permissions[index]] = value == "1" ? true : false
        })
        return permissions
    }
    hasPermission(permissionName: string): boolean {
        return this.serialize()[permissionName] == true || this.raw == 1
    }
}
