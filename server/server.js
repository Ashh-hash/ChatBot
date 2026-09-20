const express = require("express");
const cors = require("cors");
const Groq = require("groq-sdk");
const { PrismaClient } = require("@prisma/client");

require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());


// ==========================================
// PRISMA + DATABASE SETUP
// ==========================================

const dbUrl = process.env.DATABASE_URL;
let prisma;

// TiDB Cloud Serverless uses HTTPS (not TCP), so we use @tidbcloud/prisma-adapter
// This avoids the "pool timeout: active=0 idle=0" error from mariadb TCP driver
if (dbUrl && dbUrl.includes("tidbcloud.com")) {
  try {
    const { PrismaTiDBCloud } = require("@tidbcloud/prisma-adapter");
    const parsed = new URL(dbUrl);
    const adapter = new PrismaTiDBCloud({
      url: dbUrl,
      username: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      host: parsed.hostname,
      database: parsed.pathname.replace(/^\//, "").split("?")[0],
    });
    prisma = new PrismaClient({ adapter });
    console.log("Using TiDB Cloud HTTPS adapter");
  } catch (err) {
    console.error("TiDB Cloud adapter setup error:", err);
  }
}

// Local MySQL fallback using mariadb driver
if (!prisma) {
  try {
    const { PrismaMariaDb } = require("@prisma/adapter-mariadb");
    const mariadb = require("mariadb");
    const pool = mariadb.createPool({
      host: process.env.DATABASE_HOST || "127.0.0.1",
      port: Number(process.env.DATABASE_PORT) || 3306,
      user: process.env.DATABASE_USER || "root",
      password: process.env.DATABASE_PASSWORD || "",
      database: process.env.DATABASE_NAME || "chatbot",
      connectionLimit: 10,
    });
    const adapter = new PrismaMariaDb(pool);
    prisma = new PrismaClient({ adapter });
    console.log("Using local MariaDB adapter");
  } catch (err) {
    console.error("Local DB adapter setup error:", err);
  }
}


// ==========================================
// GROQ SETUP
// ==========================================

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// ==========================================
// NODEMAILER EMAIL SETUP
// ==========================================

const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});


// ==========================================
// TEST ROUTE
// ==========================================

app.get("/", (req, res) => {
  res.json({
    message: "ChatBot backend is running!",
  });
});


// ==========================================
// DATABASE TEST
// ==========================================

app.get("/api/db-test", async (req, res) => {
  try {

    const users = await prisma.user.findMany();

    res.json({
      message: "MySQL connection is working!",
      users: users,
    });

  } catch (error) {

    console.error("Database error:", error);

    res.status(500).json({
      error: "Database connection failed.",
    });

  }
});


// ==========================================
// AUTH API (SIGNUP & LOGIN WITH PASSWORD)
// ==========================================

app.post("/api/auth/signup", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Check if user already exists AND is fully verified (password set, no pending OTP)
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.password && !existing.otp) {
      return res.status(400).json({ error: "An account with this email already exists. Please Sign In." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate OTP for email verification
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save pending user with OTP (not fully registered yet)
    await prisma.user.upsert({
      where: { email },
      update: { name: name || "User", password: hashedPassword, otp, otpExpiresAt },
      create: { email, name: name || "User", password: hashedPassword, otp, otpExpiresAt },
    });

    console.log("----------------------------------------");
    console.log(`🔐 Signup OTP for ${email}: ${otp}`);
    console.log("----------------------------------------");

    // Send OTP email
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        await transporter.sendMail({
          from: `"ChatBot AI" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: "Verify your ChatBot Account",
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 460px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff;">
              <h2 style="color: #0f172a; margin-top: 0; margin-bottom: 8px; font-size: 22px;">Verify your account</h2>
              <p style="color: #475569; font-size: 14px; line-height: 1.5; margin-bottom: 24px;">Enter this 6-digit code to complete your registration:</p>
              <div style="text-align: center; padding: 18px; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 12px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #10a37f; margin-bottom: 24px;">
                ${otp}
              </div>
              <p style="color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.5;">This code expires in 10 minutes. If you did not create an account, ignore this email.</p>
            </div>
          `,
        });
        console.log(`✉️ Signup OTP email sent to ${email}`);
      } catch (mailError) {
        console.warn("Could not send signup OTP email:", mailError.message);
      }
    }

    res.json({ message: "OTP sent to email. Please verify to complete registration." });
  } catch (error) {
    console.error("Sign up error:", error);
    res.status(500).json({ error: "Failed to create account" });
  }
});

// Verify OTP and complete signup
app.post("/api/auth/signup-verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.otp !== otp || !user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      return res.status(400).json({ error: "Invalid or expired OTP. Please try again." });
    }

    // Clear OTP — account is now verified
    await prisma.user.update({
      where: { id: user.id },
      data: { otp: null, otpExpiresAt: null },
    });

    console.log(`✅ User signup verified: ${user.email} (ID: ${user.id})`);

    res.json({
      message: "Account created successfully",
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error("Signup OTP verify error:", error);
    res.status(500).json({ error: "Failed to verify OTP" });
  }
});


app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: "No account found with this email. Please Sign Up." });
    }

    if (!user.password) {
      return res.status(400).json({ error: "This account was created with OTP/Google. Please log in with OTP or Google." });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(400).json({ error: "Incorrect password. Please try again." });
    }

    console.log(`🔓 User logged in with password: ${user.email} (ID: ${user.id})`);

    res.json({
      message: "Login successful",
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Failed to log in" });
  }
});


// ==========================================
// AUTH API (EMAIL OTP & GOOGLE)
// ==========================================

app.post("/api/auth/send-otp", async (req, res) => {
  const { name, email } = req.body;

  try {
    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Upsert user (update if exists, create if not)
    await prisma.user.upsert({
      where: { email },
      update: { otp, otpExpiresAt, name: name || undefined },
      create: { email, name, otp, otpExpiresAt },
    });

    // Log OTP to console for debugging
    console.log("----------------------------------------");
    console.log(`🔐 OTP for ${email}: ${otp}`);
    console.log("----------------------------------------");

    // If EMAIL_USER and EMAIL_PASS are configured in .env, send real email!
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        await transporter.sendMail({
          from: `"ChatBot AI" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: "Your ChatBot Verification Code",
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 460px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff;">
              <h2 style="color: #0f172a; margin-top: 0; margin-bottom: 8px; font-size: 22px;">ChatBot Verification</h2>
              <p style="color: #475569; font-size: 14px; line-height: 1.5; margin-bottom: 24px;">Your 6-digit verification code is below. Enter it on the login page to proceed:</p>
              
              <div style="text-align: center; padding: 18px; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 12px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #10a37f; margin-bottom: 24px;">
                ${otp}
              </div>
              
              <p style="color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.5;">This code expires in 10 minutes. If you did not request this code, please safely ignore this email.</p>
            </div>
          `,
        });
        console.log(`✉️ Email successfully dispatched to ${email}`);
      } catch (mailError) {
        console.warn("Could not dispatch email via SMTP (logged to console instead):", mailError.message);
      }
    }

    res.json({ message: "OTP sent successfully!" });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json({ error: "Failed to generate OTP" });
  }
});

app.post("/api/auth/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.otp !== otp || !user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    // Clear OTP after successful login
    await prisma.user.update({
      where: { id: user.id },
      data: { otp: null, otpExpiresAt: null },
    });

    res.json({
      message: "Login successful",
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ error: "Failed to verify OTP" });
  }
});

app.post("/api/auth/google", async (req, res) => {
  const { credential, name, email } = req.body;

  try {
    let userEmail = email;
    let userName = name;

    // Verify token with Google if token is provided
    if (credential) {
      try {
        const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
        if (tokenInfoRes.ok) {
          const payload = await tokenInfoRes.json();
          userEmail = payload.email || userEmail;
          userName = payload.name || userName;
        }
      } catch (err) {
        console.warn("Google token verification note:", err.message);
      }
    }

    if (!userEmail) {
      return res.status(400).json({ error: "Email is required for Google login" });
    }

    // Find or create user
    const user = await prisma.user.upsert({
      where: { email: userEmail },
      update: { name: userName || undefined },
      create: { email: userEmail, name: userName || "Google User" },
    });

    console.log("----------------------------------------");
    console.log(`🚀 Google login successful for: ${user.email} (ID: ${user.id})`);
    console.log("----------------------------------------");

    res.json({
      message: "Google login successful",
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error("Google Auth error:", error);
    res.status(500).json({ error: "Google authentication failed" });
  }
});


// ==========================================
// CHAT API
// ==========================================

app.post("/api/chat", async (req, res) => {

  try {

    const messages = req.body.messages;

    const conversationId =
      Number(req.body.conversationId);

    const documentId = req.body.documentId;

    console.log("Messages received from React:");
    console.log(messages);

    console.log(
      "Conversation ID received by /api/chat:"
    );
    console.log(conversationId);

    // ==========================================
    // FETCH DOCUMENT CONTENT FROM DB (IF ANY)
    // ==========================================
    let documentContent = null;
    if (documentId) {
      const doc = await prisma.document.findUnique({
        where: { id: Number(documentId) }
      });
      if (doc) {
        documentContent = doc.extractedText;
        console.log("Document fetched from DB, length:", documentContent.length);
      }
    }


    // ==========================================
    // ASK GROQ FOR AI RESPONSE
    // ==========================================

    // Build the messages array for Groq
    const groqMessages = [
      {
        role: "system",
        content:
          "You are a helpful AI assistant. Answer accurately, naturally, and directly. Match the length and structure of your response to the complexity of the user's question. For simple factual questions, give a concise direct answer without unnecessary sections, tables, bullet points, travel tips, disclaimers, or extra information. For complex questions, provide as much explanation as needed. Use paragraphs, bullets, tables, or headings only when they genuinely improve clarity. Avoid unnecessary blank lines and repetition. Do not provide information the user did not ask for unless it is important for understanding the answer.",
      },
    ];

    // If a document was uploaded, add its content as context
    if (documentContent) {
      groqMessages.push({
        role: "system",
        content: `The user has uploaded a document. Here is its content:\n\n${documentContent}\n\nUse this document to answer the user's questions. Refer to specific parts of the document when relevant.`,
      });
    }

    // Add the conversation messages
    groqMessages.push(...messages);

const completion =
      await groq.chat.completions.create({
        messages: groqMessages,

        model: "openai/gpt-oss-120b",
      });

    const aiReply =
      completion.choices[0]?.message?.content ||
      "No response from AI";

    console.log("AI reply from Groq:");
    console.log(aiReply);


    // ==========================================
    // SAVE AI MESSAGE TO DATABASE
    // ==========================================

    await prisma.message.create({

      data: {
        role: "assistant",
        content: aiReply,
        conversationId: conversationId,
      },

    });


    console.log(
      "AI message saved to conversation:",
      conversationId
    );


    // ==========================================
    // SEND RESPONSE BACK TO REACT
    // ==========================================

    res.json({

      reply: aiReply,

    });

  }

  catch (error) {

    console.error(
      "Groq API error:",
      error
    );

    res.status(500).json({

      error:
        "Something went wrong while contacting the AI.",

    });

  }

});
// ==========================================
// CREATE NEW CONVERSATION
// ==========================================

app.post("/api/conversations", async (req, res) => {

  try {

    const userId = req.body.userId ? Number(req.body.userId) : 1;

    const conversation =
      await prisma.conversation.create({

        data: {
          title: "New conversation",
          userId: userId,
        },

      });

    console.log(
      "Conversation created for user:",
      userId,
      conversation
    );

    res.json({
      conversation: conversation,
    });

  }

  catch (error) {

    console.error(
      "Conversation creation error:",
      error
    );

    res.status(500).json({
      error:
        "Failed to create conversation.",
    });

  }

});
// ==========================================
// GET ALL CONVERSATIONS
// ==========================================

app.get("/api/conversations", async (req, res) => {

  try {

    const userId = req.query.userId ? Number(req.query.userId) : 1;

    const conversations =
      await prisma.conversation.findMany({

        where: {

          userId: userId,

        },

        orderBy: {

          createdAt: "desc",

        },

      });


    console.log(
      `Conversations loaded for user ${userId}:`,
      conversations.length
    );


    res.json({

      conversations: conversations,

    });

  }

  catch (error) {

    console.error(
      "Conversation loading error:",
      error
    );

    res.status(500).json({

      error:
        "Failed to load conversations.",

    });

  }

});

// ==========================================
// GET MESSAGES FOR A CONVERSATION
// ==========================================

app.get("/api/conversations/:id/messages", async (req, res) => {

  try {

    const conversationId = Number(req.params.id);

    const messages =
      await prisma.message.findMany({

        where: {
          conversationId: conversationId,
        },

        orderBy: {
          createdAt: "asc",
        },

      });

    res.json({
      messages: messages,
    });

  }

  catch (error) {

    console.error(
      "Failed to load conversation messages:",
      error
    );

    res.status(500).json({
      error: "Failed to load messages",
    });

  }

});

// ==========================================
// DELETE CONVERSATION
// ==========================================

app.delete(
  "/api/conversations/:id",
  async (req, res) => {

    try {

      const conversationId =
        Number(req.params.id);


      // Delete all messages
      // belonging to this conversation

      await prisma.message.deleteMany({

        where: {

          conversationId:
            conversationId,

        },

      });


      // Delete the conversation

      await prisma.conversation.delete({

        where: {

          id:
            conversationId,

        },

      });


      console.log(
        "Conversation deleted:",
        conversationId
      );


      res.json({

        message:
          "Conversation deleted successfully.",

      });

    }

    catch (error) {

      console.error(
        "Conversation deletion error:",
        error
      );

      res.status(500).json({

        error:
          "Failed to delete conversation.",

      });

    }

  }
);

// ==========================================
// RENAME CONVERSATION
// ==========================================

app.patch("/api/conversations/:id", async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    const { title } = req.body;

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: { title },
    });

    res.json({ conversation: updated });
  } catch (error) {
    console.error("Failed to update conversation:", error);
    res.status(500).json({ error: "Failed to update conversation" });
  }
});


// ==========================================
// CREATE MESSAGE
// ==========================================
app.post("/api/messages", async (req, res) => {

  try {

    const { conversationId, role, content } = req.body;

    const message = await prisma.message.create({
      data: {
        role: role,
        content: content,
        conversationId: conversationId,
      },
    });


    // Update conversation title using the first user message
    const conversation = await prisma.conversation.findUnique({
      where: {
        id: conversationId,
      },
    });

    if (
      conversation &&
      conversation.title === "New conversation"
    ) {
      await prisma.conversation.update({
        where: {
          id: conversationId,
        },
        data: {
          title: content.slice(0, 40),
        },
      });
    }


    res.json({
      message: message,
    });

  } catch (error) {

    console.error(
      "Message saving error:",
      error
    );

    res.status(500).json({
      error: "Failed to save message.",
    });

  }

});
// ==========================================
// FILE UPLOAD
// ==========================================

const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { PDFParse, VerbosityLevel } = require("pdf-parse");
const XLSX = require("xlsx");
const mammoth = require("mammoth");

// Multer storage — keeps original filename with timestamp prefix
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    // e.g. "1694812345678-sales_info.csv"
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

app.post("/api/upload", upload.single("file"), async (req, res) => {

  try {

    if (!req.file) {
      return res.status(400).json({
        error: "No file uploaded",
      });
    }

    const filePath = path.resolve(req.file.path);
    const fileType = req.file.mimetype;

    console.log("Uploaded file:", req.file.originalname);
    console.log("File type:", fileType);
    console.log("File path:", filePath);

    // ----------------------------------------
    // EXTRACT TEXT BASED ON FILE TYPE
    // ----------------------------------------

    let extractedText = "";

    if (fileType === "text/csv") {
      // CSV is plain text — read it directly with Node's fs
      extractedText = fs.readFileSync(filePath, "utf8");
      console.log("CSV extracted, length:", extractedText.length, "characters");

    } else if (fileType === "application/pdf") {
      // PDF: pass file as Uint8Array in constructor, then load + getText
      const fileBuffer = new Uint8Array(fs.readFileSync(filePath));
      const parser = new PDFParse({ verbosity: VerbosityLevel.ERRORS, data: fileBuffer });
      await parser.load();
      const pdfResult = await parser.getText();
      extractedText = pdfResult.text;
      console.log("PDF extracted, length:", extractedText.length, "characters");

    } else if (
      fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      fileType === "application/vnd.ms-excel"
    ) {
      // Excel: read workbook, convert each sheet to CSV text
      const workbook = XLSX.readFile(filePath);
      const sheetTexts = workbook.SheetNames.map((name) => {
        const sheet = workbook.Sheets[name];
        return XLSX.utils.sheet_to_csv(sheet);
      });
      extractedText = sheetTexts.join("\n\n");
      console.log("Excel extracted, length:", extractedText.length, "characters");

    } else if (
      fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      // DOCX: mammoth extracts raw text from Word documents
      const result = await mammoth.extractRawText({ path: filePath });
      extractedText = result.value;
      console.log("DOCX extracted, length:", extractedText.length, "characters");

    } else if (fileType === "text/plain") {
      // TXT: plain text, same as CSV
      extractedText = fs.readFileSync(filePath, "utf8");
      console.log("TXT extracted, length:", extractedText.length, "characters");
    }

    // ----------------------------------------
    // RETURN RESULT
    // ----------------------------------------

    res.json({
      message: "File uploaded successfully",
      filename: req.file.originalname,
      fileType: fileType,
      extractedText: extractedText,
    });

  } catch (error) {

    console.error("File upload error:", error);

    res.status(500).json({
      error: "File upload failed",
    });

  }

});

// ==========================================
// START SERVER
// ==========================================

const PORT = 3000;

app.listen(PORT, () => {

  console.log(
    `Server running on http://localhost:${PORT}`
  );

});