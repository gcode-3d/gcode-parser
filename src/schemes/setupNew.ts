import Joi from "joi"

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
    device: Joi.object({
        path: Joi.string().normalize().required(),
        manufacturer: Joi.string().normalize(),
        serialNumber: Joi.string().normalize(),
        pnpId: Joi.string().normalize(),
        locationId: Joi.string().normalize(),
        vendorId: Joi.string().normalize(),
        productId: Joi.string().normalize(),
    }).required(),
    printInfo: Joi.object({
        xValue: Joi.number().min(1).required(),
        yValue: Joi.number().min(1).required(),
        zValue: Joi.number().min(1).required(),
        origin: Joi.string().valid("lower-left", "center").required(),
        heatedBed: Joi.boolean().required(),
        heatedChamber: Joi.boolean().required(),
        printerName: Joi.string().min(1).alphanum().required(),
    }),
    account: Joi.object({
        username: Joi.string().normalize().min(1).max(250).required(),
        password: Joi.string().normalize().min(1).max(60).required(),
    }).required(),
})
