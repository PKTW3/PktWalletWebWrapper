const os = require("os");

let isWindows = os.platform() === 'win32';

let config = require("./config.json");

const events = require("./events.js");

const logger = require('./util/logger.js');

const fs = require("fs");
const isDockerized = fs.existsSync("./dockerized.txt")

class pktdWalletProcess {

    constructor(onProcessDeath=undefined) {
        this.shell = require("shelljs");

        if(isWindows) {
            this.child = this.shell.exec(config.walletbinpath + "pktwallet.exe", {async:true, silent: true});
        } else {
            if(isDockerized) {
                this.child = this.shell.exec("./pktd/bin/pktwallet", {async:true, silent: true});
            } else {
                this.child = this.shell.exec(config.walletbinpath + "pktwallet", {async:true, silent: true});
            }
        }

        this.running = true;

        let p = this;

        this.child.stdout.on('data', function(data) {
            let started = false;

            if(data.toString().includes("Waiting for chain backend to sync to tip")) {
                logger.log("PktD Commandline Wallet is syncing the backend to latest pkt tip point, once complete the web wallet frontend will be available");
                    //console.log("frontend starting...");
                    events.emit('frontend-start');
            } else if(data.toString().includes("Wallet frontend synced to tip")) {
                    //console.log("frontend starting...");
                    events.emit('frontend-start');
            }

            events.emit('console-text', data.toString());
           // console.log(data);
        });

        this.child.stdout.on('end', () => {
            p.running = false;
            logger.log("wallet is stopped, check configuration for walletbin path mismatches");
            if(onProcessDeath !== undefined) {
                onProcessDeath();
            }
        });
    }

}

module.exports = pktdWalletProcess;
