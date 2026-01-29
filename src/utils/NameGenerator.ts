const adjectives = [
  'Swift', 'Brave', 'Clever', 'Mighty', 'Gentle', 'Wise', 'Bold', 'Calm',
  'Fierce', 'Happy', 'Proud', 'Silent', 'Wild', 'Noble', 'Bright', 'Dark',
  'Golden', 'Silver', 'Crimson', 'Azure', 'Mystic', 'Ancient', 'Young', 'Elder',
  'Lucky', 'Sly', 'Quick', 'Strong', 'Agile', 'Steady', 'Curious', 'Playful',
  'Mysterious', 'Radiant', 'Shadow', 'Storm', 'Thunder', 'Lightning', 'Frost', 'Flame',
  'Cosmic', 'Stellar', 'Lunar', 'Solar', 'Crystal', 'Velvet', 'Emerald', 'Ruby',
  'Sapphire', 'Amber', 'Jade', 'Pearl', 'Diamond', 'Onyx', 'Topaz', 'Coral'
];

const animals = [
  'Penguin', 'Fox', 'Wolf', 'Bear', 'Eagle', 'Hawk', 'Owl', 'Raven',
  'Tiger', 'Lion', 'Panther', 'Leopard', 'Cheetah', 'Jaguar', 'Lynx', 'Puma',
  'Dragon', 'Phoenix', 'Griffin', 'Unicorn', 'Pegasus', 'Chimera', 'Sphinx', 'Kraken',
  'Dolphin', 'Whale', 'Shark', 'Octopus', 'Turtle', 'Seal', 'Otter', 'Walrus',
  'Falcon', 'Sparrow', 'Heron', 'Crane', 'Swan', 'Peacock', 'Flamingo', 'Albatross',
  'Rabbit', 'Hare', 'Squirrel', 'Raccoon', 'Badger', 'Beaver', 'Mongoose', 'Ferret',
  'Cobra', 'Viper', 'Python', 'Anaconda', 'Salamander', 'Gecko', 'Chameleon', 'Iguana'
];

/**
 * Generates a random display name in the format "Adjective Animal"
 * @returns A random display name like "Swift Penguin" or "Brave Fox"
 */
export function generateRandomDisplayName(): string {
  const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomAnimal = animals[Math.floor(Math.random() * animals.length)];
  return `${randomAdjective} ${randomAnimal}`;
}

/**
 * Generates a random display name with a seed for consistency
 * @param seed A string to use as a seed (e.g., userId)
 * @returns A consistent random display name based on the seed
 */
export function generateSeededDisplayName(seed: string): string {
  // Simple hash function to convert string to number
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use the hash to pick consistent adjective and animal
  const adjectiveIndex = Math.abs(hash) % adjectives.length;
  const animalIndex = Math.abs(hash >> 8) % animals.length;
  
  return `${adjectives[adjectiveIndex]} ${animals[animalIndex]}`;
}
