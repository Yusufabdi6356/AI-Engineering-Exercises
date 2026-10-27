'use client';

import { useState } from 'react';
import { Check, Copy, RotateCcw, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Feedback } from '@/lib/chat-store';

interface MessageActionsProps {
  text: string;
  model?: string;
  feedback?: Feedback | null;
  disabled: boolean;
  onRegenerate: () => void;
  onRate: (feedback: Feedback | null) => void;
}

export default function MessageActions({ text, model, feedback, disabled, onRegenerate, onRate }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-1 text-muted-foreground">
      <Button variant="ghost" size="icon-sm" onClick={copy} aria-label="Copy">
        {copied ? <Check /> : <Copy />}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onRate(feedback === 'up' ? null : 'up')}
        disabled={disabled}
        aria-label="Good response"
        aria-pressed={feedback === 'up'}
        className={feedback === 'up' ? 'text-foreground' : ''}
      >
        <ThumbsUp className={feedback === 'up' ? 'fill-current' : ''} />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onRate(feedback === 'down' ? null : 'down')}
        disabled={disabled}
        aria-label="Bad response"
        aria-pressed={feedback === 'down'}
        className={feedback === 'down' ? 'text-foreground' : ''}
      >
        <ThumbsDown className={feedback === 'down' ? 'fill-current' : ''} />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onRegenerate} disabled={disabled} aria-label="Regenerate">
        <RotateCcw />
      </Button>
      {model && <span className="ml-1 text-xs">{model}</span>}
    </div>
  );
}
