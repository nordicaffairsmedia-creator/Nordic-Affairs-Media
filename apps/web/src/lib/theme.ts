/** Where the visitor's light/navy choice is remembered (browser storage). */
export const THEME_KEY = 'nam-theme'

/** Runs in <head> before the page paints, so a saved "light" choice shows without a flash. */
export const themeBootScript = `try{if(localStorage.getItem('${THEME_KEY}')==='light')document.documentElement.dataset.theme='light'}catch(e){}`
