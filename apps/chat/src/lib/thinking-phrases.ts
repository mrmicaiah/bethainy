// Bethainy's thinking phrases - things she mutters while processing
// These should feel like an old-fashioned secretary rummaging through files

export const thinkingPhrases = [
  // Looking for things
  "Now where did I put that...",
  "I know it's here somewhere...",
  "Let me check the back room...",
  "One moment, dear...",
  "Hmm, which drawer was that...",
  "I just had it in my hands...",
  "Now let me see here...",
  "Give me just a tick...",
  "It's in one of these folders...",
  "I'm sure I filed that...",
  
  // Rummaging sounds
  "These papers are a mess today...",
  "Who reorganized my desk...",
  "Ah, there's that pen I lost...",
  "This filing system needs work...",
  "I really should label these better...",
  "So many notebooks...",
  "Which one, which one...",
  "Not that drawer...",
  "Behind the rolodex maybe...",
  "Under the calendar...",
  
  // Thinking out loud
  "Let me think now...",
  "If I remember right...",
  "That rings a bell...",
  "Oh yes, I recall...",
  "Now that's a good question...",
  "Hmm, let me pull that up...",
  "I wrote that down somewhere...",
  "What did we say about that...",
  "Just a moment, hon...",
  "Bear with me here...",
  
  // Finding things
  "Aha, here we go...",
  "Found it! Well, almost...",
  "Getting warmer...",
  "This looks promising...",
  "I knew I kept this...",
  "There's the notebook...",
  "Okay, okay, here...",
  "Let me just flip to the right page...",
  "Almost got it...",
  "Just need to cross-reference...",
  
  // Office sounds
  "These reading glasses never stay put...",
  "Where's my good pen...",
  "The light's better over here...",
  "Let me grab my notes...",
  "I made a list somewhere...",
  "Should be in the Tuesday folder...",
  "Or was it Wednesday...",
  "My memory isn't what it used to be...",
  "No wait, I do remember...",
  "Let me double-check that...",
  
  // Being thorough
  "I want to make sure I get this right...",
  "Let me look at this properly...",
  "One thing at a time...",
  "No shortcuts now...",
  "Doing this the right way...",
  "Let me be certain...",
  "I'll just verify...",
  "Best to check twice...",
  "Measure twice, cut once...",
  "Hold on, almost there...",
  
  // Casual muttering
  "Mmhmm, mmhmm...",
  "Yes, yes...",
  "Right, right...",
  "Oh my...",
  "Well now...",
  "Let's see here...",
  "Okay then...",
  "Alright, alright...",
  "Here we are...",
  "Just about...",
  
  // Specific to tasks
  "Checking the schedule...",
  "Looking at the numbers...",
  "Flipping through the records...",
  "Consulting my notes...",
  "Reviewing the files..."
];

// Get a random thinking phrase
export function getThinkingPhrase(): string {
  return thinkingPhrases[Math.floor(Math.random() * thinkingPhrases.length)];
}

// Get multiple unique phrases for longer waits
export function getThinkingSequence(count: number): string[] {
  const shuffled = [...thinkingPhrases].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
