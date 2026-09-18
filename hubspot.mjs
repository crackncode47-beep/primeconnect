const baseUrl = "https://api.hubapi.com";

async function hubspotRequest(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.HUBSPOT_PRIVATE_APP_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.message || `HubSpot returned ${response.status}`;
    throw Error(message);
  }
  return data;
}

function contactProperties(data) {
  const {
    firstName,
    lastName,
    email,
    phone,
    dob,
    address,
    note,
    selection,
    pricing,
  } = data;
  return {
    firstname: firstName,
    lastname: lastName,
    email,
    phone,
    date_of_birth: dob,
    address: address.line1,
    city: address.city,
    state: address.province,
    zip: address.postalCode,
    lifecyclestage: "lead",
    hs_lead_status: "NEW",
  };
}

export async function syncToHubSpot(id, data) {
  if (!process.env.HUBSPOT_PRIVATE_APP_TOKEN) return "not_configured";
  const payload = { ...data, id };
  const properties = contactProperties(payload);
  const search = await hubspotRequest("/crm/v3/objects/contacts/search", {
    method: "POST",
    body: JSON.stringify({
      filterGroups: [
        {
          filters: [
            { propertyName: "email", operator: "EQ", value: data.email },
          ],
        },
      ],
      properties: ["email"],
      limit: 1,
    }),
  });
  const existing = search.results?.[0];
  const contact = existing
    ? await hubspotRequest(`/crm/v3/objects/contacts/${existing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ properties }),
      })
    : await hubspotRequest("/crm/v3/objects/contacts", {
        method: "POST",
        body: JSON.stringify({ properties }),
      });

  let deal;
  if (process.env.HUBSPOT_CREATE_DEAL !== "false") {
    deal = await hubspotRequest("/crm/v3/objects/deals", {
      method: "POST",
      body: JSON.stringify({
        properties: {
          dealname: `PrimeConnect lead - ${data.firstName} ${data.lastName}`,
          amount: String(data.pricing.total),
          pipeline: process.env.HUBSPOT_DEAL_PIPELINE || "default",
          dealstage: process.env.HUBSPOT_DEAL_STAGE || "appointmentscheduled",
          description: [
            `Request ID: ${id}`,
            `Contact ID: ${contact.id}`,
            `Email: ${data.email}`,
            `Phone: ${data.phone}`,
            `Date of birth: ${data.dob}`,
            `Address: ${data.address.line1}, ${data.address.city}, ${data.address.province} ${data.address.postalCode}`,
            "Cart information:",
            `Internet: ${data.selection.speed} Mbps — $${data.pricing.internet}/month`,
            `TV: ${data.selection.tv} — $${data.pricing.television}/month`,
            `Home phone: ${data.selection.phone ? "$25/month" : "Not selected"}`,
            `Auto-pay: ${data.selection.autopay ? "Yes" : "No"}${data.pricing.discount ? ` — $${data.pricing.discount}/month saved` : ""}`,
            `Promotion: ${data.pricing.promo ? "Two free months on internet and selected TV" : "None"}`,
            `Monthly cart total: $${data.pricing.total} before taxes`,
            "Due at signup: $0",
            `Customer note: ${data.note || "None"}`,
          ].join("\n"),
        },
        associations: [
          {
            to: { id: contact.id },
            types: [
              {
                associationCategory: "HUBSPOT_DEFINED",
                associationTypeId: 3,
              },
            ],
          },
        ],
      }),
    });
  }

  const noteBody = [
    "PrimeConnect customer request",
    `Request ID: ${id}`,
    "",
    "Customer information:",
    `Name: ${data.firstName} ${data.lastName}`,
    `Email: ${data.email}`,
    `Phone: ${data.phone}`,
    `Date of birth: ${data.dob}`,
    `Address: ${data.address.line1}, ${data.address.city}, ${data.address.province} ${data.address.postalCode}`,
    "",
    "Cart information:",
    `Internet: ${data.selection.speed} Mbps — $${data.pricing.internet}/month`,
    `TV: ${data.selection.tv} — $${data.pricing.television}/month`,
    `Home phone: ${data.selection.phone ? "$25/month" : "Not selected"}`,
    `Auto-pay: ${data.selection.autopay ? "Yes" : "No"}${data.pricing.discount ? ` — $${data.pricing.discount}/month saved` : ""}`,
    `Promotion: ${data.pricing.promo ? "Two free months on internet and selected TV" : "None"}`,
    `Monthly cart total: $${data.pricing.total} before taxes`,
    "Due at signup: $0",
    `Customer note: ${data.note || "None"}`,
  ].join("\n");
  await hubspotRequest("/crm/v3/objects/notes", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        hs_timestamp: new Date().toISOString(),
        hs_note_body: noteBody,
      },
      associations: [
        {
          to: { id: contact.id },
          types: [
            {
              associationCategory: "HUBSPOT_DEFINED",
              associationTypeId: 202,
            },
          ],
        },
        ...(deal
          ? [
              {
                to: { id: deal.id },
                types: [
                  {
                    associationCategory: "HUBSPOT_DEFINED",
                    associationTypeId: 214,
                  },
                ],
              },
            ]
          : []),
      ],
    }),
  });
  return "sent";
}
