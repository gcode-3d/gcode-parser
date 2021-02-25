import WebSocket from "ws"

export default interface ExtWebSocket extends WebSocket {
    userInfo: any
    id: string
    sendJSON: (object: Object) => void
}
