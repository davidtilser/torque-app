# Three-minute live demo

Show one repair decision end to end using Torque. The buyer is an espresso-machine technician facing a no-water fault. The offers are demo fixtures and the order is sandboxed. Start in [sponsor mode](README.md#run-the-sponsor-pump-demo) with a pre-approved Persona Sandbox test inquiry to demonstrate Cognee, Persona, and SingleStore.

| Time | On screen |
| --- | --- |
| 0:00–0:25 | Introduce the machine and the symptom. “The pump runs loudly, but neither group dispenses water.” Enter that observation in **Diagnose** or use **Pump runs, no water**. |
| 0:25–1:00 | Show likely causes, including an inlet restriction, a pump fault, or a brew valve fault. Point to the checks for water supply and whether both groups are affected. Confirm the scenario before sourcing. |
| 1:00–1:35 | Click **Inspect water pump**. The model opens, highlights the pump, and loads replacement offers from SingleStore. A technician who already knows the part can click the pump directly. |
| 1:35–2:15 | Compare the two compatible 230 V offers by delivered price, ZIP-based arrival, and seller reviews. Show that the cheaper 120 V pump is excluded even though its flow rate and seller rating look attractive. |
| 2:15–2:45 | Click **Review order**. Show the exact part number, seller, total, and ETA. Approve the sandbox order. Torque checks the demo technician’s Persona Sandbox status before saving the order. |
| 2:45–3:00 | Open the receipt’s audit trail. Point out the selected component, fit evidence, rejected alternate, Persona Sandbox verification, and explicit order approval. |

## Alternate path

Choose **Leaks around handle**, inspect the left group head seal, and compare the compatible 54 mm seal with the rejected 58 mm listing. In **Exploded view**, the portafilters move to expose the seals. The scenario can also start by clicking the seal on the machine.

The earlier photo-first demo concept used a live photo of the machine’s model sticker to identify the exact unit before fetching its official guide and parts list. It is a future path. If presenting a generic 3D model alongside a venue machine, identify it as illustrative and use exact manufacturer evidence for any real compatibility claim. [Example Breville service manual](https://assets.breville.com/BES840/BES840_USC_IB_L23_LR.pdf) · [Example manufacturer parts catalog](https://www.breville.com/en-us/producthub/bes840)
