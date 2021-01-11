const Serialmanager = require("./src/serial/")
const stateManager = require("./src/stateManager.js")

const currentState = new stateManager()

currentState.connectionManager
    .list()
    .then((list) => {
        var product = list.filter((i) => {
            return i["manufacturer"] == "wch.cn"
        })[0]

        currentState.connectionManager.create(product.path)
    })
    .catch((e) => {
        console.error(e)
    })
