import type { Locale } from '@/i18n/config'
import type { SiteSettingsData } from '@/payload-types'
import { aboutDefaults, settings as settingsDefaults } from '@/lib/wordpress/content'

/**
 * Translations of the agency's own fixed wording (About page, footer text, key
 * figures) so that switching language changes the whole page, not only the menus.
 * DRAFT translations — to be checked by native Swedish, Tamil and Malayalam speakers.
 * The accrediting body's name is kept in English on purpose until the client confirms
 * its official name in each language.
 * Text typed in the CMS for a language always wins over these.
 */

type About = typeof aboutDefaults

const icons = {
  expertise: aboutDefaults.expertise.map((e) => e.icon),
  pillars: aboutDefaults.pillars.map((p) => p.icon),
}

function build(t: {
  title: string
  paragraphs: string[]
  expertiseEyebrow: string
  expertiseTitle: string
  expertise: string[]
  eventsTitle: string
  eventsIntro: string
  events: string[]
  ministersTitle: string
  ministersNote: string
  pillars: { title: string; text: string }[]
  ctaTitle: string
  ctaText: string
}): About {
  return {
    ...t,
    ministers: aboutDefaults.ministers,
    expertise: t.expertise.map((label, i) => ({ label, icon: icons.expertise[i] ?? 'globe' })),
    pillars: t.pillars.map((p, i) => ({ ...p, icon: icons.pillars[i] ?? 'globe' })),
  }
}

const about: Record<Exclude<Locale, 'en'>, About> = {
  sv: build({
    title: 'Vi fångar historien med kvalitet',
    paragraphs: [
      'Nordic Affairs Media är en svensk medieorganisation specialiserad på officiella besök på hög nivå, diplomatiska evenemang, regeringsuppdrag, kungliga ceremonier och internationell sportbevakning i Sverige och över hela världen.',
      'Med ett starkt engagemang för professionalism, noggrannhet och visuellt berättande levererar vi fotografi och video i världsklass för prestigefyllda nationella och internationella evenemang.',
      'Vårt team arbetar med precision, diskretion och hängivenhet för att dokumentera ögonblick av historisk, kulturell och global betydelse genom kraftfull visuell media.',
    ],
    expertiseEyebrow: 'Vår expertis',
    expertiseTitle: 'Vi bevakar med stolthet',
    expertise: [
      'Regerings- och diplomatbesök',
      'Kungliga evenemang och statsceremonier',
      'Internationella toppmöten och konferenser',
      'Ambassader och officiella delegationer',
      'Sportevenemang och turneringar',
      'Kulturella och offentliga firanden',
    ],
    eventsTitle: 'Stora evenemang vi bevakat',
    eventsIntro:
      'Nordic Affairs Media har haft förmånen att bevaka flera internationella och kungliga evenemang av hög profil, bland annat:',
    events: [
      'Indiens premiärminister Narendra Modis besök i Sverige',
      'Indiens förre president Pranab Mukherjees besök i Sverige',
      'Officiella uppdrag med Ulf Kristersson',
      'Statsbesök av Frederik X',
      'Presidentbesök av Halla Tómasdóttir',
      'De prestigefyllda Nobelevenemangen',
      'Kungliga firanden och officiella evenemang med Carl XVI Gustaf',
      'Indo-Nordic Summit 2018',
      'Stockholms Kulturfestival',
    ],
    ministersTitle: 'Ministerbesök från Indien, bland andra',
    ministersNote: '…och många fler framstående internationella tillfällen.',
    pillars: [
      {
        title: 'Professionella standarder',
        text: 'Nordic Affairs Media arbetar med professionalism, integritet och kvalitet i varje uppdrag. Officiellt ackrediterade av Swedish Press Association levererar vi pålitlig mediebevakning av diplomatiska besök, kungliga ceremonier, regeringsuppdrag och prestigefyllda internationella evenemang – med noggrannhet, diskretion och visuellt berättande i världsklass.',
      },
      {
        title: 'Vår vision',
        text: 'Vår vision är att skapa slagkraftiga visuella berättelser som bevarar viktiga globala ögonblick och stärker internationella band. Genom enastående fotografi, video och filmiskt berättande vill vi lyfta fram diplomati, ledarskap, kultur och idrott och skapa meningsfulla medieupplevelser som inspirerar publik världen över.',
      },
      {
        title: 'Baserade i Sverige – verksamma i hela världen',
        text: 'Med huvudkontor i Stockholm levererar Nordic Affairs Media förstklassig internationell evenemangsbevakning i Sverige och runt om i världen. Genom professionalism, kreativitet och pålitliga mediepartnerskap fortsätter vi att bygga ett starkt rykte för att dokumentera historiska ögonblick, officiella uppdrag, kulturella firanden och globala evenemang med kvalitet och äkthet.',
      },
    ],
    ctaTitle: 'Låt oss arbeta tillsammans',
    ctaText: 'För medieförfrågningar, evenemangsbevakning och samarbeten.',
  }),
  ta: build({
    title: 'சிறப்புடன் வரலாற்றைப் பதிவு செய்கிறோம்',
    paragraphs: [
      'Nordic Affairs Media ஸ்வீடனை மையமாகக் கொண்ட ஒரு ஊடக நிறுவனம். உயர்நிலை அதிகாரப்பூர்வ வருகைகள், ராஜதந்திர நிகழ்வுகள், அரசு நிகழ்ச்சிகள், அரச விழாக்கள் மற்றும் சர்வதேச விளையாட்டுகளை ஸ்வீடனிலும் உலகெங்கிலும் பதிவு செய்வதில் நாங்கள் நிபுணத்துவம் பெற்றவர்கள்.',
      'தொழில்முறை, துல்லியம் மற்றும் காட்சிவழிக் கதைசொல்லல் மீதான உறுதியான அர்ப்பணிப்புடன், மதிப்புமிக்க தேசிய மற்றும் சர்வதேச நிகழ்வுகளுக்கு உலகத்தரம் வாய்ந்த புகைப்பட மற்றும் காணொளி சேவைகளை வழங்குகிறோம்.',
      'வரலாற்று, கலாச்சார மற்றும் உலகளாவிய முக்கியத்துவம் வாய்ந்த தருணங்களை சக்திவாய்ந்த காட்சி ஊடகத்தின் மூலம் ஆவணப்படுத்த எங்கள் குழு துல்லியத்துடனும் நம்பகத்தன்மையுடனும் அர்ப்பணிப்புடனும் பணியாற்றுகிறது.',
    ],
    expertiseEyebrow: 'எங்கள் நிபுணத்துவம்',
    expertiseTitle: 'பெருமையுடன் நாங்கள் பதிவு செய்பவை',
    expertise: [
      'அரசு மற்றும் ராஜதந்திர வருகைகள்',
      'அரச நிகழ்வுகள் மற்றும் அரசு விழாக்கள்',
      'சர்வதேச உச்சி மாநாடுகள் மற்றும் கருத்தரங்குகள்',
      'தூதரகங்கள் மற்றும் அதிகாரப்பூர்வ குழுக்கள்',
      'விளையாட்டு நிகழ்வுகள் மற்றும் போட்டிகள்',
      'கலாச்சார மற்றும் பொது கொண்டாட்டங்கள்',
    ],
    eventsTitle: 'நாங்கள் பதிவு செய்த முக்கிய நிகழ்வுகள்',
    eventsIntro:
      'பல உயர்மட்ட சர்வதேச மற்றும் அரச நிகழ்வுகளைப் பதிவு செய்யும் வாய்ப்பு Nordic Affairs Media-வுக்குக் கிடைத்துள்ளது, அவற்றில் சில:',
    events: [
      'இந்தியப் பிரதமர் நரேந்திர மோடியின் ஸ்வீடன் வருகை',
      'இந்தியாவின் முன்னாள் குடியரசுத் தலைவர் பிரணாப் முகர்ஜியின் ஸ்வீடன் வருகை',
      'உல்ஃப் கிறிஸ்டர்சன் பங்கேற்ற அதிகாரப்பூர்வ நிகழ்வுகள்',
      'மன்னர் ஃப்ரெடெரிக் X-இன் அரசு முறை வருகைகள்',
      'அதிபர் ஹல்லா டோமஸ்டோட்டிரின் வருகைகள்',
      'மதிப்புமிக்க நோபல் பரிசு நிகழ்வுகள்',
      'மன்னர் கார்ல் XVI குஸ்தாஃப் பங்கேற்ற அரச கொண்டாட்டங்கள் மற்றும் அதிகாரப்பூர்வ நிகழ்வுகள்',
      'இந்தோ-நார்டிக் உச்சி மாநாடு 2018',
      'ஸ்டாக்ஹோம் கலாச்சாரத் திருவிழா',
    ],
    ministersTitle: 'இந்தியாவிலிருந்து வந்த அமைச்சர்களின் வருகைகள், அவற்றில்',
    ministersNote: '…மேலும் பல சிறப்புமிக்க சர்வதேச நிகழ்வுகள்.',
    pillars: [
      {
        title: 'தொழில்முறைத் தரங்கள்',
        text: 'Nordic Affairs Media ஒவ்வொரு பணியிலும் தொழில்முறை, நேர்மை மற்றும் சிறப்புடன் செயல்படுகிறது. Swedish Press Association-ஆல் அதிகாரப்பூர்வமாக அங்கீகரிக்கப்பட்ட நாங்கள், ராஜதந்திர வருகைகள், அரச விழாக்கள், அரசு நிகழ்ச்சிகள் மற்றும் மதிப்புமிக்க சர்வதேச நிகழ்வுகளுக்கு துல்லியம், நம்பகத்தன்மை மற்றும் உலகத்தரக் காட்சிக் கதைசொல்லலுடன் நம்பகமான ஊடகப் பதிவை வழங்குகிறோம்.',
      },
      {
        title: 'எங்கள் நோக்கு',
        text: 'முக்கியமான உலகளாவிய தருணங்களைப் பாதுகாத்து, சர்வதேச உறவுகளை வலுப்படுத்தும் தாக்கமிக்க காட்சிக் கதைகளை உருவாக்குவதே எங்கள் நோக்கு. சிறந்த புகைப்படம், காணொளி மற்றும் திரைப்படப் பாணிக் கதைசொல்லல் மூலம் ராஜதந்திரம், தலைமைத்துவம், கலாச்சாரம் மற்றும் விளையாட்டை வெளிப்படுத்தி, உலகெங்கிலும் உள்ள பார்வையாளர்களை ஊக்குவிக்கும் அர்த்தமுள்ள ஊடக அனுபவங்களை வழங்குவதே எங்கள் இலக்கு.',
      },
      {
        title: 'ஸ்வீடனில் தளம் — உலகம் முழுவதும் பணி',
        text: 'ஸ்டாக்ஹோமைத் தலைமையிடமாகக் கொண்ட Nordic Affairs Media, ஸ்வீடனிலும் உலகின் பல இடங்களிலும் உயர்தர சர்வதேச நிகழ்வுப் பதிவை வழங்குகிறது. தொழில்முறை, படைப்பாற்றல் மற்றும் நம்பகமான ஊடகக் கூட்டாண்மைகள் மூலம், வரலாற்றுத் தருணங்கள், அதிகாரப்பூர்வ நிகழ்வுகள், கலாச்சாரக் கொண்டாட்டங்கள் மற்றும் உலகளாவிய நிகழ்வுகளைச் சிறப்புடனும் உண்மைத்தன்மையுடனும் ஆவணப்படுத்துவதில் வலுவான நற்பெயரைத் தொடர்ந்து உருவாக்கி வருகிறோம்.',
      },
    ],
    ctaTitle: 'இணைந்து பணியாற்றுவோம்',
    ctaText: 'ஊடக விசாரணைகள், நிகழ்வுப் பதிவு மற்றும் கூட்டுப் பணிகளுக்கு.',
  }),
  ml: build({
    title: 'മികവോടെ ചരിത്രം പകർത്തുന്നു',
    paragraphs: [
      'സ്വീഡൻ ആസ്ഥാനമായി പ്രവർത്തിക്കുന്ന ഒരു മാധ്യമ സ്ഥാപനമാണ് Nordic Affairs Media. ഉന്നതതല ഔദ്യോഗിക സന്ദർശനങ്ങൾ, നയതന്ത്ര പരിപാടികൾ, സർക്കാർ ചടങ്ങുകൾ, രാജകീയ ആഘോഷങ്ങൾ, അന്താരാഷ്ട്ര കായിക മത്സരങ്ങൾ എന്നിവ സ്വീഡനിലും ലോകമെമ്പാടും പകർത്തുന്നതിൽ ഞങ്ങൾ വൈദഗ്ധ്യം നേടിയിരിക്കുന്നു.',
      'പ്രൊഫഷണലിസം, കൃത്യത, ദൃശ്യകഥപറച്ചിൽ എന്നിവയോടുള്ള ശക്തമായ പ്രതിബദ്ധതയോടെ, പ്രശസ്തമായ ദേശീയ-അന്താരാഷ്ട്ര പരിപാടികൾക്ക് ലോകോത്തര ഫോട്ടോഗ്രഫിയും വീഡിയോഗ്രഫിയും ഞങ്ങൾ നൽകുന്നു.',
      'ചരിത്രപരവും സാംസ്കാരികവും ആഗോളവുമായ പ്രാധാന്യമുള്ള നിമിഷങ്ങൾ ശക്തമായ ദൃശ്യമാധ്യമത്തിലൂടെ രേഖപ്പെടുത്താൻ ഞങ്ങളുടെ ടീം കൃത്യതയോടും വിവേകത്തോടും സമർപ്പണത്തോടും കൂടി പ്രവർത്തിക്കുന്നു.',
    ],
    expertiseEyebrow: 'ഞങ്ങളുടെ വൈദഗ്ധ്യം',
    expertiseTitle: 'അഭിമാനത്തോടെ ഞങ്ങൾ പകർത്തുന്നവ',
    expertise: [
      'സർക്കാർ, നയതന്ത്ര സന്ദർശനങ്ങൾ',
      'രാജകീയ പരിപാടികളും സംസ്ഥാന ചടങ്ങുകളും',
      'അന്താരാഷ്ട്ര ഉച്ചകോടികളും സമ്മേളനങ്ങളും',
      'എംബസികളും ഔദ്യോഗിക പ്രതിനിധി സംഘങ്ങളും',
      'കായിക മത്സരങ്ങളും ടൂർണമെന്റുകളും',
      'സാംസ്കാരിക, പൊതു ആഘോഷങ്ങൾ',
    ],
    eventsTitle: 'ഞങ്ങൾ പകർത്തിയ പ്രധാന പരിപാടികൾ',
    eventsIntro:
      'നിരവധി ഉന്നതതല അന്താരാഷ്ട്ര, രാജകീയ പരിപാടികൾ പകർത്താനുള്ള അവസരം Nordic Affairs Media-യ്ക്ക് ലഭിച്ചിട്ടുണ്ട്, അവയിൽ ചിലത്:',
    events: [
      'ഇന്ത്യൻ പ്രധാനമന്ത്രി നരേന്ദ്ര മോദിയുടെ സ്വീഡൻ സന്ദർശനം',
      'മുൻ ഇന്ത്യൻ രാഷ്ട്രപതി പ്രണബ് മുഖർജിയുടെ സ്വീഡൻ സന്ദർശനം',
      'ഉൾഫ് ക്രിസ്റ്റേഴ്സൺ പങ്കെടുത്ത ഔദ്യോഗിക പരിപാടികൾ',
      'ഫ്രെഡറിക് X രാജാവിന്റെ ഔദ്യോഗിക സന്ദർശനങ്ങൾ',
      'പ്രസിഡന്റ് ഹല്ല ടോമസ്ഡോട്ടിറിന്റെ സന്ദർശനങ്ങൾ',
      'പ്രശസ്തമായ നൊബേൽ സമ്മാന പരിപാടികൾ',
      'കാൾ XVI ഗുസ്താഫ് രാജാവ് പങ്കെടുത്ത രാജകീയ ആഘോഷങ്ങളും ഔദ്യോഗിക പരിപാടികളും',
      'ഇൻഡോ-നോർഡിക് ഉച്ചകോടി 2018',
      'സ്റ്റോക്ക്ഹോം സാംസ്കാരികോത്സവം',
    ],
    ministersTitle: 'ഇന്ത്യയിൽ നിന്നുള്ള മന്ത്രിമാരുടെ സന്ദർശനങ്ങൾ, അവയിൽ',
    ministersNote: '…കൂടാതെ മറ്റനേകം വിശിഷ്ട അന്താരാഷ്ട്ര അവസരങ്ങളും.',
    pillars: [
      {
        title: 'പ്രൊഫഷണൽ നിലവാരം',
        text: 'ഓരോ ദൗത്യത്തിലും പ്രൊഫഷണലിസവും സത്യസന്ധതയും മികവും പുലർത്തിയാണ് Nordic Affairs Media പ്രവർത്തിക്കുന്നത്. Swedish Press Association-ന്റെ ഔദ്യോഗിക അംഗീകാരമുള്ള ഞങ്ങൾ, നയതന്ത്ര സന്ദർശനങ്ങൾ, രാജകീയ ചടങ്ങുകൾ, സർക്കാർ പരിപാടികൾ, പ്രശസ്തമായ അന്താരാഷ്ട്ര പരിപാടികൾ എന്നിവയ്ക്ക് കൃത്യതയോടും വിവേകത്തോടും ലോകോത്തര ദൃശ്യകഥപറച്ചിലോടും കൂടി വിശ്വസനീയമായ മാധ്യമ കവറേജ് നൽകുന്നു.',
      },
      {
        title: 'ഞങ്ങളുടെ ദർശനം',
        text: 'പ്രധാനപ്പെട്ട ആഗോള നിമിഷങ്ങൾ സംരക്ഷിക്കുകയും അന്താരാഷ്ട്ര ബന്ധങ്ങൾ ശക്തിപ്പെടുത്തുകയും ചെയ്യുന്ന ശ്രദ്ധേയമായ ദൃശ്യകഥകൾ സൃഷ്ടിക്കുക എന്നതാണ് ഞങ്ങളുടെ ദർശനം. മികച്ച ഫോട്ടോഗ്രഫി, വീഡിയോഗ്രഫി, സിനിമാറ്റിക് കഥപറച്ചിൽ എന്നിവയിലൂടെ നയതന്ത്രം, നേതൃത്വം, സംസ്കാരം, കായികം എന്നിവ അവതരിപ്പിച്ച് ലോകമെമ്പാടുമുള്ള പ്രേക്ഷകരെ പ്രചോദിപ്പിക്കുന്ന അർത്ഥവത്തായ മാധ്യമാനുഭവങ്ങൾ നൽകാൻ ഞങ്ങൾ ലക്ഷ്യമിടുന്നു.',
      },
      {
        title: 'സ്വീഡൻ ആസ്ഥാനം — ലോകമെമ്പാടും പ്രവർത്തനം',
        text: 'സ്റ്റോക്ക്ഹോം ആസ്ഥാനമായ Nordic Affairs Media സ്വീഡനിലും ലോകത്തിന്റെ വിവിധ ഭാഗങ്ങളിലും ഉന്നത നിലവാരമുള്ള അന്താരാഷ്ട്ര പരിപാടികളുടെ കവറേജ് നൽകുന്നു. പ്രൊഫഷണലിസം, സർഗ്ഗാത്മകത, വിശ്വസനീയമായ മാധ്യമ പങ്കാളിത്തങ്ങൾ എന്നിവയിലൂടെ ചരിത്ര നിമിഷങ്ങൾ, ഔദ്യോഗിക പരിപാടികൾ, സാംസ്കാരിക ആഘോഷങ്ങൾ, ആഗോള സംഭവങ്ങൾ എന്നിവ മികവോടെയും ആധികാരികതയോടെയും രേഖപ്പെടുത്തുന്നതിൽ ഞങ്ങൾ ശക്തമായ സൽപ്പേര് കെട്ടിപ്പടുക്കുന്നത് തുടരുന്നു.',
      },
    ],
    ctaTitle: 'നമുക്ക് ഒരുമിച്ച് പ്രവർത്തിക്കാം',
    ctaText: 'മാധ്യമ അന്വേഷണങ്ങൾക്കും പരിപാടികളുടെ കവറേജിനും സഹകരണത്തിനും.',
  }),
}

/** About page wording in the reader's language (English for English). */
export function aboutFor(locale: Locale): About {
  return locale === 'en' ? aboutDefaults : about[locale]
}

const settingsText: Record<
  Exclude<Locale, 'en'>,
  {
    tagline: string
    description: string
    location: string
    accreditation: string
    stats: string[]
  }
> = {
  sv: {
    tagline: 'Vi fångar globala ögonblick',
    description:
      'Nordic Affairs Media är en svensk medieorganisation specialiserad på diplomatiska evenemang, officiella besök, internationella toppmöten, kungliga ceremonier och sportbevakning i Sverige och över hela världen.',
    location: 'Stockholm, Sverige',
    accreditation: 'Ackrediterade av Swedish Press Association',
    stats: [
      'Års erfarenhet',
      'Globala evenemang bevakade',
      'Internationella uppdrag',
      'Pålitliga partnerskap',
      'Mediesupport dygnet runt',
    ],
  },
  ta: {
    tagline: 'உலகளாவிய தருணங்களைப் பதிவு செய்கிறோம்',
    description:
      'Nordic Affairs Media ஸ்வீடனை மையமாகக் கொண்ட ஊடக நிறுவனம்; ராஜதந்திர நிகழ்வுகள், அதிகாரப்பூர்வ வருகைகள், சர்வதேச உச்சி மாநாடுகள், அரச விழாக்கள் மற்றும் விளையாட்டுகளை ஸ்வீடனிலும் உலகெங்கிலும் பதிவு செய்வதில் நிபுணத்துவம் பெற்றது.',
    location: 'ஸ்டாக்ஹோம், ஸ்வீடன்',
    accreditation: 'Swedish Press Association-ஆல் அங்கீகரிக்கப்பட்டது',
    stats: [
      'ஆண்டுகால சிறப்பு',
      'பதிவு செய்த உலகளாவிய நிகழ்வுகள்',
      'சர்வதேசப் பணிகள்',
      'நம்பகமான கூட்டாண்மைகள்',
      'ஊடக உதவி — எப்போதும்',
    ],
  },
  ml: {
    tagline: 'ആഗോള നിമിഷങ്ങൾ പകർത്തുന്നു',
    description:
      'സ്വീഡൻ ആസ്ഥാനമായ മാധ്യമ സ്ഥാപനമാണ് Nordic Affairs Media; നയതന്ത്ര പരിപാടികൾ, ഔദ്യോഗിക സന്ദർശനങ്ങൾ, അന്താരാഷ്ട്ര ഉച്ചകോടികൾ, രാജകീയ ചടങ്ങുകൾ, കായിക മത്സരങ്ങൾ എന്നിവ സ്വീഡനിലും ലോകമെമ്പാടും പകർത്തുന്നതിൽ വൈദഗ്ധ്യം.',
    location: 'സ്റ്റോക്ക്ഹോം, സ്വീഡൻ',
    accreditation: 'Swedish Press Association-ന്റെ അംഗീകാരം',
    stats: [
      'വർഷത്തെ മികവ്',
      'പകർത്തിയ ആഗോള പരിപാടികൾ',
      'അന്താരാഷ്ട്ര ദൗത്യങ്ങൾ',
      'വിശ്വസനീയ പങ്കാളിത്തങ്ങൾ',
      'എപ്പോഴും മാധ്യമ പിന്തുണ',
    ],
  },
}

/**
 * Settings text for the reader's language. The CMS value wins unless it is still the
 * original English wording (the CMS falls back to English when a language is empty).
 */
export function localizedSettings(s: SiteSettingsData, locale: Locale): SiteSettingsData {
  if (locale === 'en') return s
  const tr = settingsText[locale]
  const pick = (value: string | null | undefined, english: string, translated: string) =>
    !value || value === english ? translated : value
  const englishStats = settingsDefaults.stats.map((x) => x.label)
  return {
    ...s,
    tagline: pick(s.tagline, settingsDefaults.tagline, tr.tagline),
    description: pick(s.description, settingsDefaults.description, tr.description),
    location: pick(s.location, settingsDefaults.location, tr.location),
    accreditation: pick(s.accreditation, settingsDefaults.accreditation, tr.accreditation),
    stats: s.stats?.map((x) => {
      const i = englishStats.indexOf(x.label)
      return i >= 0 && tr.stats[i] ? { ...x, label: tr.stats[i] } : x
    }),
  }
}
