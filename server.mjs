import http from "node:http";
import { readFile, mkdir, chmod, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";
import { quote } from "./pricing.mjs";
import { notifyRequest } from "./email.mjs";
import { syncToHubSpot } from "./hubspot.mjs";
const root = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || join(root, "data");
await mkdir(dataDir, { recursive: true, mode: 0o700 });
const db = new DatabaseSync(join(dataDir, "requests.sqlite"));
db.exec(
  "CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, payload TEXT NOT NULL)",
);
db.exec(
  "CREATE TABLE IF NOT EXISTS notifications (request_id TEXT PRIMARY KEY, status TEXT NOT NULL)",
);
await chmod(join(dataDir, "requests.sqlite"), 0o600);
const uploadsDir = join(root, "public", "uploads");
await mkdir(uploadsDir, { recursive: true });
db.exec(`CREATE TABLE IF NOT EXISTS homepage_featured_images (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  alt_text TEXT NOT NULL DEFAULT '',
  image_path TEXT NOT NULL,
  destination_url TEXT NOT NULL DEFAULT '',
  open_in_new_tab INTEGER NOT NULL DEFAULT 0,
  position TEXT NOT NULL DEFAULT 'large-left',
  section_key TEXT NOT NULL DEFAULT 'hero-board',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'admin',
  updated_by TEXT NOT NULL DEFAULT 'admin'
)`);
// add section_key column if upgrading from old schema
try { db.exec('ALTER TABLE homepage_featured_images ADD COLUMN section_key TEXT NOT NULL DEFAULT "hero-board"'); } catch {}
const adminSessions = new Set();
const limits = new Map();
const json = (res, status, data) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
};
async function address(params) {
  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.search = new URLSearchParams({
    access_token: process.env.MAPBOX_PUBLIC_TOKEN || "",
    autocomplete: "true",
    country: "CA",
    language: "en",
    limit: "7",
    types: "address",
    ...params,
  }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw Error("Address service unavailable");
  const data = await response.json();
  return data.features || [];
}
function mapboxAddress(feature) {
  const rawContext = feature.properties?.context || feature.context || [];
  const context = Object.fromEntries(
    Array.isArray(rawContext)
      ? rawContext.map((item) => [item.id?.split(".")[0], item])
      : Object.entries(rawContext).map(([key, item]) => [
          key,
          typeof item === "string" ? { text: item } : item,
        ]),
  );
  const region = context.region;
  const provinceNames = {
    "british columbia": "BC",
    alberta: "AB",
    manitoba: "MB",
    saskatchewan: "SK",
    ontario: "ON",
  };
  const label = (item) => item?.text || item?.name || item?.name_en || "";
  const provinceValue =
    region?.short_code ||
    region?.region_code ||
    region?.region_code_full?.replace(/^CA-/, "") ||
    label(region);
  const postalCode = label(context.postcode);
  const postalProvince = {
    A: "NL",
    B: "NS",
    C: "PE",
    E: "NB",
    G: "QC",
    H: "QC",
    J: "QC",
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
    provinceNames[provinceValue.toLowerCase()] ||
    provinceValue.replace(/^CA-/, "") ||
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
http
  .createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
    const url0 = new URL(req.url, "http://localhost");
    const isAdmin = url0.pathname === "/admin";
    res.setHeader(
      "Content-Security-Policy",
      isAdmin
        ? "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
        : "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
    );
    try {
      const url = url0;
      if (url.pathname.startsWith("/api/")) {
        const ip = req.socket.remoteAddress;
        const now = Date.now();
        const window = limits.get(ip);
        if (!window || now - window.time > 60000)
          limits.set(ip, { time: now, count: 1 });
        else if (++window.count > 80)
          return json(res, 429, {
            error: "Please wait a moment and try again.",
          });
        if (limits.size > 10000)
          for (const [key, value] of limits)
            if (now - value.time > 60000) limits.delete(key);
        if (req.method === "POST" && url.pathname === "/api/admin/login") {
          let body = "";
          for await (const chunk of req) { body += chunk; if (body.length > 1000) return json(res, 413, { error: "Too large" }); }
          let data; try { data = JSON.parse(body); } catch { return json(res, 400, { error: "Invalid" }); }
          if (data.password === (process.env.ADMIN_PASSWORD || "admin123")) {
            const token = randomUUID();
            adminSessions.add(token);
            return json(res, 200, { token });
          }
          return json(res, 401, { error: "Wrong password" });
        }
        if (req.method === "GET" && url.pathname === "/api/admin/requests") {
          const token = req.headers["x-admin-token"] || "";
          if (!adminSessions.has(token)) return json(res, 401, { error: "Unauthorized" });
          const rows = db.prepare("SELECT id, created_at, payload FROM requests ORDER BY created_at DESC").all();
          return json(res, 200, { requests: rows.map(r => ({ id: r.id, created_at: r.created_at, ...JSON.parse(r.payload) })) });
        }
        if (req.method === "DELETE" && url.pathname.startsWith("/api/admin/requests/")) {
          const token = req.headers["x-admin-token"] || "";
          if (!adminSessions.has(token)) return json(res, 401, { error: "Unauthorized" });
          const id = url.pathname.split("/").pop();
          db.prepare("DELETE FROM requests WHERE id=?").run(id);
          db.prepare("DELETE FROM notifications WHERE request_id=?").run(id);
          return json(res, 200, { ok: true });
        }

        // ── FEATURED IMAGES: public GET ──
        if (req.method === "GET" && url.pathname === "/api/featured-images") {
          const section = url.searchParams.get('section') || 'hero-board';
          const rows = db.prepare("SELECT * FROM homepage_featured_images WHERE is_active=1 AND section_key=? ORDER BY sort_order ASC").all(section);
          return json(res, 200, { images: rows });
        }

        // ── FEATURED IMAGES: admin GET all ──
        if (req.method === "GET" && url.pathname === "/api/admin/featured-images") {
          const token = req.headers["x-admin-token"] || "";
          if (!adminSessions.has(token)) return json(res, 401, { error: "Unauthorized" });
          const rows = db.prepare("SELECT * FROM homepage_featured_images ORDER BY sort_order ASC").all();
          return json(res, 200, { images: rows });
        }

        // ── FEATURED IMAGES: upload ──
        if (req.method === "POST" && url.pathname === "/api/admin/featured-images/upload") {
          const token = req.headers["x-admin-token"] || "";
          if (!adminSessions.has(token)) return json(res, 401, { error: "Unauthorized" });
          const ct = req.headers["content-type"] || "";
          if (!ct.includes("multipart/form-data")) return json(res, 400, { error: "Multipart required" });
          const boundary = ct.split("boundary=")[1];
          if (!boundary) return json(res, 400, { error: "No boundary" });
          const chunks = [];
          let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 5 * 1024 * 1024) return json(res, 413, { error: "File too large. Max 5 MB." });
            chunks.push(chunk);
          }
          const buf = Buffer.concat(chunks);
          const boundaryBuf = Buffer.from("--" + boundary);
          const parts = [];
          let pos = 0;
          while (pos < buf.length) {
            const start = buf.indexOf(boundaryBuf, pos);
            if (start === -1) break;
            const end = buf.indexOf(boundaryBuf, start + boundaryBuf.length);
            const partEnd = end === -1 ? buf.length : end;
            const part = buf.slice(start + boundaryBuf.length, partEnd);
            if (part.length > 4) parts.push(part);
            pos = partEnd;
          }
          let fileBuffer = null, origName = "", fields = {};
          for (const part of parts) {
            const headerEnd = part.indexOf("\r\n\r\n");
            if (headerEnd === -1) continue;
            const header = part.slice(0, headerEnd).toString();
            const body = part.slice(headerEnd + 4, part.length - 2);
            const nameMatch = header.match(/name="([^"]+)"/);
            const fileMatch = header.match(/filename="([^"]+)"/);
            if (!nameMatch) continue;
            if (fileMatch) { fileBuffer = body; origName = fileMatch[1]; }
            else fields[nameMatch[1]] = body.toString().trim();
          }
          if (!fileBuffer || !fileBuffer.length) return json(res, 400, { error: "No file received" });
          const allowedExts = [".jpg", ".jpeg", ".png", ".webp"];
          const fileExt = extname(origName).toLowerCase();
          if (!allowedExts.includes(fileExt)) return json(res, 400, { error: "Only JPG, PNG or WebP allowed" });
          const sig = fileBuffer.slice(0, 4);
          const isJpg = sig[0] === 0xFF && sig[1] === 0xD8;
          const isPng = sig[0] === 0x89 && sig[1] === 0x50;
          const isWebp = fileBuffer.slice(0, 12).toString("ascii").includes("WEBP");
          if (!isJpg && !isPng && !isWebp) return json(res, 400, { error: "Invalid image file" });
          const filename = randomUUID() + fileExt;
          const filepath = join(uploadsDir, filename);
          await writeFile(filepath, fileBuffer);
          return json(res, 200, { path: "/uploads/" + filename });
        }

        // ── FEATURED IMAGES: create record ──
        if (req.method === "POST" && url.pathname === "/api/admin/featured-images") {
          const token = req.headers["x-admin-token"] || "";
          if (!adminSessions.has(token)) return json(res, 401, { error: "Unauthorized" });
          let body = ""; for await (const c of req) body += c;
          let d; try { d = JSON.parse(body); } catch { return json(res, 400, { error: "Invalid" }); }
          if (!d.image_path) return json(res, 400, { error: "image_path required" });
          const VALID_SECTIONS = ['hero-board','slideshow','service-cards','savings-collage','dealer-portrait','switch-story','community-gallery'];
          const sectionKey = VALID_SECTIONS.includes(d.section_key) ? d.section_key : 'hero-board';
          const pos = (typeof d.position === 'string' && d.position.trim()) ? d.position.trim() : 'large-left';
          const now = new Date().toISOString();
          const id = randomUUID();
          const maxOrder = db.prepare("SELECT MAX(sort_order) as m FROM homepage_featured_images WHERE section_key=?").get(sectionKey);
          const sortOrder = (maxOrder?.m ?? -1) + 1;
          db.prepare(`INSERT INTO homepage_featured_images VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
            id, (d.title||"New Image").slice(0,200), (d.alt_text||d.title||"Image").slice(0,300),
            d.image_path.slice(0,500), (d.destination_url||""),(d.open_in_new_tab?1:0),
            pos, sectionKey, sortOrder, (d.is_active===false?0:1), now, now, "admin", "admin"
          );
          return json(res, 201, { id });
        }

        // ── FEATURED IMAGES: update ──
        if (req.method === "PATCH" && url.pathname.startsWith("/api/admin/featured-images/")) {
          const token = req.headers["x-admin-token"] || "";
          if (!adminSessions.has(token)) return json(res, 401, { error: "Unauthorized" });
          const id = url.pathname.split("/").pop();
          let body = ""; for await (const c of req) body += c;
          let d; try { d = JSON.parse(body); } catch { return json(res, 400, { error: "Invalid" }); }
          const existing = db.prepare("SELECT * FROM homepage_featured_images WHERE id=?").get(id);
          if (!existing) return json(res, 404, { error: "Not found" });
          const now = new Date().toISOString();
          const VALID_SECTIONS = ['hero-board','slideshow','service-cards','savings-collage','dealer-portrait','switch-story','community-gallery'];
          const sectionKey = VALID_SECTIONS.includes(d.section_key) ? d.section_key : existing.section_key;
          const pos = (typeof d.position === 'string' && d.position.trim()) ? d.position.trim() : existing.position;
          // if replacing image, delete old file
          if (d.image_path && d.image_path !== existing.image_path && existing.image_path.startsWith("/uploads/")) {
            const oldFile = join(root, "public", existing.image_path);
            if (existsSync(oldFile)) await unlink(oldFile).catch(() => {});
          }
          db.prepare(`UPDATE homepage_featured_images SET title=?,alt_text=?,image_path=?,destination_url=?,open_in_new_tab=?,position=?,section_key=?,sort_order=?,is_active=?,updated_at=?,updated_by=? WHERE id=?`).run(
            (d.title??existing.title).slice(0,200), (d.alt_text??existing.alt_text).slice(0,300),
            (d.image_path??existing.image_path).slice(0,500), (d.destination_url??existing.destination_url),
            (d.open_in_new_tab!==undefined?d.open_in_new_tab?1:0:existing.open_in_new_tab),
            pos, sectionKey, (d.sort_order??existing.sort_order), (d.is_active!==undefined?d.is_active?1:0:existing.is_active),
            now, "admin", id
          );
          return json(res, 200, { ok: true });
        }

        // ── FEATURED IMAGES: delete ──
        if (req.method === "DELETE" && url.pathname.startsWith("/api/admin/featured-images/")) {
          const token = req.headers["x-admin-token"] || "";
          if (!adminSessions.has(token)) return json(res, 401, { error: "Unauthorized" });
          const id = url.pathname.split("/").pop();
          const existing = db.prepare("SELECT * FROM homepage_featured_images WHERE id=?").get(id);
          if (!existing) return json(res, 404, { error: "Not found" });
          if (existing.image_path.startsWith("/uploads/")) {
            const f = join(root, "public", existing.image_path);
            if (existsSync(f)) await unlink(f).catch(() => {});
          }
          db.prepare("DELETE FROM homepage_featured_images WHERE id=?").run(id);
          return json(res, 200, { ok: true });
        }
        if (req.method === "GET" && url.pathname === "/api/address/find") {
          const query = (url.searchParams.get("q") || "").trim();
          if (query.length < 3 || query.length > 200)
            return json(res, 400, { error: "Enter at least 3 characters." });
          const features = await address({ q: query });
          return json(res, 200, {
            items: features.map((feature) => ({
              id: feature.id,
              Text: [
                feature.properties?.address || feature.address,
                feature.text,
              ]
                .filter(Boolean)
                .join(" "),
              Description:
                feature.place_name || feature.properties?.full_address || "",
              address: mapboxAddress(feature),
            })),
          });
        }
        if (req.method === "POST" && url.pathname === "/api/requests") {
          if (
            req.headers.origin &&
            req.headers.origin !== `http://${req.headers.host}` &&
            req.headers.origin !== `https://${req.headers.host}`
          )
            return json(res, 403, { error: "Invalid request origin." });
          let body = "";
          for await (const chunk of req) {
            body += chunk;
            if (body.length > 15000)
              return json(res, 413, { error: "Request is too large." });
          }
          let data;
          try {
            data = JSON.parse(body);
          } catch {
            return json(res, 400, { error: "Invalid request." });
          }
          const {
            firstName,
            lastName,
            email,
            phone,
            dob,
            address: a,
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
            !a ||
            typeof a.line1 !== "string" ||
            !a.line1.trim() ||
            a.line1.length > 200 ||
            typeof a.city !== "string" ||
            !a.city.trim() ||
            a.city.length > 100 ||
            !/^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i.test(a.postalCode || "") ||
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
              a.province,
              selection.speed,
              selection.tv,
              selection.phone,
              selection.autopay,
            );
          } catch {
            return json(res, 400, {
              error: "Select a valid internet and TV plan.",
            });
          }
          const id = randomUUID();
          db.prepare("INSERT INTO requests VALUES (?,?,?)").run(
            id,
            new Date().toISOString(),
            JSON.stringify({
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              email,
              phone,
              dob,
              address: a,
              note,
              selection,
              pricing,
              consent: true,
            }),
          );
          const stored = JSON.parse(
            db.prepare("SELECT payload FROM requests WHERE id=?").get(id)
              .payload,
          );
          const emailStatus = await notifyRequest(id, stored);
          let crmStatus = "not_configured";
          try {
            crmStatus = await syncToHubSpot(id, stored);
          } catch (error) {
            console.error(`HubSpot sync failed for ${id}:`, error.message);
            crmStatus = "failed";
          }
          db.prepare("INSERT INTO notifications VALUES (?,?)").run(
            id,
            `email:${emailStatus};crm:${crmStatus}`,
          );
          return json(res, 201, { id });
        }
        return json(res, 404, { error: "Not found" });
      }
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405);
        return res.end();
      }
      const files = {
        "/": "index.html",
        "/plans": "index.html",
        "/signup": "index.html",
        "/thank-you": "index.html",
        "/privacy": "index.html",
        "/app.js": "app.js",
        "/styles.css": "styles.css",
        "/pricing.mjs": "../pricing.mjs",
        "/assets/logo.jpg": "assets/logo.jpg",
        "/assets/home.jpg": "assets/home.jpg",
        "/assets/internet.png": "assets/internet.png",
        "/assets/tv.jpg": "assets/tv.jpg",
        "/assets/Essentials_TV.jpg": "assets/Essentials_TV.jpg",
        "/assets/Popular_TV.jpg": "assets/Popular_TV.jpg",
        "/assets/Ultimate_TV.jpg": "assets/Ultimate_TV.jpg",
        "/assets/speed.jpg": "assets/speed.jpg",
        "/assets/canada-leader.jpg": "assets/canada-leader.jpg",
        "/assets/switch-rogers.jpg": "assets/switch-rogers.jpg",
        "/assets/building-canada.jpg": "assets/building-canada.jpg",
        "/assets/savings.jpg": "assets/savings.jpg",
        "/assets/switch-save.jpg": "assets/switch-save.jpg",
        "/assets/canada-space.jpg": "assets/canada-space.jpg",
        "/assets/two-moods.jpg": "assets/two-moods.jpg",
        "/assets/back-to-school.jpg": "assets/back-to-school.jpg",
        "/assets/rogers-dealer.png": "assets/rogers-dealer.png",
        "/assets/websaver-logo.png": "assets/websaver-logo.png",
        "/assets/main-logo.png": "assets/main-logo.png",
        "/admin": "admin.html",
        "/robots.txt": "robots.txt",
        "/sitemap.xml": "sitemap.xml",
      };
      for (const name of [
        "caveat",
        "dm-sans",
        "dm-sans-semibold",
        "manrope",
        "outfit",
        "outfit-semibold",
      ])
        files["/assets/" + name + ".ttf"] = "assets/" + name + ".ttf";
      const file = files[url.pathname];
      if (!file) {
        // serve uploaded images dynamically
        if (url.pathname.startsWith("/uploads/")) {
          const fname = url.pathname.slice(9).replace(/[^a-zA-Z0-9._-]/g, "");
          if (!fname) { res.writeHead(404); return res.end("Not found"); }
          const fpath = join(uploadsDir, fname);
          if (!existsSync(fpath)) { res.writeHead(404); return res.end("Not found"); }
          const fext = extname(fname).toLowerCase();
          const mime = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" }[fext] || "application/octet-stream";
          const content = await readFile(fpath);
          res.setHeader("Content-Type", mime);
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          return res.end(req.method === "HEAD" ? undefined : content);
        }
        res.writeHead(404);
        return res.end("Not found");
      }
      const content = await readFile(join(root, "public", file));
      const fileExt2 = extname(file);
      res.setHeader(
        "Content-Type",
        {
          ".html": "text/html; charset=utf-8",
          ".css": "text/css",
          ".js": "text/javascript",
          ".mjs": "text/javascript",
          ".jpg": "image/jpeg",
          ".png": "image/png",
          ".ttf": "font/ttf",
          ".xml": "application/xml",
          ".txt": "text/plain",
        }[fileExt2],
      );
      if (fileExt2 === ".js" || fileExt2 === ".mjs" || fileExt2 === ".html") {
        res.setHeader("Cache-Control", "no-cache");
      }
      res.end(req.method === "HEAD" ? undefined : content);
    } catch (error) {
      json(res, 503, {
        error:
          error.name === "TimeoutError"
            ? "Address search timed out. Try again or enter your address manually."
            : "We could not complete that request. Please try again or enter your address manually.",
      });
    }
  })
  .listen(process.env.PORT || 4173, "127.0.0.1", () =>
    console.log(
      "PrimeConnect ready at http://localhost:" + (process.env.PORT || 4173),
    ),
  );
