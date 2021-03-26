import Route from "../classes/route"
import setupWizard from "../tools/setupWizard.js"
import path from "path"
const gitHash = require("child_process")
    .execSync("git rev-parse HEAD")
    .toString()
    .trim()
export default new Route("-1", "MIDDLEWARE", 2, (_, res, server) => {
    if (process.env.NODE_ENV === "production") {
        server.app.use((_, res, next) => {
            res.setHeader("X-Version", gitHash)
            next()
        })
        if (server.isInSetupMode) {
            setupWizard()
                .then((location: string) => {
                    res.sendFile(path.join(location, "index.html"))
                })
                .catch((e: Error) => {
                    throw e
                })
        } else {
            res.sendFile(
                path.join(__dirname, "../../", "build/client", "index.html")
            )
        }
    }
})
