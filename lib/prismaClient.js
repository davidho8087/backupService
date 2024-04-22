const { PrismaClient } = require("@prisma/client");
const path = require("path");

// prismaClient.js

// Construct the database URL based on the environment
const dbPath = process.pkg
  ? path.join(path.dirname(process.execPath), "db", "dev.db") // For pkg executable
  : path.join(__dirname, "..", "db", "dev.db"); // For development

let prisma;

if (!prisma) {
  // Now use the database path to set the connection URL
  try {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: `file:${dbPath}`,
        },
      },
    });

    // Attempt to connect to the database to ensure connection can be established
    prisma.$connect().catch((e) => {
      console.error("Error connecting to the database:", e);
      // Handle connection error (e.g., log, retry, exit)
      process.exit(1); // Optionally exit if cannot connect to database
    });
  } catch (error) {
    console.error("Failed to initialize Prisma Client:", error);
    // Further handling if necessary (e.g., retry logic, logging)
    process.exit(1); // Optionally exit if initialization fails
  }
}

module.exports = prisma;
