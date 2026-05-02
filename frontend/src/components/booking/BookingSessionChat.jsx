import { useCallback, useEffect, useRef, useState } from "react";
import { fetchBookingChat } from "../../api/bookingAPI";
import { useSocket } from "../../context/SocketContext";
import useAuth from "../../hooks/useAuth";

/**
 * Real-time study session chat for a booking room (Socket.IO).
 * @param {{ bookingId: string }} props
 */
const BookingSessionChat = ({ bookingId }) => {
  const { socket, connected } = useSocket();
  const { user } = useAuth();
  const selfId = user?.id || user?._id;
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [roomJoined, setRoomJoined] = useState(false);
  const listRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!bookingId) return;
      try {
        const { data } = await fetchBookingChat(bookingId);
        if (cancelled || !data?.messages?.length) return;
        const historical = data.messages.map((row, i) => ({
          id: `hist-${row._id || i}-${row.createdAt}`,
          bookingId: String(bookingId),
          userId: row.user?._id || row.user,
          userName: row.user?.name,
          text: row.text,
          createdAt:
            typeof row.createdAt === "string"
              ? row.createdAt
              : new Date(row.createdAt).toISOString(),
        }));
        setMessages((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const merged = [
            ...historical.filter((h) => !existingIds.has(h.id)),
            ...prev,
          ];
          return merged.sort(
            (a, b) =>
              new Date(a.createdAt).getTime() -
              new Date(b.createdAt).getTime(),
          );
        });
      } catch {
        /* not a participant yet or offline */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  useEffect(() => {
    if (!socket || !bookingId || !connected) {
      setRoomJoined(false);
      return undefined;
    }

    socket.emit("joinBookingRoom", { bookingId }, (ack) => {
      setRoomJoined(Boolean(ack?.ok));
    });

    const onReceive = (msg) => {
      if (String(msg?.bookingId) !== String(bookingId)) return;
      setMessages((prev) => [...prev, msg]);
    };

    const onJoined = (userData) => {
      if (!userData?.userId) return;
      if (String(userData.bookingId) !== String(bookingId)) return;
      setMessages((prev) => [
        ...prev,
        {
          id: `join-${userData.socketId}-${userData.joinedAt}`,
          bookingId: String(bookingId),
          type: "system",
          text: `${userData.name || "Someone"} joined the session`,
          createdAt: userData.joinedAt || new Date().toISOString(),
        },
      ]);
    };

    const onLeft = (payload) => {
      if (String(payload?.bookingId) !== String(bookingId)) return;
      setMessages((prev) => [
        ...prev,
        {
          id: `left-${payload.socketId}-${Date.now()}`,
          bookingId: String(bookingId),
          type: "system",
          text: "A participant left the session",
          createdAt: new Date().toISOString(),
        },
      ]);
    };

    socket.on("receiveMessage", onReceive);
    socket.on("userJoined", onJoined);
    socket.on("userLeft", onLeft);

    return () => {
      socket.off("receiveMessage", onReceive);
      socket.off("userJoined", onJoined);
      socket.off("userLeft", onLeft);
      socket.emit("leaveBookingRoom", { bookingId });
      setRoomJoined(false);
    };
  }, [socket, bookingId, connected]);

  const send = (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !socket || !roomJoined) return;

    socket.emit("sendMessage", { bookingId, text }, (ack) => {
      if (!ack?.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            bookingId: String(bookingId),
            type: "system",
            text: ack?.message || "Message could not be sent",
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    });
    setDraft("");
  };

  return (
    <div className="session-chat" aria-label="Session chat">
      <div className="session-chat-header">
        <span>Session chat (real-time + saved history)</span>
        {!connected && (
          <span className="session-chat-status">Connecting…</span>
        )}
        {connected && !roomJoined && (
          <span className="session-chat-status">Joining room…</span>
        )}
        {connected && roomJoined && (
          <span className="session-chat-status session-chat-status--live">
            Live
          </span>
        )}
      </div>
      <div className="session-chat-messages" ref={listRef} role="log">
        {messages.length === 0 ? (
          <p className="session-chat-empty">No messages yet.</p>
        ) : (
          messages.map((m) => {
            const isSelf =
              m.userId && selfId && String(m.userId) === String(selfId);
            const isSystem = m.type === "system";
            return (
              <div
                key={m.id}
                className={`session-chat-msg${isSystem ? " session-chat-msg--system" : ""}${isSelf ? " session-chat-msg--self" : ""}`}
              >
                {!isSystem && (
                  <span className="session-chat-author">
                    {isSelf ? "You" : m.userName || "Participant"}
                  </span>
                )}
                <span className="session-chat-text">{m.text}</span>
                <time className="session-chat-time" dateTime={m.createdAt}>
                  {m.createdAt
                    ? new Date(m.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                </time>
              </div>
            );
          })
        )}
      </div>
      <form className="session-chat-form" onSubmit={send}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            roomJoined ? "Message the group…" : "Waiting for connection…"
          }
          disabled={!roomJoined}
          maxLength={2000}
          autoComplete="off"
        />
        <button type="submit" disabled={!roomJoined || !draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
};

export default BookingSessionChat;
