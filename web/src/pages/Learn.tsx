import { useEffect, useMemo, useState } from 'react';
import { lessonsForAge, type Lesson } from '@pocketpilot/core';
import { Card } from '../components/ui.tsx';
import { useProfile } from '../lib/profile.tsx';

const STORAGE_KEY = 'pocketpilot.lessons';

function readDone(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

export default function Learn() {
  const { profile } = useProfile();
  const lessons = useMemo(() => lessonsForAge(profile?.age ?? null), [profile?.age]);
  const [open, setOpen] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, number>>(readDone);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(done));
    } catch {
      /* fine */
    }
  }, [done]);

  const finished = lessons.filter((l) => done[l.id] !== undefined).length;
  const current = lessons.find((l) => l.id === open) ?? null;

  return (
    <div className="stack">
      <div className="page-title">
        <h1>Learn 📚</h1>
        <p>Six short lessons. One big idea each, then a quick quiz.</p>
      </div>
      <div className="row spread">
        <span className="pill accent">
          {finished} of {lessons.length} done
        </span>
        {finished === lessons.length && lessons.length > 0 && <span className="pill good">You finished them all! 🏆</span>}
      </div>
      {current ? (
        <LessonView lesson={current} best={done[current.id]} onBack={() => setOpen(null)} onScore={(score) => setDone({ ...done, [current.id]: Math.max(score, done[current.id] ?? 0) })} />
      ) : (
        <div className="grid grid-3">
          {lessons.map((l) => (
            <button key={l.id} type="button" className="tile" onClick={() => setOpen(l.id)}>
              <span className="emoji">{l.emoji}</span>
              <span className="name">{l.title}</span>
              <span className="price">{l.idea}</span>
              <span className="tiny">{done[l.id] !== undefined ? `Best score ${done[l.id]}/${l.quiz.length} ✓` : `${l.quiz.length} questions`}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LessonView({ lesson, best, onBack, onScore }: { lesson: Lesson; best: number | undefined; onBack: () => void; onScore: (score: number) => void }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    setAnswers({});
    setChecked(false);
  }, [lesson.id]);
  const score = lesson.quiz.filter((q, i) => answers[i] === q.answer).length;
  const allAnswered = lesson.quiz.every((_, i) => answers[i] !== undefined);

  return (
    <div className="stack">
      <button type="button" className="btn ghost" onClick={onBack} style={{ alignSelf: 'flex-start' }}>
        ← All lessons
      </button>
      <Card emoji={lesson.emoji} title={lesson.title} right={best !== undefined ? <span className="pill good">best {best}/{lesson.quiz.length}</span> : undefined}>
        <p style={{ fontWeight: 800, fontSize: '1.15rem' }}>{lesson.idea}</p>
        {lesson.body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <div className="insight win" style={{ marginTop: 8 }}>
          <span className="emoji">🎯</span>
          <div>
            <h3>Try this week</h3>
            <p>{lesson.challenge}</p>
          </div>
        </div>
      </Card>
      <Card title="Quick quiz" emoji="❓">
        <div className="stack">
          {lesson.quiz.map((q, qi) => {
            const picked = answers[qi];
            return (
              <div key={qi}>
                <p style={{ fontWeight: 800, marginBottom: 6 }}>
                  {qi + 1}. {q.q}
                </p>
                <div className="row">
                  {q.choices.map((c, ci) => {
                    const isPicked = picked === ci;
                    const isRight = checked && ci === q.answer;
                    const isWrong = checked && isPicked && ci !== q.answer;
                    return (
                      <button
                        key={ci}
                        type="button"
                        className={`btn sm ${isPicked && !checked ? '' : 'secondary'}`}
                        style={isRight ? { background: 'var(--win)', color: 'var(--win-ink)' } : isWrong ? { background: 'var(--warn)', color: 'var(--warn-ink)' } : undefined}
                        disabled={checked}
                        onClick={() => setAnswers({ ...answers, [qi]: ci })}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
                {checked && <p className="small muted" style={{ marginTop: 6 }}>{q.why}</p>}
              </div>
            );
          })}
          {!checked ? (
            <button
              type="button"
              className="btn"
              disabled={!allAnswered}
              onClick={() => {
                setChecked(true);
                onScore(score);
              }}
              style={{ alignSelf: 'flex-start' }}
            >
              Check my answers
            </button>
          ) : (
            <div className={`alert ${score === lesson.quiz.length ? 'ok' : 'info'}`}>
              {score} out of {lesson.quiz.length}. {score === lesson.quiz.length ? 'Perfect! 🎉' : 'Read the explanations and try again any time.'}
              <button type="button" className="btn ghost sm" onClick={() => { setAnswers({}); setChecked(false); }} style={{ marginLeft: 8 }}>
                Try again
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
