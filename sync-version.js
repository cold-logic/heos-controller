const fs = require('fs');
const path = require('path');

const rootPackage = require('./package.json');
const appPackagePath = path.join(__dirname, 'app', 'package.json');
const appPackage = require(appPackagePath);

appPackage.version = rootPackage.version;
appPackage.author = rootPackage.author;
appPackage.description = rootPackage.description;
// We can also sync productName if it exists in root, but it's currently in build config
// appPackage.productName = rootPackage.productName; 

fs.writeFileSync(appPackagePath, JSON.stringify(appPackage, null, 2));

console.log(`Synced app/package.json version to ${rootPackage.version}`);