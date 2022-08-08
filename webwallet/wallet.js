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

        newState.isSyncing = info.Syncing;
        newState.currentHeight = info.CurrentHeight;

        newState.walletStats = info.WalletStats;

        newState.resyncing = newState.walletStats.MaintenanceInProgress == true && newState.walletStats.MaintenanceName.includes("resync");

        if(this.state !== undefined) {
            newState.syncStart = this.state.syncStart === undefined ? undefined : this.state.syncStart;
            newState.syncEnd = this.state.syncEnd === undefined ? undefined : this.state.syncEnd;
        }

        if (newState.isSyncing) {
            newState.currentChainHead = await explorer.getCurrentBlockHeight();
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

        this.state = newState;

        //console.log(this.state);

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
            let shell = require("shelljs");
            shell.config.silent = false;

            this.lockTimeout = setTimeout(() => {
                t.lockWallet();
            }, period * 1000);

            let cmd = config.walletbinpath+"pktctl --wallet walletpassphrase " + config.wallet_password + " " + period;

            if(isDockerized) {
                cmd = "./pktd/bin/pktctl --wallet walletpassphrase " + config.wallet_password + " " + period;
            }

            if(isWindows)  {
                cmd = config.walletbinpath+"pktctl.exe --wallet walletpassphrase " + config.wallet_password + " " + period
            }

            let r = await shelljsExec(shell, cmd);

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
        if(this.daemonRunning) {
            let shell = require("shelljs");
            shell.config.silent = true;

            let json = !isWindows ? isDockerized ? await shelljsExec(shell, "./pktd/bin/pktctl --wallet getinfo") : await shelljsExec(shell, config.walletbinpath+"pktctl --wallet getinfo") : await shelljsExec(shell, config.walletbinpath+"pktctl.exe --wallet getinfo");

            return JSON.parse(json);
        }
    }

    lockWallet() {
        if(this.daemonRunning) {
            let shell = require("shelljs");
            shell.config.silent = true;

            if(isWindows) {
                shelljsExec(shell, config.walletbinpath+"pktctl.exe --wallet walletlock");
            } else {
                if(isDockerized) {
                    shelljsExec(shell, "./pktd/bin/pktctl --wallet walletlock");
                } else {
                    shelljsExec(shell, config.walletbinpath + "pktctl --wallet walletlock");
                }
            }


            this.locked = true;

            this.state.locked = this.locked;

            return this.locked;
        }
    }

    async getWalletBalances() {
        if(this.daemonRunning) {
            let shell = require("shelljs");
            shell.config.silent = true;

            let json = !isWindows ? isDockerized ? await shelljsExec(shell, "./pktd/bin/pktctl --wallet getaddressbalances 1 1") : await shelljsExec(shell, config.walletbinpath+"pktctl --wallet getaddressbalances 1 1") : await shelljsExec(shell, config.walletbinpath+"pktctl.exe --wallet getaddressbalances 1 1") ;

            //console.log(json);

            return JSON.parse(json);
        }
    }

    async getGlobalBalance() {
        if(this.daemonRunning) {
            let shell = require("shelljs");
            shell.config.silent = true;

            let r = !isWindows ? isDockerized ? await shelljsExec(shell, "./pktd/bin/pktctl --wallet getbalance")  : await shelljsExec(shell, config.walletbinpath+"pktctl --wallet getbalance") : await shelljsExec(shell, config.walletbinpath+"pktctl.exe --wallet getbalance");

            r = r.toString();
            r = r.replace("\n", "");

            return r;
        }
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
        //if(this.daemonRunning) {

        if(pktAmount === 0 && fromAddr === toAddr) {
            let shell = require("shelljs");
            shell.config.silent = false;

            if (this.locked) {
                await this.unlockWallet(10);
            }

            let res = !isWindows ? isDockerized ? await shelljsExec(shell, "./pktd/bin/pktctl --wallet sendfrom " + toAddr + " 0 '[\"" + fromAddr + "\"]'") : await shelljsExec(shell, config.walletbinpath+"pktctl --wallet sendfrom " + toAddr + " 0 '[\"" + fromAddr + "\"]'") : await shelljsExec(shell, config.walletbinpath+'pktctl.exe --wallet sendfrom ' + toAddr + " 0 [\\\"" + fromAddr + "\\\"]") ;

            return res;
        } else {
            let shell = require("shelljs");
            shell.config.silent = false;

            if (this.locked) {
                await this.unlockWallet(10);
            }

            let res = !isWindows ? isDockerized ? await shelljsExec(shell, "./pktd/bin/pktctl --wallet sendfrom " + toAddr + " " + pktAmount + " '[\"" + fromAddr + "\"]'") : await shelljsExec(shell, config.walletbinpath+"pktctl --wallet sendfrom " + toAddr + " " + pktAmount + " '[\"" + fromAddr + "\"]'") : await shelljsExec(shell, config.walletbinpath+'pktctl.exe --wallet sendfrom ' + toAddr + " " + pktAmount + " [\\\"" + fromAddr + "\\\"]") ;

            return res;
        }

        //}
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

    getNewAddress() {
        if(this.daemonRunning)
        {
            let shell = require("shelljs");
            shell.config.silent = true;

            if(isWindows) {
                return shelljsExec(shell, config.walletbinpath+"pktctl.exe --wallet getnewaddress");
            } else {
                if(isDockerized) {
                    return shelljsExec(shell, "./pktd/bin/pktctl --wallet getnewaddress");
                } else {
                    return shelljsExec(shell, config.walletbinpath+"pktctl --wallet getnewaddress");

                }
            }
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