import SerialPort from "serialport"

export default interface ExtSerialPort extends SerialPort {
    writeDrain: (data: string, callback?: () => void | null) => void
}
