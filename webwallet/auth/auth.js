const tfa = require("2fa");
const fs  = require("fs");

function generateQR(id="pkt-wallet") {
    return new Promise(async (resolve, reject) => {
        tfa.generateKey(32, function(err, key) {

            let returnObject = {};

            returnObject.fakey = key;

            tfa.generateBackupCodes(8, 'xxxx-xxxx-xxxx', function (err, codes) {
                // [ '7818-b7b8-c928', '3526-dc04-d3f2', 'be3c-5d9f-cb68', ... ]

                // these should be sent to the user, stored and checked when we get a 2fa code
                returnObject.backupCodes = codes;
            });

            // generate a google QR code so the user can save their new key
            // tfa.generateGoogleQR(name, accountname, secretkey, cb)
            tfa.generateGoogleQR('PktWebWallet', id, key, function (err, qr) {
                // data URL png image for google authenticator
                returnObject.qrImage = qr;

            });

            let intval = setInterval(() => {
                if(returnObject.qrImage !== undefined && returnObject.backupCodes !== undefined) {
                    clearInterval(intval);
                    return resolve(returnObject);
                }
            }, 100)

        });
    });
}

async function generateSaveQR(id="pkt-wallet", path="./auth.json") {
    let qr = await generateQR(id);

    fs.writeFile(path, JSON.stringify(qr), (err) => {
        // throws an error, you could also catch it here
        if (err) throw err;
        // success case, the file was saved
    });

    return {
        path: path,
        qr: qr
    }
}

function verifyQR(code) {
    const auth = require("../auth.json");
    let opts = {
        // the number of counters to check before what we're given
        // default: 0
        beforeDrift: 0,
        // and the number to check after
        // default: 0
        afterDrift: 0,
        // if before and after drift aren't specified,
        // before + after drift are set to drift / 2
        // default: 0
        drift: 0,
        // the step for the TOTP counter in seconds
        // default: 30
        step: 30
    };

    let counter = Math.floor(Date.now() / 1000 / opts.step);

// verify it as a HOTP
    let validHOTP = tfa.verifyHOTP(auth.fakey, code, counter, opts);
// true

// for TOTP, the counter is calculated internally using Date.now();
    let validTOTP = tfa.verifyTOTP(auth.fakey, code, opts);
// true

    return validHOTP && validTOTP;
}

module.exports = {
    generateQR: generateQR,
    verifyQR: verifyQR,
    generateSaveQR: generateSaveQR
};