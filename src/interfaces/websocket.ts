import WebSocket from "ws"

export default interface ExtWebSocket extends WebSocket {
    userInfo: any
    sendJSON: (object: Object) => void
}
