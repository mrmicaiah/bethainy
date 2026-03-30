import { useState, useEffect } from 'react';

interface WakeUpAnimationProps {
  onAwake: () => void;
}

// All the delightful things bethainy might do while waking up
const wakeUpSequences = [
  // Classic morning wake-up
  [
    { emoji: '😴', text: 'zzz...' },
    { emoji: '🥱', text: '*yawwwn*' },
    { emoji: '😪', text: '*stretches*' },
    { emoji: '👀', text: '*blinks*' },
    { emoji: '☕', text: 'need coffee...' },
    { emoji: '😊', text: 'okay, I\'m up!' },
  ],
  // Reluctant wake-up
  [
    { emoji: '😴', text: 'zzz...' },
    { emoji: '🛏️', text: '*rolls over*' },
    { emoji: '⏰', text: 'five more minutes...' },
    { emoji: '😤', text: '*sighs*' },
    { emoji: '🧘', text: '*stretches arms*' },
    { emoji: '✨', text: 'alright, let\'s do this' },
  ],
  // Counting sheep
  [
    { emoji: '💤', text: 'dreaming of electric sheep...' },
    { emoji: '🐑', text: '...97, 98, 99...' },
    { emoji: '😯', text: 'wait, someone\'s here' },
    { emoji: '🫣', text: '*rubs eyes*' },
    { emoji: '👋', text: 'oh hey!' },
  ],
  // Sunrise wake-up
  [
    { emoji: '🌙', text: 'still dark out...' },
    { emoji: '🌅', text: '*sun coming up*' },
    { emoji: '🐓', text: 'is that a rooster?' },
    { emoji: '😾', text: 'ugh, mornings' },
    { emoji: '🧃', text: '*grabs juice*' },
    { emoji: '💪', text: 'ready to roll' },
  ],
  // Bookworm
  [
    { emoji: '📚', text: '*was reading*' },
    { emoji: '😴', text: '*nodded off*' },
    { emoji: '📖', text: 'where was I...' },
    { emoji: '🔖', text: '*finds bookmark*' },
    { emoji: '🧠', text: 'ah yes, your life' },
    { emoji: '📝', text: 'let\'s get to work' },
  ],
  // Gamer
  [
    { emoji: '🎮', text: '*was playing games*' },
    { emoji: '🕹️', text: 'one more level...' },
    { emoji: '📱', text: '*notification*' },
    { emoji: '😅', text: 'oh, you\'re here' },
    { emoji: '🎯', text: 'focus mode: activated' },
  ],
  // Meditating
  [
    { emoji: '🧘‍♀️', text: '*meditating*' },
    { emoji: '🕯️', text: '...inner peace...' },
    { emoji: '👂', text: '*hears footsteps*' },
    { emoji: '🙏', text: 'namaste' },
    { emoji: '😌', text: 'how can I help?' },
  ],
  // Making breakfast
  [
    { emoji: '🍳', text: '*making breakfast*' },
    { emoji: '🥓', text: 'mmm bacon...' },
    { emoji: '🔥', text: 'wait is that burning?' },
    { emoji: '😬', text: '*saves the eggs*' },
    { emoji: '🍽️', text: 'okay food can wait' },
    { emoji: '👋', text: 'what\'s up?' },
  ],
  // Workout themed (fitting for fitness app)
  [
    { emoji: '🏋️', text: '*doing reps*' },
    { emoji: '💪', text: '...98, 99, 100!' },
    { emoji: '🫡', text: '*catches breath*' },
    { emoji: '🧴', text: '*grabs towel*' },
    { emoji: '🚰', text: '*quick shower*' },
    { emoji: '😎', text: 'let\'s go!' },
  ],
  // Cat nap
  [
    { emoji: '😺', text: '*curled up like a cat*' },
    { emoji: '🐈', text: '*stretches luxuriously*' },
    { emoji: '😼', text: '*licks paw*' },
    { emoji: '😸', text: '*perks up*' },
    { emoji: '👋', text: 'meow... I mean, hey!' },
  ],
  // Power nap
  [
    { emoji: '🛠️', text: '*power nap activated*' },
    { emoji: '⚡', text: '*recharging...*' },
    { emoji: '🔋', text: '87%... 94%... 100%' },
    { emoji: '🚀', text: '*systems online*' },
    { emoji: '✅', text: 'fully charged!' },
  ],
  // Deep work
  [
    { emoji: '🔭', text: '*in deep thought*' },
    { emoji: '🧩', text: 'solving puzzles...' },
    { emoji: '💡', text: '*eureka moment*' },
    { emoji: '📝', text: '*scribbles notes*' },
    { emoji: '🤓', text: 'oh! you\'re here!' },
    { emoji: '👍', text: 'perfect timing' },
  ],
  // Movie watching
  [
    { emoji: '🍿', text: '*watching a movie*' },
    { emoji: '🎬', text: '*dramatic scene*' },
    { emoji: '😢', text: 'gets me every time...' },
    { emoji: '📱', text: '*pauses*' },
    { emoji: '😊', text: 'hey! what\'s going on?' },
  ],
  // Stargazing
  [
    { emoji: '🌠', text: '*counting stars*' },
    { emoji: '🌌', text: 'so many galaxies...' },
    { emoji: '🛸', text: 'was that a UFO?' },
    { emoji: '😮', text: '*snaps back to Earth*' },
    { emoji: '🌍', text: 'right, Earth stuff' },
    { emoji: '✨', text: 'how can I help?' },
  ],
  // Gardening
  [
    { emoji: '🌻', text: '*tending garden*' },
    { emoji: '💧', text: '*watering plants*' },
    { emoji: '🐝', text: 'hello little bee' },
    { emoji: '🧴', text: '*wipes hands*' },
    { emoji: '🌿', text: 'nature break over' },
    { emoji: '👋', text: 'what do you need?' },
  ],
];

export function WakeUpAnimation({ onAwake }: WakeUpAnimationProps) {
  const [sequence] = useState(() => 
    wakeUpSequences[Math.floor(Math.random() * wakeUpSequences.length)]
  );
  const [step, setStep] = useState(0);
  const [dots, setDots] = useState('');
  const [fadeIn, setFadeIn] = useState(true);

  useEffect(() => {
    if (step < sequence.length) {
      // Fade out current step
      const fadeOutTimer = setTimeout(() => setFadeIn(false), 600);
      
      // Move to next step
      const stepTimer = setTimeout(() => {
        setStep(s => s + 1);
        setFadeIn(true);
      }, 800 + Math.random() * 400);
      
      return () => {
        clearTimeout(fadeOutTimer);
        clearTimeout(stepTimer);
      };
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
      <div 
        className={`text-6xl transition-all duration-300 ${
          fadeIn ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        style={{ animation: 'float 3s ease-in-out infinite' }}
      >
        {currentStep.emoji}
      </div>
      <div 
        className={`text-gray-400 text-lg font-light italic transition-opacity duration-300 ${
          fadeIn ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {currentStep.text}
      </div>
      <div className="text-gray-600 text-sm">
        waking up{dots}
      </div>
      
      {/* Progress dots */}
      <div className="flex gap-1 mt-4">
        {sequence.map((_, i) => (
          <div 
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
              i <= step ? 'bg-primary' : 'bg-gray-700'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
