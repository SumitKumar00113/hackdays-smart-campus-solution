const StatsCard = ({ icon: Icon, label, value, change, tone = "blue" }) => (
  <article className={`stat-card stat-${tone}`}>
    <div className="stat-icon">
      {Icon ? <Icon size={22} strokeWidth={2.3} /> : null}
    </div>
    {change ? <span className="stat-change">{change}</span> : null}
    <div className="stat-content">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  </article>
);

export default StatsCard;
