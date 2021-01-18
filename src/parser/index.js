module.exports = class parser {
    constructor(stateManager) {
        this.stateManager = stateManager
    }

    calculateChecksum(cmd) {
        var cs = 0
        var byteArray = toUTF8Array(cmd)

        for (var i = 0; cmd[i] != "*" && cmd[i] != null; i++) {
            cs = cs ^ byteArray[i]
        }
        cs &= 0xff
        return cs
    }

    parseResponse(code, responses, returnValues) {
        switch (code) {
            case "M115":
                const firmwareKeys = responses[0].match(/([A-Z_]+:)/g)
                const values = new Map()
                let tempCopy = responses[0].slice(0)
                firmwareKeys.forEach((i) => {
                    tempCopy = tempCopy.replace(i, "[-||-]")
                })
                tempCopy
                    .split("[-||-]")
                    .slice(1)
                    .forEach((value, index) => {
                        values.set(firmwareKeys[index].slice(0, -1), value)
                    })
                responses
                    .slice(1)
                    .filter((i) => i.match(/^(Cap:\w+):(\d)/) != null)
                    .forEach((i) => {
                        const result = i.match(/^(Cap:\w+):(\d)/)
                        values.set(result[1], result[2] == "1" ? true : false)
                    })

                if (returnValues == true) {
                    return values
                } else {
                    this.stateManager.printer.updateCapabilities(values)
                }

                break
            case "M105":
                let string = responses[0]
                string = string.replace("ok", "").trim()
                let tools = string
                    .split("T")
                    .filter((i) => i.length != 0)
                    .map((string) => {
                        string = "T" + string
                        let tool = string.match(
                            /((T\d?):([\d\.]+) ?\/([\d\.]+))+/
                        )
                        return {
                            name: parseFloat(tool[2]),
                            currentTemp: parseFloat(tool[3]),
                            targetTemp: parseFloat(tool[4]),
                        }
                    })
                let bedResult = string.match(/B:([\d\.]+) ?\/([\d\.]+)/)
                let bed = {
                    currentTemp: parseFloat(bedResult[1]),
                    targetTemp: parseFloat(bedResult[2]),
                }

                let chamberResult = string.match(/(C:([\d\.]+) ?\/([\d\.]+))+/)
                let chamber = null
                if (chamberResult != null) {
                    chamber = {
                        currentTemp: parseFloat(chamberResult[1]),
                        targetTemp: parseFloat(chamberResult[2]),
                    }
                }
                if (returnValues == true) {
                    return {
                        tools,
                        bed,
                        chamber,
                    }
                } else {
                    this.stateManager.webserver.sendTemperatureToClients({
                        tools,
                        bed,
                        chamber,
                    })
                }
                break
            default:
                console.log("Undefined code: " + code)
        }
    }
}

function toUTF8Array(str) {
    var utf8 = []
    for (var i = 0; i < str.length; i++) {
        var charcode = str.charCodeAt(i)
        if (charcode < 0x80) utf8.push(charcode)
        else if (charcode < 0x800) {
            utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f))
        } else if (charcode < 0xd800 || charcode >= 0xe000) {
            utf8.push(
                0xe0 | (charcode >> 12),
                0x80 | ((charcode >> 6) & 0x3f),
                0x80 | (charcode & 0x3f)
            )
        }
        // surrogate pair
        else {
            i++
            // UTF-16 encodes 0x10000-0x10FFFF by
            // subtracting 0x10000 and splitting the
            // 20 bits of 0x0-0xFFFFF into two halves
            charcode =
                0x10000 +
                (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff))
            utf8.push(
                0xf0 | (charcode >> 18),
                0x80 | ((charcode >> 12) & 0x3f),
                0x80 | ((charcode >> 6) & 0x3f),
                0x80 | (charcode & 0x3f)
            )
        }
    }
    return utf8
}
