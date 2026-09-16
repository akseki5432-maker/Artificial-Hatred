/**
 * Seed catalog of things kids save for, plus the small "daily stuff" that quietly
 * eats an allowance. Prices are typical US list prices and are meant to be
 * refreshed from an online search or edited by the family - see the Prices page.
 */

export type GoalCategory = 'games' | 'tech' | 'toys' | 'sports' | 'experiences' | 'big-dreams' | 'custom';

export interface CatalogItem {
  id: string;
  name: string;
  emoji: string;
  category: GoalCategory;
  /** Typical price in USD when the catalog was written. */
  price: number;
  currency: string;
  /** Short kid-friendly note. */
  note?: string;
  /** Search query that finds this item's price online. */
  searchQuery?: string;
}

export const CATALOG_LAST_REVIEWED = '2026-09';

export const GOAL_CATALOG: CatalogItem[] = [
  // games
  { id: 'video-game', name: 'New video game', emoji: '🎮', category: 'games', price: 69.99, currency: 'USD', searchQuery: 'new AAA video game price' },
  { id: 'nintendo-switch-2', name: 'Nintendo Switch 2', emoji: '🕹️', category: 'games', price: 449.99, currency: 'USD', searchQuery: 'Nintendo Switch 2 console price' },
  { id: 'ps5', name: 'PlayStation 5', emoji: '🎯', category: 'games', price: 499.99, currency: 'USD', searchQuery: 'PlayStation 5 console price' },
  { id: 'game-pass-year', name: 'A year of Game Pass', emoji: '📀', category: 'games', price: 239.88, currency: 'USD', note: 'That is a monthly subscription times twelve.', searchQuery: 'Xbox Game Pass Ultimate monthly price' },
  { id: 'roblox-robux', name: '10,000 Robux', emoji: '🟥', category: 'games', price: 99.99, currency: 'USD', searchQuery: '10000 Robux price' },
  // tech
  { id: 'headphones', name: 'Wireless headphones', emoji: '🎧', category: 'tech', price: 149.99, currency: 'USD', searchQuery: 'wireless headphones for kids price' },
  { id: 'earbuds', name: 'Wireless earbuds', emoji: '🎵', category: 'tech', price: 79.99, currency: 'USD', searchQuery: 'wireless earbuds price' },
  { id: 'tablet', name: 'Tablet', emoji: '📱', category: 'tech', price: 349, currency: 'USD', searchQuery: 'iPad price' },
  { id: 'smartphone', name: 'Smartphone', emoji: '📲', category: 'tech', price: 599, currency: 'USD', searchQuery: 'iPhone 17 price' },
  { id: 'laptop', name: 'Laptop', emoji: '💻', category: 'tech', price: 799, currency: 'USD', searchQuery: 'student laptop price' },
  { id: 'smartwatch', name: 'Smartwatch', emoji: '⌚', category: 'tech', price: 249, currency: 'USD', searchQuery: 'Apple Watch SE price' },
  { id: 'camera', name: 'Instant camera', emoji: '📸', category: 'tech', price: 79.99, currency: 'USD', searchQuery: 'Instax Mini 12 price' },
  { id: 'gaming-pc', name: 'Gaming PC', emoji: '🖥️', category: 'tech', price: 1199, currency: 'USD', searchQuery: 'entry level gaming PC price' },
  // toys
  { id: 'lego-set', name: 'Big LEGO set', emoji: '🧱', category: 'toys', price: 99.99, currency: 'USD', searchQuery: 'LEGO set price' },
  { id: 'lego-millennium-falcon', name: 'LEGO Millennium Falcon', emoji: '🚀', category: 'toys', price: 849.99, currency: 'USD', searchQuery: 'LEGO UCS Millennium Falcon price' },
  { id: 'trading-card-box', name: 'Trading card booster box', emoji: '🃏', category: 'toys', price: 149.99, currency: 'USD', searchQuery: 'Pokemon booster box price' },
  { id: 'plush', name: 'Giant plushie', emoji: '🧸', category: 'toys', price: 39.99, currency: 'USD', searchQuery: 'giant plush toy price' },
  { id: 'rc-car', name: 'RC car', emoji: '🏎️', category: 'toys', price: 89.99, currency: 'USD', searchQuery: 'RC car for kids price' },
  { id: 'drone', name: 'Mini drone', emoji: '🛸', category: 'toys', price: 129, currency: 'USD', searchQuery: 'mini drone with camera price' },
  // sports & outdoors
  { id: 'bike', name: 'Bike', emoji: '🚲', category: 'sports', price: 299, currency: 'USD', searchQuery: 'kids mountain bike price' },
  { id: 'skateboard', name: 'Skateboard', emoji: '🛹', category: 'sports', price: 89.99, currency: 'USD', searchQuery: 'complete skateboard price' },
  { id: 'scooter', name: 'Electric scooter', emoji: '🛴', category: 'sports', price: 399, currency: 'USD', searchQuery: 'electric scooter for teens price' },
  { id: 'soccer-cleats', name: 'Soccer cleats', emoji: '⚽', category: 'sports', price: 69.99, currency: 'USD', searchQuery: 'youth soccer cleats price' },
  { id: 'basketball-shoes', name: 'Basketball shoes', emoji: '🏀', category: 'sports', price: 129.99, currency: 'USD', searchQuery: 'kids basketball shoes price' },
  { id: 'sneakers', name: 'Cool sneakers', emoji: '👟', category: 'sports', price: 119.99, currency: 'USD', searchQuery: 'Nike Air Force 1 price' },
  // experiences
  { id: 'movie-night', name: 'Movie + popcorn', emoji: '🍿', category: 'experiences', price: 22, currency: 'USD', searchQuery: 'average movie ticket price' },
  { id: 'theme-park', name: 'Theme park day', emoji: '🎢', category: 'experiences', price: 139, currency: 'USD', searchQuery: 'Universal Studios 1 day ticket price' },
  { id: 'concert', name: 'Concert ticket', emoji: '🎤', category: 'experiences', price: 135, currency: 'USD', searchQuery: 'average concert ticket price' },
  { id: 'summer-camp', name: 'Week of summer camp', emoji: '🏕️', category: 'experiences', price: 450, currency: 'USD', searchQuery: 'summer camp week cost' },
  { id: 'museum-pass', name: 'Museum or zoo membership', emoji: '🦖', category: 'experiences', price: 120, currency: 'USD', searchQuery: 'zoo family membership price' },
  // big dreams
  { id: 'first-car-fund', name: 'First car fund', emoji: '🚗', category: 'big-dreams', price: 8000, currency: 'USD', note: 'A used starter car. Big, but the math still works.', searchQuery: 'average used car price for teens' },
  { id: 'college-textbooks', name: 'A year of college books', emoji: '📚', category: 'big-dreams', price: 1200, currency: 'USD', searchQuery: 'average cost of college textbooks per year' },
  { id: 'trip-abroad', name: 'Trip abroad', emoji: '✈️', category: 'big-dreams', price: 2500, currency: 'USD', searchQuery: 'average cost international trip' },
  { id: 'emergency-fund', name: 'Rainy-day fund', emoji: '☔', category: 'big-dreams', price: 500, currency: 'USD', note: 'Money that sits there so surprises are not scary.' },
];

export interface HabitItem {
  id: string;
  name: string;
  emoji: string;
  price: number;
  currency: string;
  /** Typical purchases per week. */
  timesPerWeek: number;
  searchQuery?: string;
}

/** The small, repeated purchases that add up. */
export const HABIT_CATALOG: HabitItem[] = [
  { id: 'candy', name: 'Candy bar', emoji: '🍫', price: 1.75, currency: 'USD', timesPerWeek: 5, searchQuery: 'candy bar price' },
  { id: 'chips', name: 'Bag of chips', emoji: '🥔', price: 2.25, currency: 'USD', timesPerWeek: 4, searchQuery: 'single serve chips price' },
  { id: 'soda', name: 'Soda or energy drink', emoji: '🥤', price: 2.5, currency: 'USD', timesPerWeek: 5, searchQuery: 'bottle of soda price' },
  { id: 'boba', name: 'Boba tea', emoji: '🧋', price: 6.5, currency: 'USD', timesPerWeek: 2, searchQuery: 'boba tea price' },
  { id: 'coffee-drink', name: 'Fancy coffee drink', emoji: '☕', price: 5.75, currency: 'USD', timesPerWeek: 3, searchQuery: 'Starbucks frappuccino price' },
  { id: 'fast-food', name: 'Fast-food meal', emoji: '🍔', price: 10.5, currency: 'USD', timesPerWeek: 2, searchQuery: 'fast food combo meal price' },
  { id: 'vending', name: 'Vending machine snack', emoji: '🍬', price: 1.5, currency: 'USD', timesPerWeek: 5, searchQuery: 'vending machine snack price' },
  { id: 'app-purchase', name: 'In-app purchase', emoji: '💎', price: 4.99, currency: 'USD', timesPerWeek: 2, searchQuery: 'in app purchase gems price' },
  { id: 'card-pack', name: 'Trading card pack', emoji: '🎴', price: 4.99, currency: 'USD', timesPerWeek: 2, searchQuery: 'Pokemon booster pack price' },
  { id: 'gacha', name: 'Blind box / gacha toy', emoji: '🎁', price: 8, currency: 'USD', timesPerWeek: 1, searchQuery: 'blind box toy price' },
  { id: 'ice-cream', name: 'Ice cream', emoji: '🍦', price: 4.5, currency: 'USD', timesPerWeek: 2, searchQuery: 'ice cream cone price' },
  { id: 'slushie', name: 'Slushie', emoji: '🧊', price: 2.75, currency: 'USD', timesPerWeek: 3, searchQuery: 'slushie price' },
];

export const CATEGORY_LABELS: Record<GoalCategory, string> = {
  games: 'Games',
  tech: 'Tech',
  toys: 'Toys',
  sports: 'Sports & outdoors',
  experiences: 'Experiences',
  'big-dreams': 'Big dreams',
  custom: 'My own goals',
};

export function findCatalogItem(id: string): CatalogItem | undefined {
  return GOAL_CATALOG.find((i) => i.id === id);
}

export function findHabit(id: string): HabitItem | undefined {
  return HABIT_CATALOG.find((i) => i.id === id);
}
