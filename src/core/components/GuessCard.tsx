import { useState } from 'react';
import { Rich } from './Rich';

interface Props {
  /** Pertanyaan (boleh memuat `$…$`). */
  question: string;
  options: string[];
  /** Indeks jawaban benar. */
  answer: number;
  /** Petunjuk yang muncul setelah tebakan salah. */
  hint?: string;
  /** Dipanggil sekali per pertanyaan: `ok` = tebakan pertama benar. */
  onResolve: (ok: boolean) => void;
}

/**
 * Kartu "tebak dulu": mahasiswa menebak sebelum langkah berikutnya dibuka.
 * Beri `key` yang berubah tiap pertanyaan agar kartu mulai dari awal.
 */
export function GuessCard({ question, options, answer, hint, onResolve }: Props) {
  const [wrong, setWrong] = useState<number[]>([]);
  const [done, setDone] = useState(false);

  const pick = (k: number) => {
    if (done) return;
    if (k === answer) {
      setDone(true);
      onResolve(wrong.length === 0);
    } else if (!wrong.includes(k)) {
      setWrong((w) => [...w, k]);
    }
  };

  return (
    <div className="guess-card" role="group" aria-label="Tebak dulu">
      <div className="guess-q" aria-live="polite">
        {wrong.length > 0 && !done && hint ? (
          <>
            <b>Petunjuk:</b> <Rich>{hint}</Rich>
          </>
        ) : (
          <>
            <b>Tebak dulu:</b> <Rich>{question}</Rich>
          </>
        )}
      </div>
      <div className="guess-opts">
        {options.map((o, k) => (
          <button
            key={k}
            type="button"
            className={`btn small${done && k === answer ? ' active' : ''}${wrong.includes(k) ? ' wrong' : ''}`}
            disabled={wrong.includes(k) || done}
            onClick={() => pick(k)}
          >
            <Rich>{o}</Rich>
          </button>
        ))}
      </div>
    </div>
  );
}
