/* The first Inner Beast week (kickboxing, until 2026-11-20). Kept only for the tests written against it. */
import type { Session } from './training.ts';

export const OLD_WEEK: Session[][] = [
  [{ id: 'mon-shadow', name: 'Shadow Kickboxing', kind: 'rounds', min: 26, focus: 'jab' }, { id: 'mon-bag', name: 'Heavy Bag Training', kind: 'rounds', min: 19, focus: 'move' }, { id: 'mon-bw', name: 'Bodyweight Workout', kind: 'amrap', min: 10 }],
  [{ id: 'tue-stretch', name: 'Dynamic Warm-up', kind: 'routine', min: 10 }, { id: 'tue-cal', name: 'Calisthenics: Chest, Shoulders, Triceps', kind: 'workout', min: 45 }, { id: 'knee-tue', name: 'Knee Armor', kind: 'workout', min: 8 }, { id: 'tue-easy', name: 'Easy Shadow Kickboxing', kind: 'rounds', min: 10, focus: 'slow' }, { id: 'tue-row', name: 'Easy Row', kind: 'run', min: 20 }, { id: 'tue-cool', name: 'Cool-down Stretch', kind: 'routine', min: 5 }],
  [{ id: 'wed-walk', name: 'Walk (10K Steps)', kind: 'walk', min: 75 }, { id: 'wed-shower', name: 'Cold & Warm Showers', kind: 'shower', min: 10 }, { id: 'wed-med', name: 'Meditation', kind: 'wimhof', min: 12 }],
  [{ id: 'thu-rope', name: 'Jumping Rope', kind: 'rounds', min: 18, focus: 'rope', alt: { other: 'Agility Ladder' } }, { id: 'thu-shadow', name: 'Shadow Kickboxing', kind: 'rounds', min: 15, focus: 'combo', alt: { other: 'Technical Sparring / Pads' } }, { id: 'thu-power', name: 'Punch-out', kind: 'rounds', min: 11, focus: 'power' }, { id: 'thu-bag', name: 'Heavy Bag Training', kind: 'rounds', min: 23, focus: 'power', alt: { other: 'Machine Row' } }],
  [{ id: 'fri-stretch', name: 'Dynamic Warm-up', kind: 'routine', min: 10 }, { id: 'fri-cal', name: 'Calisthenics: Back, Biceps, Shoulders', kind: 'workout', min: 54 }, { id: 'kick-fri', name: 'Kick Armor', kind: 'workout', min: 10 }, { id: 'fri-easy', name: 'Easy Shadow Kickboxing', kind: 'rounds', min: 10, focus: 'distance' }],
  [{ id: 'sun-legs', name: 'Leg Day Warm-up', kind: 'routine', min: 10 }, { id: 'sun-lunges', name: 'Speed, Power & Leg Strength', kind: 'workout', min: 66 }, { id: 'knee-sat', name: 'Knee Armor', kind: 'workout', min: 8 }],
  [{ id: 'sun-jog', name: 'Easy Row', kind: 'run', min: 20, alt: { other: 'Jogging' } }, { id: 'sat-mob', name: 'Mobility Training', kind: 'routine', min: 30 }, { id: 'sat-med', name: 'Meditation', kind: 'wimhof', min: 10 }, { id: 'sat-breath', name: 'Breathing Exercises', kind: 'breath', min: 10 }],
];

