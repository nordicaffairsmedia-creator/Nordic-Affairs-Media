/**
 * Moves the old WordPress site into the CMS from your own computer — use this if the
 * old site's firewall blocks Render, or simply because it is faster. Run:
 *
 *   npm run import:wordpress -w @nam/web
 *
 * with the SAME DATABASE_URI, PAYLOAD_SECRET and S3_* values as on Render in apps/web/.env,
 * so photos land in the shared storage and appear on the live site.
 * Safe to stop (Ctrl+C) and run again — nothing is copied twice.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { importBasics, importItem, loadPlan, WP_BASE } from '../lib/wordpress/importer'

if (!process.env.S3_BUCKET && process.env.IMPORT_ALLOW_LOCAL_DISK !== '1') {
  console.error(
    'S3_BUCKET is not set: photos would be saved on this computer only and never reach the live site.\n' +
      'Copy the S3_* values from Render into apps/web/.env (or set IMPORT_ALLOW_LOCAL_DISK=1 for a local test).',
  )
  process.exit(1)
}

const payload = await getPayload({ config })
console.log(`Reading ${WP_BASE} …`)
const plan = await loadPlan()
const photos = plan.reduce((n, i) => n + (i.duplicateOf ? 0 : i.photos), 0)
console.log(`${plan.length} items, ${photos} photos.`)

const basics = await importBasics(payload)
basics.failed.forEach((f) => console.warn(`  ! ${f}`))
console.log(`✓ ${basics.message}`)

const problems: string[] = []
for (const [n, item] of plan.entries()) {
  let offset = 0
  for (;;) {
    let result
    try {
      result = await importItem(payload, item.key, offset, item.duplicateOf, 20)
    } catch (e) {
      problems.push(`${item.title}: ${e instanceof Error ? e.message : String(e)}`)
      console.error(`  ✗ ${item.title}: ${String(e)}`)
      break
    }
    result.failed.forEach((f) => {
      problems.push(`${item.title}: ${f}`)
      console.warn(`  ! ${f}`)
    })
    process.stdout.write(`\r[${n + 1}/${plan.length}] ${item.title} — ${result.message}      `)
    if (result.done) break
    offset = result.next
  }
  process.stdout.write('\n')
}

console.log(problems.length ? `\nDone with ${problems.length} problem(s):` : '\nAll done.')
problems.forEach((p) => console.log(`  - ${p}`))
process.exit(0)
