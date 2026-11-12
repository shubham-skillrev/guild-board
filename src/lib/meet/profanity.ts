/**
 * Kers' profanity filter for meeting mode (docs/06-meeting-mode.md): runs on
 * the server before a word-cloud entry is stored or broadcast. A blocked
 * entry is dropped quietly; the sender sees "Kers didn't like that one".
 *
 * English plus common Hindi / Hinglish slang (romanised and Devanagari). The
 * input is normalised first, so the usual dodges land on the same word:
 *
 *   case, accents, full-width and Cyrillic look-alikes   "ＦＵＣＫ", "fսck"
 *   leetspeak                                           "b00b", "sh1t", "a$$"
 *   separators inside a word                            "f.u.c.k", "f-u-c-k"
 *   spaced-out letters                                  "f u c k", "fu ck"
 *   repeated letters                                    "shiiit", "fuuuck"
 *   Hinglish spellings (oo/u, ee/i, w/v, y/i, ph/f)     "chootiya", "lawda"
 *
 * Avoiding the Scunthorpe problem: only roots that never occur inside a
 * normal word are matched anywhere ("fuck", "bitch"). Short ones that do
 * ("ass" in class, "cum" in document, "tit" in title, "anal" in analysis,
 * "cock" in peacock, "rape" in grape) only match as the whole word, with a
 * plural. Names that contain a root (Kshitij, Shital, Ashit) are allowed
 * explicitly. A miss costs one rude word on screen for a moment; a false
 * hit quietly drops someone's honest answer, so the lists lean careful.
 *
 * No imports: the unit tests run it straight under `node --test`.
 */

const LEET_I: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '6': 'g', '7': 't', '8': 'b', '9': 'g', '@': 'a', '$': 's', '!': 'i', '|': 'i', '+': 't', '€': 'e', '¡': 'i' }
/** The same, reading 1 and | as l ("a55h01e"). */
const LEET_L: Record<string, string> = { ...LEET_I, '1': 'l', '|': 'l' }

/** Cyrillic and other letters that look Latin. */
const HOMOGLYPHS: Record<string, string> = { 'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'к': 'k', 'і': 'i', 'ј': 'j', 'ѕ': 's', 'ԁ': 'd', 'ɡ': 'g', 'ս': 'u', 'ν': 'v', 'ο': 'o', 'α': 'a',
  // Latin letters NFKD leaves alone: f with a hook, and small capitals ("fᴜck").
  'ƒ': 'f', 'ᴀ': 'a', 'ʙ': 'b', 'ᴄ': 'c', 'ᴅ': 'd', 'ᴇ': 'e', 'ꜰ': 'f', 'ɢ': 'g', 'ʜ': 'h', 'ɪ': 'i', 'ᴊ': 'j', 'ᴋ': 'k', 'ʟ': 'l',
  'ᴍ': 'm', 'ɴ': 'n', 'ᴏ': 'o', 'ᴘ': 'p', 'ʀ': 'r', 'ꜱ': 's', 'ᴛ': 't', 'ᴜ': 'u', 'ᴠ': 'v', 'ᴡ': 'w', 'ʏ': 'y', 'ᴢ': 'z' }

/**
 * Lower-cased, accents and zero-width characters gone, full-width folded,
 * look-alikes mapped. Devanagari keeps its vowel signs (they carry the word)
 * but loses the nukta and folds chandrabindu into anusvara, so ड़/ड and
 * गाँड/गांड compare equal.
 */
export function baseForm(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-़ͯ​-‍⁠﻿]/g, '')
    .replace(/ँ/g, 'ं')
    .toLowerCase()
    .replace(/./gu, c => HOMOGLYPHS[c] ?? c)
    .normalize('NFC')
}

/** A word as a pattern where every letter may repeat ("shit" -> s+h+i+t+), keeping real doubles ("boob" -> b+o{2,}b+). */
function runs(word: string): string {
  return word.replace(/(.)\1*/g, run => (run.length === 1 ? `${run}+` : `${run[0]}{${run.length},}`))
}

// ─── English (matched on the strict form: letters only, repeats allowed) ───

/** Never inside a normal word: blocked wherever they appear. */
const EN_ANYWHERE = [
  'fuck', 'fcuk', 'fvck', 'phuck', 'fck', 'fukk', 'motherf', 'shit', 'bitch', 'biatch', 'whore', 'slut', 'nigger', 'nigga',
  'faggot', 'cocksucker', 'asshole', 'arsehole', 'dickhead', 'jackass', 'dumbass', 'smartass', 'asshat', 'asswipe',
  'wanker', 'wanking', 'porn', 'pussy', 'bastard', 'douche', 'twat', 'bollock', 'cumshot', 'dildo', 'blowjob', 'handjob', 'jizz',
]
/** Short, or inside normal words: only the whole word (plus a plural). */
const EN_EXACT = [
  'ass', 'arse', 'tit', 'titty', 'titties', 'boob', 'boobies', 'cum', 'anal', 'sex', 'sexy', 'penis', 'vagina', 'rape', 'raped',
  'rapist', 'piss', 'pissed', 'dick', 'cock', 'prick', 'retard', 'retarded', 'shag', 'fag', 'fuk', 'fuker', 'fukin', 'fuking',
  'wank', 'stfu', 'gtfo', 'wtf', 'fml', 'mf', 'milf', 'horny', 'nude', 'nudes', 'cunt',
  'fuq', 'phuk', 'phuck', 'mofo', 'kunt',
]
/** Blocked at the start of a word ("cunts", "cunty"), not inside one (Scunthorpe). */
const EN_PREFIX = ['cunt']

/** Words and names that contain a root and are fine. Removed before the anywhere check. */
const ALLOW = ['kshitij', 'shitij', 'shital', 'ashit', 'dikshit', 'mishit', 'shiitake', 'shitake', 'snigger']

const anywhere = EN_ANYWHERE.map(w => new RegExp(runs(w)))
const exact = EN_EXACT.map(w => new RegExp(`^(?:${runs(w)})(?:e?s)?$`))
const prefix = EN_PREFIX.map(w => new RegExp(`^${runs(w)}`))

// ─── Hindi / Hinglish, romanised (matched on the loose form) ───────────────

/**
 * The loose form: Hinglish has no fixed spelling, so long vowels, w/v, y/i,
 * ph/f and q/k are folded and every repeated letter collapses to one
 * ("chootiyaa" -> "chutia", "lawda" -> "lavda", "gaand" -> "gand").
 */
export function looseForm(strict: string): string {
  return strict
    .replace(/o{2,}/g, 'u')
    .replace(/e{2,}/g, 'i')
    .replace(/ph/g, 'f')
    .replace(/w/g, 'v')
    .replace(/q/g, 'k')
    .replace(/y/g, 'i')
    .replace(/(.)\1+/g, '$1')
}

const HI_ANYWHERE = [
  /chuti[ae]/,                 // chutiya, chutiye, chutiyapa
  /chutmar/,
  /bh?e?h?[ae]n+cho/,          // bhenchod, behenchod, bhanchod, benchod, bhencho
  /madh?[ae]?r?chod/,          // madarchod, maderchod, madharchod
  /[a-z]chod/,                 // betichod, bakchod... (but not "chod"/"chhod", to leave)
  /bhosa?d/, /bhosr/,          // bhosdike, bhosadi, bhosda, bhosri
  /haram(i|kh|z|j)/,           // harami, haramkhor, haramzada (not "haram" alone)
  /gandmar|gandfat/,
  /bhadv/,                     // bhadwa, bhadve
  /randibaj|randibaz/,
]
const HI_EXACT = [
  /^chut$/,                    // choot
  /^lund$/, /^lauda$/, /^lavd[aeiu]$/, /^lodu$/,
  /^gand(u|ia)?$/,             // gaand, gaandu (not gandhi)
  /^rand(i|va)$/,              // randi, randwa (not grandiose)
  /^kut(a|e|ia)$/,             // kutta, kutte, kuttiya
  /^jhan?t(u|e)?$/,            // jhaat, jhatu, jhant, jhantu
  /^chodu$/, /^chinal$/,
]
/** Abbreviations and words where collapsing doubles would hit something innocent: the strict form. */
const HI_STRICT = [/^(bc|mc|bkl|mkc|mkb|bsdk)$/, /^t+a+t{2,}[ie]+s?$/]

// ─── Devanagari (matched on the base form, anywhere) ───────────────────────

const DEVANAGARI = ['चूतिया', 'चुतिया', 'चूत', 'भेनचोद', 'बहनचोद', 'बहेनचोद', 'मादरचोद', 'चोद', 'भोसड़ी', 'भोसड़ा', 'भोसडीके', 'लौड़ा', 'लवड़ा', 'लंड', 'गांड', 'गाण्ड', 'रंडी', 'हरामी', 'हरामज़ादा', 'हरामखोर', 'झाट', 'भड़वा'].map(baseForm)

/** The ways one token may be read: letters only, and leetspeak read two ways. */
function readings(token: string): string[] {
  const leet = (map: Record<string, string>) => token.replace(/./gu, c => map[c] ?? c).replace(/[^\p{L}]/gu, '')
  return [...new Set([token.replace(/[^\p{L}]/gu, ''), leet(LEET_I), leet(LEET_L)])].filter(Boolean)
}

function blockedWord(strict: string): boolean {
  if (exact.some(r => r.test(strict)) || prefix.some(r => r.test(strict)) || HI_STRICT.some(r => r.test(strict))) return true
  if (HI_EXACT.some(r => r.test(looseForm(strict)))) return true
  // Allowed names and words become a gap the anywhere-roots can't match across.
  let s = strict
  for (const ok of ALLOW) s = s.split(ok).join('_')
  return anywhere.some(r => r.test(s)) || HI_ANYWHERE.some(r => r.test(looseForm(s)))
}

/** The tokens to check: each word, runs of single letters joined ("f u c k"), and the whole entry when it's all fragments ("fu ck"). */
function tokens(text: string): string[] {
  const parts = text.split(/\s+/).filter(Boolean)
  const out: string[] = [...parts]
  let run: string[] = []
  const flush = () => { if (run.length > 1) out.push(run.join('')); run = [] }
  for (const p of parts) {
    if ([...p].length === 1) run.push(p)
    else flush()
  }
  flush()
  if (parts.length > 1 && parts.every(p => [...p].length <= 3)) out.push(parts.join(''))
  return out
}

// ─── Masked on purpose ("f**k", "sh*t", "a**") ────────────────────────────

/** What a mask can stand in for: the word, plus the usual endings. */
const MASKABLE = ['fuck', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'ass', 'arse', 'asshole', 'twat', 'slut', 'whore', 'pussy', 'porn', 'bastard', 'wanker', 'chutiya', 'chod']
  .flatMap(w => ['', 's', 'y', 'ty', 'er', 'ers', 'ed', 'in', 'ing'].map(end => w + end))

/**
 * A token with `*` or `#` in it, read as a pattern where each mask is one
 * letter: blocked when it spells a MASKABLE word exactly. Three characters
 * at least, so "c#", "f#" and "A*" (languages, an algorithm) pass.
 */
function masked(token: string): boolean {
  if (!/[*#]/.test(token)) return false
  const t = [...token].map(c => (c === '*' || c === '#' ? '*' : LEET_I[c] ?? c)).join('').replace(/[^\p{L}*]/gu, '')
  if (t.length < 3 || !/\p{L}/u.test(t)) return false
  const re = new RegExp(`^${t.replace(/\*/g, '[a-z]')}$`)
  return MASKABLE.some(w => re.test(w))
}

/** Whether Kers drops this entry. */
export function isBlocked(text: string): boolean {
  const base = baseForm(text)
  if (DEVANAGARI.some(w => base.includes(w))) return true
  return tokens(base).some(t => masked(t) || readings(t).some(blockedWord))
}
