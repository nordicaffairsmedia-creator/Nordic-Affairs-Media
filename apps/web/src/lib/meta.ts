import 'server-only'

/*
 * Meta (Facebook and Instagram) Marketing API, version-pinned. Needs a Meta developer app:
 * META_APP_ID and META_APP_SECRET on the website (Vercel). Ads run as the connected Facebook
 * Page, in the ad account of the person who connected; Meta bills the payment method on that
 * ad account.
 */
export const GRAPH = 'https://graph.facebook.com/v21.0'
export const metaReady = () => Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET)
export const SCOPES = 'pages_show_list,pages_read_engagement,ads_management,business_management'

export class MetaError extends Error {}

type Json = Record<string, unknown>

export async function graph<T = Json>(path: string, token: string, init?: { method?: 'GET' | 'POST'; params?: Record<string, unknown> }): Promise<T> {
  const method = init?.method ?? 'GET'
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(init?.params ?? {})) {
    if (v === undefined || v === null) continue
    params.set(k, typeof v === 'string' ? v : JSON.stringify(v))
  }
  params.set('access_token', token)
  const url = `${GRAPH}/${path}${method === 'GET' ? `?${params}` : ''}`
  const res = await fetch(url, {
    method,
    ...(method === 'POST' ? { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() } : {}),
  })
  const data = (await res.json().catch(() => ({}))) as Json & { error?: { message?: string; error_user_msg?: string } }
  if (!res.ok || data.error) throw new MetaError(data.error?.error_user_msg || data.error?.message || `Meta said ${res.status}`)
  return data as T
}

export const oauthRedirectUri = (site: string) => `${site}/api/advertising/callback`

/** Swaps the one-time code for a long-lived user token (about 60 days). */
export async function exchangeCode(code: string, redirectUri: string) {
  const q = new URLSearchParams({ client_id: process.env.META_APP_ID!, client_secret: process.env.META_APP_SECRET!, redirect_uri: redirectUri, code })
  const short = (await (await fetch(`${GRAPH}/oauth/access_token?${q}`)).json()) as { access_token?: string; error?: { message?: string } }
  if (!short.access_token) throw new MetaError(short.error?.message || 'Facebook did not accept the sign-in.')
  const q2 = new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: process.env.META_APP_ID!, client_secret: process.env.META_APP_SECRET!, fb_exchange_token: short.access_token })
  const long = (await (await fetch(`${GRAPH}/oauth/access_token?${q2}`)).json()) as { access_token?: string; expires_in?: number }
  return { token: long.access_token || short.access_token, expiresIn: long.expires_in ?? 0 }
}

export type EventAdInput = {
  adAccountId: string
  pageId: string
  token: string
  name: string
  headline: string
  message: string
  link: string
  imageUrl?: string
  dailyBudget: number // major units of the ad account currency (e.g. 100 = 100 SEK)
  startTime: Date
  endTime: Date
  countries: string[]
  ageMin: number
  ageMax: number
}

/** Creates campaign → ad set → creative → ad, all started. Returns Meta's ids. */
export async function createEventAd(i: EventAdInput) {
  const act = `act_${i.adAccountId.replace(/^act_/, '')}`
  const campaign = await graph<{ id: string }>(`${act}/campaigns`, i.token, {
    method: 'POST',
    params: { name: i.name, objective: 'OUTCOME_TRAFFIC', status: 'PAUSED', special_ad_categories: [] },
  })
  try {
    const adset = await graph<{ id: string }>(`${act}/adsets`, i.token, {
      method: 'POST',
      params: {
        name: `${i.name} – audience`,
        campaign_id: campaign.id,
        daily_budget: Math.round(i.dailyBudget * 100),
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'LINK_CLICKS',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        start_time: i.startTime.toISOString(),
        end_time: i.endTime.toISOString(),
        targeting: { geo_locations: { countries: i.countries }, age_min: i.ageMin, age_max: i.ageMax },
        status: 'PAUSED',
      },
    })
    const creative = await graph<{ id: string }>(`${act}/adcreatives`, i.token, {
      method: 'POST',
      params: {
        name: `${i.name} – creative`,
        object_story_spec: {
          page_id: i.pageId,
          link_data: {
            message: i.message,
            link: i.link,
            name: i.headline,
            ...(i.imageUrl ? { picture: i.imageUrl } : {}),
            call_to_action: { type: 'BUY_TICKETS', value: { link: i.link } },
          },
        },
      },
    })
    const ad = await graph<{ id: string }>(`${act}/ads`, i.token, {
      method: 'POST',
      params: { name: i.name, adset_id: adset.id, creative: { creative_id: creative.id }, status: 'PAUSED' },
    })
    // Everything exists: switch it on (campaign last, so nothing runs half-built).
    await graph(adset.id, i.token, { method: 'POST', params: { status: 'ACTIVE' } })
    await graph(ad.id, i.token, { method: 'POST', params: { status: 'ACTIVE' } })
    await graph(campaign.id, i.token, { method: 'POST', params: { status: 'ACTIVE' } })
    return { campaignId: campaign.id, adSetId: adset.id, creativeId: creative.id, adId: ad.id }
  } catch (e) {
    // Do not leave a half-built paused campaign behind.
    await graph(campaign.id, i.token, { method: 'POST', params: { status: 'DELETED' } }).catch(() => null)
    throw e
  }
}

export async function setCampaignStatus(campaignId: string, token: string, status: 'ACTIVE' | 'PAUSED' | 'DELETED') {
  await graph(campaignId, token, { method: 'POST', params: { status } })
}

export async function campaignResults(campaignId: string, token: string) {
  const info = await graph<{ effective_status?: string }>(campaignId, token, { params: { fields: 'effective_status' } })
  const ins = await graph<{ data?: { impressions?: string; reach?: string; clicks?: string; spend?: string }[] }>(`${campaignId}/insights`, token, {
    params: { fields: 'impressions,reach,clicks,spend', date_preset: 'maximum' },
  })
  const r = ins.data?.[0] ?? {}
  return {
    effectiveStatus: info.effective_status ?? '',
    impressions: Number(r.impressions ?? 0),
    reach: Number(r.reach ?? 0),
    clicks: Number(r.clicks ?? 0),
    spend: Number(r.spend ?? 0),
  }
}
