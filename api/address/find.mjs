import { json, mapboxFeatures, featureItem } from "../_lib.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET")
    return json(res, 405, { error: "Method not allowed." });
  const query = (
    new URL(req.url, "http://localhost").searchParams.get("q") || ""
  ).trim();
  if (query.length < 3 || query.length > 200)
    return json(res, 400, { error: "Enter at least 3 characters." });
  try {
    const features = await mapboxFeatures(query);
    return json(res, 200, { items: features.map(featureItem) });
  } catch {
    return json(res, 503, {
      error:
        "Address search is temporarily unavailable. Please enter your address manually.",
    });
  }
}
