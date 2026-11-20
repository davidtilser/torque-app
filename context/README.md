# Torque project context

Torque is a repair workbench for equipment technicians. It helps a technician identify a component, investigate a symptom, and source a compatible replacement. The prototype uses a catalog-based model of the single-group Rancilio Silvia M. The same workflow could apply to a printer or another machine with a reliable service manual and parts catalog.

## Product decisions

- **When the technician knows the part**, they select it on the 3D machine or in the component picker. The part highlights and its details appear. Opening the machine exposes the internal assembly. Exploded view separates the portafilter, gasket, screen, tray, and major internal parts for inspection.
- **When the technician knows the symptom**, they describe it in the Diagnose tab. Torque returns possible causes, checks, and links to inspect the relevant components. A vague report triggers a clarifying question. The diagnosis is a starting point for inspection.
- **When a replacement is needed**, Torque filters by exact fit first, then compares ZIP-based delivery, total price including shipping, and seller ratings. The cheaper incompatible listing stays visible with the reason it was excluded. The technician can change the ranking priority or pick a different compatible offer.
- **When the technician approves**, the prototype places a sandbox order. The receipt records the part, seller, price, delivery estimate, and what was checked. The audit trail also records when the technician came from a mocked diagnosis.

The concept started with step-by-step spatial guidance for production-line equipment. The team considered a shipping-label printer and chose the espresso-machine scenario because a physical machine at the venue could give the demo a recognizable starting point. The current prototype starts with a model built from the Rancilio spare parts catalog. Photo-based model identification remains a product idea. [Imaginate spatial work instructions](https://www.imaginate.in/ai-work-instructions) · [Imaginate immersive training](https://www.imaginate.in/immersive-learning-platform)

## Prototype as shipped

- Vite and vanilla JavaScript run the local interface. Three.js renders the Silvia M with selection, orbit, zoom, cutaway, and exploded view.
- The workbench has 34 clickable components. Each has a catalog page, manufacturer part numbers, exact-part supplier links, and in-app sandbox checkout. If the catalog lists more than one replacement, the technician selects the part number first. The water pump uses the machine’s voltage and frequency instead.
- The housing proportions follow the manufacturer’s dimensions. Internal shapes and placement are illustrative. [Rancilio Silvia specifications](https://www.ranciliogroup.com/rancilio/silvia/silvia/)
- Diagnostic fixtures cover noisy or low-flow pumping, leaks around the handle, weak steam, cold brew water, unresponsive controls, and flow diverted to the drip tray.
- Sellers, prices, ratings, and delivery estimates are demo fixtures. The pump and gasket part numbers come from the catalog. Checkout always creates a sandbox receipt.

Run `npm ci` and `npm run dev` to preview. Use `npm run build` to check the production build.

## Run the sponsor pump demo

1. Copy `.env.example` to `.env.local` and set `TORQUE_MODE=live`. Add the Cognee Cloud API key, workspace API URL, and the dataset name containing `RLCSILVIAM_en-US.pdf` as `COGNEE_DATASET`. Add the SingleStore SQL host, database, username, and password. Use a demo database where the SQL user can create and alter tables, read, and insert. Set `SINGLESTORE_CA_PATH` if the cluster uses a CA bundle.
2. In Persona, switch to **Sandbox**, create a Sandbox API key with permission to read inquiries, and create a test inquiry using a sample template such as KYC. Complete the sandbox flow with sample data and confirm the inquiry status is **Approved**. Add the key as `PERSONA_API_KEY` and the `inq_…` ID as `PERSONA_INQUIRY_ID` in `.env.local`. [Persona Sandbox setup](https://docs.withpersona.com/api-quickstart-tutorial) · [Test inquiry walkthrough](https://docs.withpersona.com/tutorial-embedded-flow-inquiry-template#step-7-test-the-flow)
3. Run `npm run seed:demo`. It verifies both pump variants in Cognee and seeds the Silvia M offer catalog in SingleStore. The database keeps the original `torque_pump_offers` and `torque_pump_orders` table names so prior receipts remain available. The server also initializes its tables on first use.
4. Start or restart `npm run dev`. Click **Pump runs, no water → Inspect water pump → Select the machine nameplate → Review order → Approve sandbox order**. Open the receipt’s audit trail to see the Cognee diagnosis, Persona Sandbox verification, and SingleStore receipt.

Local symptom rules identify the no-flow scenario. Cognee retrieves the matching Silvia M catalog parts and lets the technician confirm the manufacturer codes when selecting a component. The nameplate selection determines pump fit. The 120 V / 60 Hz pump is `34011023`. The 220–230 V / 50 Hz pump is `34011026`. After the technician approves an order in sponsor mode, Torque checks the configured Persona test inquiry and stores the verification outcome with the sandbox order in SingleStore. The demo uses one preconfigured test technician. `TORQUE_MODE=mock` runs the checkout without sponsor credentials. Keep `.env.local` local.

## Repository map

| File | Purpose |
| --- | --- |
| `index.html`, `style.css`, `main.js` | Torque workbench, diagnostic and parts views, interaction, approval, and receipt |
| `viewer.js`, `silvia-model.js` | Three.js viewer and catalog-based Silvia M geometry |
| `parts.js` | Component names, descriptions, and catalog links |
| `diagnostics.js` | Local symptom-to-cause rules and follow-up questions |
| `offers.js` | Mock listings, fit and ranking logic, and sandbox orders |
| `server/` | Demo API, Cognee-backed diagnosis, Persona Sandbox verification, and SingleStore pump catalog and order persistence |

See [the three-minute demo](demo.md) and [the hackathon brief and sponsor notes](hackathon.md).
