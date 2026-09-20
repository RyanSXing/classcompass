import { CheckCircle2, Clock3, UsersRound } from 'lucide-react';
import { teachingParts } from '@/lib/teaching-copy';

export function TeachingAction({ description }: { description: string }) {
  const parts = teachingParts(description);
  return <div className="teaching-action-body">
    {(parts.time || parts.who) && <div className="teaching-action-meta">
      {parts.time && <span><Clock3 size={14} aria-hidden="true" />{parts.time}</span>}
      {parts.who && <span><UsersRound size={14} aria-hidden="true" />{parts.who}</span>}
    </div>}
    <ol className="teaching-action-steps" role="list">{parts.steps.map((step, index) => <li key={index}>
      <span className="teaching-step-number" aria-hidden="true">{index + 1}</span><p>{step}</p>
    </li>)}</ol>
    {parts.check && <div className="teaching-action-check"><CheckCircle2 size={17} aria-hidden="true" /><div><strong>Look for</strong><p>{parts.check}</p></div></div>}
  </div>;
}
