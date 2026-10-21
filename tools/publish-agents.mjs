// Creates or updates one public prompt agent per company: node tools/publish-agents.mjs <keyfile>
// <keyfile> is a JSON file with {"apiKey": "sk_..."}; the key needs the keys permission and a publisher account.
import fs from "node:fs";
import { AGENT_OWNER, agentModel, agentPrompt, BASE_MODEL, COMPANIES } from "../companies.js";

const GEN = "https://gen.pollinations.ai";
const { apiKey } = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

const existing = (await (await fetch(`${GEN}/account/agents`, { headers })).json()).data;
for (const company of COMPANIES) {
    const body = {
        name: `tower-${company.id}`,
        title: company.name,
        description: `${company.tagline} A company in the Pollen Tower, run by one owner and four AI agents.`,
        systemPrompt: agentPrompt(company),
        baseModel: BASE_MODEL,
        mcpServers: [],
        visibility: "public",
    };
    const found = existing.find((agent) => agent.model === agentModel(company, AGENT_OWNER));
    const response = await fetch(`${GEN}/account/agents${found ? `/${found.id}` : ""}`, {
        method: found ? "PATCH" : "POST",
        headers,
        body: JSON.stringify(found ? { ...body, name: undefined } : body),
    });
    console.log(company.id, found ? "update" : "create", response.status, response.ok ? "" : await response.text());
}
