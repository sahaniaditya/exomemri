import { STEPS } from './data';

export function HowItWorks() {
  return (
    <div className="sec divide" id="how">
      <div className="wrap">
        <div className="plate">
          <span className="platenum">04</span>
          <span className="label">How it works</span>
          <span className="plateline" />
        </div>
        <h2 className="serif [font-size:46px] [margin-bottom:14px]">Three steps, zero friction.</h2>
        <div className="steps-grid">
          {STEPS.map((s, i) => (
            <div key={s.n} className="step">
              <div className={`stepbar${i === STEPS.length - 1 ? ' stepbar-last' : ''}`} />
              <div className="stepnum">{s.n}</div>
              <h3 className="serif [font-size:28px] [margin-bottom:12px]">{s.title}</h3>
              <p className="dim [font-size:16.5px]">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
