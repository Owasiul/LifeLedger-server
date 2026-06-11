const fs = require('fs');
const key = fs.readFileSync('./lifeledger-9e28d-firebase-adminsdk-fbsvc-f9b74ebfb2.json', 'utf8')
const base64 = Buffer.from(key).toString('base64')
console.log(base64)