import { useCallback, useEffect, useState } from "react";
import useAuth from "../../hooks/useAuth";
import { fetchLostFoundItems } from "../../api/lostFoundAPI";
import ItemCard from "../../components/lostfound/ItemCard";
import ItemForm from "../../components/lostfound/ItemForm";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

const LostFoundPage = () => {
  const { user } = useAuth();
  const userId = user?._id || user?.id;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await fetchLostFoundItems();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not load items."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="page-pad lostfound-page">
      <h1>Lost & found</h1>
      <p className="page-lead">
        Browse campus posts and add your own. You can attach a photo (uploaded
        via Cloudinary when configured in the backend).
      </p>

      {error ? (
        <p className="page-banner error" role="alert">
          {error}
        </p>
      ) : null}
      {formError ? (
        <p className="page-banner error" role="alert">
          {formError}
        </p>
      ) : null}

      <ItemForm
        postedBy={userId}
        onCreated={() => {
          setFormError("");
          load();
        }}
        onError={setFormError}
      />

      <h2 className="section-title">Recent posts</h2>
      {loading ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <p>
          No items yet. Post one above or run <code>npm run seed</code>.
        </p>
      ) : (
        <div className="lf-grid">
          {items.map((item) => (
            <ItemCard key={item._id} item={item} />
          ))}
        </div>
      )}
    </main>
  );
};

export default LostFoundPage;
