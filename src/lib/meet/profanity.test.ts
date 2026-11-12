import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isBlocked } from './profanity.ts'

const blocks = (words: string[]) => {
  for (const w of words) assert.equal(isBlocked(w), true, `should block "${w}"`)
}
const allows = (words: string[]) => {
  for (const w of words) assert.equal(isBlocked(w), false, `should allow "${w}"`)
}

test('English profanity', () => {
  blocks(['fuck', 'FUCK', 'Fucking', 'motherfucker', 'shit', 'bullshit', 'bitch', 'asshole', 'ass', 'asses', 'dick', 'cunt', 'cunts', 'boobs', 'tits', 'porn', 'wtf', 'stfu', 'slut', 'whore', 'bastard'])
})

test('leetspeak, separators and repeated letters', () => {
  blocks(['f.u.c.k', 'f-u-c-k', 'f_u_c_k', 'f*u*c*k', 'b00b', 'b00bs', 'sh1t', '5h1t', 'shiiit', 'shiiiiiiit', 'fuuuuck', 'a$$', '@ss', 'a55h01e', 'b!tch', 'p0rn', 'sh!t'])
})

test('spaced-out letters and fragments', () => {
  blocks(['f u c k', 's h i t', 'fu ck', 'a ss'])
})

test('look-alike letters and accents', () => {
  blocks(['ｆｕｃｋ', 'fսck', 'shіt', 'fück', 'shít'])
})

test('Hinglish, romanised', () => {
  blocks([
    'chutiya', 'chootiya', 'chutiye', 'chutia', 'Chutiyaaa', 'choot',
    'bhenchod', 'behenchod', 'benchod', 'bhanchod', 'bhencho', 'madarchod', 'maderchod', 'betichod', 'bakchodi',
    'bhosdike', 'bhosadi', 'bsdk', 'bc', 'mc', 'bkl', 'mkc',
    'lund', 'lauda', 'lawda', 'lavde', 'lodu',
    'gaand', 'gand', 'gaandu', 'gandu',
    'randi', 'harami', 'haramkhor', 'haramzada',
    'kutta', 'kutte', 'jhaat', 'jhatu', 'tatti', 'bhadwa', 'chodu',
  ])
})

test('Hinglish with dodges', () => {
  blocks(['ch00tiya', 'chu.ti.ya', 'bh3nch0d', 'b.c', 'l@uda', 'c h u t i y a'])
})

test('Devanagari', () => {
  blocks(['चूतिया', 'बहनचोद', 'मादरचोद', 'भोसड़ी', 'भोसडी', 'लौड़ा', 'गांड', 'गाँड', 'रंडी', 'हरामी'])
})

test('no Scunthorpe problem: common words pass', () => {
  allows([
    'class', 'classic', 'assess', 'assessment', 'assassin', 'passion', 'bass', 'grass', 'glasses', 'compass', 'mass', 'ambassador',
    'cassette', 'assignment', 'assume', 'arsenal', 'scunthorpe', 'title', 'titan', 'competitive', 'petition', 'constitution',
    'cucumber', 'document', 'circumstance', 'accumulate', 'analysis', 'analyst', 'canal', 'sextant', 'sussex', 'essex',
    'therapist', 'grape', 'scrape', 'cockpit', 'peacock', 'cocktail', 'hancock', 'dickens', 'shift', 'shitake', 'shiitake',
    'hello', 'hell', 'damn', 'crap', 'sucks', 'button', 'butterfly', 'skyscraper', 'spice', 'pushpin', 'mishap', 'shuttle',
    'swanky', 'snigger', 'niggle', 'fukushima', 'fukuoka', 'kung fu', 'parachute', 'chutney', 'uganda', 'gandhi', 'grandiose',
    'brandish', 'haram', 'kuttappan', 'tattoo', 'chhod do', 'chodo', 'bench', 'benchmark', 'because', 'deadline', 'burnout',
  ])
})

test('names and Indian words with a root inside pass', () => {
  allows(['kshitij', 'Kshitij', 'shital', 'Ashit', 'sheetal', 'lunden', 'saala', 'kamina', 'yaar', 'jugaad', 'chill', 'bakwas'])
})

test('ordinary one-word answers pass', () => {
  allows(['tired', 'busy', 'meetings', 'kubernetes', 'c++', 'node.js', 'flaky tests', 'on-call', 'deploys', 'productive', 'chaos', 'sleepy', '🚀', 'खुश', 'थकान'])
})

test('masked on purpose', () => {
  blocks(['f**k', 'sh*t', 's#it', 'a**', 'b**ch', 'sh**', 'f*cking', 'c*nt', 'd*ck', 'p*ssy', 'ch*tiya'])
})

test('more look-alikes and spellings', () => {
  blocks(['ƒuck', 'fᴜck', 'ꜱʜɪᴛ', 'fuq', 'phuk', 'mofo', 'kunt'])
})

test('a mask alone is not a swear: languages, algorithms, markdown', () => {
  allows(['c#', 'f#', 'A*', '*nix', '#1', '#rust', '**', 'd*mn', 'h*ll', 'c*de', '**kotlin**', '*important*', 'fix#123'])
})

test('Indian surnames and cricket words with a root inside pass', () => {
  allows(['Dikshit', 'dikshit', 'Shitij', 'mishit', 'Kshitija'])
})
