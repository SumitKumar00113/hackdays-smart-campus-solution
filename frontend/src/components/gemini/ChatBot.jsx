import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Send } from "lucide-react";
import { performGeminiAction } from "../../api/geminiAPI";
import useAuth from "../../hooks/useAuth";

/** Renders **bold** and `code` segments; keeps newlines (parent uses pre-wrap). */
function ChatMessageBody({ text }) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`\n]+`)/g).filter((p) => p !== "");
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
          return (
            <code key={i} className="chat-inline-code">
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

const formatStructuredReply = (payload) => {
  if (!payload || typeof payload !== "object") return "";

  if (payload.type === "chat" && payload.data?.reply) {
    return String(payload.data.reply);
  }

  if (payload.type === "attendance" && payload.data) {
    const { summary, records } = payload.data;
    const lines = [
      "**Your attendance (from the database)**",
      summary
        ? `- Present: ${summary.present ?? 0}, absent: ${summary.absent ?? 0}, late: ${summary.late ?? 0} (${summary.attendancePercent ?? 0}% attendance)`
        : "",
      records?.length
        ? `\nRecent rows:\n${records
            .slice(0, 5)
            .map(
              (r) =>
                `• ${r.date ? new Date(r.date).toLocaleDateString() : "?"} — ${r.classroom} — ${r.status}`,
            )
            .join("\n")}`
        : "\n_No records yet — mark attendance on the Attendance page._",
    ];
    return lines.filter(Boolean).join("\n");
  }

  if (payload.type === "booking" && payload.data) {
    const { availableRooms, bookedRooms, date, time } = payload.data;
    return [
      "**Room availability**",
      `Date: ${date ?? "today"}${time ? `, time: ${time}` : ""}`,
      availableRooms?.length
        ? `Open rooms: ${availableRooms.join(", ")}`
        : "No rooms listed as free for that slot.",
      bookedRooms?.length ? `Busy: ${bookedRooms.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (payload.type === "notice" && payload.data?.notices) {
    const list = payload.data.notices;
    if (!list.length) return "No notices found for that filter.";
    return [
      "**Notices**",
      ...list.map(
        (n) =>
          `• **${n.title}** (${n.publishedAt ? new Date(n.publishedAt).toLocaleDateString() : ""})\n  ${String(n.body).slice(0, 160)}${String(n.body).length > 160 ? "…" : ""}`,
      ),
    ].join("\n\n");
  }

  if (payload.data?.reply) return String(payload.data.reply);

  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
};

const EMPTY_HINTS = [
  "What notices are there?",
  "Is there a free classroom at 2pm?",
  "Show my attendance summary",
];

const HISTORY_KEY = "campus_ai_history_v1";
const MAX_CONVERSATIONS = 20;

const createConversation = (seedText = "") => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: seedText.trim() || "New chat",
  updatedAt: Date.now(),
  messages: [],
});

const normalizeConversations = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((c) => c && typeof c === "object" && Array.isArray(c.messages))
    .map((c) => ({
      id: String(c.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      title: String(c.title || "New chat"),
      updatedAt: Number(c.updatedAt) || Date.now(),
      messages: c.messages
        .filter((m) => m && (m.role === "user" || m.role === "assistant"))
        .map((m) => ({ role: m.role, text: String(m.text || "") })),
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_CONVERSATIONS);
};

const historyStorageKey = (userId) => `${HISTORY_KEY}:${userId || "guest"}`;

const ChatBot = () => {
  const { user } = useAuth();
  const userId = user?._id || user?.id;
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    const storageKey = historyStorageKey(userId);
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      const normalized = normalizeConversations(parsed);
      if (normalized.length) {
        setConversations(normalized);
        setActiveId(normalized[0].id);
      } else {
        const fresh = createConversation();
        setConversations([fresh]);
        setActiveId(fresh.id);
      }
    } catch {
      const fresh = createConversation();
      setConversations([fresh]);
      setActiveId(fresh.id);
    }
  }, [userId]);

  useEffect(() => {
    if (!conversations.length) return;
    const storageKey = historyStorageKey(userId);
    try {
      localStorage.setItem(storageKey, JSON.stringify(conversations));
    } catch {
      // Ignore storage failures (private mode / quota).
    }
  }, [conversations, userId]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) || conversations[0] || null,
    [activeId, conversations],
  );
  const messages = activeConversation?.messages || [];
  const hasMessages = messages.length > 0;

  const touchConversation = (id, updater) => {
    setConversations((prev) => {
      const next = prev.map((conv) => {
        if (conv.id !== id) return conv;
        const updated = updater(conv);
        return { ...updated, updatedAt: Date.now() };
      });
      return [...next].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CONVERSATIONS);
    });
  };

  const createNewChat = () => {
    const fresh = createConversation();
    setConversations((prev) => [fresh, ...prev].slice(0, MAX_CONVERSATIONS));
    setActiveId(fresh.id);
    setInput("");
  };

  const send = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading || !activeConversation) return;

    const targetId = activeConversation.id;
    setInput("");
    touchConversation(targetId, (conv) => ({
      ...conv,
      title: conv.messages.length === 0 ? text.slice(0, 42) : conv.title,
      messages: [...conv.messages, { role: "user", text }],
    }));
    setLoading(true);
    try {
      const { data } = await performGeminiAction(text, {
        userId,
        studentId: userId,
      });
      const reply =
        data?.error ||
        formatStructuredReply(data) ||
        "Empty response from server.";
      touchConversation(targetId, (conv) => ({
        ...conv,
        messages: [...conv.messages, { role: "assistant", text: reply }],
      }));
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        "Request failed.";
      touchConversation(targetId, (conv) => ({
        ...conv,
        messages: [...conv.messages, { role: "assistant", text: msg }],
      }));
    } finally {
      setLoading(false);
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({
          top: listRef.current.scrollHeight,
          behavior: "smooth",
        });
      });
    }
  };

  return (
    <div className={`chat-bot ${hasMessages ? "is-thread" : "is-empty"}`}>
      <aside className="chat-history-panel" aria-label="Chat history">
        <button className="chat-new-btn" type="button" onClick={createNewChat}>
          + New chat
        </button>
        <div className="chat-history-list">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              type="button"
              className={`chat-history-item ${conv.id === activeConversation?.id ? "active" : ""}`}
              onClick={() => setActiveId(conv.id)}
            >
              <strong>{conv.title || "New chat"}</strong>
              <span>{new Date(conv.updatedAt).toLocaleString()}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="chat-main">
        <div className="chat-header">
          <div className="chat-header-text">
            <strong className="chat-header-title">Campus AI</strong>
            <span className="chat-header-sub">Gemini + live campus data</span>
          </div>
        </div>

        {hasMessages ? (
          <div className="chat-messages" ref={listRef}>
            {messages.map((msg, i) => (
              <div key={`${i}-${msg.role}`} className={`chat-bubble ${msg.role}`}>
                <div className="chat-text markdown-lite">
                  <ChatMessageBody text={msg.text} />
                </div>
              </div>
            ))}
            {loading ? (
              <div className="chat-bubble assistant chat-bubble--typing" aria-live="polite">
                <span className="chat-typing-dots" aria-hidden>
                  <span />
                  <span />
                  <span />
                </span>
                <span className="chat-typing-label">Thinking…</span>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="chat-empty-state">
            <div className="chat-empty-title-wrap">
              <div className="chat-empty-icon" aria-hidden>
                <Bot size={24} strokeWidth={2} />
              </div>
              <h2 className="chat-empty-title">What are you working on?</h2>
            </div>
            <p className="chat-empty-sub">
              Ask anything about notices, room bookings, attendance, or your campus updates.
            </p>
            <div className="chat-empty-hints" aria-hidden>
              {EMPTY_HINTS.map((hint) => (
                <span key={hint}>{hint}</span>
              ))}
            </div>
          </div>
        )}

        <form className="chat-input-row" onSubmit={send}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything"
            disabled={loading}
            aria-label="Message to Campus AI"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send message"
          >
            <Send size={18} />
          </button>
        </form>
      </section>
    </div>
  );
};

export default ChatBot;
