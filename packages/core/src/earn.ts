/**
 * Ways kids can earn more than their allowance, grouped by age. Pay figures are
 * typical US ranges and exist to start a conversation, not to set a price.
 */

export interface EarnIdea {
  id: string;
  name: string;
  emoji: string;
  /** Typical pay per job / session in USD. */
  payLow: number;
  payHigh: number;
  /** How often a kid could realistically do it per week. */
  timesPerWeek: number;
  minAge: number;
  needsAdult: boolean;
  tip: string;
  kind: 'chores' | 'neighborhood' | 'creative' | 'selling' | 'skills';
}

export const EARN_IDEAS: EarnIdea[] = [
  { id: 'extra-chores', name: 'Extra chores at home', emoji: '🧹', payLow: 2, payHigh: 5, timesPerWeek: 4, minAge: 5, needsAdult: true, kind: 'chores', tip: 'Agree on a list with a price for each job. Do the job well the first time.' },
  { id: 'car-wash', name: 'Wash the family car', emoji: '🚿', payLow: 5, payHigh: 15, timesPerWeek: 1, minAge: 7, needsAdult: true, kind: 'chores', tip: 'Ask neighbors too once you are good at it.' },
  { id: 'recycling', name: 'Return cans and bottles', emoji: '♻️', payLow: 3, payHigh: 10, timesPerWeek: 1, minAge: 6, needsAdult: true, kind: 'neighborhood', tip: 'Only in places that pay a deposit. Free money for a little sorting.' },
  { id: 'lemonade', name: 'Lemonade or bake stand', emoji: '🍋', payLow: 15, payHigh: 60, timesPerWeek: 1, minAge: 6, needsAdult: true, kind: 'selling', tip: 'Count the cost of lemons, cups, and sugar first. Profit is what is left after that.' },
  { id: 'dog-walk', name: 'Dog walking', emoji: '🐕', payLow: 10, payHigh: 20, timesPerWeek: 3, minAge: 10, needsAdult: true, kind: 'neighborhood', tip: 'Start with one friendly dog you know. Be on time, every time.' },
  { id: 'pet-sit', name: 'Pet sitting', emoji: '🐈', payLow: 15, payHigh: 30, timesPerWeek: 1, minAge: 11, needsAdult: true, kind: 'neighborhood', tip: 'Great when neighbors travel. Send a photo update - people love that.' },
  { id: 'yard-work', name: 'Yard work and leaves', emoji: '🍂', payLow: 15, payHigh: 40, timesPerWeek: 1, minAge: 10, needsAdult: true, kind: 'neighborhood', tip: 'Raking, weeding, watering. Bring your own gloves.' },
  { id: 'snow', name: 'Shovel snow', emoji: '❄️', payLow: 15, payHigh: 40, timesPerWeek: 1, minAge: 11, needsAdult: true, kind: 'neighborhood', tip: 'Seasonal but fast. Knock on doors right after it snows.' },
  { id: 'plant-care', name: 'Water plants for neighbors', emoji: '🪴', payLow: 5, payHigh: 15, timesPerWeek: 1, minAge: 8, needsAdult: true, kind: 'neighborhood', tip: 'Easy job when people are on holiday.' },
  { id: 'crafts', name: 'Sell crafts or bracelets', emoji: '🧵', payLow: 10, payHigh: 40, timesPerWeek: 1, minAge: 8, needsAdult: true, kind: 'creative', tip: 'Make ten of your best design instead of one of everything.' },
  { id: 'resell', name: 'Sell old toys and games', emoji: '📦', payLow: 10, payHigh: 80, timesPerWeek: 1, minAge: 9, needsAdult: true, kind: 'selling', tip: 'Clean it, photograph it in good light, and price it a little under others.' },
  { id: 'tutoring', name: 'Tutor younger kids', emoji: '📐', payLow: 10, payHigh: 25, timesPerWeek: 2, minAge: 13, needsAdult: true, kind: 'skills', tip: 'Reading, math, or a game you are great at. Patience is the real skill.' },
  { id: 'babysit', name: 'Babysitting', emoji: '👶', payLow: 15, payHigh: 25, timesPerWeek: 2, minAge: 13, needsAdult: true, kind: 'neighborhood', tip: 'Take a babysitting safety course first. Parents will pay more for it.' },
  { id: 'tech-help', name: 'Tech help for grandparents', emoji: '📶', payLow: 10, payHigh: 20, timesPerWeek: 1, minAge: 12, needsAdult: true, kind: 'skills', tip: 'Setting up phones, printers, and video calls. Explain slowly.' },
  { id: 'referee', name: 'Referee or coach little kids', emoji: '🏁', payLow: 15, payHigh: 30, timesPerWeek: 1, minAge: 14, needsAdult: true, kind: 'skills', tip: 'Ask your sports league. Weekend mornings are prime time.' },
  { id: 'part-time', name: 'Part-time job', emoji: '🏪', payLow: 60, payHigh: 120, timesPerWeek: 2, minAge: 15, needsAdult: true, kind: 'skills', tip: 'A few shifts a week. Check your local minimum age and hours rules.' },
];

export interface EarnEstimate extends EarnIdea {
  /** Midpoint pay per job. */
  payTypical: number;
  weeklyPotential: number;
  monthlyPotential: number;
  yearlyPotential: number;
}

/** Ideas a kid of `age` can do, with weekly/monthly/yearly potential. */
export function earnIdeasForAge(age: number): EarnEstimate[] {
  return EARN_IDEAS.filter((i) => age >= i.minAge)
    .map((i) => {
      const payTypical = (i.payLow + i.payHigh) / 2;
      const weeklyPotential = payTypical * i.timesPerWeek;
      return {
        ...i,
        payTypical,
        weeklyPotential,
        monthlyPotential: (weeklyPotential * 52) / 12,
        yearlyPotential: weeklyPotential * 52,
      };
    })
    .sort((a, b) => b.weeklyPotential - a.weeklyPotential);
}
