import { useEffect, useState } from "react";
import BookingSessionChat from "../../components/booking/BookingSessionChat";
import useAuth from "../../hooks/useAuth";
import {
  createBooking,
  fetchBookings,
  joinBookingSession,
  leaveBookingSession,
} from "../../api/bookingAPI";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

const participantLabel = (p) => {
  if (!p) return "";
  if (typeof p === "object" && p.name) return p.name;
  return String(p);
};

const BookingPage = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    room: "",
    subject: "",
    description: "",
    timeslot: "",
    date: "",
    maxParticipants: 20,
    isPublic: true,
  });

  const userId = user?._id || user?.id;

  const loadBookings = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await fetchBookings();
      setBookings(data);
    } catch (fetchError) {
      setError(
        getApiErrorMessage(fetchError, "Unable to load room bookings."),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!userId) {
      setError("You must be signed in.");
      return;
    }
    if (!form.room.trim() || !form.timeslot.trim() || !form.date) {
      setError("Room, date, and time slot are required.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const { data } = await createBooking({
        room: form.room.trim(),
        subject: form.subject.trim() || "Study session",
        description: form.description.trim() || undefined,
        timeslot: form.timeslot.trim(),
        date: new Date(form.date).toISOString(),
        bookedBy: userId,
        isPublic: form.isPublic,
        maxParticipants: Number(form.maxParticipants) || 20,
        status: "approved",
      });
      setBookings((prev) => [data, ...prev]);
      setForm({
        room: "",
        subject: "",
        description: "",
        timeslot: "",
        date: "",
        maxParticipants: 20,
        isPublic: true,
      });
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not create booking."));
    } finally {
      setCreating(false);
    }
  };

  const handleJoinSession = async (booking) => {
    if (!userId) {
      setError("You must be signed in to join a session.");
      return;
    }

    const alreadyJoined = booking.participants?.some(
      (participant) =>
        participant?._id?.toString() === userId?.toString() ||
        participant?.toString() === userId?.toString(),
    );

    if (alreadyJoined) {
      return;
    }

    if (
      booking.maxParticipants &&
      booking.participants?.length >= booking.maxParticipants
    ) {
      setError("This session is already full.");
      return;
    }

    setActionLoading((prev) => ({ ...prev, [booking._id]: true }));
    setError("");

    try {
      const { data } = await joinBookingSession(booking._id);
      setBookings((prev) =>
        prev.map((item) => (item._id === booking._id ? data : item)),
      );
    } catch (joinError) {
      setError(
        getApiErrorMessage(joinError, "Unable to join the session."),
      );
    } finally {
      setActionLoading((prev) => ({ ...prev, [booking._id]: false }));
    }
  };

  const handleLeaveSession = async (booking) => {
    if (!userId) return;
    setActionLoading((prev) => ({ ...prev, [booking._id]: true }));
    setError("");
    try {
      const { data } = await leaveBookingSession(booking._id);
      setBookings((prev) =>
        prev.map((item) => (item._id === booking._id ? data : item)),
      );
    } catch (leaveError) {
      setError(getApiErrorMessage(leaveError, "Unable to leave the session."));
    } finally {
      setActionLoading((prev) => ({ ...prev, [booking._id]: false }));
    }
  };

  return (
    <main className="booking-page page-pad">
      <h1>Room sessions</h1>
      <p className="page-lead">
        Public sessions are visible to everyone; private ones stay on your
        list only—perfect when you do not want others to join.
      </p>

      <section className="panel-card">
        <h2>New booking</h2>
        <form className="grid-form" onSubmit={handleCreate}>
          <label>
            Room
            <input
              value={form.room}
              onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))}
              placeholder="e.g. Science Hall 402"
              required
            />
          </label>
          <label>
            Subject
            <input
              value={form.subject}
              onChange={(e) =>
                setForm((f) => ({ ...f, subject: e.target.value }))
              }
              placeholder="e.g. DSA, Linear Algebra"
            />
          </label>
          <label className="grid-span-2">
            Topic / description (optional)
            <input
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder='e.g. "Trees & graphs review"'
            />
          </label>
          <label>
            Date
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              required
            />
          </label>
          <label>
            Time slot
            <input
              value={form.timeslot}
              onChange={(e) =>
                setForm((f) => ({ ...f, timeslot: e.target.value }))
              }
              placeholder="e.g. 4:00 PM – 6:00 PM"
              required
            />
          </label>
          <label>
            Max participants
            <input
              type="number"
              min={1}
              value={form.maxParticipants}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  maxParticipants: e.target.value,
                }))
              }
            />
          </label>
          <label className="flex items-center gap-2" style={{ marginTop: 24 }}>
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(e) =>
                setForm((f) => ({ ...f, isPublic: e.target.checked }))
              }
            />
            <span>Public session (others can discover and join)</span>
          </label>
          <div className="form-actions">
            <button type="submit" disabled={creating}>
              {creating ? "Saving…" : "Publish session"}
            </button>
          </div>
        </form>
      </section>

      {error && (
        <div className="booking-error page-banner error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p>Loading bookings…</p>
      ) : (
        <div className="booking-list">
          {bookings.length === 0 ? (
            <p>
              No room bookings yet. Add one above or run{" "}
              <code>npm run seed</code> in the backend.
            </p>
          ) : (
            bookings.map((booking) => {
              const isParticipant = userId
                ? booking.participants?.some(
                    (participant) =>
                      participant?._id?.toString() === userId?.toString() ||
                      participant?.toString() === userId?.toString(),
                  )
                : false;

              const isHost =
                userId &&
                (booking.bookedBy?._id?.toString() === userId?.toString() ||
                  booking.bookedBy?.toString() === userId?.toString());

              const full =
                booking.maxParticipants &&
                booking.participants?.length >= booking.maxParticipants;

              const names = (booking.participants || [])
                .map(participantLabel)
                .filter(Boolean);

              return (
                <article key={booking._id} className="booking-card">
                  <div className="booking-card-badges">
                    {booking.isPublic === false ? (
                      <span className="booking-badge booking-badge--private">
                        Private
                      </span>
                    ) : (
                      <span className="booking-badge booking-badge--public">
                        Public
                      </span>
                    )}
                  </div>
                  <div>
                    <strong>Room:</strong> {booking.room}
                  </div>
                  <div>
                    <strong>Time slot:</strong> {booking.timeslot}
                  </div>
                  <div>
                    <strong>Date:</strong>{" "}
                    {booking.date
                      ? new Date(booking.date).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })
                      : "—"}
                  </div>
                  <div>
                    <strong>Subject:</strong> {booking.subject || "—"}
                  </div>
                  {booking.description ? (
                    <div>
                      <strong>Topic:</strong> {booking.description}
                    </div>
                  ) : null}
                  <div>
                    <strong>Booked by:</strong>{" "}
                    {booking.bookedBy?.name || "—"}
                  </div>
                  <div>
                    <strong>Participants</strong> (
                    {booking.participants?.length || 0}
                    {booking.maxParticipants
                      ? ` / ${booking.maxParticipants}`
                      : ""}
                    )
                    {names.length ? (
                      <ul className="booking-participant-list">
                        {names.map((n, i) => (
                          <li key={`${booking._id}-p-${i}`}>{n}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="muted-line"> None yet</span>
                    )}
                  </div>
                  <div className="booking-actions-row">
                    {!isParticipant ? (
                      <button
                        type="button"
                        disabled={
                          actionLoading[booking._id] ||
                          full ||
                          (!booking.isPublic && !isHost)
                        }
                        onClick={() => handleJoinSession(booking)}
                      >
                        {actionLoading[booking._id]
                          ? "…"
                          : full
                            ? "Full"
                            : !booking.isPublic && !isHost
                              ? "Private (host only)"
                              : "Join session"}
                      </button>
                    ) : (
                      <>
                        <span className="booking-joined-pill">You’re in</span>
                        {!isHost ? (
                          <button
                            type="button"
                            className="booking-leave-btn"
                            disabled={actionLoading[booking._id]}
                            onClick={() => handleLeaveSession(booking)}
                          >
                            Leave session
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                  {isParticipant && userId && (
                    <BookingSessionChat bookingId={booking._id} />
                  )}
                </article>
              );
            })
          )}
        </div>
      )}
    </main>
  );
};

export default BookingPage;
