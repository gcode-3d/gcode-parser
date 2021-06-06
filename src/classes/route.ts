import { Request, Response } from "express"
import Webserver from "./webserver"

enum setupType {
    ROUTENOTFORSETUP = 0,
    ROUTEFORSETUP = 1,
    ROUTEALWAYS = 2,
}

export default class Route {
    path: string
    method: string
    handler: (
        request: Request,
        response: Response,
        webserver: Webserver,
        next?: (error?: Error) => void
    ) => void
    registerCondition?: (webserver?: Webserver) => boolean
    setupType: setupType
    constructor(
        path: string,
        method: string,
        setupType: setupType,
        handler: (
            request: Request,
            response: Response,
            webserver: Webserver,
            next?: (error?: Error) => void
        ) => void,
        registerCondition?: (webserver?: Webserver) => boolean
    ) {
        this.path = path
        this.method = method
        this.handler = handler
        this.registerCondition = registerCondition
        this.setupType = setupType
    }
}
