const terminal = document.getElementById("terminal")
const input = document.getElementById("inputTerminal")
const modal = document.getElementById("modal")
const sendButton = document.getElementById("sendButton")
let connecting = false
const allowedEntries = 1000
let ws

terminal.value = ""
let backlog = []

modal.classList.add("is-active")
openConnection()
function openConnection() {
    if (connecting) {
        return
    }
    updateConnecting(true)

    if (ws != null) {
        ws.close()
        ws = null
    }

    ws = new WebSocket("ws://" + window.location.host + "/ws/terminal")
    ws.onopen = function () {
        modal.classList.remove("is-active")
        updateConnecting(false)
    }
    ws.onclose = function () {
        modal.classList.add("is-active")
    }
    ws.onmessage = function (message) {
        message = JSON.parse(message.data)
        switch (message.type) {
            case "ready":
                if (message.content) {
                    console.log("Ready ", message.content)
                }
                document
                    .getElementById("toolTemp")
                    .parentElement.classList.remove("is-hidden")
                document
                    .getElementById("bedTemp")
                    .parentElement.classList.remove("is-hidden")
                document
                    .getElementById("chamberTemp")
                    .parentElement.classList.remove("is-hidden")

                break
            case "message_receive":
                appendTerminal("> " + message.data)
                terminalHasChanged()
                break
            case "temperature_change":
                console.log(message)
                document.getElementById("toolTemp").innerHTML =
                    message.data.tools[0].currentTemp +
                    " | " +
                    message.data.tools[0].targetTemp
                if (message.data.bed == null) {
                    document
                        .getElementById("bedTemp")
                        .parentElement.classList.add("is-hidden")
                } else {
                    document.getElementById("bedTemp").innerHTML =
                        message.data.bed.currentTemp +
                        " | " +
                        message.data.bed.targetTemp
                }
                if (message.data.chamber == null) {
                    document
                        .getElementById("chamberTemp")
                        .parentElement.classList.add("is-hidden")
                } else {
                    document.getElementById("chamberTemp").innerHTML =
                        message.data.chamber.currentTemp +
                        " | " +
                        message.data.chamber.targetTemp
                }
                break
            default:
                console.log("Unknown event?", message.type)
        }
    }
    ws.onerror = function (error) {
        updateConnecting(false)
        modal.querySelector(".content").innerHTML = "Error occurred"
        status.innerHTML = "Connection has errored, see console"
    }
}

function updateConnecting(value) {
    connecting = value
    modal.querySelector(".content").innerHTML = ""
    value
        ? modal.querySelector("button.button").classList.add("is-loading")
        : modal.querySelector("button.button").classList.remove("is-loading")
}

function terminalHasChanged() {
    if (document.getElementById("autoscroll").checked) {
        terminal.scrollTop = terminal.scrollHeight
    }
}

input.onkeypress = function (e) {
    if (e.keyCode == 13 && e.key == "Enter") {
        return send()
    }
}

sendButton.onclick = () => {
    send()
}

function send() {
    if (input.value.trim().length == 0) {
        return
    }
    if (ws.readyState !== WebSocket.OPEN) {
        return
    }
    const content = input.value.trim()

    ws.send(content)
    appendTerminal("<<" + content)
    input.value = ""
}

function appendTerminal(content) {
    backlog.push({
        content,
        date: new Date(),
    })
    if (backlog.length > allowedEntries) {
        backlog.shift()
    }
    terminal.value = backlog
        .map((i) => {
            var time =
                "[" +
                i.date.getHours() +
                ":" +
                i.date.getMinutes() +
                ":" +
                i.date.getMilliseconds() +
                "]"
            return time + " - " + i.content
        })
        .join("\n")
}
