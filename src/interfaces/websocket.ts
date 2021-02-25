import WebSocket from "ws"

export default interface ExtWebSocket extends WebSocket {
    userInfo: any
    sendJSON: (Object) => void
}
