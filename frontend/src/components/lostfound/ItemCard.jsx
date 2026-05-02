const ItemCard = ({ item }) => {
  const when = item.createdAt
    ? new Date(item.createdAt).toLocaleString()
    : "";
  const poster =
    typeof item.postedBy === "object" && item.postedBy?.name
      ? item.postedBy.name
      : "Campus user";

  return (
    <article className="lf-card">
      {item.imageUrl ? (
        <div className="lf-thumb">
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
          />
        </div>
      ) : null}
      <div className="lf-body">
        <span className={`lf-status lf-status-${item.status || "lost"}`}>
          {item.status || "lost"}
        </span>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
        <footer className="lf-footer">
          <span>{item.locationName || item.location || "Location TBD"}</span>
          <span>
            {poster} · {when}
          </span>
        </footer>
      </div>
    </article>
  );
};

export default ItemCard;
