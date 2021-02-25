import Joi from "Joi"

let validBaudrates = [
    "Auto",
    "115200",
    "57600",
    "38400",
    "19200",
    "14400",
    "9600",
    "4800",
    "2400",
    "1200",
    "300",
    "110",
]
export default Joi.object({
    name: Joi.string().normalize().min(1).max(255).required(),
    width: Joi.number().greater(0).required(),
    depth: Joi.number().greater(0).required(),
    height: Joi.number().greater(0).required(),
    heatedBed: Joi.boolean(),
    heatedChamber: Joi.boolean(),
    baudRate: Joi.string().valid(...validBaudrates),
    path: Joi.string().required(),
})
