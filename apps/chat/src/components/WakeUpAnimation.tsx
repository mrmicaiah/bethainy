import { useState, useEffect } from 'react';

interface WakeUpAnimationProps {
  onAwake: () => void;
}

// All the delightful things bethainy might do while waking up
const wakeUpSequences = [
  [
    { emoji: '😴', text: 'zzz...' },
    { emoji: '🥱', text: '*yawwwn*' },
    { emoji: '😪', text: '*stretches*' },
    { emoji: '👀', text: '*blinks*' },
    { emoji: '☕', text: 'need coffee...' },
    { emoji: '😊', text: 'okay, I\'m up!' },
  ],
  [
    { emoji: '😴', text: 'zzz...' },
    { emoji: '🛏️', text: '*rolls over*' },
    { emoji: '⏰', text: 'five more minutes...' },
    { emoji: '😤', text: '*sighs*' },
    { emoji: '🧘', text: '*stretches arms*' },
    { emoji: '✨', text: 'alright, let\'s do this' },
  ],
  [
    { emoji: '💤', text: 'dreaming of electric sheep...' },
    { emoji: '🐑', text: '...97, 98, 99...' },
    { emoji: '😯', text: 'wait, someone\'s here' },
    { emoji: '🫣', text: '*rubs eyes*' },
    { emoji: '👋', text: 'oh hey!' },
  ],
  [
    { emoji: '🌙', text: 'still dark out...' },
    { emoji: '🌅', text: '*sun coming up*' },
    { emoji: '🐓', text: 'is that a rooster?' },
    { emoji: '😾', text: 'ugh, mornings' },
    { emoji: '🧃', text: '*grabs juice*' },
    { emoji: '💪', text: 'ready to roll' },
  ],
  [
    { emoji: '📚', text: '*was reading*' },
    { emoji: '😴', text: '*nodded off*' },
    { emoji: '📖', text: 'where was I...' },
    { emoji: '🔖', text: '*finds bookmark*' },
    { emoji: '🧠', text: 'ah yes, your life' },
    { emoji: '📝', text: 'let\'s get to work' },
  ],
  [
    { emoji: '🎮', text: '*was playing games*' },
    { emoji: '🕹️', text: 'one more level...' },
    { emoji: '📱', text: '*notification*' },
    { emoji: '😅', text: 'oh, you\'re here' },
    { emoji: '🎯', text: 'focus mode: activated' },
  ],
  [
    { emoji: '🧘‍♀️', text: '*meditating*' },
    { emoji: '🕯️', text: '...inner peace...' },
    { emoji: '👂', text: '*hears footsteps*' },
    { emoji: '🙏', text: 'namaste' },
    { emoji: '😌', text: 'how can I help?' },
  ],
  [
    { emoji: '🍳', text: '*making breakfast*' },
    { emoji: '🥓', text: 'mmm bacon...' },
    { emoji: '🔥', text: 'wait is that burning?' },
    { emoji: '😬', text: '*saves the eggs*' },
    { emoji: '🍽️', text: 'okay food can wait' },
    { emoji: '👋', text: 'what\'s up?' },
  ],
];

export function WakeUpAnimation({ onAwake }: WakeUpAnimationProps) {
  const [sequence] = useState(() => 
    wakeUpSequences[Math.floor(Math.random() * wakeUpSequences.length)]
  );
  const [step, setStep] = useState(0);
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (step < sequence.length) {
      const timer = setTimeout(() => {
        setStep(s => s + 1);
      }, 800 + Math.random() * 400); // Slightly random timing feels more natural
      return () => clearTimeout(timer);
    } else {
      // Animation complete, wait a beat then notify parent
      const timer = setTimeout(onAwake, 500);
      return () => clearTimeout(timer);
    }
  }, [step, sequence.length, onAwake]);

  // Animate dots while showing current step
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 400);
    return () => clearInterval(interval);
  }, []);

  const currentStep = sequence[Math.min(step, sequence.length - 1)];

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-6">
      <div className="text-6xl animate-bounce-slow">
        {currentStep.emoji}
      </div>
      <div className="text-gray-400 text-lg font-light italic">
        {currentStep.text}
      </div>
      <div className="text-gray-600 text-sm">
        waking up{dots}
      </div>
    </div>
  );
}
