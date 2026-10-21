// The tower's rules, free of the DOM and the network so node can test them.
import { agentPrompt, BASE_MODEL } from "./companies.js";

export const RUN_MESSAGE = "Run today.";

const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/**
 * The jobs a company's team brings back, read from the agent's reply. A job needs an agent,
 * a title and a finished result; a decision needs a question and at least two options.
 */
export function parseJobs(content) {
    let parsed;
    try {
        parsed = JSON.parse(
            String(content)
                .trim()
                .replace(/^```(?:json)?\s*|\s*```$/g, ""),
        );
    } catch {
        throw new Error("The team's report was not readable. Try again.");
    }
    const jobs = (Array.isArray(parsed?.jobs) ? parsed.jobs : [])
        .map((job) => {
            const options = (Array.isArray(job?.decision?.options) ? job.decision.options : [])
                .map((option) => text(option, 80))
                .filter(Boolean)
                .slice(0, 3);
            const question = text(job?.decision?.question, 200);
            return {
                agent: text(job?.agent, 40),
                title: text(job?.title, 100),
                result: text(job?.result, 600),
                decision: question && options.length >= 2 ? { question, options } : null,
            };
        })
        .filter((job) => job.agent && job.title && job.result)
        .slice(0, 5);
    if (!jobs.length) throw new Error("The team came back without finished jobs. Try again.");
    return jobs;
}

/** A run with the owner's pick recorded for one job. Picks are indexes into the job's options. */
export function choose(run, jobIndex, optionIndex) {
    const options = run.jobs[jobIndex]?.decision?.options;
    if (!options?.[optionIndex]) throw new Error("No such option");
    return { ...run, choices: { ...run.choices, [jobIndex]: optionIndex } };
}

/** How many of a run's decisions the owner has made. */
export function decided(run) {
    const total = run.jobs.filter((job) => job.decision).length;
    const made = run.jobs.filter((job, i) => job.decision && run.choices[i] !== undefined).length;
    return { made, total };
}

/** Companies whose name, owner, sector, tagline or agents contain every word typed. */
export function search(companies, query) {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return companies.filter((company) => {
        const haystack = [company.name, company.owner, company.sector, company.tagline, ...company.agents]
            .join(" ")
            .toLowerCase();
        return words.every((word) => haystack.includes(word));
    });
}

const slug = (name) =>
    name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

/** The next floor from the renter's application, or an Error that says what to fix. */
export function application(form, taken) {
    const name = text(form.name, 40);
    const owner = text(form.owner, 30);
    const tagline = text(form.tagline, 140);
    const agents = (form.agents ?? []).map((agent) => text(agent, 30));
    if (name.length < 2 || !slug(name)) throw new Error("Give the company a name of at least two letters.");
    if (!owner) throw new Error("Say who the owner is.");
    if (tagline.length < 10) throw new Error("Describe what the company does in one line (at least 10 characters).");
    if (agents.length !== 4 || agents.some((agent) => !agent)) throw new Error("Name all four agents.");
    let id = slug(name);
    for (let n = 2; taken.includes(id); n++) id = `${slug(name)}-${n}`;
    return { id, name, sector: "New", owner, tagline, agents, mine: true };
}

/** The body that creates this company's agent in the renter's own account. */
export function agentRequest(company) {
    return {
        name: `tower-${company.id}`,
        title: company.name.slice(0, 42),
        description: `${company.tagline} A company in the Pollen Tower.`,
        systemPrompt: agentPrompt(company),
        baseModel: BASE_MODEL,
        mcpServers: [],
        visibility: "private",
    };
}
