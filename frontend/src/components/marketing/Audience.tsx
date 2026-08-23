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
        <h2 className="serif [font-size:46px] [margin-bottom:44px]">Built for people who learn online.</h2>
        <div className="audience-grid">
          {AUDIENCE.map((a) => (
            <div key={a.title} className="acard">
              <div className="ficon [font-size:26px]">{a.icon}</div>
              <h3 className="serif [font-size:22px] [margin-bottom:10px]">{a.title}</h3>
              <p className="dim [font-size:15px]">{a.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
