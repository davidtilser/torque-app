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

1. Copy `.env.example` to `.env.local` and set `TORQUE_MODE=live`. Add the Arcee API key, the Cognee Cloud API key and workspace API URL, and the SingleStore SQL host, database, username, and password. Use a demo database where that user can create tables, read, and insert. Set `SINGLESTORE_CA_PATH` if the cluster uses a CA bundle.
2. Run `npm run seed:demo`. It loads the illustrative pump knowledge into Cognee and creates and seeds the `torque_pump_offers` and `torque_pump_orders` tables in SingleStore. The demo server also initializes its pump tables on first use.
3. Start or restart `npm run dev`. Click **Pump runs, no water → Inspect water pump → Review order → Approve sandbox order**. The diagnosis should show **Arcee + Cognee**, the pump offers should show **SingleStore**, and the receipt should say **Saved in SingleStore**.

The pump diagnosis queries Cognee and uses Arcee to rank candidates grounded in the result. SingleStore serves the fixture offers and stores approved pump orders and their audit records. The other prototype scenarios use local data. `TORQUE_MODE=mock` runs the same pump flow without sponsor credentials. Keep `.env.local` local.

## Repository map

| File | Purpose |
| --- | --- |
| `index.html`, `style.css`, `main.js` | Torque workbench, diagnostic and parts views, interaction, approval, and receipt |
| `viewer.js`, `internals.js`, `prepared-mesh-parts.js` | Three.js viewer, illustrative internals, and mapping for the merged GLB geometry |
| `parts.js` | Component names, descriptions, and catalog links |
| `diagnostics.js` | Local symptom-to-cause rules and follow-up questions |
| `offers.js` | Mock listings, fit and ranking logic, and sandbox orders |
| `server/` | Demo API, Arcee and Cognee diagnosis, SingleStore pump catalog and order persistence |

See [the three-minute demo](demo.md) and [the hackathon brief and sponsor notes](hackathon.md).
