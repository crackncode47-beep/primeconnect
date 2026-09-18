# PrimeConnect

A complete responsive website with an animated homepage, Mapbox address autocomplete, provincial plan builder, TV and home phone options, and customer request storage.

## Preview

Requires Node.js 22.13 or newer. In this folder run `npm start`, then open http://localhost:4173. No packages need installing. Run `npm test` to verify all provincial pricing and bundle combinations.

## Email delivery

The recipient is configured as **raf77c@gmail.com**. To activate email notifications, add `RESEND_API_KEY` and a verified sender address in `EMAIL_FROM` to `.env`, then restart. Sending documentation: https://resend.com/docs/api-reference/emails/send-email . A receiving Gmail address alone cannot authorize outgoing email.

Until configured, requests are saved locally; no email is claimed to be sent. Date of birth stays out of email notifications. Delivery outcomes are stored in the `notifications` table. Failed notifications remain recoverable from the stored request; automatic retries are not implemented.

## CRM delivery

The recommended free CRM for this site is **HubSpot Free CRM**. Create a private app in HubSpot with `crm.objects.contacts.read`, `crm.objects.contacts.write`, `crm.objects.deals.write`, and `crm.objects.notes.write` scopes, then set `HUBSPOT_PRIVATE_APP_TOKEN` in `.env`. Each request upserts a contact by email, creates a lead deal, and adds a visible CRM note with the address, date of birth, selected services, pricing, phone, and customer note. Set `HUBSPOT_CREATE_DEAL=false` if you only want contact records and notes. Date of birth is excluded from email notifications but is sent to HubSpot because it is part of the CRM lead record.

## Data and hosting

The Mapbox public token is configured in `.env`, excluded by `.gitignore`, and used only by the server address proxy. Requests are stored in `data/requests.sqlite`, a private SQLite file with owner-only file permissions. There is no public customer-data or admin endpoint. Restrict access to the computer and back up the database securely.

For Vercel, deploy this project with `vercel.json` and add `MAPBOX_PUBLIC_TOKEN`, `LEAD_EMAIL`, `RESEND_API_KEY`, `EMAIL_FROM`, `HUBSPOT_PRIVATE_APP_TOKEN`, `HUBSPOT_CREATE_DEAL`, `HUBSPOT_DEAL_PIPELINE`, and `HUBSPOT_DEAL_STAGE` as project environment variables. The Vercel API routes do not use the local SQLite database; configure email or HubSpot before launch because Vercel function storage is ephemeral. Confirm final offer terms and your data retention policy before public launch. No card details or payment are collected.

## Pricing assumptions

TV ($35 Essential / $55 Plus / $95 Ultimate) and phone ($25) apply in all five supported provinces. The $5 auto-pay discount applies only in BC, AB and MB, as specified. SK and ON receive two free months of internet and selected TV; phone is excluded. Prices are before taxes. Mapbox verifies address search results, not Rogers serviceability; an advisor confirms service availability.

## Files

- `public/` — website and supplied brand images
- `server.mjs` — address API proxy, validation and request storage
- `pricing.mjs` — shared pricing rules
- `email.mjs` — email notifications
- `test.mjs` — pricing tests

Mapbox Geocoding API documentation: https://docs.mapbox.com/api/search/geocoding/
