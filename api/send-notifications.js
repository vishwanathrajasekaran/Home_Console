import webpush from 'web-push'

export default async function handler(req, res) {
  // Simple shared-secret guard so this endpoint can't be spammed by strangers.
  if (req.query.key !== process.env.CRON_TRIGGER_KEY) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  const { APPS_SCRIPT_URL, CRON_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env
  if (!APPS_SCRIPT_URL || !CRON_SECRET || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return res.status(500).json({ error: 'Missing required environment variables' })
  }

  webpush.setVapidDetails('mailto:notifications@vishwanathrajasekaran.in', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

  try {
    const url = `${APPS_SCRIPT_URL}?action=getDueForNotify&secret=${encodeURIComponent(CRON_SECRET)}`
    const r = await fetch(url)
    const data = await r.json()
    if (data.error) return res.status(500).json({ error: data.error })

    const notifications = data.notifications || []
    const results = await Promise.allSettled(
      notifications.map((n) =>
        webpush.sendNotification(
          n.subscription,
          JSON.stringify({ title: n.title, body: n.body, tag: n.tag })
        )
      )
    )

    const sent = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.length - sent
    return res.status(200).json({ ok: true, sent, failed, total: notifications.length })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
