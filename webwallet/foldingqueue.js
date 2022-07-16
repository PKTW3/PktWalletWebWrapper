const Queue = require('better-queue');
const explorer = require("./lookup/explorer.js");
const events = require("./events.js");
const logger = require("./util/logger.js");

const q = new Queue(async function (input, cb) {

    let address = input.address;
    let addressDetails = undefined;

    try {
        addressDetails = await explorer.getExplorerAddressDetails(address);
    } catch (e) {
        console.log(e);
        addressDetails = undefined;
    }


    if(addressDetails!== undefined && addressDetails.unconsolidatedTransations > 200) {
        logger.log(address + " needs to fold.");
        events.emit("fold-check-results" , {
            input: input,
            address: input.address,
            result: true
        });
    } else {
        logger.log(address + " does not need to fold.");

        if(input.callback !== undefined && input.callback) {
            events.emit("fold-check-results" , {
                input: input,
                address: input.address,
                result: false
            });
        }
    }

    return cb();
}, {afterProcessDelay: 2500});

module.exports = q;