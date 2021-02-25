"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Joi_1 = __importDefault(require("Joi"));
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
];
exports.default = Joi_1.default.object({
    name: Joi_1.default.string().normalize().min(1).max(255).required(),
    width: Joi_1.default.number().greater(0).required(),
    depth: Joi_1.default.number().greater(0).required(),
    height: Joi_1.default.number().greater(0).required(),
    heatedBed: Joi_1.default.boolean(),
    heatedChamber: Joi_1.default.boolean(),
    baudRate: Joi_1.default.string().valid(...validBaudrates),
    path: Joi_1.default.string().required(),
});
