# Torque project context

Torque is a repair workbench for equipment technicians. It helps a technician identify a component, investigate a symptom, and source a compatible replacement. The prototype uses one illustrative two-group espresso machine. The same workflow could apply to a printer or another machine with a reliable service manual and parts catalog.

## Product decisions

- **When the technician knows the part**, they select it on the 3D machine or in the component picker. The part highlights and its details appear. Opening the machine exposes the internal assembly. Exploded view moves the portafilters so the seals and shower screens are easier to inspect.
- **When the technician knows the symptom**, they describe it in the Diagnose tab. Torque returns possible causes, checks, and links to inspect the relevant components. A vague report triggers a clarifying question. The diagnosis is a starting point for inspection.
- **When a replacement is needed**, Torque filters by exact fit first, then compares ZIP-based delivery, total price including shipping, and seller ratings. The cheaper incompatible listing stays visible with the reason it was excluded. The technician can change the ranking priority or pick a different compatible offer.
- **When the technician approves**, the prototype places a sandbox order. The receipt records the part, seller, price, delivery estimate, and what was checked. The audit trail also records when the technician came from a mocked diagnosis.

The concept started with step-by-step spatial guidance for production-line equipment. The team considered a shipping-label printer and chose the espresso-machine scenario because a physical machine at the venue could give the demo a recognizable starting point. The current prototype starts with a prepared model. Photo-based model identification remains a product idea. [Imaginate spatial work instructions](https://www.imaginate.in/ai-work-instructions) · [Imaginate immersive training](https://www.imaginate.in/immersive-learning-platform)

## Prototype as shipped

- Vite and vanilla JavaScript run the local interface. Three.js renders the bundled GLB with selection, orbit, zoom, cutaway, and exploded view.
- The component picker covers 47 components. The model includes eight illustrative internal parts with mock listings and checkout. Both group head seals also have mock listings. Other exterior parts show identification and availability.
- The internal catalog covers the steam boiler, brew boiler, water pump, solenoid valve, control board, pressure switch, inlet hose, and heating element.
- Diagnostic fixtures cover noisy or low-flow pumping, leaks around the handle, weak steam, cold brew water, unresponsive controls, and flow diverted to the drip tray.
- Sellers, SKUs, prices, ratings, and delivery estimates are demo fixtures. The Tevy asset depicts a generic machine with an illustrative interior. Checkout always creates a sandbox receipt. [Tevy asset and CC0 license](https://tevy.dev/models/espresso-machine)

Run `npm ci` and `npm run dev` to preview. Use `npm run build` to check the production build.

## Run the sponsor pump demo

1. Copy `.env.example` to `.env.local` and set `TORQUE_MODE=live`. Add the Cognee Cloud API key and workspace API URL and the SingleStore SQL host, database, username, and password. Use a demo database where the SQL user can create and alter tables, read, and insert. Set `SINGLESTORE_CA_PATH` if the cluster uses a CA bundle.
2. In Persona, switch to **Sandbox**, create a Sandbox API key with permission to read inquiries, and create a test inquiry using a sample template such as KYC. Complete the sandbox flow with sample data and confirm the inquiry status is **Approved**. Add the key as `PERSONA_API_KEY` and the `inq_…` ID as `PERSONA_INQUIRY_ID` in `.env.local`. [Persona Sandbox setup](https://docs.withpersona.com/api-quickstart-tutorial) · [Test inquiry walkthrough](https://docs.withpersona.com/tutorial-embedded-flow-inquiry-template#step-7-test-the-flow)
3. Run `npm run seed:demo`. It loads the illustrative pump knowledge into Cognee and creates or updates the `torque_pump_offers` and `torque_pump_orders` tables in SingleStore. The server also initializes its pump tables on first use.
4. Start or restart `npm run dev`. Click **Pump runs, no water → Inspect water pump → Review order → Approve sandbox order**. Open the receipt’s audit trail to see the Cognee diagnosis, Persona Sandbox verification, and SingleStore receipt.

The pump diagnosis queries Cognee with the technician’s observation. Torque filters the candidate parts against the retrieved evidence and checks the shared water supply first. After the technician explicitly approves an order, Torque checks the configured test inquiry through Persona and stores the verification outcome with the sandbox order in SingleStore. The demo uses one preconfigured test technician. Other prototype scenarios use local data. `TORQUE_MODE=mock` runs the pump flow without sponsor credentials. Keep `.env.local` local.

## Repository map

| File | Purpose |
| --- | --- |
| `index.html`, `style.css`, `main.js` | Torque workbench, diagnostic and parts views, interaction, approval, and receipt |
| `viewer.js`, `internals.js`, `prepared-mesh-parts.js` | Three.js viewer, illustrative internals, and mapping for the merged GLB geometry |
| `parts.js` | Component names, descriptions, and catalog links |
| `diagnostics.js` | Local symptom-to-cause rules and follow-up questions |
| `offers.js` | Mock listings, fit and ranking logic, and sandbox orders |
| `server/` | Demo API, Cognee-backed diagnosis, Persona Sandbox verification, and SingleStore pump catalog and order persistence |

See [the three-minute demo](demo.md) and [the hackathon brief and sponsor notes](hackathon.md).
