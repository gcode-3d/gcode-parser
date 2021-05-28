import Route from "../classes/route"
import UserTokenResult from "../classes/UserTokenResult"
import { Stream } from "stream"
import * as Sentry from "@sentry/node"

export default new Route("/api/files", "PUT", 0, async (req, res, server) => {
    try {
        if (!req.headers.authorization) {
            return res.sendStatus(401)
        }
        if (!req.headers["content-type"].startsWith("multipart/form-data")) {
            return res.sendStatus(500)
        }
        var token = req.headers.authorization.replace("auth-", "")
        var userInfo = await server.stateManager.storage.validateToken(token)
        if (!userInfo) {
            return res.sendStatus(401)
        }
        userInfo = userInfo as UserTokenResult
        const permissions = userInfo.permissions
        if (!permissions.hasPermission("file.edit")) {
            return res.sendStatus(401)
        }

        let stream = new Stream.Readable({
            read: (size) => {
                return true
            },
        })
        req.on("data", (data) => {
            stream.push(data)
        })

        req.on("end", () => {
            stream.emit("end")
        })

        server.stateManager.storage
            .insertFileWithStream(
                stream,
                req.headers["content-type"].split("boundary=")[1]
            )
            .then(() => {
                return res.sendStatus(200)
            })
            .catch((e) => {
                Sentry.captureException(e)
                res.sendStatus(500)
            })
    } catch (e) {
        console.error(e)
        Sentry.captureException(e)
    }
})
