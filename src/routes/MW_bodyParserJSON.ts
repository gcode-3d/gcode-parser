import Route from "../classes/route"
import bodyParser from "body-parser"
export default new Route("1", "MIDDLEWARE", 2, (req, res, _, next) => {
    bodyParser.json()(req, res, next)
})
