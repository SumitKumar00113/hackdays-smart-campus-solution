import { ChevronRight, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

const getBookingScheduleParts = (booking) => {
  if (!booking?.date) {
    return { dateStr: "", timeslot: booking?.timeslot || "" };
  }
  const d = new Date(booking.date);
  const dateStr = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return { dateStr, timeslot: booking.timeslot || "" };
};

const RecentActivity = ({ bookings = [], loading }) => (
  <section className="schedule-section">
    <div className="section-heading">
      <h2>Upcoming sessions</h2>
      <Link to="/bookings">View calendar</Link>
    </div>

    {loading ? (
      <p className="muted-line">Loading schedule…</p>
    ) : bookings.length === 0 ? (
      <p className="muted-line">
        No upcoming bookings.{" "}
        <Link to="/bookings">Create or join a room session</Link>.
      </p>
    ) : (
      <div className="schedule-list">
        {bookings.map((item) => {
          const { dateStr, timeslot } = getBookingScheduleParts(item);
          const iso = item.date ? new Date(item.date).toISOString() : undefined;
          return (
          <article className="schedule-item" key={item._id}>
            <time className="schedule-when" dateTime={iso}>
              {dateStr ? (
                <span className="schedule-date">{dateStr}</span>
              ) : null}
              {timeslot ? (
                <span className="schedule-timeslot">{timeslot}</span>
              ) : null}
              {!dateStr && !timeslot ? (
                <span className="schedule-timeslot">Session</span>
              ) : null}
              <span className="schedule-status">{item.status || "Session"}</span>
            </time>
            <div className="schedule-detail">
              <strong>{item.subject || "Room booking"}</strong>
              <span>
                <MapPin size={13} />
                {item.room}
              </span>
            </div>
            <span className="schedule-badge">
              {item.bookedBy?.name || "Host"}
            </span>
            <ChevronRight className="schedule-arrow" size={18} />
          </article>
          );
        })}
      </div>
    )}
  </section>
);

export default RecentActivity;
