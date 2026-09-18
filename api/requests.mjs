import { json, submitRequest } from "./_lib.mjs";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return json(res, 405, { error: "Method not allowed." });
  try {
    return await submitRequest(req, res);
  } catch (error) {
    console.error("Request submission failed:", error);
    return json(res, 500, {
      error: "Unable to submit your request right now.",
    });
  }
}
