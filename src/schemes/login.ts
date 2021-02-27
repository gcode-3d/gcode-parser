import Joi from "joi"
export default Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().min(8).max(24).required(),
    remember: Joi.boolean(),
    datetime: Joi.date().iso(),
})
