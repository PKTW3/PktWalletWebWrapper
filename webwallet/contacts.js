//TODO: simple address 'pktaddr' key map system for contacts
const PersistentMap = require("persistentmap");

const contactsMap = new PersistentMap('./storage/contacts.json');
let contactsLoaded = false;

async function addContact(alias, address) {
    if(!contactsMap.has(alias)) {
        contactsMap.set(alias, address);
    }

    return false;
}

async function removeContact(alias, address) {
    if(contactsMap.has(alias)) {
        contactsMap.delete(alias);
    }

    return false;
}

async function getContactByAlias(alias) {
    return contactsMap.has(alias) ? contactsMap.get(alias) : undefined;
}

function getContactByAddress(address2) {
    return new Promise(async (resolve, reject) => {

        function process(address, alias, map) {
            if(address === address2) {
                return resolve({
                    alias: alias,
                    address: address
                });
            }
        }

        contactsMap.forEach(process);
    });
}

function hasContact(alias) {
    return contactsMap.has(alias);
}

async function loadContacts() {
    await contactsMap.load();
    contactsLoaded = true;
}

module.exports = {
    addContact: addContact,
    removeContact: removeContact,
    getContactByAddress: getContactByAddress,
    getContactByAlias: getContactByAlias,
    hasContact: hasContact,
    loadContacts: loadContacts
};