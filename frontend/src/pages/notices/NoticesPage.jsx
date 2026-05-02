import { useEffect, useState } from "react";
import { fetchNotices } from "../../api/noticeAPI";
import NoticeCard from "../../components/notices/NoticeCard";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

const NoticesPage = () => {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await fetchNotices();
        if (!cancelled) setNotices(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) setError(getApiErrorMessage(e, "Could not load notices."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="page-pad notices-page">
      <h1>Campus notices</h1>
      <p className="page-lead">
        Announcements from faculty and staff, loaded from the API.
      </p>
      {error ? (
        <p className="page-banner error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p>Loading notices…</p>
      ) : notices.length === 0 ? (
        <p>
          No notices yet. Run <code>npm run seed</code> in the backend folder
          for demo content.
        </p>
      ) : (
        <div className="notice-list">
          {notices.map((n) => (
            <NoticeCard key={n._id} notice={n} />
          ))}
        </div>
      )}
    </main>
  );
};

export default NoticesPage;
