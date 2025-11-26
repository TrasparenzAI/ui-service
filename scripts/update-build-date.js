const fs = require("fs");

const pkg = JSON.parse(fs.readFileSync("package.json"));
pkg.buildDate = new Date().toISOString();

fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
