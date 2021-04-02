import Route from "../classes/route"
import setupWizard from "../tools/setupWizard.js"
import path from "path"

export default new Route("-1", "MIDDLEWARE", 2, (_, res, server) => {
    if (process.env.NODE_ENV === "production") {
        if (server.isInSetupMode) {
            setupWizard()
                .then((location: string) => {
                    res.sendFile(
                        path.join(
                            __dirname,
                            "../../../",
                            location,
                            "index.html"
                        )
                    )
                })
                .catch((e: Error) => {
                    throw e
                })
        } else {
            res.sendFile(
                path.join(__dirname, "../../../", "build/client", "index.html")
            )
        }
    }
})
