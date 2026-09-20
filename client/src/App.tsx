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

import Login from './Login';

function App() {
  // ==========================================
  // AUTH STATE & PERSISTENCE
  // ==========================================
  const [currentUser, setCurrentUser] = useState<{ id: number; name: string; email: string } | null>(() => {
    try {
      const saved = localStorage.getItem("chatbot_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const handleLoginSuccess = (user: { id: number; name: string; email: string }) => {
    setCurrentUser(user);
    try {
      localStorage.setItem("chatbot_user", JSON.stringify(user));
    } catch (e) {
      console.error("Failed to save session:", e);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem("chatbot_user");
    } catch (e) {
      console.error("Failed to clear session:", e);
    }
    setChats([]);
    setActiveChatId(null);
  };

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
const [activeDocumentId, setActiveDocumentId] = useState<number | null>(null);

  // ==========================================
  // LOAD CONVERSATIONS FROM DATABASE
  // ==========================================

  useEffect(() => {
    if (!currentUser) return;

    async function loadConversations() {
      try {
        const response = await fetch(
          `http://localhost:3000/api/conversations?userId=${currentUser?.id || 1}`
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
        } else {
          // If user has no conversations, create the first one automatically!
          createNewChat();
        }
      } catch (error) {
        console.error(
          "Failed to load conversations:",
          error
        );
      }
    }

    loadConversations();
  }, [currentUser?.id]);
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
          body: JSON.stringify({ userId: currentUser?.id || 1 }),
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
  // RENAME CHAT
  // ==========================================

  async function renameChat(chatId: number) {
    const currentChat = chats.find((chat) => chat.id === chatId);
    const newTitle = prompt("Enter new chat title:", currentChat?.title || "");
    if (!newTitle || newTitle.trim() === "" || newTitle === currentChat?.title) {
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:3000/api/conversations/${chatId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title: newTitle.trim() }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to rename conversation");
      }

      setChats((previousChats) =>
        previousChats.map((chat) =>
          chat.id === chatId
            ? { ...chat, title: newTitle.trim() }
            : chat
        )
      );
    } catch (error) {
      console.error("Rename chat error:", error);
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
  if (isLoading) return;

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

  let currentChatId: number;

  // If user has no active conversation, create one right now!
  if (activeChatId === null) {
    try {
      const convRes = await fetch("http://localhost:3000/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser?.id || 1 }),
      });
      const convData = await convRes.json();
      currentChatId = Number(convData.conversation.id);

      const newChat: Chat = {
        id: currentChatId,
        title: currentMessage.length > 25 ? currentMessage.substring(0, 25) + "..." : currentMessage,
        messages: [userMessage],
      };

      setChats((prev) => [newChat, ...prev]);
      setActiveChatId(currentChatId);
    } catch (err) {
      console.error("Failed to create new conversation:", err);
      setIsLoading(false);
      return;
    }
  } else {
    currentChatId = activeChatId;
    // ==========================================
    // UPDATE UI WITH USER MESSAGE
    // ==========================================
    setChats((previousChats) =>
      previousChats.map((chat) => {
        if (chat.id !== currentChatId) {
          return chat;
        }

        const updatedTitle =
          chat.messages.length === 0
            ? currentMessage.length > 25
              ? currentMessage.substring(0, 25) + "..."
              : currentMessage
            : chat.title;

        return {
          ...chat,
          title: updatedTitle,
          messages: [...chat.messages, userMessage],
        };
      })
    );
  }

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
          conversationId: currentChatId,
          role: "user",
        }),
      }
    );

    if (!messageResponse.ok) {
      throw new Error("Failed to save user message");
    }
  } catch (error) {
    console.error("User message save error:", error);
    setIsLoading(false);
    return;
  }

  // ==========================================
  // CONVERT MESSAGES TO GROQ FORMAT
  // ==========================================

  try {
    const currentChat = chats.find((chat) => chat.id === currentChatId);
    const existingMessages = currentChat?.messages || [];
    const allMessages = [...existingMessages, userMessage];

    const groqMessages = allMessages.map((msg) => ({
      role: msg.sender === "user" ? "user" : "assistant",
      content: msg.text,
    }));

    console.log("Sending to backend:", groqMessages);
    console.log("SENDING CONVERSATION ID:", currentChatId);

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
          conversationId: currentChatId,
          documentId: activeDocumentId || undefined,
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Backend request failed");
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
        if (chat.id !== currentChatId) {
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

  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} darkMode={darkMode} />;
  }

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


        {/* New Chat Button */}

        <button
          className="new-chat-button"
          onClick={createNewChat}
        >

          <span className="plus">
            +
          </span>

          <span>
            New Chat
          </span>

        </button>


        {/* Chat History List */}

        <div className="chat-list">

          {chats.map((chat) => (

            <div
              key={chat.id}
              className={
                chat.id === activeChatId
                  ? "chat-item active"
                  : "chat-item"
              }
              onClick={() =>
                setActiveChatId(chat.id)
              }
            >

              <span className="chat-item-icon">
                💬
              </span>

              {/* Chat Title */}

              <span className="chat-item-title">
                {chat.title}
              </span>


              {/* Rename button */}

              <button
                className="rename-chat"

                onClick={(event) => {
                  event.stopPropagation();

                  renameChat(chat.id);
                }}

                title="Rename chat"

                aria-label="Rename chat"
              >

                ✏️

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

          {/* User Profile & Logout */}
          <div className="user-profile" style={{
            marginTop: '12px', 
            padding: '10px 12px', 
            background: darkMode ? '#2a2b32' : '#f0f2f5',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            border: darkMode ? '1px solid #3d3e48' : '1px solid #e1e4ea'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
              <div className="user-avatar" style={{
                width: '32px', 
                height: '32px', 
                fontSize: '14px', 
                fontWeight: 'bold',
                background: '#10a37f',
                color: '#fff',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {(currentUser?.name || currentUser?.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <span style={{
                  fontSize: '13px', 
                  fontWeight: '600', 
                  color: darkMode ? '#f0f0f0' : '#222',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {currentUser?.name || currentUser?.email?.split('@')[0] || 'User'}
                </span>
                <span style={{
                  fontSize: '11px', 
                  color: darkMode ? '#8e8ea0' : '#71767b',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {currentUser?.email}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Log out"
              aria-label="Log out"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '6px',
                borderRadius: '6px',
                color: darkMode ? '#c5c5d2' : '#6e6e80',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s, color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = darkMode ? '#3e3f4b' : '#e4e6ea';
                e.currentTarget.style.color = '#ff5c5c';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = darkMode ? '#c5c5d2' : '#6e6e80';
              }}
            >
              🚪
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