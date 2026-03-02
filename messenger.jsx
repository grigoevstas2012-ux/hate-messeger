import { useState, useEffect, useRef, useCallback } from "react";

// ============================================================
// CRYPTO ENGINE (Web Crypto API — AES-256-GCM + ECDH)
// ============================================================
const CryptoEngine = {
  async generateKeyPair() {
    return await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey"]
    );
  },
  async deriveSharedKey(privateKey, publicKey) {
    return await crypto.subtle.deriveKey(
      { name: "ECDH", public: publicKey },
      privateKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  },
  async encrypt(key, plaintext) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
    return { iv: Array.from(iv), ciphertext: Array.from(new Uint8Array(ciphertext)) };
  },
  async decrypt(key, { iv, ciphertext }) {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(iv) },
      key,
      new Uint8Array(ciphertext)
    );
    return new TextDecoder().decode(decrypted);
  },
};

// ============================================================
// MOCK DATA
// ============================================================
const USERS = {
  me: { id: "me", name: "You", username: "@you", avatar: "🧑", online: true, color: "#2196F3" },
  alice: { id: "alice", name: "Alice Morgan", username: "@alice", avatar: "👩", online: true, lastSeen: "online", color: "#E91E63" },
  bob: { id: "bob", name: "Bob Chen", username: "@bob", avatar: "👨", online: false, lastSeen: "last seen 2h ago", color: "#4CAF50" },
  carol: { id: "carol", name: "Carol White", username: "@carol", avatar: "👱‍♀️", online: true, lastSeen: "online", color: "#FF9800" },
  devgroup: { id: "devgroup", name: "Dev Team 🚀", username: "@devteam", avatar: "💻", isGroup: true, members: 12, color: "#9C27B0" },
  news: { id: "news", name: "Tech News", username: "@technews", avatar: "📰", isChannel: true, subscribers: "2.4K", color: "#00BCD4" },
  cryptobot: { id: "cryptobot", name: "CryptoBot", username: "@cryptobot", avatar: "🤖", isBot: true, color: "#607D8B" },
};

const INITIAL_MESSAGES = {
  alice: [
    { id: 1, from: "alice", text: "Hey! Did you see the new React 19 features? 🔥", time: "09:14", status: "read", reactions: [{ emoji: "🔥", count: 2 }] },
    { id: 2, from: "me", text: "Yes! Server components are a game changer. The new hooks too.", time: "09:15", status: "read" },
    { id: 3, from: "alice", text: "Totally agree. Are you using it in production yet?", time: "09:16", status: "read" },
    { id: 4, from: "me", text: "Not yet, still testing. But the DX improvements are huge.", time: "09:17", status: "read" },
    { id: 5, from: "alice", text: "Same here. Let me know how it goes! 👍", time: "09:20", status: "read", reactions: [{ emoji: "👍", count: 1 }] },
  ],
  bob: [
    { id: 1, from: "bob", text: "Can you review my PR when you get a chance?", time: "Yesterday", status: "read" },
    { id: 2, from: "me", text: "Sure, I'll take a look after lunch!", time: "Yesterday", status: "read" },
    { id: 3, from: "bob", text: "Thanks! No rush 🙏", time: "Yesterday", status: "read" },
  ],
  carol: [
    { id: 1, from: "carol", text: "Meeting at 3pm today, don't forget!", time: "10:00", status: "read" },
    { id: 2, from: "me", text: "Got it, I'll be there!", time: "10:02", status: "read" },
  ],
  devgroup: [
    { id: 1, from: "alice", text: "Stand-up in 5 minutes everyone!", time: "09:55", status: "read" },
    { id: 2, from: "bob", text: "Be right there 🏃", time: "09:56", status: "read" },
    { id: 3, from: "carol", text: "Joining now", time: "09:57", status: "read" },
    { id: 4, from: "me", text: "On my way!", time: "09:58", status: "read" },
  ],
  news: [
    { id: 1, from: "news", text: "🚀 OpenAI releases GPT-5 with unprecedented reasoning capabilities", time: "08:00", status: "read", views: 1204 },
    { id: 2, from: "news", text: "📱 Apple announces Vision Pro 2 with major performance upgrades", time: "10:30", status: "read", views: 3421 },
    { id: 3, from: "news", text: "💻 Linux kernel 7.0 released with revolutionary scheduler changes", time: "12:00", status: "read", views: 892 },
  ],
  cryptobot: [
    { id: 1, from: "cryptobot", text: "👋 Hello! I'm CryptoBot. I can help you with:\n• /price <symbol> — get crypto price\n• /chart <symbol> — show price chart\n• /alert <symbol> <price> — set price alert", time: "08:00", status: "read" },
  ],
};

const CHAT_LIST = [
  { id: "alice", unread: 0, pinned: true, typing: false },
  { id: "devgroup", unread: 3, pinned: true, typing: true },
  { id: "carol", unread: 0, pinned: false, typing: false },
  { id: "news", unread: 1, pinned: false, typing: false },
  { id: "bob", unread: 0, pinned: false, typing: false },
  { id: "cryptobot", unread: 0, pinned: false, typing: false },
];

const EMOJI_LIST = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👏", "🤔", "😍"];

// ============================================================
// MAIN APP
// ============================================================
export default function TelegramApp() {
  const [theme, setTheme] = useState("dark");
  const [activeChat, setActiveChat] = useState("alice");
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [chatList, setChatList] = useState(CHAT_LIST);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [editMsg, setEditMsg] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [emojiPicker, setEmojiPicker] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [forwardMsg, setForwardMsg] = useState(null);
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [encryptedChats, setEncryptedChats] = useState(new Set(["alice"]));
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [attachMenu, setAttachMenu] = useState(false);
  const [notif, setNotif] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const isDark = theme === "dark";

  const colors = isDark ? {
    bg: "#0e1621", sidebar: "#17212b", chatBg: "#0e1621",
    msgIn: "#182533", msgOut: "#2b5278", accent: "#5288c1",
    text: "#e8e8e8", subtext: "#7d8e9e", border: "#0d1823",
    hover: "#1f2d3d", input: "#17212b", inputBorder: "#2a3a4a",
    header: "#17212b", topBar: "#17212b", pin: "#1f2e40",
    bubble: "#2b5278", unread: "#5288c1",
  } : {
    bg: "#f0f2f5", sidebar: "#ffffff", chatBg: "#dfe3ea",
    msgIn: "#ffffff", msgOut: "#d9f0ff", accent: "#2481cc",
    text: "#000000", subtext: "#707579", border: "#dae0e6",
    hover: "#f0f2f5", input: "#ffffff", inputBorder: "#dae0e6",
    header: "#ffffff", topBar: "#ffffff", pin: "#f0f7ff",
    bubble: "#d9f0ff", unread: "#2481cc",
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeChat]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") { setContextMenu(null); setEmojiPicker(null); setReplyTo(null); setEditMsg(null); setAttachMenu(false); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Auto bot reply
  useEffect(() => {
    if (!activeChat) return;
    const lastMsg = messages[activeChat]?.slice(-1)[0];
    if (!lastMsg || lastMsg.from !== "me") return;

    const user = USERS[activeChat];
    if (!user?.isBot && !user?.isChannel) {
      if (Math.random() > 0.6) {
        const typing = setTimeout(() => {
          setChatList(cl => cl.map(c => c.id === activeChat ? { ...c, typing: true } : c));
          setTimeout(() => {
            setChatList(cl => cl.map(c => c.id === activeChat ? { ...c, typing: false } : c));
            const replies = [
              "Got it! 👍", "That's interesting...", "Let me think about that 🤔",
              "Sure, sounds good!", "Okay, I'll check it out 🔍", "Thanks for the update!",
              "Agreed! 💯", "Nice idea!", "Will do 🙌", "Perfect, thanks!",
            ];
            const reply = replies[Math.floor(Math.random() * replies.length)];
            addMessage(activeChat, { from: activeChat, text: reply, time: getCurrentTime(), status: "read" });
          }, 1500);
        }, 800);
        return () => clearTimeout(typing);
      }
    }
  }, [messages[activeChat]?.length]);

  const getCurrentTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  };

  const addMessage = (chatId, msg) => {
    setMessages(prev => ({
      ...prev,
      [chatId]: [...(prev[chatId] || []), { ...msg, id: Date.now() + Math.random() }]
    }));
  };

  const showNotif = (text) => {
    setNotif(text);
    setTimeout(() => setNotif(null), 2500);
  };

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;

    if (editMsg) {
      setMessages(prev => ({
        ...prev,
        [activeChat]: prev[activeChat].map(m =>
          m.id === editMsg.id ? { ...m, text, edited: true } : m
        )
      }));
      setEditMsg(null);
    } else {
      const msg = {
        id: Date.now(),
        from: "me",
        text,
        time: getCurrentTime(),
        status: "sent",
        replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, from: replyTo.from } : null,
        encrypted: encryptedChats.has(activeChat),
      };
      addMessage(activeChat, msg);
      setChatList(cl => cl.map(c => c.id === activeChat ? { ...c, unread: 0 } : c));
      setTimeout(() => {
        setMessages(prev => ({
          ...prev,
          [activeChat]: prev[activeChat].map(m => m.id === msg.id ? { ...m, status: "delivered" } : m)
        }));
        setTimeout(() => {
          setMessages(prev => ({
            ...prev,
            [activeChat]: prev[activeChat].map(m => m.id === msg.id ? { ...m, status: "read" } : m)
          }));
        }, 600);
      }, 400);
    }
    setInput("");
    setReplyTo(null);
    inputRef.current?.focus();
  };

  const deleteMessage = (msgId) => {
    setMessages(prev => ({
      ...prev,
      [activeChat]: prev[activeChat].filter(m => m.id !== msgId)
    }));
    setContextMenu(null);
    showNotif("Message deleted");
  };

  const addReaction = (msgId, emoji) => {
    setMessages(prev => ({
      ...prev,
      [activeChat]: prev[activeChat].map(m => {
        if (m.id !== msgId) return m;
        const reactions = m.reactions ? [...m.reactions] : [];
        const idx = reactions.findIndex(r => r.emoji === emoji);
        if (idx >= 0) {
          reactions[idx] = { ...reactions[idx], count: reactions[idx].count + 1 };
        } else {
          reactions.push({ emoji, count: 1 });
        }
        return { ...m, reactions };
      })
    }));
    setEmojiPicker(null);
  };

  const togglePin = (chatId) => {
    setChatList(cl => cl.map(c => c.id === chatId ? { ...c, pinned: !c.pinned } : c));
    showNotif("Chat pinned");
  };

  const sortedChats = [...chatList]
    .filter(c => {
      if (!search) return true;
      const u = USERS[c.id];
      return u?.name?.toLowerCase().includes(search.toLowerCase());
    })
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  const activeMsgs = messages[activeChat] || [];
  const activeUser = USERS[activeChat];
  const isTyping = chatList.find(c => c.id === activeChat)?.typing;

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    const msg = {
      id: Date.now(),
      from: "me",
      text: isImage ? "" : file.name,
      time: getCurrentTime(),
      status: "sent",
      file: { name: file.name, type: file.type, size: file.size, url: URL.createObjectURL(file), isImage },
    };
    addMessage(activeChat, msg);
    setAttachMenu(false);
  };

  const s = {
    app: {
      display: "flex", height: "100vh", width: "100%", fontFamily: "'Segoe UI', system-ui, sans-serif",
      background: colors.bg, color: colors.text, overflow: "hidden", position: "relative",
    },
    sidebar: {
      width: sidebarOpen ? 360 : 0, minWidth: sidebarOpen ? 360 : 0,
      background: colors.sidebar, borderRight: `1px solid ${colors.border}`,
      display: "flex", flexDirection: "column", transition: "width 0.3s ease",
      overflow: "hidden",
    },
    sidebarHeader: {
      padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
      borderBottom: `1px solid ${colors.border}`, background: colors.header,
    },
    searchBox: {
      padding: "8px 16px", borderBottom: `1px solid ${colors.border}`,
    },
    searchInput: {
      width: "100%", padding: "8px 14px 8px 36px", borderRadius: 22,
      border: `1px solid ${colors.inputBorder}`, background: isDark ? "#1f2d3d" : "#f0f2f5",
      color: colors.text, fontSize: 14, outline: "none", boxSizing: "border-box",
    },
    chatItem: (active, pinned) => ({
      display: "flex", alignItems: "center", padding: "10px 16px", gap: 12, cursor: "pointer",
      background: active ? (isDark ? "#2b5278" : "#d4e8f5") : (pinned ? colors.pin : "transparent"),
      transition: "background 0.15s", borderRadius: 0,
    }),
    avatar: (color) => ({
      width: 50, height: 50, borderRadius: "50%", background: color,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 22, flexShrink: 0, position: "relative",
    }),
    onlineDot: {
      position: "absolute", bottom: 2, right: 2, width: 12, height: 12,
      borderRadius: "50%", background: "#4dcd5e", border: `2px solid ${colors.sidebar}`,
    },
    chatArea: {
      flex: 1, display: "flex", flexDirection: "column", background: colors.chatBg,
      backgroundImage: isDark
        ? "radial-gradient(circle at 20% 50%, #0d2137 0%, transparent 50%), radial-gradient(circle at 80% 20%, #0a1a2e 0%, transparent 50%)"
        : "radial-gradient(circle at 20% 50%, #d6e8f8 0%, transparent 50%), radial-gradient(circle at 80% 20%, #e8f4fc 0%, transparent 50%)",
      position: "relative",
    },
    topBar: {
      padding: "0 16px", height: 56, display: "flex", alignItems: "center",
      justifyContent: "space-between", background: colors.topBar,
      borderBottom: `1px solid ${colors.border}`, flexShrink: 0, backdropFilter: "blur(10px)",
    },
    messagesArea: {
      flex: 1, overflowY: "auto", padding: "16px 10%",
      scrollbarWidth: "thin", scrollbarColor: `${colors.accent}40 transparent`,
    },
    msgWrapper: (isMe) => ({
      display: "flex", justifyContent: isMe ? "flex-end" : "flex-start",
      marginBottom: 4, position: "relative", animation: "msgIn 0.2s ease",
    }),
    msgBubble: (isMe, isChannel) => ({
      maxWidth: "68%", padding: "8px 12px", borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
      background: isMe ? colors.msgOut : (isChannel ? colors.header : colors.msgIn),
      position: "relative", wordBreak: "break-word", fontSize: 14.5, lineHeight: 1.5,
      boxShadow: "0 1px 3px rgba(0,0,0,0.15)", transition: "transform 0.1s",
    }),
    inputArea: {
      padding: "10px 16px", background: colors.input,
      borderTop: `1px solid ${colors.border}`, flexShrink: 0,
    },
    inputRow: {
      display: "flex", alignItems: "flex-end", gap: 10, position: "relative",
    },
    textInput: {
      flex: 1, padding: "10px 14px", borderRadius: 22,
      border: `1px solid ${colors.inputBorder}`, background: isDark ? "#1f2d3d" : "#f8f9fa",
      color: colors.text, fontSize: 15, outline: "none", resize: "none", maxHeight: 120,
      fontFamily: "inherit", lineHeight: 1.5,
    },
    sendBtn: {
      width: 44, height: 44, borderRadius: "50%", background: colors.accent,
      border: "none", cursor: "pointer", display: "flex", alignItems: "center",
      justifyContent: "center", color: "#fff", flexShrink: 0, transition: "transform 0.15s, background 0.15s",
    },
    iconBtn: {
      background: "none", border: "none", cursor: "pointer",
      color: colors.subtext, padding: 8, borderRadius: "50%",
      transition: "color 0.15s, background 0.15s", display: "flex", alignItems: "center",
    },
    ctxMenu: {
      position: "fixed", background: isDark ? "#232e3c" : "#fff",
      borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.3)", zIndex: 1000,
      padding: "6px 0", minWidth: 180, overflow: "hidden",
    },
    ctxItem: {
      padding: "10px 18px", cursor: "pointer", fontSize: 14, display: "flex",
      alignItems: "center", gap: 10, transition: "background 0.1s", color: colors.text,
    },
    statusTick: (status) => ({
      fontSize: 11, color: status === "read" ? "#5288c1" : colors.subtext, marginLeft: 4,
    }),
  };

  return (
    <div style={s.app} onClick={() => { setContextMenu(null); setEmojiPicker(null); setAttachMenu(false); }}>
      <style>{`
        @keyframes msgIn { from { opacity: 0; transform: translateY(8px) scale(0.97); } to { opacity: 1; transform: none; } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: none; } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: #5288c140; border-radius: 4px; }
        .chat-item:hover { background: ${isDark ? "#1f2d3d" : "#f0f2f5"} !important; }
        .chat-item.active:hover { background: ${isDark ? "#2b5278" : "#d4e8f5"} !important; }
        .icon-btn:hover { background: ${isDark ? "#1f2d3d" : "#f0f2f5"} !important; color: ${colors.text} !important; }
        .ctx-item:hover { background: ${isDark ? "#1f2d3d" : "#f0f2f5"} !important; }
        .send-btn:hover { transform: scale(1.08) !important; background: ${isDark ? "#6699cc" : "#1a6fb5"} !important; }
        .msg-bubble:hover .msg-actions { opacity: 1 !important; }
        .msg-actions { opacity: 0; transition: opacity 0.2s; }
        textarea { scrollbar-width: thin; }
        .typing-dot { width: 6px; height: 6px; border-radius: 50%; background: ${colors.subtext}; animation: pulse 1.2s infinite; display: inline-block; }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; } .typing-dot:nth-child(3) { animation-delay: 0.4s; }
      `}</style>

      {/* Notification */}
      {notif && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: isDark ? "#232e3c" : "#fff", color: colors.text, padding: "10px 20px", borderRadius: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.3)", zIndex: 2000, animation: "msgIn 0.3s ease", fontSize: 13 }}>
          {notif}
        </div>
      )}

      {/* SIDEBAR */}
      <div style={s.sidebar}>
        {/* Header */}
        <div style={s.sidebarHeader}>
          <button className="icon-btn" style={s.iconBtn}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
          </button>
          <span style={{ fontSize: 17, fontWeight: 600, flex: 1 }}>Telegram</span>
          <button className="icon-btn" style={s.iconBtn} onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} title="Toggle theme">
            {isDark ? "☀️" : "🌙"}
          </button>
        </div>

        {/* Search */}
        <div style={s.searchBox}>
          <div style={{ position: "relative" }}>
            <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: colors.subtext }} width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
            <input style={s.searchInput} placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Chat List */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {sortedChats.map(chat => {
            const user = USERS[chat.id];
            const msgs = messages[chat.id] || [];
            const lastMsg = msgs[msgs.length - 1];
            const isActive = activeChat === chat.id;
            const chatTyping = chat.typing;

            return (
              <div key={chat.id} className={`chat-item${isActive ? " active" : ""}`}
                style={s.chatItem(isActive, chat.pinned)}
                onClick={() => { setActiveChat(chat.id); setChatList(cl => cl.map(c => c.id === chat.id ? { ...c, unread: 0 } : c)); setShowInfo(false); }}>
                <div style={s.avatar(user.color)}>
                  <span>{user.avatar}</span>
                  {user.online && !user.isGroup && !user.isChannel && !user.isBot && <div style={s.onlineDot} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
                      {chat.pinned && <span style={{ marginRight: 4, fontSize: 12 }}>📌</span>}
                      {user.isChannel && <span style={{ marginRight: 4 }}>📢</span>}
                      {user.isBot && <span style={{ marginRight: 4 }}>🤖</span>}
                      {user.name}
                    </span>
                    <span style={{ fontSize: 11, color: colors.subtext, flexShrink: 0 }}>{lastMsg?.time || ""}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: colors.subtext, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
                      {chatTyping ? <span style={{ color: colors.accent }}>typing...</span> :
                        lastMsg?.file?.isImage ? "📷 Photo" :
                        lastMsg?.file ? `📎 ${lastMsg.file.name}` :
                        lastMsg?.from === "me" ? `You: ${lastMsg.text}` : lastMsg?.text || ""}
                    </span>
                    {chat.unread > 0 && (
                      <span style={{ background: colors.unread, color: "#fff", borderRadius: 12, padding: "1px 7px", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{chat.unread}</span>
                    )}
                    {encryptedChats.has(chat.id) && <span title="Secret chat" style={{ fontSize: 11, color: "#4dcd5e", flexShrink: 0 }}>🔒</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CHAT AREA */}
      <div style={s.chatArea} onClick={e => e.stopPropagation()}>
        {/* Top Bar */}
        <div style={s.topBar}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => setShowInfo(si => !si)}>
            <button className="icon-btn" style={s.iconBtn} onClick={e => { e.stopPropagation(); setSidebarOpen(o => !o); }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
            </button>
            <div style={s.avatar(activeUser.color)}>
              {activeUser.avatar}
              {activeUser.online && !activeUser.isGroup && !activeUser.isChannel && <div style={s.onlineDot} />}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
                {activeUser.name}
                {encryptedChats.has(activeChat) && <span style={{ color: "#4dcd5e", fontSize: 12 }}>🔒</span>}
              </div>
              <div style={{ fontSize: 12, color: colors.subtext }}>
                {isTyping ? <span style={{ color: colors.accent }}>typing...</span> :
                  activeUser.isGroup ? `${activeUser.members} members` :
                  activeUser.isChannel ? `${activeUser.subscribers} subscribers` :
                  activeUser.isBot ? "bot" :
                  activeUser.online ? "online" : activeUser.lastSeen}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button className="icon-btn" style={s.iconBtn} title="Search" onClick={() => showNotif("Search in chat")}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
            </button>
            <button className="icon-btn" style={s.iconBtn} title={encryptedChats.has(activeChat) ? "Disable E2E" : "Enable E2E encryption"}
              onClick={() => {
                setEncryptedChats(ec => { const s = new Set(ec); s.has(activeChat) ? s.delete(activeChat) : s.add(activeChat); return s; });
                showNotif(encryptedChats.has(activeChat) ? "Encryption disabled" : "🔒 End-to-end encryption enabled");
              }}>
              {encryptedChats.has(activeChat) ? "🔒" : "🔓"}
            </button>
            <button className="icon-btn" style={s.iconBtn} onClick={() => togglePin(activeChat)} title="Pin chat">📌</button>
            <button className="icon-btn" style={s.iconBtn} onClick={() => setShowInfo(si => !si)} title="Info">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div style={s.messagesArea} onClick={() => setContextMenu(null)}>
          {activeMsgs.map((msg, idx) => {
            const isMe = msg.from === "me";
            const sender = USERS[msg.from];
            const showAvatar = !isMe && (idx === 0 || activeMsgs[idx - 1].from !== msg.from);
            const showName = !isMe && (activeUser.isGroup) && showAvatar;

            return (
              <div key={msg.id} style={s.msgWrapper(isMe)}
                onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, msg }); }}
              >
                {!isMe && activeUser.isGroup && (
                  <div style={{ width: 32, marginRight: 6, alignSelf: "flex-end" }}>
                    {showAvatar && <div style={{ ...s.avatar(sender?.color), width: 32, height: 32, fontSize: 16 }}>{sender?.avatar}</div>}
                  </div>
                )}
                <div style={{ position: "relative", maxWidth: "68%" }}>
                  {/* Reply preview */}
                  {msg.replyTo && (
                    <div style={{ background: isDark ? "#1a2a3a" : "#e0f0ff", borderLeft: `3px solid ${colors.accent}`, borderRadius: "4px 4px 0 0", padding: "4px 10px", fontSize: 12, color: colors.subtext, marginBottom: -2 }}>
                      <span style={{ color: colors.accent, fontWeight: 600 }}>{msg.replyTo.from === "me" ? "You" : USERS[msg.replyTo.from]?.name || msg.replyTo.from}</span>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{msg.replyTo.text}</div>
                    </div>
                  )}
                  <div className="msg-bubble" style={s.msgBubble(isMe, activeUser.isChannel)}>
                    {showName && <div style={{ color: sender?.color || colors.accent, fontWeight: 600, fontSize: 12, marginBottom: 3 }}>{sender?.name}</div>}
                    
                    {/* File/Image */}
                    {msg.file?.isImage && (
                      <img src={msg.file.url} alt="photo" style={{ maxWidth: 280, maxHeight: 300, borderRadius: 8, display: "block", marginBottom: 4 }} />
                    )}
                    {msg.file && !msg.file.isImage && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, background: isDark ? "#1a2a3a" : "#eaf4ff", borderRadius: 8, padding: "8px 12px", marginBottom: 4 }}>
                        <span style={{ fontSize: 24 }}>📎</span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{msg.file.name}</div>
                          <div style={{ fontSize: 11, color: colors.subtext }}>{(msg.file.size / 1024).toFixed(1)} KB</div>
                        </div>
                      </div>
                    )}
                    
                    {/* Text */}
                    {msg.text && <span style={{ whiteSpace: "pre-wrap" }}>{msg.text}</span>}
                    
                    {/* Metadata */}
                    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4, marginTop: 3 }}>
                      {msg.encrypted && <span title="Encrypted" style={{ fontSize: 9, color: "#4dcd5e" }}>🔒</span>}
                      {msg.edited && <span style={{ fontSize: 10, color: colors.subtext }}>edited</span>}
                      {msg.views && <span style={{ fontSize: 10, color: colors.subtext }}>👁 {msg.views}</span>}
                      <span style={{ fontSize: 11, color: colors.subtext }}>{msg.time}</span>
                      {isMe && (
                        <span style={s.statusTick(msg.status)}>
                          {msg.status === "sent" ? "✓" : msg.status === "delivered" ? "✓✓" : "✓✓"}
                        </span>
                      )}
                    </div>

                    {/* Reactions */}
                    {msg.reactions?.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                        {msg.reactions.map((r, i) => (
                          <span key={i} onClick={() => addReaction(msg.id, r.emoji)}
                            style={{ background: isDark ? "#1a2a3a" : "#e0f0ff", borderRadius: 12, padding: "2px 7px", fontSize: 13, cursor: "pointer", userSelect: "none" }}>
                            {r.emoji} {r.count}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Hover actions */}
                    <div className="msg-actions" style={{ position: "absolute", top: -28, [isMe ? "left" : "right"]: 0, display: "flex", gap: 4 }}>
                      <button onClick={e => { e.stopPropagation(); setEmojiPicker(emojiPicker === msg.id ? null : msg.id); }}
                        style={{ background: isDark ? "#232e3c" : "#fff", border: "none", borderRadius: 16, padding: "4px 8px", cursor: "pointer", fontSize: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
                        😊
                      </button>
                      <button onClick={() => setReplyTo(msg)}
                        style={{ background: isDark ? "#232e3c" : "#fff", border: "none", borderRadius: 16, padding: "4px 8px", cursor: "pointer", fontSize: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
                        ↩️
                      </button>
                    </div>

                    {/* Emoji picker */}
                    {emojiPicker === msg.id && (
                      <div onClick={e => e.stopPropagation()}
                        style={{ position: "absolute", [isMe ? "right" : "left"]: 0, bottom: "100%", marginBottom: 8, background: isDark ? "#232e3c" : "#fff", borderRadius: 12, padding: 8, display: "flex", gap: 6, boxShadow: "0 4px 20px rgba(0,0,0,0.3)", zIndex: 100 }}>
                        {EMOJI_LIST.map(em => (
                          <button key={em} onClick={() => addReaction(msg.id, em)}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, borderRadius: 8, padding: 4, transition: "transform 0.1s" }}
                            onMouseEnter={e => e.target.style.transform = "scale(1.3)"}
                            onMouseLeave={e => e.target.style.transform = "scale(1)"}>
                            {em}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {isTyping && (
            <div style={s.msgWrapper(false)}>
              <div style={{ ...s.msgBubble(false), padding: "10px 16px", display: "flex", gap: 5, alignItems: "center" }}>
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply bar */}
        {replyTo && (
          <div style={{ padding: "8px 16px", background: isDark ? "#17212b" : "#f8f9fa", borderTop: `1px solid ${colors.border}`, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, borderLeft: `3px solid ${colors.accent}`, paddingLeft: 10 }}>
              <div style={{ color: colors.accent, fontWeight: 600, fontSize: 12 }}>{replyTo.from === "me" ? "You" : USERS[replyTo.from]?.name}</div>
              <div style={{ fontSize: 13, color: colors.subtext, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{replyTo.text}</div>
            </div>
            <button className="icon-btn" style={s.iconBtn} onClick={() => setReplyTo(null)}>✕</button>
          </div>
        )}

        {/* Edit bar */}
        {editMsg && (
          <div style={{ padding: "8px 16px", background: isDark ? "#17212b" : "#f8f9fa", borderTop: `1px solid ${colors.border}`, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, borderLeft: `3px solid #ff9800`, paddingLeft: 10 }}>
              <div style={{ color: "#ff9800", fontWeight: 600, fontSize: 12 }}>✏️ Edit message</div>
              <div style={{ fontSize: 13, color: colors.subtext, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{editMsg.text}</div>
            </div>
            <button className="icon-btn" style={s.iconBtn} onClick={() => { setEditMsg(null); setInput(""); }}>✕</button>
          </div>
        )}

        {/* Input Area */}
        {!activeUser.isChannel && (
          <div style={s.inputArea} onClick={e => e.stopPropagation()}>
            <div style={s.inputRow}>
              <div style={{ position: "relative" }}>
                <button className="icon-btn" style={s.iconBtn} onClick={e => { e.stopPropagation(); setAttachMenu(a => !a); }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>
                </button>
                {attachMenu && (
                  <div onClick={e => e.stopPropagation()}
                    style={{ position: "absolute", bottom: "calc(100% + 8px)", left: 0, background: isDark ? "#232e3c" : "#fff", borderRadius: 12, padding: "6px 0", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", minWidth: 160, zIndex: 200 }}>
                    {[
                      { icon: "📷", label: "Photo/Video", accept: "image/*,video/*" },
                      { icon: "📎", label: "File", accept: "*" },
                    ].map(a => (
                      <div key={a.label} className="ctx-item" style={s.ctxItem}
                        onClick={() => { fileInputRef.current.accept = a.accept; fileInputRef.current.click(); }}>
                        <span>{a.icon}</span><span>{a.label}</span>
                      </div>
                    ))}
                    <div className="ctx-item" style={s.ctxItem} onClick={() => { showNotif("🎤 Voice recording started..."); setAttachMenu(false); }}>
                      <span>🎤</span><span>Voice Message</span>
                    </div>
                    <div className="ctx-item" style={s.ctxItem} onClick={() => { showNotif("📍 Location sharing — not supported in demo"); setAttachMenu(false); }}>
                      <span>📍</span><span>Location</span>
                    </div>
                  </div>
                )}
              </div>

              <textarea
                ref={inputRef}
                style={s.textInput}
                placeholder={`Message ${activeUser.isBot ? activeUser.name : ""}`}
                value={input}
                rows={1}
                onChange={e => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                }}
              />

              <button className="send-btn" style={s.sendBtn} onClick={sendMessage}>
                {input.trim() ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 15 6.7 12H5c0 3.42 2.72 6.23 6 6.72V21h2v-2.28c3.28-.49 6-3.3 6-6.72h-1.7z"/></svg>
                )}
              </button>
            </div>
          </div>
        )}
        {activeUser.isChannel && (
          <div style={{ ...s.inputArea, textAlign: "center", color: colors.subtext, fontSize: 13 }}>
            You can only view messages in this channel
          </div>
        )}
      </div>

      {/* INFO PANEL */}
      {showInfo && (
        <div style={{ width: 280, background: colors.sidebar, borderLeft: `1px solid ${colors.border}`, display: "flex", flexDirection: "column", animation: "slideIn 0.2s ease" }}>
          <div style={{ padding: "16px", borderBottom: `1px solid ${colors.border}`, display: "flex", alignItems: "center", gap: 12 }}>
            <button className="icon-btn" style={s.iconBtn} onClick={() => setShowInfo(false)}>✕</button>
            <span style={{ fontWeight: 600 }}>Info</span>
          </div>
          <div style={{ padding: 24, textAlign: "center" }}>
            <div style={{ ...s.avatar(activeUser.color), width: 80, height: 80, fontSize: 36, margin: "0 auto 16px" }}>
              {activeUser.avatar}
            </div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{activeUser.name}</div>
            <div style={{ color: colors.subtext, fontSize: 13, marginTop: 4 }}>
              {activeUser.username}
            </div>
            <div style={{ marginTop: 8, padding: "4px 12px", borderRadius: 12, display: "inline-block", fontSize: 12, fontWeight: 600, background: activeUser.online ? "#4dcd5e22" : colors.hover, color: activeUser.online ? "#4dcd5e" : colors.subtext }}>
              {activeUser.online ? "● online" : activeUser.isGroup ? `👥 ${activeUser.members} members` : activeUser.isChannel ? `📢 ${activeUser.subscribers} subscribers` : "offline"}
            </div>
          </div>
          <div style={{ margin: "0 16px", borderTop: `1px solid ${colors.border}`, paddingTop: 16 }}>
            {[
              { icon: "🔒", label: "Encryption", value: encryptedChats.has(activeChat) ? "E2E Enabled" : "Standard" },
              { icon: "🔔", label: "Notifications", value: "On" },
              { icon: "🚫", label: "Block", value: "" },
            ].map(item => (
              <div key={item.label} className="ctx-item" style={{ ...s.ctxItem, padding: "12px 8px", borderRadius: 8 }}
                onClick={() => item.label === "Encryption" && (setEncryptedChats(ec => { const s = new Set(ec); s.has(activeChat) ? s.delete(activeChat) : s.add(activeChat); return s; }), showNotif("Encryption toggled"))}>
                <span>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                <span style={{ color: colors.subtext, fontSize: 12 }}>{item.value}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: 16, marginTop: "auto", borderTop: `1px solid ${colors.border}` }}>
            <div style={{ fontSize: 11, color: colors.subtext, textAlign: "center", lineHeight: 1.6 }}>
              🔒 Messages in this chat are{" "}
              <strong style={{ color: encryptedChats.has(activeChat) ? "#4dcd5e" : colors.subtext }}>
                {encryptedChats.has(activeChat) ? "end-to-end encrypted" : "standard encrypted"}
              </strong>
              {encryptedChats.has(activeChat) && <><br />Using AES-256-GCM + ECDH P-256</>}
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div onClick={e => e.stopPropagation()} style={{ ...s.ctxMenu, left: Math.min(contextMenu.x, window.innerWidth - 200), top: Math.min(contextMenu.y, window.innerHeight - 250) }}>
          {[
            { icon: "↩️", label: "Reply", action: () => { setReplyTo(contextMenu.msg); setContextMenu(null); } },
            { icon: "✏️", label: "Edit", action: () => { if (contextMenu.msg.from === "me") { setEditMsg(contextMenu.msg); setInput(contextMenu.msg.text); setContextMenu(null); inputRef.current?.focus(); } else showNotif("Can't edit others' messages"); }, disabled: contextMenu.msg.from !== "me" },
            { icon: "📋", label: "Copy", action: () => { navigator.clipboard.writeText(contextMenu.msg.text); setContextMenu(null); showNotif("Copied!"); } },
            { icon: "➡️", label: "Forward", action: () => { setForwardMsg(contextMenu.msg); setShowForwardDialog(true); setContextMenu(null); } },
            { icon: "📌", label: "Pin", action: () => { showNotif("Message pinned"); setContextMenu(null); } },
            { icon: "🗑️", label: "Delete", action: () => deleteMessage(contextMenu.msg.id), danger: true },
          ].map(item => (
            <div key={item.label} className="ctx-item" style={{ ...s.ctxItem, color: item.danger ? "#e53935" : item.disabled ? colors.subtext : colors.text, opacity: item.disabled ? 0.5 : 1 }}
              onClick={item.action}>
              <span>{item.icon}</span><span>{item.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Forward Dialog */}
      {showForwardDialog && forwardMsg && (
        <div onClick={() => setShowForwardDialog(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: isDark ? "#232e3c" : "#fff", borderRadius: 16, padding: 24, width: 340, boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }}>
            <h3 style={{ margin: "0 0 16px", color: colors.text }}>Forward message</h3>
            {Object.values(USERS).filter(u => u.id !== "me").map(u => (
              <div key={u.id} className="chat-item" style={{ ...s.chatItem(false, false), borderRadius: 8, marginBottom: 4 }}
                onClick={() => {
                  addMessage(u.id, { ...forwardMsg, id: Date.now(), from: "me", time: getCurrentTime(), forwarded: true, status: "sent" });
                  setShowForwardDialog(false);
                  showNotif(`Forwarded to ${u.name}`);
                }}>
                <div style={{ ...s.avatar(u.color), width: 36, height: 36, fontSize: 18 }}>{u.avatar}</div>
                <span style={{ fontSize: 14, color: colors.text }}>{u.name}</span>
              </div>
            ))}
            <button onClick={() => setShowForwardDialog(false)}
              style={{ marginTop: 12, width: "100%", padding: "10px", borderRadius: 10, border: "none", background: isDark ? "#1a2a3a" : "#f0f2f5", color: colors.text, cursor: "pointer", fontSize: 14 }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileUpload} />
    </div>
  );
}
