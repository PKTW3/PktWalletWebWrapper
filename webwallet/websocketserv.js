const socketio = require("socket.io");
const HashMap = require("hashmap");
let config = require("./config.json");
let auth = require("./auth/auth.js");

const os = require("os");

const ws = require("./consolesocket.js");

let isWindows = os.platform() === 'win32';

function getAuthConfig() {
    return require("./auth.json");
}

const wallet = require("./wallet.js");
const express = require('express');
const { Server } = require("socket.io");
const path = require("path");
const logger = require("./util/logger.js");

const fs = require("fs");
const isDockerized = fs.existsSync("./dockerized.txt")
const events = require("./events.js");

const unconfirmedTransactionQueue = require("./unconfirmedtransactionqueue.js");

let consoleSocket = undefined;
let minerManagerSyncer = undefined;

class websockserv {

    constructor(pktdDaemon) {
        this.port = config.listenport;
        this.app = express();
        this.http = require('http');
        this.server = this.http.createServer(this.app);
        this.io = new Server(this.server);

        let p = this;
        this.lastFoldAttempt = undefined;

        consoleSocket = new ws(this);

        minerManagerSyncer = setInterval(async () => {
            if(consoleSocket.connected) {
                consoleSocket.socket.emit("miners-request");
            }
        }, 10050);

        this.sessions = new HashMap();
        this.authedSessions = new HashMap();
        this.ipSessionMap = new HashMap();
        this.miners = undefined;
        this.foldingQueue = require("./foldingqueue.js");
        this.walletDaemon = pktdDaemon;

        this.pktWallet = new wallet();

        this.pktWallet.init(this.walletDaemon).then(async () => {
            await unconfirmedTransactionQueue.block();
            setInterval(async () => {
                if(p.lastFoldAttempt !== undefined) {
                    if(new Date().getTime() - p.lastFoldAttempt > (60000 * 60 * 12)) {
                        this.lastFoldAttempt = new Date().getTime();
                        let addresses = await p.pktWallet.getWalletBalances();

                        if(addresses.length === 0) {
                            return;
                        }

                        for(let i = 0; i < addresses.length; i++) {
                            let addr = addresses[i].address;

                            p.foldingQueue.push({
                                address: addr
                            });
                        }

                    }
                } else {
                    p.lastFoldAttempt = new Date().getTime();

                    let addresses = await p.pktWallet.getWalletBalances();

                    if(addresses.length === 0) {
                        return;
                    }

                    for(let i = 0; i < addresses.length; i++) {
                        let addr = addresses[i].address;

                        p.foldingQueue.push({
                            address: addr
                        });
                    }
                }
            }, (60000 * 60) * 3);
            });

            this.app.get('/', (req, res) => {
                res.sendFile('index.html', {root: config.clientWebPath});
            });

            this.app.get('/qr', (req, res) => {
                res.sendFile('qr.html', {root: config.clientWebPath});
            });

            this.app.use('/js', express.static(path.join(config.clientWebPath, 'js')));
            this.app.use('/css', express.static(path.join(config.clientWebPath, 'css')));
            this.app.use('/images', express.static(path.join(config.clientWebPath, 'images')));


            if(isDockerized) {
                this.server.listen(80, "0.0.0.0",511, () => {
                    logger.log('websocket listening listening on '+config.listenip+':'+this.port);
                });
            } else {
                this.server.listen(this.port, config.listenip,511, () => {
                    logger.log('websocket listening listening on '+config.listenip+':'+this.port);
                });
            }




        this.stateRefresher = setInterval(async () => {
            await p.pktWallet.refreshState();
        }, 5000);

        events.on("fold-check-results", async(data) => {
            let addr = data.address;

            if(data.result) {
                await p.pktWallet.foldAddress(addr);
                logger.log("[Folding]: Folding address: "+addr);

            }

            if(data.input.socketId !== undefined) {
                let sock = p.authedSessions.get(data.input.socketId);

                if(sock !== undefined) {
                    sock.emit("fold-check", {
                        address: addr,
                        result: data.result
                    })
                }
            }
        });

        this.io.on("connection", async (socket) => {
            let syncer = undefined;

            let address = socket.handshake.address;

            this.sessions.set(socket.id, socket);
            this.ipSessionMap.set(socket.id, address);

            setTimeout(async function () {
                if(!p.authedSessions.has(socket.id)) {
                        socket.emit("authorization-timeout");
                        socket.emit("close", "access timeout");
                        socket.disconnect();
                }
            }, 60000);

            let dev = require("./dev.js");

            let resyncer = undefined;

            socket.on('auth', async (data) => {
                if(data.code !== undefined) {
                    if (dev || auth.verifyQR(data.code)) {
                        this.authedSessions.set(socket.id, socket);
                        socket.emit("authorized");
                        if(!dev) {
                            logger.log(socket.id + " authorized by 2fa");
                        } else {
                            logger.log(socket.id + " authorized by dev mode active");
                        }

                        syncer = setInterval(async () => {
                            socket.emit("wallet-state", p.pktWallet.state);
                        }, 2000);
                    } else {
                        socket.emit("unauthorized");
                        socket.emit("close", "invalid code");
                        socket.disconnect();

                    }
                }
            });

            socket.on("miners", async () => {
                let authed = p.authedSessions.has(socket.id);

                if(authed) {
                    if(p.miners !== undefined) {
                        socket.emit("miners", p.miners);
                    }
                }
            })

            socket.on("close", async (reason)=> {
                socket.emit("close", reason);
                socket.disconnect();
            })

            socket.on("qr-request", async (testQrPassword) => {
                    testQrPassword = testQrPassword.toString();

                    logger.log(testQrPassword + " VS "+config.qrpassword);

                    if(testQrPassword === config.qrpassword) {
                        socket.emit("login-qr", getAuthConfig().qrImage);
                    }
            });

            socket.on("fold-check", async (address) => {
                let authed = p.authedSessions.has(socket.id);

                if(authed) {
                    let socketId = socket.id;

                    p.foldingQueue.push({
                        socketId: socketId,
                        address: address,
                        callback: true,
                    });
                }
            });

            socket.on("fold-all", async() => {
                let authed = p.authedSessions.has(socket.id);

                if(authed) {
                    let addresses = await p.pktWallet.getWalletBalances();

                    if (addresses.length === 0) {
                        return;
                    }

                    for (let i = 0; i < addresses.length; i++) {
                        let addr = addresses[i].address;

                        p.foldingQueue.push({
                            socketId: socket.id,
                            address: addr
                        });
                    }
                }
            });

            socket.on("refresh-state", async () => {
                let authed = p.authedSessions.has(socket.id);

                if(authed) {
                    socket.emit("wallet-state", p.pktWallet.state);
                }
            });

            socket.on("create-address", async () => {
                let authed = p.authedSessions.has(socket.id);

                if(authed) {
                    let result = await p.pktWallet.getNewAddress();

                    logger.log(result);

                    setTimeout(async ()=> {
                        await p.pktWallet.refreshState(socket);
                    }, 500);

                    socket.emit("create-address", result);
                }
            });

            socket.on("send-pkt", async (sendData) => {
                let authed = p.authedSessions.has(socket.id);

                logger.log("send inc: "+JSON.stringify(sendData));
                if(authed) {
                    //TODO: validate sender address
                    let code = sendData.code;

                    let codePasses = auth.verifyQR(code);

                    if(codePasses) {
                        if(!p.pktWallet.state.isSyncing) {
                            let validAddress = wallet.validatePktAddress(sendData.pktReceiverAddress);

                            if(sendData.pktSenderAddress !== undefined && validAddress) {
                                let result = await p.pktWallet.spendPkt(sendData.pktSenderAddress, sendData.pktReceiverAddress, sendData.pktAmount);

                                await p.pktWallet.refreshState(socket);//TODO: all session states should be triggered with 'state refreshes' from actions

                                if(result !== undefined && result.toString().length > 0) {
                                    unconfirmedTransactionQueue.push({
                                        txid: result.toString().trim().replace("\n", ""),
                                        address: sendData.pktSenderAddress,
                                        date: new Date()
                                    });

                                    socket.emit("send-submitted", {
                                        txid: result
                                    });
                                } else {
                                    logger.log("send failed");
                                    socket.emit("send-failed", {
                                        sendData:sendData
                                    })
                                }
                            } else if(validAddress) {
                                let result = await p.pktWallet.spendGlobal(sendData.pktReceiverAddress, sendData.pktAmount);

                                logger.log(result);
                            }
                        } else {
                            logger.log("send failed because wallet is not in sync");
                            socket.emit("send-failed", {
                                sendData:sendData
                            });
                        }
                    } else {
                        logger.log("send failed because 2fa code did not match.");
                        socket.emit("send-failed", {
                            sendData:sendData,
                            codeDenied: true
                        });
                    }
                }
            });

            socket.on('disconnect', async (reason) => {
                let authed = p.authedSessions.has(socket.id);

                if(authed) {
                    p.authedSessions.delete(socket.id);
                }

                p.ipSessionMap.delete(socket.id);

                if(syncer !== undefined) {
                    clearInterval(syncer);
                }
            });

        });
    }

}

module.exports = websockserv;