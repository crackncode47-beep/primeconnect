import { randomUUID } from "node:crypto";
import { quote } from "../pricing.mjs";
import { notifyRequest } from "../email.mjs";
import { syncToHubSpot } from "../hubspot.mjs";

export function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

export async function mapboxFeatures(query) {
  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.search = new URLSearchParams({
    access_token: process.env.MAPBOX_PUBLIC_TOKEN || "",
    autocomplete: "true",
    country: "CA",
    language: "en",
    limit: "7",
    types: "address",
    q: query,
  }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw Error("Address service unavailable");
  const data = await response.json();
  return data.features || [];
}

export function mapboxAddress(feature) {
  const rawContext = feature.properties?.context || feature.context || [];
  const context = Object.fromEntries(
    Array.isArray(rawContext)
      ? rawContext.map((item) => [item.id?.split(".")[0], item])
      : Object.entries(rawContext).map(([key, item]) => [
          key,
          typeof item === "string" ? { text: item } : item,
        ]),
  );
  const label = (item) => item?.text || item?.name || item?.name_en || "";
  const region = context.region;
  const regionValue =
    region?.short_code ||
    region?.region_code ||
    region?.region_code_full?.replace(/^CA-/, "") ||
    label(region);
  const provinceNames = {
    "british columbia": "BC",
    alberta: "AB",
    manitoba: "MB",
    saskatchewan: "SK",
    ontario: "ON",
  };
  const postalCode = label(context.postcode);
  const postalProvince = {
    K: "ON",
    L: "ON",
    M: "ON",
    N: "ON",
    P: "ON",
    R: "MB",
    S: "SK",
    T: "AB",
    V: "BC",
  }[postalCode[0]?.toUpperCase()];
  const province =
    provinceNames[regionValue.toLowerCase()] ||
    regionValue.replace(/^CA-/, "") ||
    postalProvince ||
    "";
  return {
    line1: [
      feature.properties?.address_number ||
        feature.properties?.address ||
        feature.address,
      feature.properties?.street || feature.text || feature.properties?.name,
    ]
      .filter(Boolean)
      .join(" "),
    city: label(context.place) || label(context.locality),
    province,
    postalCode,
    verified: true,
  };
}

export function featureItem(feature) {
  return {
    id: feature.id,
    Text:
      feature.properties?.full_address ||
      feature.place_name ||
      feature.text ||
      "Address match",
    Description: feature.place_name || feature.properties?.full_address || "",
    address: mapboxAddress(feature),
  };
}

async function requestBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 15000) throw Error("Request is too large.");
  }
  return JSON.parse(body);
}

export async function submitRequest(req, res) {
  let data;
  try {
    data = await requestBody(req);
  } catch (error) {
    return json(res, error.message === "Request is too large." ? 413 : 400, {
      error:
        error.message === "Request is too large."
          ? error.message
          : "Invalid request.",
    });
  }
  const {
    firstName,
    lastName,
    email,
    phone,
    dob,
    address,
    consent,
    note = "",
    selection,
  } = data;
  if (
    typeof firstName !== "string" ||
    !firstName.trim() ||
    firstName.length > 80 ||
    typeof lastName !== "string" ||
    !lastName.trim() ||
    lastName.length > 80 ||
    typeof email !== "string" ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    email.length > 254 ||
    typeof phone !== "string" ||
    !/^1?\d{10}$/.test(phone.replace(/\D/g, "")) ||
    typeof dob !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dob) ||
    !address ||
    typeof address.line1 !== "string" ||
    !address.line1.trim() ||
    address.line1.length > 200 ||
    typeof address.city !== "string" ||
    !address.city.trim() ||
    address.city.length > 100 ||
    !/^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i.test(address.postalCode || "") ||
    consent !== true ||
    typeof note !== "string" ||
    note.length > 2000 ||
    !selection ||
    typeof selection.phone !== "boolean" ||
    typeof selection.autopay !== "boolean"
  )
    return json(res, 400, {
      error: "Please check your address and contact details.",
    });

  const date = new Date(dob + "T00:00:00Z");
  if (
    isNaN(date) ||
    date.toISOString().slice(0, 10) !== dob ||
    date > new Date() ||
    date.getUTCFullYear() < 1900
  )
    return json(res, 400, { error: "Enter a valid date of birth." });

  let pricing;
  try {
    pricing = quote(
      address.province,
      selection.speed,
      selection.tv,
      selection.phone,
      selection.autopay,
    );
  } catch {
    return json(res, 400, { error: "Select a valid internet and TV plan." });
  }
  const id = randomUUID();
  const stored = {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email,
    phone,
    dob,
    address,
    note,
    selection,
    pricing,
    consent: true,
  };
  const emailStatus = await notifyRequest(id, stored);
  let crmStatus = "not_configured";
  try {
    crmStatus = await syncToHubSpot(id, stored);
  } catch (error) {
    console.error(`HubSpot sync failed for ${id}:`, error.message);
    crmStatus = "failed";
  }
  console.log(`Request ${id}: email:${emailStatus};crm:${crmStatus}`);
  return json(res, 201, { id });
}
