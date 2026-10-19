// Vercel entry point: serves the compiled Express app (npm run build → dist/app.js) for every request.
// vercel.json rewrites all paths to this function, so the routes behave exactly as on Render.
import app from '../dist/app.js'

export default app
