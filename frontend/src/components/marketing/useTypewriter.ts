import { useEffect, useRef, useState } from 'react';

export function useTypewriter(text: string, delay = 900, speed = 26, step = 2) {
  const [typed, setTyped] = useState('');
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let i = 0;
    const tick = () => {
      if (i <= text.length) {
        setTyped(text.slice(0, i));
        i += step;
        timer.current = setTimeout(tick, speed);
      } else {
        setTyped(text);
        setDone(true);
      }
    };
    timer.current = setTimeout(tick, delay);
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [text, delay, speed, step]);

  return { typed, done };
}
