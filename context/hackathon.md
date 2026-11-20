# Personal Agents Hackathon

Tokens& held the event at AWS Builder Loft in San Francisco on **November 20, 2026**. The kickoff was at **11:00 a.m. Pacific**, the submission deadline was **4:30 p.m.**, and finalist judging started at **5:00 p.m.** Teams could have 2–4 people and submit one project built during the event. Finalists had a **three-minute live demo**. [Official hack page](https://tokensand.com/personalagenthack) · [Luma event](https://luma.com/personalagenthack) · [Organizer’s live-demo confirmation](https://discord.com/channels/1278435478609072198/1296885258364518560/1573173462338502657)

Submit a GitHub repository reviewers can access, a short shareable demo video, a description of the project and tools used, and team names and contact emails through the submission portal. A working website and project screenshot were welcome. [Submission portal](https://tokensand.com/personalagenthack/submit)

## Challenge and judging

The brief asked teams to build a shopping agent with an audit trail. It emphasized reliable context, a meaningful action, and a visible account of what informed the decision. The organizer clarified that shopping was recommended and optional. The team recorded a minimum of **three sponsor tools** from the event briefing. [Official challenge](https://tokensand.com/personalagenthack) · [Organizer clarification](https://discord.com/channels/1278435478609072198/1296885258364518560/1573315889435119677)

The event slide listed five judging criteria.

1. **Autonomy** — how well the agent completes a real task end to end with minimal manual intervention.
2. **Idea** — whether the project addresses a meaningful problem or shows real-world value.
3. **Technical implementation** — the quality of the architecture and implementation.
4. **Tool use** — how effectively the project uses sponsor tools.
5. **Presentation** — how clearly the team demonstrates the working solution in three minutes.

Torque is designed to let the technician provide observations and explicitly approve a purchase, while the agent handles evidence retrieval, compatibility, and offer comparison.

## Sponsor integration plan

The pump workflow integrates three sponsor tools. See [local setup](README.md#run-the-sponsor-pump-demo) for credentials and seeding.

| Tool | Role |
| --- | --- |
| Cognee | Retrieve relationships between the symptom, checks, and modeled components from a seeded pump knowledge graph. |
| Persona | Check the demo technician’s Sandbox verification status before saving the approved order. |
| SingleStore | Read the pump catalog, recheck fit at approval, and save the sandbox order and audit record. |

Firedrill was considered for a test that reproduces the wrong-variant purchase, then verifies that the agent excludes the incompatible offer after the fix. [Firedrill judging and event credits](https://discord.com/channels/1278435478609072198/1570734626828320819/1573372434244173925)

## Published sponsor prizes

| Sponsor | Published prize |
| --- | --- |
| Senso | 10k, 5k, and 1k credits for first, second, and third in its trusted-context shopping challenge |
| Amplitude / Statsig | $1,000 and $500 |
| Superlinked | Two SIE tracks, each with $500 cash plus $500 in SIE Serverless credits |
| Guild AI | 100M, 50M, and 25M tokens |
| Airbyte | $1,000, $500, and $250 Visa gift cards |
| Arcee AI | First, $500 platform credits plus $250 merchandise gift card. Second, $250 platform credits plus $100 gift card. Third, $100 gift card. |
| Cognee | First, $500 cash plus $500 credits. Second, $250 cash plus $500 credits. Third, $500 credits. |
| Firedrill | $500, $300, and $200 Visa gift cards, plus 40k, 20k, and 14k credits respectively. Each winner also gets three months of Starter. |
| SingleStore | $1,000, $750, and $500 in gift cards |
| Persona | $250 Keychron gift card and swag for each winning team member |

Prize amounts and participation instructions come from the [official sponsor list](https://tokensand.com/personalagenthack). [Senso challenge and docs](https://discord.com/channels/1278435478609072198/1572995889100755105/1573194209945714728)
