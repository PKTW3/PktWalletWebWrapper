//TODO: queued implementation of wallet sends / confirmations of said sends on blockchain with callback (and persistence)
//wallet send locks can be applied on a sending address basis, looks like you can still submit transactions with different wallet addresses with verfied values
const Queue = require('better-queue');
const explorer = require("./lookup/explorer.js");
const events = require("./events.js");

const PersistentMap = require("persistentmap");

const pm = new PersistentMap('./storage/unconfirmed_tx_index.json');

const logger = require("./util/logger.js");

const q = new Queue(async function (input, cb) {

    // Some processing here ...
    let txid = input.txid;
    let address = input.address;

    //console.log(txid);

    let txDetails = await explorer.getExplorerTransactionDetails(txid);

    if(txDetails.confirmed) {
        let s = {txid: txid, txDetails: txDetails};
        events.emit('transaction-confirmed', s);
        if(pm.has(txid)) {
            pm.delete(txid);
        }

        logger.log(txid+" has confirmed. "+address)

        return cb();
    } else {
        logger.log(txid+" has not been confirmed "+address)
        q.push(input);
       return cb();
    }
}, {
    afterProcessDelay: 30000
});


async function block(load=true) {
    if(load) {
        await pm.load();
    }

    function loader(value, key, map) {
            ///console.log(value);
            q.push(value);
    }

    pm.forEach(loader)
}

module.exports = {
    queue: q,
    block: block,
    unconfirmedMap: pm,
    push: function(data) {
        pm.set(data.txid, data);
        q.push(data);
    },
    hasAddressUnconfirmed: function(address) {
        let eles = pm.values();

        for(let i = 0; i < eles.length; i++) {
            let d = eles[i];
            if(d.address === address) {
                return true;
            }
        }

        return false;
    }
};