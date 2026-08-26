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
        <h2 className="serif how-title">Three steps, zero friction.</h2>
        <div className="steps-grid">
          {STEPS.map((s, i) => (
            <div key={s.n} className="step">
              <div className={`stepbar${i === STEPS.length - 1 ? ' stepbar-last' : ''}`} />
              <div className="stepnum">{s.n}</div>
              <h3 className="serif step-title">{s.title}</h3>
              <p className="dim">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}