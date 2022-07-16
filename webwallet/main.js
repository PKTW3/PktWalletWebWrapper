const pktdwallet = require("./pktd-wallet-process.js");

const pkg = require("./package.json");

const logger = require("./util/logger.js")

logger.log("Starting Pkt Web Wallet Engine V."+pkg.version);

const events = require("./events.js");
const WebSockServ = require("./websocketserv.js");

logger.log("Starting up PktD wallet service...");

let walletDaemon = new pktdwallet(() => {
    process.exit(1);
});

let server = undefined;

logger.log("Waiting for PktD wallet service to finish starting...");

events.on('frontend-start', () => {
    if(server === undefined) {
        logger.log("setting up web services...");
        server = new WebSockServ(walletDaemon);
    }
});

