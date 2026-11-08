/**
 * 40 fun animal nicknames for the Landing page placeholder and randomizer.
 */
export const FUN_NAMES = [
    'Sleepy Otter',
    'Velvet Fox',
    'Dancing Puffin',
    'Cosmic Gecko',
    'Bouncing Panda',
    'Sneaky Badger',
    'Curious Owl',
    'Dizzy Penguin',
    'Gentle Moose',
    'Jolly Koala',
    'Speedy Turtle',
    'Wobbly Duck',
    'Clever Raccoon',
    'Happy Beaver',
    'Fuzzy Alpaca',
    'Mighty Hedgehog',
    'Brave Sparrow',
    'Playful Seal',
    'Dreamy Sloth',
    'Zippy Hamster',
    'Sunny Dolphin',
    'Brisk Rabbit',
    'Cheery Frog',
    'Quiet Lynx',
    'Whimsical Bear',
    'Nimble Squirrel',
    'Golden Hawk',
    'Dapper Walrus',
    'Spunky Ferret',
    'Loyal Wolf',
    'Peppy Parrot',
    'Lucky Toucan',
    'Cozy Marmot',
    'Wild Flamingo',
    'Silly Lemur',
    'Merry Meerkat',
    'Crafty Coyote',
    'Chirpy Finch',
    'Swift Cheetah',
    'Noble Eagle',
];

export const getRandomFunName = () => {
    const idx = Math.floor(Math.random() * FUN_NAMES.length);
    return FUN_NAMES[idx];
};
