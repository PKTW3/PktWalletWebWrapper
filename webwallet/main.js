const pktdwallet = require("./pktd-wallet-process.js");

const pkg = require("./package.json");

const logger = require("./util/logger.js")

const fs = require("fs");
const os =require("os");

let isWindows = os.platform() === 'win32';

let authExists = fs.existsSync("./auth.json");
let configExists = fs.existsSync("./config.json");

if(!authExists && !configExists) {
    logger.log("PW3 is in a default state, please run  Please run node setup/generateauthjson.js & node setup/generateconfigjson.js");
    logger.log("see: https://www.pktw3.com/installing-pw3/");
    return;
}

if(!authExists) {
    logger.log("PW3 not configured. Please run node setup/generateauthjson.js");
    logger.log("see: https://www.pktw3.com/installing-pw3/");
    return;
}

if(!configExists) {
    logger.log("PW3 not configured. Please run node setup/generateconfigjson.js");
    logger.log("see: https://www.pktw3.com/installing-pw3/");
    return;
}

const config = require("./config.json");

if(config.listenip === undefined) {
    logger.log("Listening ip is not set, please specify an ip for listenip in config.json.");
    logger.log("see: https://www.pktw3.com/installing-pw3/");
    return;
} else {
    const runUnsafe = require("./rununsafe.js");

    if(!config.listenip.startsWith("100") && !config.listenip.startsWith("127.0") && !config.listenip.startsWith("localhost")) {
        if(!runUnsafe) {
            logger.log("Listening ip is set to a non private ip, if this in in error (you have a custom vpn etc) set rununsafe.js to true");
            logger.log("see: https://www.pktw3.com/installing-pw3/");
            return;
        }
    }
}

if(config.listenport !== 80) {
    logger.log("**** port is not set to 80, web wallet users may experience CORS issues. ****");
    logger.log("**** It is recommended to run PW3 on a private ip on port 80 to avoid browser cors issues ****");
    logger.log("see: https://www.pktw3.com/installing-pw3/");
}

if(isWindows) {
    let contents = fs.readFileSync("../client/web/js/socketurl.js");

    if(!contents.toString().includes(config.listenip)) {
        logger.log("**** client/web/js/socketurl.js does not contain the listening ip. ****");
        logger.log("see: https://www.pktw3.com/installing-pw3/");
        return;
    }
}


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

