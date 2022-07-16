const puppeteer = require('puppeteer');

let config = require("../config.json");

async function getCurrentBlockHeight() {

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(config.explorerUrl, {waitUntil: 'networkidle0'});

    const tds = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('td'), el => el.textContent)
    });

    await browser.close();

    return tds[0];
}

async function getExplorerBlockDetails(blkid) {

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(config.explorerUrl+'/block/'+blkid, {waitUntil: 'networkidle0'});

    const spans = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('span'), el => el.textContent)
    })

    await browser.close();

    let ourObject = blockSpanSeek(spans);
    //console.log(spans);

    return ourObject;
}

function blockSpanSeek(spans) {
    let returnObject = {};

    let i = 0;
    while (i < spans.length) {
        let currentText = spans[i];
        //console.log(currentText);
        if (currentText.includes("Block #")) {
            returnObject.blockNumber = currentText.replace("Block #", "");
        }

        if (currentText.includes("Size (Bytes)")) {
            if (spans[i + 1] === "" && spans[i + 2] === "") {
                returnObject.bytes = spans[i + 3];
            }
        }

        if (currentText.includes("Difficulty")) {
            if (spans[i + 1] === "" && spans[i + 2] === "") {
                returnObject.difficulty = spans[i + 3];
            }
        }

        if (currentText.includes("Transactions")) {
            if (spans[i + 1] === "" && spans[i + 2] === "") {
                returnObject.transactions = spans[i + 3];
            }
        }

        if (currentText.includes("Next Block")) {
            if (spans[i + 1] === "" && spans[i + 2] === "") {
                returnObject.nextBlock = spans[i + 3];
            }
        }

        if (currentText.includes("Previous Block")) {
            if (spans[i + 1] === "" && spans[i + 2] === "") {
                returnObject.previousBlock = spans[i + 3];
            }
        }

        if (currentText.includes("Timestamp")) {
            if (spans[i + 1] === "" && spans[i + 2] === "") {
                returnObject.timestamp = spans[i + 3];
            }
        }

        if (currentText.includes("Confirmations")) {
            if (spans[i + 1] === "" && spans[i + 2] === "") {
                returnObject.confirmations = spans[i + 3];
            }
        }

        if (currentText.includes("Announcements")) {
            if (spans[i + 1] === "" && spans[i + 2] === "") {
                returnObject.announcements = spans[i + 3];
            }
        }

        if (currentText.includes("Announcement Difficulty")) {
            if (spans[i + 1] === "" && spans[i + 2] === "") {
                returnObject.announcementDifficulty = spans[i + 3];
            }
        }

        if (currentText.includes("Estimated Bandwidth")) {
            if (spans[i + 1] === "" && spans[i + 2] === "") {
                returnObject.estimatedBandwidth = spans[i + 3];
            }
        }

        if (currentText.includes("Estimated Bandwidth")) {
            if (spans[i + 1] === "" && spans[i + 2] === "") {
                returnObject.estimatedBandwidth = spans[i + 3];
            }
        }

        if (currentText.includes("Estimated Encryptions Per Second'")) {
            if (spans[i + 1] === "" && spans[i + 2] === "") {
                returnObject.eeps = spans[i + 3];
            }
        }

        i++;
    }

    return returnObject;
}


async function getExplorerAddressDetails(addr) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(config.explorerUrl+'/address/'+addr, {waitUntil: 'networkidle0'});

    const spans = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('span'), el => el.textContent)
    })

    await browser.close();


    let ourObject = addressSpanSeek(addr, spans);

    return ourObject;
}




async function getExplorerTransactionDetails(txid) {

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(config.explorerUrl+'/tx/'+txid, {waitUntil: 'networkidle0'});

    const spans = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('span'), el => el.textContent)
    })

    await browser.close();

    let ourObject = transactionSpanSeek(spans);

    return ourObject;
}

function transactionSpanSeek(spans) {
    let returnObject = {};

    let i = 0;
    while(i < spans.length) {
        let currentText = spans[i];
        //console.log(currentText);

        if(currentText.includes("Size (Bytes)")) {
            if(spans[i + 1] === "" && spans[i + 2] === "") {
                returnObject.bytes = spans[i + 3];
            }
        }

        if(currentText.includes("Fee Per Byte")) {
            if(spans[i + 1] === "" && spans[i + 2] === "") {
                returnObject.fpb = spans[i + 3];
            }
        }

        if(currentText.includes("Confirmations")) {
            if(spans[i + 1] === "" && spans[i + 2] === "") {
                returnObject.confirmations = spans[i + 3];

                returnObject.confirmed = returnObject.confirmations !== "Unconfirmed" && parseInt(returnObject.confirmations) > 0;
            }
        }

        if(currentText.includes("First Seen")) {
            if(spans[i + 1] === "" && spans[i + 2] === "") {
                returnObject.firstSeen = spans[i + 3];
            }
        }

        if(currentText.includes("In Block")) {
            if(spans[i + 1] === "" && spans[i + 2] === "") {
                returnObject.inBlock = spans[i + 3];
            }
        }

        i++;
    }

    return returnObject;
}

function addressSpanSeek(addr, spans) {
    let returnObject = {};

    returnObject.address = addr;

    let i = 0;
    while(i < spans.length) {
        let currentText = spans[i];
        //console.log(currentText);

        if(currentText.includes("Unconsolidated Txns")) {
            if(spans[i + 1] === "" && spans[i + 2] === "") {
                returnObject.unconsolidatedTransations = parseInt(spans[i + 3]);
            }
        }

        if(currentText.includes("Balance")) {
            if(spans[i + 1] === "" && spans[i + 2] === "") {
                returnObject.balance = parseFloat(spans[i + 3].split(" ")[0].replace(",", ""));
            }
        }

        if(currentText.includes("Transactions")) {
            if(spans[i + 1] === "" && spans[i + 2] === "") {
                returnObject.transactions = parseFloat(spans[i + 3].replace(",", ""));
            }
        }


        if(currentText.includes("Mining payouts")) {
            if(spans[i + 1] === "" && spans[i + 2] === "") {
                returnObject.miningPayouts = parseFloat(spans[i + 3].replace(",", ""));
            }
        }


        i++;
    }

    return returnObject;
}

module.exports = {getExplorerTransactionDetails:getExplorerTransactionDetails, getExplorerBlockDetails: getExplorerBlockDetails, getCurrentBlockHeight: getCurrentBlockHeight, getExplorerAddressDetails: getExplorerAddressDetails}
