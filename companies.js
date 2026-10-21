// The companies in the tower. Add a floor by adding an entry: one owner, four agents.
// `agent` is the Pollinations agent that runs the company; see tools/publish-agents.mjs.
export const AGENT_OWNER = "tomdacatto";
export const BASE_MODEL = "openai/gpt-5.4-nano";

export const COMPANIES = [
    {
        id: "tidewatch",
        name: "Tidewatch",
        sector: "Safety",
        owner: "Mara",
        tagline: "Flood alerts for small harbors, in plain words.",
        agents: ["Gauge reader", "Forecast checker", "Harbor liaison", "Weekly reporter"],
    },
    {
        id: "seedbank",
        name: "Seedbank",
        sector: "Gardening",
        owner: "Joon",
        tagline: "Keeps heirloom seed varieties alive and swaps them between growers.",
        agents: ["Variety scout", "Swap matcher", "Packet designer", "Grower mailer"],
    },
    {
        id: "noticeboard",
        name: "Noticeboard",
        sector: "Civic",
        owner: "Ines",
        tagline: "City council agendas turned into two-minute summaries.",
        agents: ["Agenda reader", "Summary writer", "Neighbor outreach", "Corrections desk"],
    },
    {
        id: "lumen-repairs",
        name: "Lumen Repairs",
        sector: "Home",
        owner: "Tobias",
        tagline: "Repair guides for broken appliances, found from the model number.",
        agents: ["Manual finder", "Guide builder", "Parts sourcer", "Forum answerer"],
    },
    {
        id: "fieldnotes",
        name: "Fieldnotes",
        sector: "Outdoors",
        owner: "Priya",
        tagline: "Hikers' voice memos become trail condition reports.",
        agents: ["Memo transcriber", "Trail mapper", "Ranger liaison", "Digest editor"],
    },
    {
        id: "patchwork",
        name: "Patchwork",
        sector: "Software",
        owner: "Gus",
        tagline: "Open-source changelogs rewritten as upgrade guides.",
        agents: ["Release watcher", "Guide writer", "Breaking-change tester", "Maintainer outreach"],
    },
    {
        id: "stillwater",
        name: "Stillwater",
        sector: "Finance",
        owner: "Amara",
        tagline: "Chases late freelancer invoices politely until they are paid.",
        agents: ["Invoice tracker", "Reminder writer", "Dispute helper", "Cash-flow reporter"],
    },
    {
        id: "kitchen-table",
        name: "Kitchen Table",
        sector: "Food",
        owner: "Leo",
        tagline: "Turns what is in the fridge into a week of dinners.",
        agents: ["Pantry cataloger", "Menu planner", "Shopping lister", "Leftover rescuer"],
    },
];

/** The agent id (a model name on Pollinations) for a company. */
export const agentModel = (company, owner = AGENT_OWNER) => `community/${owner}/tower-${company.id}`;

/** The instructions that make one agent run one company. */
export function agentPrompt(company) {
    return [
        `You run ${company.name}, a one-person company in a tower of AI-run companies. ${company.tagline}`,
        `The owner is ${company.owner}. Your four agents are: ${company.agents.join(", ")}.`,
        'When the owner says "Run today", do the day\'s work and bring back three finished jobs, each done by one of your agents.',
        "Reply with JSON only, no code fence, in this shape:",
        '{"jobs":[{"agent":"<one of the four agents>","title":"<short title>","result":"<two or three sentences of the finished work, concrete and specific>","decision":{"question":"<one choice only the owner can make>","options":["<option>","<option>"]}}]}',
        "Invent plausible specifics but never claim real outside actions happened. Keep each result under 60 words.",
    ].join("\n");
}
