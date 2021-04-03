import Route from "../classes/route"
import setupScheme from "../schemes/setupNew"
import Device from "../classes/device"
import Setting from "../enums/setting"

export default new Route("/api/submitSetup", "POST", 1, (req, res, server) => {
    setupScheme
        .validateAsync(req.body)
        .then(async (data) => {
            try {
                let result = await server.stateManager.storage.needsSetup()
                if (!result) {
                    console.log(
                        "[Setup] Setup not required but still got call to /api/submitSetup"
                    )
                    return res.sendStatus(403)
                }
            } catch (e) {
                console.error(e)
                res.sendStatus(500)
            }
            let devicePath = data.device.path.startsWith("COM")
                ? "\\\\.\\" + data.device.path
                : data.device.path
            server.stateManager.connectionManager
                .getBaudrate(devicePath)
                .then(async (result: connectionInfo | boolean) => {
                    if (result == false) {
                        return res.status(500).json({
                            error: true,
                            message:
                                "Could not communicate with device using any of the default baudrates",
                        })
                    }

                    let device = new Device(
                        data.printInfo.printerName,
                        devicePath,
                        data.printInfo.xValue,
                        data.printInfo.yValue,
                        data.printInfo.zValue,
                        data.printInfo.heatedBed,
                        data.printInfo.heatedChamber,
                        (result as connectionInfo).baudRate.toString()
                    )
                    try {
                        await server.stateManager.storage.saveUser(
                            data.account.username,
                            data.account.password
                        )
                        await server.stateManager.storage.saveDevice(device)
                        server.stateManager.storage.setSetting(
                            Setting.SelectedDevice,
                            device.name
                        )
                        res.sendStatus(200)
                        // exit program to restart
                        console.log("[Setup] Setup completed, restarting..")
                        // mark it as an error to make sure failure-only restarts also pick it up.
                        process.exit(1)
                    } catch (e) {
                        console.error(e)
                        return res.sendStatus(500)
                    }
                })
        })
        .catch((e) => {
            if (e.details) {
                return res.sendStatus(400)
            }
            return res.sendStatus(500)
        })
})
