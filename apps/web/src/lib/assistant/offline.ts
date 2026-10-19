import 'server-only'
import type { Locale } from '@/i18n/config'
import type { Knowledge } from './knowledge'
import type { ChatAction } from './tools'

/**
 * Nora's built-in brain: answers from the website's own content without any AI
 * service, so the chat always works (and costs nothing). It recognises what the
 * visitor is asking about — galleries, events, contact, the agency, coverage
 * requests — in English, Swedish, Tamil and Malayalam, and replies with text plus
 * the same cards and buttons the AI version uses.
 */

type Reply = { text: string; actions: ChatAction[] }

// --- What the visitor is asking about -----------------------------------------

/** q is space-padded and punctuation-free; short Latin words must match whole words ("hi" ≠ "this"). */
const has = (q: string, words: string[]) =>
  words.some((w) => (w.length <= 4 && /^[a-z]+$/.test(w) ? q.includes(` ${w} `) : q.includes(w)))

const normalise = (text: string) =>
  ` ${text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()} `

const INTENT = {
  greet: ['hi', 'hello', 'hey', 'hej', 'hallå', 'god morgon', 'good morning', 'good evening', 'vanakkam', 'வணக்கம்', 'നമസ്കാരം', 'namaskaram', 'hai'],
  thanks: ['thank', 'thanks', 'tack', 'நன்றி', 'നന്ദി', 'nandri', 'nanni', 'great', 'perfect'],
  bye: ['bye', 'goodbye', 'hej då', 'see you', 'பிறகு', 'വിട'],
  contact: ['contact', 'phone', 'call', 'email', 'mail', 'address', 'where are you', 'located', 'location', 'office', 'kontakt', 'telefon', 'adress', 'தொடர்பு', 'தொலைபேசி', 'ബന്ധപ്പെ', 'ഫോൺ', 'whatsapp'],
  coverage: ['coverage', 'cover my', 'cover our', 'cover an', 'photograph', 'photographer', 'videograph', 'hire', 'book you', 'quote', 'price', 'cost', 'rate', 'shoot', 'film my', 'event coverage', 'bevakning', 'fotograf', 'boka', 'pris', 'பதிவு', 'புகைப்படக்கார', 'கவரேஜ்', 'കവറേജ്', 'ഫോട്ടോഗ്രാഫ'],
  events: ['ticket', 'tickets', 'upcoming', 'concert', 'event', 'show', 'biljett', 'evenemang', 'konsert', 'டிக்கெட்', 'நிகழ்வு', 'ടിക്കറ്റ്', 'പരിപാടി'],
  about: ['who are you', 'about', 'what do you do', 'who is', 'agency', 'company', 'different', 'special', 'services', 'experience', 'om er', 'om oss', 'vilka är', 'பற்றி', 'யார்', 'കുറിച്ച്', 'ആരാണ്'],
  galleries: ['gallery', 'galleries', 'photo', 'photos', 'picture', 'pictures', 'album', 'latest', 'recent', 'galleri', 'bilder', 'foto', 'படத்தொகுப்பு', 'புகைப்பட', 'ഗാലറി', 'ഫോട്ടോ', 'show me'],
  social: ['instagram', 'facebook', 'youtube', 'twitter', ' x ', 'social', 'follow'],
  language: ['language', 'swedish', 'tamil', 'malayalam', 'english', 'språk', 'மொழி', 'ഭാഷ'],
  accreditation: ['accredit', 'press association', 'press card', 'ackrediter', 'அங்கீகார', 'അംഗീകാര'],
}

/** Topic words that point at kinds of galleries even when no title word is typed. */
const TOPICS: { words: string[]; match: string[] }[] = [
  { words: ['royal', 'king', 'queen', 'kung', 'drottning', 'kunglig', 'royals', 'monarch', 'அரச', 'രാജ'], match: ['king', 'queen', 'royal', 'jubilee', 'birthday'] },
  { words: ['sport', 'sports', 'football', 'soccer', 'match', 'fotboll', 'tennis', 'uefa', 'விளையாட்டு', 'സ്പോർട്സ്', 'ഫുട്ബോൾ'], match: ['sweden', 'italy', 'belgium', 'slovakia', 'azerbaijan', 'zealand', 'bosnia', 'stockholm open', 'zlatan', 'uefa'] },
  { words: ['music', 'concert', 'singer', 'band', 'live', 'musik', 'konsert', 'இசை', 'சங்கீத', 'സംഗീത'], match: ['concert', 'live', 'singer', 'band', 'sreekumar', 'sithara', 'shaggy', 'kaj', 'loreen', 'darin', 'abba', 'larz', 'martinus', 'smash', 'vidhu', 'klara', 'louise', 'theoz', 'polar music'] },
  { words: ['diplomat', 'diplomacy', 'minister', 'prime minister', 'president', 'state visit', 'visit', 'politic', 'government', 'india', 'embassy', 'statsbesök', 'regering', 'அமைச்சர்', 'பிரதமர்', 'മന്ത്രി', 'പ്രധാനമന്ത്രി'], match: ['modi', 'prime minister', 'pm ', 'minister', 'jaishank', 'kristersson', 'billström', 'president', 'visit', 'dousa', 'presidency', 'polar star'] },
  { words: ['nobel'], match: ['nobel'] },
  { words: ['dance', 'culture', 'folk', 'festival', 'dans', 'kultur', 'நடனம்', 'നൃത്ത'], match: ['dance', 'folk', 'kathakali', 'serbian'] },
  { words: ['space', 'astronaut', 'rymd'], match: ['wandt', 'astronaut'] },
]

const STOP = new Set(['the', 'and', 'for', 'with', 'show', 'me', 'any', 'have', 'you', 'photos', 'photo', 'gallery', 'galleries', 'pictures', 'of', 'from', 'some', 'please', 'can', 'see', 'want', 'like', 'about', 'what', 'is', 'are', 'a', 'an', 'in', 'on', 'to', 'do', 'your', 'my', 'i', 'och', 'av', 'från', 'visa', 'bilder', 'på', 'har', 'ni'])

function findGalleries(q: string, k: Knowledge, limit = 6) {
  const words = q.split(/[^\p{L}\p{M}\p{N}]+/u).filter((w) => w.length > 2 && !STOP.has(w))
  const topicMatches = TOPICS.filter((t) => has(q, t.words)).flatMap((t) => t.match)
  const scored = k.galleries.map((g) => {
    const hay = `${g.title} ${g.slug.replace(/-/g, ' ')} ${g.about}`.toLowerCase()
    let score = 0
    for (const w of words) if (hay.includes(w)) score += w.length > 4 ? 3 : 2
    for (const m of topicMatches) if (hay.includes(m)) score += 2
    return { g, score }
  })
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.g)
}

// --- What Nora says, in each language -----------------------------------------

type Words = {
  hello: (name?: string) => string
  thanks: string
  bye: string
  contact: (k: Knowledge) => string
  coverage: string
  noEvents: string
  events: (n: number) => string
  about: (k: Knowledge) => string
  galleriesFound: (n: number) => string
  latest: string
  social: string
  language: string
  accreditation: (k: Knowledge) => string
  nameNoted: (name: string) => string
  fallback: string
  whatsappMsg: string
  coverageMsg: string
  labels: { photos: string; open: string; book: string; contact: string; galleries: string; about: string; events: string; instagram: string }
}

const W: Record<Locale, Words> = {
  en: {
    hello: (n) => `Hej${n ? ` ${n}` : ''}! I'm **Nora** from Nordic Affairs Media. I can show you our photo galleries, tell you about upcoming events, or send your request to the team. What would you like?`,
    thanks: 'My pleasure! Anything else I can find for you — a gallery, an event, or a message to the team?',
    bye: 'Thank you for visiting Nordic Affairs Media. Hej då — come back any time!',
    contact: (k) => `You can reach the team directly:\n- Email: ${k.contactEmail ?? '—'}\n- Phone: ${k.facts.phone || '—'}\n- Based in ${k.facts.location || 'Stockholm, Sweden'}\n\nThe fastest way is WhatsApp — tap the button below and your message is ready to send.`,
    coverage: 'Great! The team covers diplomatic visits, official ceremonies, conferences, concerts, sport and cultural events, in Sweden and abroad.\n\nPlease share the **date, place and type of event**. They will reply with availability and a price. Here is a message you can edit and send:',
    noEvents: 'There are no upcoming events published right now — new concerts and events are announced on the Concerts & Events page first. Meanwhile, take a look at our latest galleries:',
    events: (n) => `Here ${n === 1 ? 'is the upcoming event' : `are the ${n} upcoming events`} — tap one to see details and book tickets:`,
    about: (k) => `${k.facts.paragraphs[0] ?? k.facts.description}\n\nWe cover:\n${k.facts.expertise.map((e) => `- ${e}`).join('\n')}\n\n${k.facts.accreditation ? `${k.facts.accreditation}.` : ''}`,
    galleriesFound: (n) => (n === 1 ? 'I found this gallery for you:' : `I found ${n} galleries that match — tap one to open it:`),
    latest: 'Here are our latest photo galleries:',
    social: 'Follow Nordic Affairs Media on **Instagram** for the newest photos: https://www.instagram.com/nordicaffairsmedia/ — X, Facebook and YouTube are coming soon.',
    language: 'The whole website is available in **Svenska, English, മലയാളം and தமிழ்** — use the language links at the top of the page. I answer in the language you are reading.',
    accreditation: (k) => `${k.facts.accreditation || 'Nordic Affairs Media is press-accredited'} — which gives the team access to official visits, ceremonies and big international events.`,
    nameNoted: (n) => `Lovely to meet you, **${n}**! I'll remember that. What can I help you find today?`,
    fallback: "I'm not sure I understood that one. I can help with **photo galleries**, **upcoming events and tickets**, **media coverage requests** or **contact details** — or you can ask the team directly on WhatsApp:",
    whatsappMsg: 'Hello Nordic Affairs Media, I have a question.',
    coverageMsg: 'Hello Nordic Affairs Media, I would like to request media coverage.\n\nEvent:\nDate:\nPlace:\nType of coverage:',
    labels: { photos: 'photos', open: 'Open gallery', book: 'Book tickets', contact: 'Contact page', galleries: 'All galleries', about: 'About us', events: 'Concerts & Events', instagram: 'Instagram' },
  },
  sv: {
    hello: (n) => `Hej${n ? ` ${n}` : ''}! Jag är **Nora** från Nordic Affairs Media. Jag kan visa våra fotogallerier, berätta om kommande evenemang eller skicka din förfrågan till teamet. Vad vill du göra?`,
    thanks: 'Varsågod! Kan jag hitta något mer – ett galleri, ett evenemang eller ett meddelande till teamet?',
    bye: 'Tack för besöket hos Nordic Affairs Media. Hej då – välkommen tillbaka!',
    contact: (k) => `Du når teamet direkt:\n- E-post: ${k.contactEmail ?? '—'}\n- Telefon: ${k.facts.phone || '—'}\n- Plats: ${k.facts.location || 'Stockholm, Sverige'}\n\nSnabbast är WhatsApp – tryck på knappen så är meddelandet klart att skicka.`,
    coverage: 'Härligt! Teamet bevakar diplomatbesök, ceremonier, konferenser, konserter, sport och kulturevenemang i Sverige och utomlands.\n\nBerätta **datum, plats och typ av evenemang** så återkommer de med tillgänglighet och pris. Här är ett meddelande du kan redigera och skicka:',
    noEvents: 'Inga kommande evenemang är publicerade just nu – nya konserter och evenemang visas först på sidan Konserter & evenemang. Titta gärna på våra senaste gallerier så länge:',
    events: (n) => `Här ${n === 1 ? 'är det kommande evenemanget' : `är ${n} kommande evenemang`} – tryck för detaljer och biljetter:`,
    about: (k) => `${k.facts.paragraphs[0] ?? k.facts.description}\n\nVi bevakar:\n${k.facts.expertise.map((e) => `- ${e}`).join('\n')}\n\n${k.facts.accreditation ? `${k.facts.accreditation}.` : ''}`,
    galleriesFound: (n) => (n === 1 ? 'Jag hittade det här galleriet:' : `Jag hittade ${n} gallerier som passar – tryck för att öppna:`),
    latest: 'Här är våra senaste fotogallerier:',
    social: 'Följ Nordic Affairs Media på **Instagram** för de senaste bilderna: https://www.instagram.com/nordicaffairsmedia/ – X, Facebook och YouTube kommer snart.',
    language: 'Hela webbplatsen finns på **Svenska, English, മലയാളം och தமிழ்** – använd språklänkarna högst upp. Jag svarar på det språk du läser.',
    accreditation: (k) => `${k.facts.accreditation || 'Nordic Affairs Media är pressackrediterade'} – vilket ger teamet tillträde till officiella besök, ceremonier och stora internationella evenemang.`,
    nameNoted: (n) => `Trevligt att träffas, **${n}**! Det kommer jag ihåg. Vad kan jag hjälpa dig hitta i dag?`,
    fallback: 'Jag är inte säker på att jag förstod. Jag kan hjälpa till med **fotogallerier**, **kommande evenemang och biljetter**, **bevakningsförfrågningar** eller **kontaktuppgifter** – eller fråga teamet direkt på WhatsApp:',
    whatsappMsg: 'Hej Nordic Affairs Media, jag har en fråga.',
    coverageMsg: 'Hej Nordic Affairs Media, jag vill beställa mediabevakning.\n\nEvenemang:\nDatum:\nPlats:\nTyp av bevakning:',
    labels: { photos: 'bilder', open: 'Öppna galleriet', book: 'Boka biljetter', contact: 'Kontakt', galleries: 'Alla gallerier', about: 'Om oss', events: 'Konserter & evenemang', instagram: 'Instagram' },
  },
  ta: {
    hello: (n) => `வணக்கம்${n ? ` ${n}` : ''}! நான் Nordic Affairs Media-வின் **நோரா**. எங்கள் புகைப்படத் தொகுப்புகளைக் காட்டவும், வரவிருக்கும் நிகழ்வுகளைச் சொல்லவும், உங்கள் கோரிக்கையைக் குழுவுக்கு அனுப்பவும் உதவுவேன். என்ன வேண்டும்?`,
    thanks: 'மகிழ்ச்சி! வேறு ஏதாவது — ஒரு தொகுப்பு, ஒரு நிகழ்வு, அல்லது குழுவுக்கு ஒரு செய்தி?',
    bye: 'Nordic Affairs Media-வைப் பார்வையிட்டதற்கு நன்றி. மீண்டும் வருக!',
    contact: (k) => `குழுவை நேரடியாகத் தொடர்பு கொள்ளலாம்:\n- மின்னஞ்சல்: ${k.contactEmail ?? '—'}\n- தொலைபேசி: ${k.facts.phone || '—'}\n- இடம்: ${k.facts.location || 'Stockholm, Sweden'}\n\nWhatsApp மிக விரைவானது — கீழே உள்ள பொத்தானை அழுத்துங்கள்.`,
    coverage: 'அருமை! அதிகாரப்பூர்வப் பயணங்கள், விழாக்கள், மாநாடுகள், இசை, விளையாட்டு, கலாச்சார நிகழ்வுகளை ஸ்வீடனிலும் வெளிநாட்டிலும் குழு பதிவு செய்கிறது.\n\n**தேதி, இடம், நிகழ்வின் வகை** ஆகியவற்றைச் சொல்லுங்கள்; கிடைக்கும் நிலையும் விலையும் தெரிவிப்பார்கள். திருத்தி அனுப்பக்கூடிய செய்தி:',
    noEvents: 'இப்போது வரவிருக்கும் நிகழ்வுகள் எதுவும் வெளியிடப்படவில்லை. அதுவரை எங்கள் சமீபத்திய தொகுப்புகளைப் பாருங்கள்:',
    events: (n) => `வரவிருக்கும் ${n} நிகழ்வு(கள்) — விவரங்களுக்கும் டிக்கெட்டுகளுக்கும் அழுத்துங்கள்:`,
    about: (k) => `${k.facts.paragraphs[0] ?? k.facts.description}\n\nநாங்கள் பதிவு செய்வது:\n${k.facts.expertise.map((e) => `- ${e}`).join('\n')}\n\n${k.facts.accreditation ? `${k.facts.accreditation}.` : ''}`,
    galleriesFound: (n) => `உங்களுக்காக ${n} தொகுப்பு(கள்) கண்டேன் — திறக்க அழுத்துங்கள்:`,
    latest: 'எங்கள் சமீபத்திய புகைப்படத் தொகுப்புகள்:',
    social: 'புதிய புகைப்படங்களுக்கு **Instagram**-இல் பின்தொடருங்கள்: https://www.instagram.com/nordicaffairsmedia/ — X, Facebook, YouTube விரைவில்.',
    language: 'முழு இணையதளமும் **Svenska, English, മലയാളം, தமிழ்** மொழிகளில் உள்ளது — பக்கத்தின் மேலே உள்ள மொழி இணைப்புகளைப் பயன்படுத்துங்கள்.',
    accreditation: (k) => `${k.facts.accreditation || 'Nordic Affairs Media பத்திரிகை அங்கீகாரம் பெற்றது'} — அதனால் அதிகாரப்பூர்வப் பயணங்கள், விழாக்கள், முக்கிய சர்வதேச நிகழ்வுகளில் குழுவுக்கு அனுமதி உண்டு.`,
    nameNoted: (n) => `உங்களைச் சந்தித்ததில் மகிழ்ச்சி, **${n}**! நினைவில் வைத்திருப்பேன். இன்று என்ன தேட உதவட்டும்?`,
    fallback: 'நீங்கள் கேட்டது எனக்குச் சரியாகப் புரியவில்லை. **புகைப்படத் தொகுப்புகள்**, **நிகழ்வுகள், டிக்கெட்டுகள்**, **பதிவு கோரிக்கைகள்**, **தொடர்பு விவரங்கள்** பற்றி உதவ முடியும் — அல்லது WhatsApp-இல் குழுவிடம் நேரடியாகக் கேளுங்கள்:',
    whatsappMsg: 'வணக்கம் Nordic Affairs Media, எனக்கு ஒரு கேள்வி உள்ளது.',
    coverageMsg: 'வணக்கம் Nordic Affairs Media, எனக்கு ஊடகப் பதிவு தேவை.\n\nநிகழ்வு:\nதேதி:\nஇடம்:\nபதிவு வகை:',
    labels: { photos: 'படங்கள்', open: 'தொகுப்பைத் திற', book: 'டிக்கெட் பதிவு', contact: 'தொடர்பு', galleries: 'அனைத்து தொகுப்புகள்', about: 'எங்களைப் பற்றி', events: 'நிகழ்வுகள்', instagram: 'Instagram' },
  },
  ml: {
    hello: (n) => `നമസ്കാരം${n ? ` ${n}` : ''}! ഞാൻ Nordic Affairs Media-യിലെ **നോറ**. ഞങ്ങളുടെ ഫോട്ടോ ഗാലറികൾ കാണിക്കാനും വരാനിരിക്കുന്ന പരിപാടികൾ പറയാനും നിങ്ങളുടെ അഭ്യർത്ഥന ടീമിന് എത്തിക്കാനും കഴിയും. എന്താണ് വേണ്ടത്?`,
    thanks: 'സന്തോഷം! മറ്റെന്തെങ്കിലും — ഒരു ഗാലറി, ഒരു പരിപാടി, അല്ലെങ്കിൽ ടീമിന് ഒരു സന്ദേശം?',
    bye: 'Nordic Affairs Media സന്ദർശിച്ചതിന് നന്ദി. വീണ്ടും വരിക!',
    contact: (k) => `ടീമിനെ നേരിട്ട് ബന്ധപ്പെടാം:\n- ഇമെയിൽ: ${k.contactEmail ?? '—'}\n- ഫോൺ: ${k.facts.phone || '—'}\n- സ്ഥലം: ${k.facts.location || 'Stockholm, Sweden'}\n\nWhatsApp ആണ് ഏറ്റവും വേഗം — താഴെയുള്ള ബട്ടൺ അമർത്തുക.`,
    coverage: 'മികച്ചത് — ഔദ്യോഗിക സന്ദർശനങ്ങൾ, ചടങ്ങുകൾ, സമ്മേളനങ്ങൾ, സംഗീതം, കായികം, സാംസ്കാരിക പരിപാടികൾ എന്നിവ സ്വീഡനിലും വിദേശത്തും ടീം കവർ ചെയ്യുന്നു.\n\n**തീയതി, സ്ഥലം, പരിപാടിയുടെ തരം** പറയൂ; ലഭ്യതയും നിരക്കും അറിയിക്കും. തിരുത്തി അയയ്ക്കാവുന്ന സന്ദേശം:',
    noEvents: 'ഇപ്പോൾ വരാനിരിക്കുന്ന പരിപാടികളൊന്നും പ്രസിദ്ധീകരിച്ചിട്ടില്ല. അതുവരെ ഞങ്ങളുടെ പുതിയ ഗാലറികൾ കാണൂ:',
    events: (n) => `വരാനിരിക്കുന്ന ${n} പരിപാടി(കൾ) — വിവരങ്ങൾക്കും ടിക്കറ്റിനും അമർത്തുക:`,
    about: (k) => `${k.facts.paragraphs[0] ?? k.facts.description}\n\nഞങ്ങൾ കവർ ചെയ്യുന്നത്:\n${k.facts.expertise.map((e) => `- ${e}`).join('\n')}\n\n${k.facts.accreditation ? `${k.facts.accreditation}.` : ''}`,
    galleriesFound: (n) => `നിങ്ങൾക്കായി ${n} ഗാലറി(കൾ) കണ്ടെത്തി — തുറക്കാൻ അമർത്തുക:`,
    latest: 'ഞങ്ങളുടെ പുതിയ ഫോട്ടോ ഗാലറികൾ:',
    social: 'പുതിയ ഫോട്ടോകൾക്ക് **Instagram**-ൽ പിന്തുടരുക: https://www.instagram.com/nordicaffairsmedia/ — X, Facebook, YouTube ഉടൻ.',
    language: 'വെബ്സൈറ്റ് മുഴുവനും **Svenska, English, മലയാളം, தமிழ்** ഭാഷകളിൽ ലഭ്യമാണ് — പേജിന്റെ മുകളിലുള്ള ഭാഷാ ലിങ്കുകൾ ഉപയോഗിക്കുക.',
    accreditation: (k) => `${k.facts.accreditation || 'Nordic Affairs Media പ്രസ് അംഗീകാരമുള്ളതാണ്'} — അതിനാൽ ഔദ്യോഗിക സന്ദർശനങ്ങളിലും ചടങ്ങുകളിലും പ്രധാന അന്താരാഷ്ട്ര പരിപാടികളിലും ടീമിന് പ്രവേശനമുണ്ട്.`,
    nameNoted: (n) => `പരിചയപ്പെട്ടതിൽ സന്തോഷം, **${n}**! ഞാൻ ഓർത്തുവെക്കാം. ഇന്ന് എന്താണ് കണ്ടെത്തേണ്ടത്?`,
    fallback: 'നിങ്ങൾ ചോദിച്ചത് എനിക്ക് ശരിക്കും മനസ്സിലായില്ല. **ഫോട്ടോ ഗാലറികൾ**, **പരിപാടികളും ടിക്കറ്റുകളും**, **കവറേജ് അഭ്യർത്ഥനകൾ**, **ബന്ധപ്പെടാനുള്ള വിവരങ്ങൾ** എന്നിവയിൽ സഹായിക്കാം — അല്ലെങ്കിൽ WhatsApp-ൽ ടീമിനോട് നേരിട്ട് ചോദിക്കൂ:',
    whatsappMsg: 'നമസ്കാരം Nordic Affairs Media, എനിക്ക് ഒരു ചോദ്യമുണ്ട്.',
    coverageMsg: 'നമസ്കാരം Nordic Affairs Media, എനിക്ക് മീഡിയ കവറേജ് വേണം.\n\nപരിപാടി:\nതീയതി:\nസ്ഥലം:\nകവറേജ് തരം:',
    labels: { photos: 'ഫോട്ടോകൾ', open: 'ഗാലറി തുറക്കുക', book: 'ടിക്കറ്റ് ബുക്ക് ചെയ്യുക', contact: 'ബന്ധപ്പെടുക', galleries: 'എല്ലാ ഗാലറികളും', about: 'ഞങ്ങളെക്കുറിച്ച്', events: 'പരിപാടികൾ', instagram: 'Instagram' },
  },
}

// --- Building the reply --------------------------------------------------------

function nameFrom(text: string): string | null {
  // "my name is anna" in any case; "I'm Anna" only when the name is written with a capital.
  const m =
    text.match(/\b(?:my name is|call me|jag heter|mitt namn är)\s+([\p{L}][\p{L}'-]{1,30})/iu) ??
    text.match(/\b(?:[Ii] am|[Ii]'m|[Jj]ag är)\s+(\p{Lu}[\p{L}'-]{1,30})/u)
  if (!m?.[1]) return null
  const n = m[1]
  const notNames = ['looking', 'interested', 'from', 'here', 'a', 'an', 'the', 'not', 'just', 'trying', 'planning', 'organising', 'organizing']
  return notNames.includes(n.toLowerCase()) ? null : n.charAt(0).toUpperCase() + n.slice(1)
}

export function offlineAnswer(
  locale: Locale,
  question: string,
  k: Knowledge,
  profile: string[],
): Reply {
  const w = W[locale]
  const L = w.labels
  const q = normalise(question)
  const known = profile.map((f) => f.match(/^name:\s*(.+)$/i)?.[1]).find(Boolean)
  const actions: ChatAction[] = []

  const galleryCards = (list: Knowledge['galleries']): ChatAction => ({
    type: 'cards',
    items: list.map((g) => ({
      title: g.title,
      subtitle: [g.date, g.photos ? `${g.photos} ${L.photos}` : ''].filter(Boolean).join(' · '),
      url: g.url,
      image: g.cover,
      cta: L.open,
    })),
  })
  const whatsapp = (message: string): ChatAction | null =>
    k.whatsapp ? { type: 'whatsapp', message, url: `https://wa.me/${k.whatsapp}?text=${encodeURIComponent(message)}` } : null
  const link = (path: string, label: string): ChatAction => ({ type: 'link', url: `/${locale}${path}`, label })
  const push = (a: ChatAction | null) => {
    if (a) actions.push(a)
  }

  // A name? Remember it and greet.
  const name = nameFrom(question)
  if (name) {
    push({ type: 'remember', fact: `Name: ${name}` })
    return { text: w.nameNoted(name), actions }
  }

  const matches = findGalleries(q, k)
  const asksGalleries = has(q, INTENT.galleries)

  if (has(q, INTENT.coverage)) {
    push({
      type: 'enquiry',
      draft: { type: 'events', name: known ?? '', email: '', subject: 'Coverage request', message: w.coverageMsg },
    })
    push(whatsapp(w.coverageMsg))
    return { text: w.coverage, actions }
  }

  if (has(q, INTENT.contact)) {
    push(whatsapp(w.whatsappMsg))
    push(link('/contact', L.contact))
    return { text: w.contact(k), actions }
  }

  const wantsTickets = has(q, ['ticket', 'tickets', 'upcoming', 'biljett', 'biljetter', 'kommande', 'டிக்கெட்', 'ടിക്കറ്റ്'])
  if (has(q, INTENT.events) && (wantsTickets || !matches.length)) {
    if (k.events.length) {
      push({
        type: 'cards',
        items: k.events.slice(0, 6).map((e) => ({ title: e.title, subtitle: [e.when, e.venue].filter(Boolean).join(' · '), url: e.url, image: e.cover, cta: L.book })),
      })
      return { text: w.events(Math.min(6, k.events.length)), actions }
    }
    push(galleryCards(k.galleries.slice(0, 4)))
    push(link('/events', L.events))
    return { text: w.noEvents, actions }
  }

  if (matches.length) {
    push(galleryCards(matches))
    return { text: w.galleriesFound(matches.length), actions }
  }

  if (asksGalleries) {
    push(galleryCards(k.galleries.slice(0, 6)))
    push(link('/gallery', L.galleries))
    return { text: w.latest, actions }
  }

  if (has(q, INTENT.accreditation)) return { text: w.accreditation(k), actions }
  if (has(q, INTENT.social)) return { text: w.social, actions }
  if (has(q, INTENT.language)) return { text: w.language, actions }

  if (has(q, INTENT.about)) {
    push(link('/about-us', L.about))
    return { text: w.about(k).trim(), actions }
  }

  if (has(q, INTENT.thanks)) return { text: w.thanks, actions }
  if (has(q, INTENT.bye)) return { text: w.bye, actions }

  if (has(q, INTENT.greet) || q.trim().length <= 2) {
    push(galleryCards(k.galleries.slice(0, 4)))
    return { text: w.hello(known), actions }
  }

  push(whatsapp(w.whatsappMsg))
  push(link('/gallery', L.galleries))
  return { text: w.fallback, actions }
}
