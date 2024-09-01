//a pkt wallet representation
const shelljs = require("shelljs");
//
let config = require("./config.json");

const os = require("os");

const explorer = require("./lookup/explorer.js")

let isWindows = os.platform() === 'win32';

const logger = require("./util/logger.js");

const fs = require("fs");
const isDockerized = fs.existsSync("./dockerized.txt")
const RPC = require("./util/rpc.js");

const rpc = require("./util/rpc.js");

function shelljsExec(shell, cmd) {
    return new Promise((resolve, reject) => {
        shell.exec(cmd, function(code, stdout, stderr) {
            resolve(stdout);
        });
    });
}
function shelljsExecE(shell, cmd) {
    return new Promise((resolve, reject) => {
        shell.exec(cmd, function(code, stdout, stderr) {
            resolve({stdout: stdout, stderr:stderr});
        });
    });
}

const events = require("./events.js");
const shell = require("shelljs");

class Wallet {

    constructor() {
        this.locked = true;
        this.lockTimeout = undefined;
        this.daemonRunning = false;
        this.walletDaemon = undefined;

        this.state = undefined;
    }

    async init(walletDaemon) {
        this.daemonRunning = walletDaemon.running;

        this.walletDaemon = walletDaemon;

        if(this.daemonRunning) {
            logger.log("refreshing app state");
            await this.refreshState();
        }
    }

    async getDaemonPid() {
        let shell = require("shelljs");
        shell.config.silent = true;

        try {
            let pid = await shelljsExec(shell, "pgrep pktwallet");

            return pid.toString().length > 0 ? parseInt(pid.toString()) : undefined;
        } catch(e) {
            return undefined;
        }
    }

    async refreshState(socket=undefined) {
        let newState = {};

        newState.walletBalances = await this.getWalletBalances();
        newState.globalBalance = await this.getGlobalBalance();
        newState.locked = this.locked;

        let info = await this.getWalletInfo();

        newState.walletStats = info.WalletStats;

        newState.isSyncing = newState.walletStats.Syncing;

        //console.log(info);

        newState.currentHeight = info.CurrentHeight;

        newState.resyncing = newState.walletStats.MaintenanceInProgress == true && newState.walletStats.MaintenanceName.includes("resync");

        if(this.state !== undefined) {
            newState.syncStart = this.state.syncStart === undefined ? undefined : this.state.syncStart;
            newState.syncEnd = this.state.syncEnd === undefined ? undefined : this.state.syncEnd;
        }

        if (newState.isSyncing) {
            newState.currentChainHead = info.BackendHeight;
        } else {
            newState.currentChainHead = newState.currentHeight;
        }

        if(this.state !== undefined) {
            if (this.state.isSyncing) {
                if (!newState.isSyncing) {
                    newState.syncEnd = new Date();
                }
            } else {
                if (newState.isSyncing) {
                    newState.syncStart = new Date();
                }
            }
        } else {
            if (newState.isSyncing) {
                if (!newState.isSyncing) {
                    newState.syncEnd = new Date();
                }
            } else {
                if (newState.isSyncing) {
                    newState.syncStart = new Date();
                }
            }
        }

        newState.info = info;

        this.state = newState;

        if(socket !== undefined) {
            socket.emit("wallet-state", this.state);
        }
    }

    /**
     * in seconds
     * @param period
     * @returns {*}
     */
    async unlockWallet(period=10) {
        if(this.daemonRunning) {
            let t = this;

            this.lockTimeout = setTimeout(() => {
                t.lockWallet();
            }, period * 1000);


            let r =  await rpc.unlockWallet(10);

            r = r.toString();

            this.locked = (!r || r.length === 0);

            this.state.locked = this.locked;

            return this.locked;
        }
    }

    async foldAddress(addr) {
        //for some reason if we don't unlock here, sometimes the spend will fail, but only with folding??
        if(this.locked) {
            await this.unlockWallet(10);
        }

        return await this.spendPkt(addr, addr, 0);
    }

    async getWalletInfo() {
         let json = await rpc.getWalletBlockchainInformation();

         return json;
    }

    lockWallet() {
        return new Promise(async (resolve, reject) => {
            this.locked = await rpc.lockWallet();

            this.state.locked = this.locked;

            return resolve(this.locked);
        });
    }

    async getWalletBalances() {
            let results = await rpc.getAddresses();

            let total = [];

            for(let i = 0; i < results.result.length; i++) {
                let result = results.result[i];

                //console.log(result);

                total.push(result);
            }


            return total;
    }

    async getGlobalBalance() {
            let results = await rpc.getAddresses();
            let total = 0;

            for(let i = 0; i < results.result.length; i++) {
                let result = results.result[i];

                total += result.total;
            }

            return total;
    }

    async spendGlobal(toAddr, pktAmount) {
        if(this.daemonRunning) {
            let shell = require("shelljs");
            shell.config.silent = true;

            if (this.locked) {
                await this.unlockWallet(10);
            }

            let res = !isWindows ? isDockerized ? await shelljsExec(shell, "./pktd/bin/pktctl --wallet sendtoaddress " + toAddr + " " + pktAmount) : await shelljsExec(shell, config.walletbinpath+"pktctl --wallet sendtoaddress " + toAddr + " " + pktAmount) : await shelljsExec(shell, config.walletbinpath+"pktctl.exe --wallet sendtoaddress " + toAddr + " " + pktAmount) ;

            return res;
        }
    }

    //returns a transaction id for the send
    //sends should block until the transaction is considered confirmed by the blockchain

    //TODO: a web function that pings the explorer / a explorer until the transaction from a spend is considered confirmed
    //this will work into the payment spooling queue
    async spendPkt(fromAddr, toAddr, pktAmount) {
        if(this.daemonRunning) {

        if(pktAmount === 0 && fromAddr === toAddr) {
            if (this.locked) {
                await rpc.unlockWallet(10);
            }

            let val = await rpc.sendFromAddress(fromAddr, toAddr, 0);

            console.log(val);

            return val;
        } else {
            if (this.locked) {
                await rpc.unlockWallet(10);
            }

            let val = await rpc.sendFromAddress(fromAddr, toAddr, pktAmount);

            console.log(val);


            return val;
        }

        }
    }

    resyncWallet()  {
        return new Promise(async(resolve, reject) => {
            if(this.daemonRunning)
            {
                let shell = require("shelljs");
                shell.config.silent = true;

                if(isWindows) {
                    shelljsExecE(shell, config.walletbinpath+"pktctl.exe --wallet resync").then((l) => {
                        //console.log(JSON.stringify(l));
                        if(l.stderr !== undefined && l.stderr.toString() !== "" && l.stderr.toString().includes("rescan job")) {
                            return resolve(false);
                        } else {
                            return resolve(true);
                        }

                    });
                } else {//./pktd/bin/pktctl
                    if(isDockerized) {
                        shelljsExecE(shell, "./pktd/bin/pktctl --wallet resync").then((l) => {
                            if (l.stderr !== undefined && l.stderr.toString() !== "" && l.stderr.toString().includes("rescan job")) {
                                return resolve(false);
                            } else {
                                return resolve(true);
                            }
                        });
                    } else {
                        shelljsExecE(shell, config.walletbinpath + "pktctl --wallet resync").then((l) => {
                            if (l.stderr !== undefined && l.stderr.toString() !== "" && l.stderr.toString().includes("rescan job")) {
                                return resolve(false);
                            } else {
                                return resolve(true);
                            }
                        });
                    }
                }
            }
        })

    }

    async getNewAddress() {
        if(this.daemonRunning)
        {
            return await rpc.getNewAddress();
        }
    }

    /**
     * Weak check for addresses
     * @param input
     * @returns {boolean}
     */
    static validatePktAddress(input) {
        return input.toString().startsWith("pkt");
    }

}

module.exports = Wallet;