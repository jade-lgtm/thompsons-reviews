// Thompsons Facebook reviews → public JSON for the website reviews widget.
// Env vars: FB_PAGE_ID, FB_PAGE_TOKEN (never-expiring Page token), ALLOWED_ORIGIN (* or https://thompsonsdecorating.co.uk)
const GRAPH = 'https://graph.facebook.com/v26.0';

export default async function handler(req, res) {
  const { FB_PAGE_ID, FB_PAGE_TOKEN, ALLOWED_ORIGIN } = process.env;
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN || '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const get = (url) => fetch(url).then((r) => r.json());
  const token = encodeURIComponent(FB_PAGE_TOKEN || '');
  const base = `${GRAPH}/${FB_PAGE_ID}`;

  try {
    let ratings = await get(`${base}/ratings?fields=created_time,recommendation_type,rating,review_text,reviewer{name}&limit=100&access_token=${token}`);
    if (ratings.error) {
      // Some pages can't return reviewer names: retry without them
      ratings = await get(`${base}/ratings?fields=created_time,recommendation_type,rating,review_text&limit=100&access_token=${token}`);
    }
    if (ratings.error) throw new Error(ratings.error.message);

    const page = await get(`${base}?fields=overall_star_rating,rating_count&access_token=${token}`);
    const items = ratings.data || [];
    const recs = items.filter((r) => r.recommendation_type);
    const positive = recs.filter((r) => r.recommendation_type === 'positive').length;

    res.status(200).json({
      rating: page.overall_star_rating || null,
      count: page.rating_count || items.length,
      recommendPct: recs.length ? Math.round((positive / recs.length) * 100) : null,
      reviews: items.filter((r) => r.review_text).map((r) => ({
        recommends: r.recommendation_type ? r.recommendation_type === 'positive' : null,
        rating: r.rating || null,
        text: r.review_text,
        name: r.reviewer && r.reviewer.name ? r.reviewer.name : 'Facebook user',
        date: r.created_time,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: 'Could not load Facebook reviews', detail: String(e.message || e) });
  }
}
