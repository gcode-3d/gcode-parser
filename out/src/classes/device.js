"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class device {
    constructor(name, path, width, depth, height, baud) {
        this.name = name;
        this.path = path;
        this.width = width;
        this.depth = depth;
        this.height = height;
        this.baud = baud;
    }
}
exports.default = device;
