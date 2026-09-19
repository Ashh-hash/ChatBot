const express = require("express");
const cors = require("cors");
const Groq = require("groq-sdk");
const { PrismaClient } = require("@prisma/client");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");

require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());


// ==========================================
// PRISMA + MYSQL SETUP
// ==========================================

const adapter = new PrismaMariaDb({
  host: "127.0.0.1",
  port: 3306,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
});

const prisma = new PrismaClient({
  adapter,
});


// ==========================================
// GROQ SETUP
// ==========================================

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
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
// CHAT API
// ==========================================

app.post("/api/chat", async (req, res) => {

  try {

    const messages = req.body.messages;

    const conversationId =
      Number(req.body.conversationId);

    const documentContent = req.body.documentContent;

    console.log("Messages received from React:");
    console.log(messages);

    console.log(
      "Conversation ID received by /api/chat:"
    );
    console.log(conversationId);

    if (documentContent) {
      console.log("Document content received, length:", documentContent.length);
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
    model: "openai/gpt-oss-120b",

    messages: groqMessages,
  });

    // ==========================================
    // GET AI RESPONSE
    // ==========================================

    const aiReply =
      completion.choices[0].message.content;


    // ==========================================
    // SAVE AI RESPONSE TO MYSQL
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

    const conversation =
      await prisma.conversation.create({

        data: {
          title: "New conversation",
          userId: 1,
        },

      });

    console.log(
      "Conversation created:",
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

    const conversations =
      await prisma.conversation.findMany({

        where: {

          userId: 1,

        },

        orderBy: {

          createdAt: "desc",

        },

      });


    console.log(
      "Conversations loaded:",
      conversations
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