const axios = require('axios');
const https = require("https");

class Service {

    constructor() {
        this.config = require("../config.json");

        this.rpcConfig = {
            protocol: 'https',
            user: this.config["wallet-rpc-user"],
            pass: this.config["wallet-rpc-pass"],
            host: this.config["wallet-rpc-address"],
            port: this.config["wallet-rpc-port"],
        };
    }

    async showTransactions(count=100) {//can likely go lower on the default 100, just captures alot
        let req = await this.authenticatedRequest({
            Method:  "listtransactions",
            params: [count],
            jsonrpc: '1.0',
        });

        return req;
    }

    async unlockWallet(time=10) {
        let req = await this.authenticatedRequest({
            Method:  "walletpassphrase",
            params: [
                this.config["wallet_password"],
                time
            ],
            jsonrpc: '1.0',
        });

        return req.error === null;
    }

    async lockWallet() {
        let req = await this.authenticatedRequest({
            Method:  "walletlock",
            params: [],
            jsonrpc: '1.0',
        });

        return req.error === null;
    }

    async getNewAddress() {
        let req = await this.authenticatedRequest({
            Method:  "getnewaddress",
            params: [],
            jsonrpc: '1.0',
        });

        return req.error === null ? req.result : undefined;
    }

    /**
     *
     * @returns {Promise<*|undefined>}
     */
    async getBestBlock() {
        let req = await this.authenticatedRequest({
            Method:  "getbestblock",
            params: [],
            jsonrpc: '1.0',
        });

        return req.error === null ? req.result : req.error;
    }

    /**
     *
     * @returns {Promise<*>}
     */
    async getWalletBlockchainInformation() {
        let req = await this.authenticatedRequest({
            Method:  "getinfo",
            params: [],
            jsonrpc: '1.0',
        });

        return req.error === null ? req.result : req.error;
    }

    /**
     *
     * @param address
     * @param toAddress
     * @param amount
     * @returns {Promise<boolean|*>}
     */
    async sendFromAddress(address, toAddress, amount=0) {
        let req = await this.authenticatedRequest({
            Method:  "sendfrom",
            params: [
                toAddress,
                amount,
                [address]
            ],
            jsonrpc: '1.0',
        });

        return req.error === null ? req.result : req.error;
    }

    async showAddresses() {
        let req = await this.authenticatedRequest({
            Method:  "getaddressbalances",
            params: [],
            jsonrpc: '1.0',
        });

        return req;
    }

    async getAddresses() {
        return await this.showAddresses();
    }

    authenticatedRequest(data) {
        let request = {
            url: "https://"+this.rpcConfig.host+":"+this.rpcConfig.port,
            method: 'POST',
            followRedirect: true,
            maxRedirects: 5,
            headers: {
                "User-Agent": "PKT-Checkout",
                "Content-Type":"application/json",
                "Authorization": `Basic ${Buffer.from(this.rpcConfig.user + ':' + this.rpcConfig.pass).toString('base64')}`
            }
        };

        if(data !== undefined) {
            request.data = data;
        }

        const instance = axios.create({
            // ... other options ...
            httpsAgent: new https.Agent({
                rejectUnauthorized: false
            })
        })

        return instance(request).then(function(response) {
            return response.data !== undefined ? response.data : response;
        }).catch(error => {
            console.log(error);
            return undefined;
        });
    }
}

const rpc = new Service();

module.exports = rpc;