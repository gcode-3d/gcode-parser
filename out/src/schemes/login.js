"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Joi_1 = __importDefault(require("Joi"));
exports.default = Joi_1.default.object({
    username: Joi_1.default.string().alphanum().min(3).max(30).required(),
    password: Joi_1.default.string().min(8).max(24).required(),
    remember: Joi_1.default.boolean(),
    datetime: Joi_1.default.date().iso(),
});
