import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import "./App.css";


type Message = {
  text: string;
  sender: "user" | "ai";
};

type Chat = {
  id: number;
  title: string;
  messages: Message[];
};

function App() {
  const [message, setMessage] = useState("");

  const [darkMode, setDarkMode] = useState(true);

  // ==========================================
  // CHAT STATE
  // ==========================================

  const [chats, setChats] = useState<Chat[]>([]);

  const [activeChatId, setActiveChatId] =
    useState<number | null>(null);

const messagesEndRef = useRef<HTMLDivElement>(null);
const [isLoading, setIsLoading] = useState(false);

// ==========================================
// FILE UPLOAD STATE
// ==========================================

const fileInputRef = useRef<HTMLInputElement>(null);
const [selectedFile, setSelectedFile] = useState<File | null>(null);
const [isUploading, setIsUploading] = useState(false);
const [extractedText, setExtractedText] = useState("");
  // ==========================================
  // LOAD CONVERSATIONS FROM DATABASE
  // ==========================================

  useEffect(() => {
    async function loadConversations() {
      try {
        const response = await fetch(
          "http://localhost:3000/api/conversations"
        );

        if (!response.ok) {
          throw new Error(
            "Failed to load conversations"
          );
        }

        const data = await response.json();

        const loadedChats: Chat[] =
          data.conversations.map(
            (conversation: {
              id: number;
              title: string | null;
            }) => ({
              id: conversation.id,
              title:
                conversation.title ||
                "New conversation",
              messages: [],
            })
          );

        setChats(loadedChats);

        if (loadedChats.length > 0) {
          setActiveChatId(loadedChats[0].id);
        }
      } catch (error) {
        console.error(
          "Failed to load conversations:",
          error
        );
      }
    }

    loadConversations();
  }, []);
useEffect(() => {
  if (activeChatId === null) {
    return;
  }

  async function loadMessages() {
    try {
      const response = await fetch(
        `http://localhost:3000/api/conversations/${activeChatId}/messages`
      );

      if (!response.ok) {
        throw new Error("Failed to load messages");
      }

      const data = await response.json();

      const loadedMessages: Message[] =
        data.messages.map(
          (msg: {
            role: string;
            content: string;
          }) => ({
            text: msg.content,
            sender:
              msg.role === "user"
                ? "user"
                : "ai",
          })
        );

      setChats((previousChats) =>
        previousChats.map((chat) =>
          chat.id === activeChatId
            ? {
                ...chat,
                messages: loadedMessages,
              }
            : chat
        )
      );

    } catch (error) {
      console.error(
        "Failed to load messages:",
        error
      );
    }
  }

  loadMessages();

}, [activeChatId]);

  // ==========================================
  // ACTIVE CHAT
  // ==========================================

  const activeChat =
    chats.find(
      (chat) => chat.id === activeChatId
    ) || {
      id: 0,
      title: "New conversation",
      messages: [],
    };


// Auto-scroll to bottom
useEffect(() => {
  messagesEndRef.current?.scrollIntoView({
    behavior: "smooth",
  });
}, [activeChat.messages]);
  // ==========================================
  // CREATE NEW CHAT
  // ==========================================

  async function createNewChat() {
    try {
      const response = await fetch(
        "http://localhost:3000/api/conversations",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to create conversation"
        );
      }

      const data = await response.json();

      console.log(
        "NEW DATABASE CONVERSATION:",
        data.conversation
      );

      const newChat: Chat = {
        id: data.conversation.id,
        title:
          data.conversation.title ||
          "New conversation",
        messages: [],
      };

      setChats((previousChats) => [
        newChat,
        ...previousChats,
      ]);

      setActiveChatId(newChat.id);

      setMessage("");
    } catch (error) {
      console.error(
        "Conversation creation error:",
        error
      );
    }
  }


  // ==========================================
  // DELETE CHAT
  // ==========================================

  async function deleteChat(chatId: number) {
    try {
      const response = await fetch(
        `http://localhost:3000/api/conversations/${chatId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to delete conversation"
        );
      }

      const remainingChats = chats.filter(
        (chat) => chat.id !== chatId
      );

      setChats(remainingChats);

      if (activeChatId === chatId) {
        if (remainingChats.length > 0) {
          setActiveChatId(
            remainingChats[0].id
          );
        } else {
          setActiveChatId(null);
        }
      }
    } catch (error) {
      console.error(
        "Delete chat error:",
        error
      );
    }
  }

// ==========================================
// COPY MESSAGE
// ==========================================

async function copyMessage(text: string) {
  try {
    await navigator.clipboard.writeText(text);

    console.log("Message copied");

  } catch (error) {
    console.error(
      "Failed to copy message:",
      error
    );
  }
}
  // ==========================================
  // SEND MESSAGE
  // ==========================================


async function sendMessage() {
  if (message.trim() === "") return;

    if (isLoading) return;// to wait after clicking on send btn
  // No conversation selected
  if (activeChatId === null) {
    console.error(
      "No active conversation selected."
    );
    return;
  }

  setIsLoading(true);

  const currentMessage = message.trim();

  // If a file is attached, include filename in the message
  // so it shows in chat and gets saved to the database
  const displayMessage = selectedFile
    ? `📄 ${selectedFile.name}\n\n${currentMessage}`
    : currentMessage;

  const userMessage: Message = {
    text: displayMessage,
    sender: "user",
  };


  // ==========================================
  // GET CURRENT CHAT
  // ==========================================

  const currentChat = chats.find(
    (chat) => chat.id === activeChatId
  );

  const previousMessages =
    currentChat?.messages || [];


  // ==========================================
  // ADD USER MESSAGE
  // ==========================================

  const updatedMessages = [
    ...previousMessages,
    userMessage,
  ];


  // ==========================================
  // UPDATE UI WITH USER MESSAGE
  // ==========================================

  setChats((previousChats) =>
    previousChats.map((chat) => {

      if (chat.id !== activeChatId) {
        return chat;
      }

      const updatedTitle =
        chat.messages.length === 0
          ? currentMessage.length > 25
            ? currentMessage.substring(0, 25) +
              "..."
            : currentMessage
          : chat.title;

      return {
        ...chat,
        title: updatedTitle,
        messages: updatedMessages,
      };
    })
  );

  setMessage("");


  // ==========================================
  // SAVE USER MESSAGE TO MYSQL
  // ==========================================

  try {

    const messageResponse = await fetch(
      "http://localhost:3000/api/messages",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          content: displayMessage,
          conversationId: activeChatId,
          role: "user",
        }),
      }
    );

    if (!messageResponse.ok) {
      throw new Error(
        "Failed to save user message"
      );
    }

  } catch (error) {

    console.error(
      "User message save error:",
      error
    );

    setIsLoading(false);

    return;
  }


  // ==========================================
  // CONVERT MESSAGES TO GROQ FORMAT
  // ==========================================

  try {

    const groqMessages =
      updatedMessages.map((msg) => ({
        role:
          msg.sender === "user"
            ? "user"
            : "assistant",

        content: msg.text,
      }));


    console.log(
      "Sending to backend:",
      groqMessages
    );

    console.log(
      "SENDING CONVERSATION ID:",
      activeChatId
    );


    // ==========================================
    // CALL BACKEND / GROQ
    // ==========================================

    const response = await fetch(
      "http://localhost:3000/api/chat",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          messages: groqMessages,
          conversationId: activeChatId,
          // Include document ID if a file is active
          documentId: activeDocumentId || undefined,
        }),
      }
    );


    if (!response.ok) {
      throw new Error(
        "Backend request failed"
      );
    }


    const data = await response.json();


    // ==========================================
    // CREATE AI MESSAGE
    // ==========================================

    const aiMessage: Message = {
      text: data.reply,
      sender: "ai",
    };


    // ==========================================
    // ADD AI RESPONSE TO UI
    // ==========================================

    setChats((previousChats) =>
      previousChats.map((chat) => {

        if (chat.id !== activeChatId) {
          return chat;
        }

        return {
          ...chat,

          messages: [
            ...chat.messages,
            aiMessage,
          ],
        };
      })
    );

  } catch (error) {

    console.error(
      "Backend error:",
      error
    );

  } finally {

    // Turn loading OFF
    // whether Groq succeeds or fails
    setIsLoading(false);

    // NOTE: we do NOT clear selectedFile/extractedText here
    // so the user can ask multiple questions about the same document.
    // They can remove it manually with the ✕ button.

  }
}


// ==========================================
// ENTER KEY
// ==========================================

function handleKeyDown(
  event: React.KeyboardEvent<HTMLInputElement>
) {
  if (event.key === "Enter") {
    sendMessage();
  }
}


// ==========================================
// FILE UPLOAD
// ==========================================

async function handleFileUpload(
  event: React.ChangeEvent<HTMLInputElement>
) {
  const file = event.target.files?.[0];
  if (!file) return;

  setSelectedFile(file);
  setIsUploading(true);

  try {
    // FormData lets us send files over HTTP
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(
      "http://localhost:3000/api/upload",
      {
        method: "POST",
        body: formData,
        // NOTE: do NOT set Content-Type header —
        // the browser sets it automatically with
        // the correct boundary for multipart/form-data
      }
    );

    if (!response.ok) {
      throw new Error("Upload failed");
    }

    const data = await response.json();

    console.log("Upload response:", data);

    // Store the document ID returned from the database
    if (data.documentId) {
      setActiveDocumentId(data.documentId);
    }

  } catch (error) {
    console.error("File upload error:", error);
    setSelectedFile(null);
  } finally {
    setIsUploading(false);
    // Reset the input so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }
}

  // ==========================================
  // UI
  // ==========================================

  return (
    <div
      className={
        darkMode
          ? "app dark"
          : "app"
      }
    >

      {/* =====================================
          SIDEBAR
      ===================================== */}

      <aside className="sidebar">

        {/* Logo */}

        <div className="logo">

          <div className="logo-icon">
            🤖
          </div>

          <span>
            ChatBot
          </span>

        </div>


        {/* New Chat */}

        <button
          className="new-chat"
          onClick={createNewChat}
        >

          <span className="plus-icon">
            +
          </span>

          New Chat

        </button>


        {/* Chat History */}

        <div className="history">

          <p className="history-title">
            Recent
          </p>


          {chats.map((chat) => (

            <div
              className={
                chat.id === activeChatId
                  ? "chat-item-wrapper active"
                  : "chat-item-wrapper"
              }

              key={chat.id}
            >

              {/* Chat button */}

              <button
                className={
                  chat.id === activeChatId
                    ? "chat-item active"
                    : "chat-item"
                }

                onClick={() =>
                  setActiveChatId(chat.id)
                }
              >

                <span className="chat-icon">
                  💬
                </span>

                <span className="chat-title">
                  {chat.title}
                </span>

              </button>


              {/* Delete button */}

              <button
                className="delete-chat"

                onClick={(event) => {
                  event.stopPropagation();

                  deleteChat(chat.id);
                }}

                title="Delete chat"

                aria-label="Delete chat"
              >

                🗑️

              </button>

            </div>

          ))}

        </div>


        {/* Sidebar Bottom */}

        <div className="sidebar-bottom">

          <div className="theme-container">

            <span>
              {darkMode
                ? "🌙"
                : "☀️"}
            </span>

            <span className="theme-text">

              {darkMode
                ? "Dark mode"
                : "Light mode"}

            </span>


            <button
              className={
                darkMode
                  ? "toggle active"
                  : "toggle"
              }

              onClick={() =>
                setDarkMode(!darkMode)
              }

              aria-label="Toggle theme"
            >

              <span className="toggle-circle"></span>

            </button>

          </div>

        </div>

      </aside>


      {/* =====================================
          MAIN CHAT
      ===================================== */}

      <main className="chat">

        {/* Header */}

        <header className="chat-header">

          <div className="header-title">

            <h3>
              {activeChat.title}
            </h3>

            <span className="online-dot"></span>

          </div>

        </header>


        {/* Messages */}

        <section className="messages">

          {activeChat.messages.length === 0 ? (

            <div className="welcome">

              <div className="welcome-icon">
                ✨
              </div>


              <h1>
                How can I help you?
              </h1>


              <p>
                Ask me anything to get started.
              </p>


              {/* Suggestions */}

              <div className="suggestions">

                <button
                  onClick={() =>
                    setMessage(
                      "Explain binary search"
                    )
                  }
                >

                  <span>
                    🔍
                  </span>

                  Explain binary search

                </button>


                <button
                  onClick={() =>
                    setMessage(
                      "Help me learn React"
                    )
                  }
                >

                  <span>
                    ⚛️
                  </span>

                  Help me learn React

                </button>


                <button
                  onClick={() =>
                    setMessage(
                      "What can you help me with?"
                    )
                  }
                >

                  <span>
                    💡
                  </span>

                  What can you help me with?

                </button>

              </div>

            </div>

          ) : (

            activeChat.messages.map(
              (msg, index) => (

                <div
                  className={
                    msg.sender === "user"
                      ? "message-row user-row"
                      : "message-row ai-row"
                  }

                  key={index}
                >

                  {msg.sender === "ai" && (

                    <div className="avatar ai-avatar">
                      🤖
                    </div>

                  )}
  


  <div 
  
  
  className={
    msg.sender === "user"
      ? "message-container user-message-container"
      : "message-container ai-message-container"
  }
>
  {/* Message bubble */}

  <div
    className={
      msg.sender === "user"
        ? "message user-message"
        : "message ai-message"
    }
  >
    <ReactMarkdown>
      {msg.text}
    </ReactMarkdown>
  </div>

  {/* Copy button outside bubble */}

  <button
    className="copy-button"
    onClick={() => copyMessage(msg.text)}
    title="Copy"
    aria-label="Copy message"
  >
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect
        x="9"
        y="9"
        width="12"
        height="12"
        rx="2"
      />

      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  </button>
</div>


                  {msg.sender === "user" && (

                    <div className="avatar user-avatar">
                      You
                    </div>

                  )}

                </div>

              )
            )

          )}
{isLoading && (
  <div className="message-row ai-row">
    <div className="avatar ai-avatar">
      🤖
    </div>

    <div className="message-container ai-message-container">
      <div className="message ai-message">
        AI is thinking...
      </div>
    </div>
  </div>
)}

<div ref={messagesEndRef} />
   <div ref={messagesEndRef} />

        </section>


        {/* ===================================
            INPUT
        =================================== */}

        <div className="input-wrapper">

          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv,.pdf,.xlsx,.xls,.docx,.txt"
            style={{ display: "none" }}
          />

          {/* Filename indicator */}
          {selectedFile && (
            <div className="file-indicator">
              <span className="file-indicator-name">
                📄 {selectedFile.name}
              </span>
              <button
                className="file-indicator-remove"
                onClick={() => {
                  setSelectedFile(null);
                  setActiveDocumentId(null);
                }}
                aria-label="Remove file"
              >
                ✕
              </button>
            </div>
          )}

          <div className="input-area">

            {/* Upload button */}
            <button
              className="upload-button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              title="Upload file"
              aria-label="Upload file"
            >
              {isUploading ? "⏳" : "📎"}
            </button>

            <input
              type="text"

              placeholder="Message ChatBot..."

              value={message}

              onChange={(event) =>
                setMessage(
                  event.target.value
                )
              }

              onKeyDown={handleKeyDown}
            />


         <button
  className={
    message.trim()
      ? "send-button active"
      : "send-button"
  }

  onClick={sendMessage}

  disabled={isLoading}

  aria-label="Send message"
>
  ➤
</button>

          </div>


          <p className="input-hint">
            ChatBot can make mistakes.
            Check important information.
          </p>

        </div>

      </main>

    </div>
  );
}

export default App;