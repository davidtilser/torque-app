# Torque

Torque is a repair and parts-shopping workbench for equipment technicians. It takes a technician from a symptom or a component on a 3D model to a compatible replacement, an approval screen, and a receipt that explains the decision.

When two pumps look alike but use different voltages or frequencies, the cheapest listing can keep a machine out of service. Torque brings the diagram, manufacturer part number, and offer comparison into the same workflow.

We built Torque for the **Tokens& Personal Agents Hackathon** in San Francisco on November 20, 2026. The challenge called for a shopping agent that uses trustworthy context, takes a meaningful action, and shows its work. Our prototype demonstrates that loop on a **Rancilio Silvia M** espresso machine. [Hackathon event](https://luma.com/personalagenthack) · [Hackathon brief and judging criteria](context/hackathon.md)

**Team** · [@davidtilser](https://github.com/davidtilser) and [@thomas24k](https://github.com/thomas24k)

## How Torque works

1. **Describe the fault or select a part.** A technician can enter a symptom, such as a noisy pump with no water flow, and get likely causes and checks. If they already know the part, they can click it directly. The Three.js model has 34 selectable components, an open-machine cutaway, and an exploded view. Each component links to the relevant page of the manufacturer’s catalog. [Rancilio Silvia M spare parts catalog](RLCSILVIAM_en-US.pdf)
2. **Check fit and compare offers.** For pump shopping, Torque asks for the voltage and frequency on the machine’s nameplate. The catalog specifies `34011023` for **120 V / 60 Hz** and `34011026` for **220–230 V / 50 Hz**. Torque ranks compatible offers by delivery to the technician’s ZIP code, total price including shipping, or seller reviews. It keeps incompatible offers visible with the reason they were excluded.
3. **Review and approve.** The technician confirms the part number, seller, delivered price, and ETA. After explicit approval, Torque submits the sandbox order itself. In sponsor mode it rechecks the quote and fit, verifies the demo technician through Persona, and saves the order in SingleStore.
4. **Read the audit trail.** The receipt records how the part was selected, why it fit, why the alternate was rejected, the Persona verification result, and the technician’s approval.

## Sponsor tools

| Tool | How we use it | Why it matters |
| --- | --- | --- |
| **Cognee** | Searches a dataset containing the Rancilio spare parts PDF. Torque uses it to look up OEM part numbers for selected components and ground the pump diagnosis in catalog evidence. | The technician can trace a recommendation to a manufacturer part number and catalog page. |
| **SingleStore** | Serves the replacement offer catalog. At approval, Torque reads the current offer again, verifies fit and quote details, then stores the sandbox order and its audit record. | The saved order reflects the quote the technician reviewed, and the decision can be inspected afterward. |
| **Persona Sandbox** | Checks the approved test technician’s inquiry through the Persona API before saving an explicitly approved sandbox order. | The demo shows how a purchasing agent can verify the person behind an approval. Torque stores the verification outcome in the receipt. |

The 3D cutaway uses illustrative internal geometry. All 34 components support in-app sandbox checkout. Sandbox listings use demo prices, ratings, and delivery estimates. Each component also links to real supplier listings by exact catalog number.

## Run locally

From the repository root, start the credential-free prototype and open the local URL that Vite prints.

```sh
npm ci
TORQUE_MODE=mock npm run dev
```

### Run the sponsor pump demo

1. Copy `.env.example` to `.env.local` and set `TORQUE_MODE=live`. Configure Cognee with the dataset containing `RLCSILVIAM_en-US.pdf`, SingleStore with the demo database connection, and Persona with a Sandbox API key and an approved test inquiry ID. [Credential setup](context/README.md#run-the-sponsor-pump-demo)
2. Run `npm run seed:demo`, then `npm run dev`. The seed verifies the pump variants in Cognee and prepares the demo catalog in SingleStore.
3. Choose **Pump runs, no water → Inspect water pump → 120 V / 60 Hz → Review order → Approve sandbox order**. Open **Order audit trail** on the receipt. [Three-minute demo script](context/demo.md)

Run `npm test` for the automated checks and `npm run build` to verify the production build.
