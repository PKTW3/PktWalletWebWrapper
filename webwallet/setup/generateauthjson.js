const readlineSync = require('readline-sync');

const auth = require("../auth/auth.js");

const input = prompt => {
    const userInput = readlineSync.question(prompt);
    return userInput;
}

async function run() {
    console.log("This script will configure your 2fa authentication for login")
    let id = input("Please enter the id to display in your 2fa app for this wallet: ");

    let shouldSave = input("should this script save to .json auth file automatically? (yes/no): ");

    if(shouldSave === "yes") {
        await auth.generateSaveQR(id, "../auth.json");
        console.log("auth.json updated")
    } else {
        console.log("auth.json contents")
        let data = await auth.generateQR(id);
        console.log(JSON.stringify(data));
    }
}

run().then(() => {

});
