const terminal = document.getElementById("terminal")
const input = document.getElementById("inputTerminal")
const status = document.getElementById("status")
const sendButton = document.getElementById("sendButton")
const ws = new WebSocket("ws://" + window.location.host + "/ws/terminal")
terminal.value = ""
ws.onopen = function () {
    status.innerHTML = "Connection is opened"
}
ws.onclose = function () {
    status.innerHTML = "Connection is closed"
}
ws.onmessage = function (message) {
    console.log("message", message)
    terminal.value += "\n>" + message.data
    terminalHasChanged()
}
ws.onerror = function (error) {
    console.error(error)
    status.innerHTML = "Connection has errored, see console"
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
    terminal.value += "\n<<" + content
    input.value = ""
}
