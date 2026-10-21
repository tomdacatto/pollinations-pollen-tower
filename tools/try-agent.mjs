// Runs one company's agent once and prints the parsed jobs: node tools/try-agent.mjs <keyfile> <companyId>
import fs from "node:fs";
import { agentModel, COMPANIES } from "../companies.js";
import { parseJobs, RUN_MESSAGE } from "../tower.js";

const { apiKey } = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const company = COMPANIES.find((c) => c.id === process.argv[3]);
const res = await fetch("https://gen.pollinations.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: agentModel(company), messages: [{ role: "user", content: RUN_MESSAGE }] }),
});
const body = await res.json();
console.log(res.status, body.usage ? JSON.stringify(body.usage) : "");
if (!res.ok) console.log(JSON.stringify(body).slice(0, 400));
else console.log(JSON.stringify(parseJobs(body.choices[0].message.content), null, 1));
