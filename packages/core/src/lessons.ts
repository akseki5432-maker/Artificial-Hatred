/**
 * Short money lessons for kids, each with a tiny quiz. Written for ages 8-14;
 * every lesson is a few sentences, one big idea, and three questions.
 */

export interface QuizQuestion {
  q: string;
  choices: string[];
  /** Index into choices. */
  answer: number;
  why: string;
}

export interface Lesson {
  id: string;
  emoji: string;
  title: string;
  /** One-sentence big idea. */
  idea: string;
  /** 2-4 short paragraphs. */
  body: string[];
  /** Something to try this week. */
  challenge: string;
  quiz: QuizQuestion[];
  minAge: number;
}

export const LESSONS: Lesson[] = [
  {
    id: 'adds-up',
    emoji: '🧮',
    title: 'Small money adds up',
    idea: 'A little bit, every time, becomes a lot.',
    minAge: 6,
    body: [
      'Three dollars a day sounds tiny. But there are 365 days in a year, so that is more than a thousand dollars.',
      'The same trick works backwards. A snack every day is also a thousand dollars a year, just going the other way.',
      'Whenever you spend or save a little, ask: what is this times 52 weeks? The answer is usually surprising.',
    ],
    challenge: 'Pick one thing you buy often. Work out what it costs in a year. Say the number out loud.',
    quiz: [
      { q: 'If you get $5 a week, how much is that in a year?', choices: ['$60', '$260', '$500'], answer: 1, why: 'There are 52 weeks in a year, and 5 × 52 = 260.' },
      { q: 'A $2 snack every school day (5 days a week) costs about how much in a year?', choices: ['$100', '$520', '$2,000'], answer: 1, why: '$2 × 5 days = $10 a week, and $10 × 52 weeks = $520.' },
      { q: 'Which adds up to more over a year?', choices: ['$1 every day', '$5 every week', 'They are about the same'], answer: 0, why: '$1 a day is $365 a year. $5 a week is $260.' },
    ],
  },
  {
    id: 'pay-yourself-first',
    emoji: '🫙',
    title: 'Pay yourself first',
    idea: 'Save the moment money arrives, before you can spend it.',
    minAge: 6,
    body: [
      'Most people plan to save "whatever is left". Nothing is ever left.',
      'Flip it around. The moment you get money, move part of it into a Save jar. Then spend what remains without guilt.',
      'Money you never see in your pocket is money you never miss. This one habit is what separates people who have savings from people who do not.',
    ],
    challenge: 'Next allowance day, put your Save share away first, before buying anything.',
    quiz: [
      { q: 'When is the best time to save part of your allowance?', choices: ['At the end of the week, if some is left', 'The moment you get it', 'Only on birthdays'], answer: 1, why: 'Saving first means it always happens. Saving what is left means it rarely does.' },
      { q: 'You get $10 and your plan is to save 40%. How much goes in the Save jar?', choices: ['$4', '$6', '$10'], answer: 0, why: '40% of $10 is $4.' },
      { q: 'What is the Spend jar for?', choices: ['Nothing, spending is bad', 'Fun stuff, without guilt', 'Emergencies only'], answer: 1, why: 'A plan with no fun money never lasts. The Spend jar is the fun part, on purpose.' },
    ],
  },
  {
    id: 'wants-needs',
    emoji: '🤔',
    title: 'Wait a week',
    idea: 'The urge to buy something fades faster than you think.',
    minAge: 7,
    body: [
      'Shops and games are designed to make you want things right now. That feeling is real, but it is also temporary.',
      'Try the wait rule: for anything over a set amount, wait one week before buying it. If you still want it, great, buy it.',
      'Most of the time you will forget about it. That is not you losing something. That is you keeping your money.',
    ],
    challenge: 'Write down the next thing you want to buy and the date. Look at the note in seven days.',
    quiz: [
      { q: 'What does the wait rule ask you to do?', choices: ['Never buy things', 'Wait a bit before bigger buys', 'Ask a friend'], answer: 1, why: 'Waiting lets the "I want it now" feeling settle so you can decide with a clear head.' },
      { q: 'You waited a week and still really want it. What now?', choices: ['Buy it, that is the point', 'Wait forever', 'Feel bad'], answer: 0, why: 'The rule is not about never buying. It is about buying things you actually want.' },
      { q: 'Which is a need?', choices: ['A new skin in a game', 'Lunch', 'A second pair of the same sneakers'], answer: 1, why: 'Needs are things you cannot do without. Most purchases are wants, which is fine, as long as you know it.' },
    ],
  },
  {
    id: 'compounding',
    emoji: '🌱',
    title: 'Money that makes money',
    idea: 'Saved money can earn extra, and the extra earns extra too.',
    minAge: 9,
    body: [
      'When money sits in a savings account or an investment, it earns a little bit called interest or a return.',
      'Next year, you earn on the original money and on last year\'s extra. That is compounding. It starts slow and then gets wild.',
      'The rule of 72: divide 72 by the yearly rate to see how many years it takes money to double. At 7%, about 10 years. At 10%, about 7.',
      'The biggest ingredient is time. A kid who starts at 10 has a huge head start on an adult who starts at 30.',
    ],
    challenge: 'Ask a grown-up if they will pay you interest on money you keep saved. Even 1% a month is a great deal.',
    quiz: [
      { q: 'At 7% a year, roughly how long does money take to double?', choices: ['About 2 years', 'About 10 years', 'About 50 years'], answer: 1, why: '72 ÷ 7 is about 10.' },
      { q: 'Compounding means…', choices: ['Buying two of everything', 'Earning on your earnings', 'Spending less every year'], answer: 1, why: 'The extra you earned last year earns extra this year.' },
      { q: 'Who ends up with more at 40, if both save the same amount each month?', choices: ['Someone who started at 12', 'Someone who started at 30', 'Same, same amount saved'], answer: 0, why: 'Time is the secret ingredient. Earlier money has more years to grow.' },
    ],
  },
  {
    id: 'earning',
    emoji: '💪',
    title: 'Two ways to have more',
    idea: 'You can spend less, or you can earn more. The best plan does both.',
    minAge: 8,
    body: [
      'Everyone talks about cutting back. But there is a limit to how little you can spend, and no limit to what you can earn.',
      'Kids earn by doing things other people would rather not do: walking dogs, raking leaves, selling old toys, helping with tech.',
      'Money you earn on top of allowance is money you were living without. Save most of it and it grows without you noticing.',
    ],
    challenge: 'Offer to do one paid job this week for a neighbor or family member. Agree on the price before you start.',
    quiz: [
      { q: 'You earn $20 from dog walking. What is the smartest first move?', choices: ['Save most of it', 'Spend it, it is extra', 'Hide it'], answer: 0, why: 'You already lived without it. Saving it costs you nothing you were used to.' },
      { q: 'Before doing a paid job you should…', choices: ['Agree on the price', 'Do it and see what they give you', 'Skip the boring parts'], answer: 0, why: 'Agreeing first avoids awkward surprises and shows you are serious.' },
      { q: 'Which is true?', choices: ['You can only cut spending so far, but earning has no ceiling', 'Earning is for adults', 'Saving is pointless'], answer: 0, why: 'Cutting has a floor. Earning does not.' },
    ],
  },
  {
    id: 'give',
    emoji: '💝',
    title: 'Sharing is part of the plan',
    idea: 'Giving a little makes money feel less like a scoreboard.',
    minAge: 6,
    body: [
      'A Share jar is for gifts, helping a cause you care about, or treating a friend.',
      'It does not need to be big. Even 10% teaches you that money is a tool, not a trophy.',
      'People who give a little tend to feel richer, not poorer. Try it and see.',
    ],
    challenge: 'Decide what your Share jar is for this month. A charity, a gift, or a surprise for someone.',
    quiz: [
      { q: 'What is the Share jar for?', choices: ['Gifts and helping others', 'Buying games', 'Savings'], answer: 0, why: 'Sharing is its own jar so it always happens, like saving.' },
      { q: 'Does sharing have to be a lot?', choices: ['Yes, or it does not count', 'No, small and regular is the point', 'Only on holidays'], answer: 1, why: 'The habit matters more than the amount.' },
      { q: 'You get $10 with a 10% Share plan. How much is for sharing?', choices: ['$1', '$5', '$10'], answer: 0, why: '10% of $10 is $1.' },
    ],
  },
];

export function lessonsForAge(age: number | null | undefined): Lesson[] {
  if (age === null || age === undefined) return LESSONS;
  return LESSONS.filter((l) => age >= l.minAge);
}

export function findLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}
