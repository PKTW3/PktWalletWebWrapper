const { io } = require("socket.io-client");

const config = require("./config.json");
const logger = require("./util/logger.js");
const fs = require('fs');

const events = require("./events.js");

class Socket {
    constructor(par) {
        this.parentCl = par;

        if(config.reportingUrl === undefined) {
            this.connected = false;
            return;
        }

        this.socket = io(config.reportingUrl);

        this.connected = false;

        let p = this;

        this.socket.on("connect", () => {
            p.connected = true;
            //logger.log("Connected to Miner manager server.");

            //this.socket.emit("auth", {code: config.consolePassword, type:"console"}); //this is part of a future update

            this.socket.on("authorized", () => {
                logger.log("Console session started with Miner manager server.");
            })
        });

        this.socket.on("disconnect", () => {
            logger.log("Console lost connection with Miner manager server.");
            p.connected = false;
        });

        this.socket.on("miners", async (miners) => {
            //console.log(miners);
            //events.emit("miners", miners);
            p.parentCl.miners = miners;
            //console.log(p.parentCl.miners);
        });
    }
}

module.exports = Socket;