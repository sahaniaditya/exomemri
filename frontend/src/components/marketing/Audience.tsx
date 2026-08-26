import { AUDIENCE } from './data';

export function Audience() {
  return (
    <div className="sec divide" id="who">
      <div className="wrap">
        <div className="plate">
          <span className="platenum">07</span>
          <span className="label">Who it&apos;s for</span>
          <span className="plateline" />
        </div>
        <h2 className="serif audience-title">Built for people who learn online.</h2>
        <div className="audience-grid">
          {AUDIENCE.map((a) => (
            <div key={a.title} className="acard">
              <div className="ficon">{a.icon}</div>
              <h3 className="serif">{a.title}</h3>
              <p className="dim">{a.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}