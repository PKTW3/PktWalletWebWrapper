const readlineSync = require('readline-sync');

const auth = require("../auth/auth.js");
const fs = require("fs");

const inquirer =  require("inquirer");

const input = prompt => {
    const userInput = readlineSync.question(prompt);
    return userInput;
}

async function run() {
    console.log("This script will configure your wallet configuration");

    let path = input("Please enter your absolute wallet db path (ex '/root/.pktwallet')? ");

    let walletbinpath = input("absolute path to wallet executable folder? (ex: C:\\desktop\\wallet-v1.5.0-windows\\bin\\) ")

    let walletpw = input("Provide the password for the provided wallet: ");

    let qrpassword = input("Please enter a password or type generate to generate a password for the 2fa (used for authentication): ");

    let clientWebPath = input("Enter the absolute path to client/web folder of the web wallet software: ");

    let write = input("write to file? (yes/no)");

    let o = {
        walletstorage: path,
        wallet_password: walletpw,
        qrpassword: qrpassword,
        walletbinpath: walletbinpath,
        clientWebPath: clientWebPath
    };

    if(write === "yes") {
        fs.writeFile("../config.json", JSON.stringify(o, null, 2), (err) => {
            // throws an error, you could also catch it here
            if (err) throw err;
            // success case, the file was saved
        });
    } else {
        console.log(JSON.stringify(o, null, 2));
    }
}

run().then(() => {

});
