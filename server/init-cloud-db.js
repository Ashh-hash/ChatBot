const { PrismaClient } = require("@prisma/client");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");
require("dotenv").config();

const dbUrl = process.env.DATABASE_URL;
const parsed = new URL(dbUrl);

const adapter = new PrismaMariaDb({
  host: parsed.hostname,
  port: Number(parsed.port) || 3306,
  user: decodeURIComponent(parsed.username),
  password: decodeURIComponent(parsed.password),
  database: parsed.pathname.replace(/^\//, ""),
  ssl: { rejectUnauthorized: false }
});

const prisma = new PrismaClient({ adapter });

async function initDb() {
  console.log("Connecting to TiDB Cloud...");

  try {
    // 1. User table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`user\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`name\` VARCHAR(191) NULL,
        \`email\` VARCHAR(191) NOT NULL UNIQUE,
        \`password\` VARCHAR(191) NULL,
        \`otp\` VARCHAR(191) NULL,
        \`otpExpiresAt\` DATETIME(3) NULL,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);
    console.log("✓ user table created");

    // 2. Conversation table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`conversation\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`title\` VARCHAR(191) NULL,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`userId\` INT NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`Conversation_userId_fkey\` (\`userId\`),
        CONSTRAINT \`Conversation_userId_fkey\` FOREIGN KEY (\`userId\`) REFERENCES \`user\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);
    console.log("✓ conversation table created");

    // 3. Message table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`message\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`role\` VARCHAR(191) NOT NULL,
        \`content\` TEXT NOT NULL,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`conversationId\` INT NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`Message_conversationId_fkey\` (\`conversationId\`),
        CONSTRAINT \`Message_conversationId_fkey\` FOREIGN KEY (\`conversationId\`) REFERENCES \`conversation\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);
    console.log("✓ message table created");

    // 4. Document table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`document\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`filename\` VARCHAR(191) NOT NULL,
        \`fileType\` VARCHAR(191) NOT NULL,
        \`storagePath\` VARCHAR(191) NOT NULL,
        \`extractedText\` LONGTEXT NOT NULL,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);
    console.log("✓ document table created");

    console.log("\n🎉 ALL TABLES CREATED IN TIDB CLOUD SUCCESSFULLY!");
  } catch (error) {
    console.error("Database setup error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

initDb();

