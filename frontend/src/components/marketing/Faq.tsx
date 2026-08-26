import { FAQS } from './data';

export function Faq() {
  return (
    <div className="sec divide" id="faq">
      <div className="wrap wrap-narrow">
        <div className="plate">
          <span className="platenum">09</span>
          <span className="label">FAQ</span>
          <span className="plateline" />
        </div>
        <h2 className="serif faq-title">Questions people will ask.</h2>
        <div className="faq">
          {FAQS.map((f, i) => (
            <details key={f.q} open={f.open} className={i === FAQS.length - 1 ? 'faq-last' : undefined}>
              <summary>
                {f.q}
                <span className="plus">+</span>
              </summary>
              <p className="ans">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}