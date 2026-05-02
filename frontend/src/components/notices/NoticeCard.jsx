const NoticeCard = ({ notice }) => {
  const when = notice.publishedAt
    ? new Date(notice.publishedAt).toLocaleString()
    : "";
  const author =
    typeof notice.author === "object" && notice.author?.name
      ? notice.author.name
      : "Campus";

  return (
    <article className="notice-card">
      <header>
        <h3>{notice.title}</h3>
        <span className="notice-meta">
          {author} · {when}
        </span>
        {notice.audience ? (
          <span className="notice-audience">{notice.audience}</span>
        ) : null}
      </header>
      <p className="notice-body">{notice.body}</p>
    </article>
  );
};

export default NoticeCard;
