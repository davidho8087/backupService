const { PrismaClient } = require('@prisma/client');
const path = require("path");

// prismaClient.js

// Construct the database URL based on the environment
const dbPath = process.pkg ?
	path.join(path.dirname(process.execPath), 'db', 'dev.db') : // For pkg executable
	path.join(__dirname, '..', 'db', 'dev.db'); // For development


console.log(`Database path: ${dbPath}`);

let prisma;

if (!prisma) {
	// Now use the database path to set the connection URL
	prisma = new PrismaClient({
		datasources: {
			db: {
				url: `file:${dbPath}`
			}
		}
	});
}

module.exports = prisma;
