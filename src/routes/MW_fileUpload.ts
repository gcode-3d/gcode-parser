import Route from "../classes/route"
import fileUpload from "express-fileupload"
import { NextFunction } from "express"

export default new Route("1", "MIDDLEWARE", 2, (req, res, _, next) => {
    return fileUpload({
        limits: 100 * 1024 * 1024,
    })(req, res, next as NextFunction)
})
