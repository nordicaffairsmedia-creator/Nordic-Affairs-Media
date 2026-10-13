import type { Locale } from '@/i18n/config'

/**
 * "Our Visual Stories" on the About page — the four photo cards from the old site.
 * Photos live in /public/about (copied from the old site, resized for the web);
 * `focus` keeps the subject in frame when the card crops the photo.
 */
export const storyPhotos = [
  { src: '/about/sports.webp', width: 720, height: 480, focus: '32% 40%' },
  { src: '/about/global.webp', width: 300, height: 533, focus: '50% 50%' },
  { src: '/about/cinematic.webp', width: 720, height: 480, focus: '56% 35%' },
  { src: '/about/excellence.webp', width: 720, height: 405, focus: '70% 40%' },
] as const

type Stories = { eyebrow: string; title: string; items: { title: string; text: string }[] }

const stories: Record<Locale, Stories> = {
  en: {
    eyebrow: 'Our Visual Stories',
    title: 'Capturing Moments Through Excellence',
    items: [
      { title: 'Sports Photography', text: 'Capturing every crucial sports moment with precision, passion, and impactful visual storytelling.' },
      { title: 'Global Coverage', text: 'Delivering international media coverage across Sweden and worldwide prestigious global events.' },
      { title: 'Cinematic Storytelling', text: 'Creating emotional visual narratives through modern cinematic photography and videography experiences.' },
      { title: 'Professional Excellence', text: 'Providing premium-quality media production with accuracy, dedication, professionalism, and creative excellence.' },
    ],
  },
  sv: {
    eyebrow: 'Våra visuella berättelser',
    title: 'Vi fångar ögonblick med kvalitet',
    items: [
      { title: 'Sportfotografi', text: 'Vi fångar varje avgörande idrottsögonblick med precision, passion och slagkraftigt visuellt berättande.' },
      { title: 'Global bevakning', text: 'Internationell mediebevakning i hela Sverige och vid prestigefyllda evenemang världen över.' },
      { title: 'Filmiskt berättande', text: 'Känslofyllda visuella berättelser genom modern filmisk fotografi och video.' },
      { title: 'Professionell kvalitet', text: 'Mediaproduktion av högsta kvalitet med noggrannhet, engagemang, professionalism och kreativ skärpa.' },
    ],
  },
  ta: {
    eyebrow: 'எங்கள் காட்சிக் கதைகள்',
    title: 'சிறப்புடன் தருணங்களைப் பதிவு செய்கிறோம்',
    items: [
      { title: 'விளையாட்டுப் புகைப்படம்', text: 'ஒவ்வொரு முக்கியமான விளையாட்டுத் தருணத்தையும் துல்லியம், ஆர்வம், தாக்கமிக்க காட்சிக் கதைசொல்லலுடன் பதிவு செய்கிறோம்.' },
      { title: 'உலகளாவிய பதிவு', text: 'ஸ்வீடன் முழுவதும் மற்றும் உலகின் புகழ்பெற்ற நிகழ்வுகளில் சர்வதேச ஊடகப் பதிவு.' },
      { title: 'திரைப்பட பாணி கதைசொல்லல்', text: 'நவீன திரைப்பட பாணி புகைப்படம் மற்றும் காணொளி மூலம் உணர்வுப்பூர்வமான காட்சிக் கதைகள்.' },
      { title: 'தொழில்முறைச் சிறப்பு', text: 'துல்லியம், அர்ப்பணிப்பு, தொழில்முறை, படைப்பாற்றலுடன் உயர்தர ஊடகத் தயாரிப்பு.' },
    ],
  },
  ml: {
    eyebrow: 'ഞങ്ങളുടെ ദൃശ്യകഥകൾ',
    title: 'മികവോടെ നിമിഷങ്ങൾ പകർത്തുന്നു',
    items: [
      { title: 'സ്പോർട്സ് ഫോട്ടോഗ്രഫി', text: 'ഓരോ നിർണായക കായിക നിമിഷവും കൃത്യതയോടെയും ആവേശത്തോടെയും ശക്തമായ ദൃശ്യാഖ്യാനത്തോടെയും പകർത്തുന്നു.' },
      { title: 'ആഗോള കവറേജ്', text: 'സ്വീഡനിലുടനീളവും ലോകമെമ്പാടുമുള്ള പ്രശസ്ത പരിപാടികളിലും അന്താരാഷ്ട്ര മാധ്യമ കവറേജ്.' },
      { title: 'സിനിമാറ്റിക് കഥപറച്ചിൽ', text: 'ആധുനിക സിനിമാറ്റിക് ഫോട്ടോഗ്രഫിയിലൂടെയും വീഡിയോഗ്രഫിയിലൂടെയും വികാരഭരിതമായ ദൃശ്യകഥകൾ.' },
      { title: 'പ്രൊഫഷണൽ മികവ്', text: 'കൃത്യതയോടെയും സമർപ്പണത്തോടെയും പ്രൊഫഷണലിസത്തോടെയും സർഗ്ഗാത്മകതയോടെയും ഉന്നത നിലവാരമുള്ള മാധ്യമ നിർമ്മാണം.' },
    ],
  },
}

export const storiesFor = (locale: Locale): Stories => stories[locale]
