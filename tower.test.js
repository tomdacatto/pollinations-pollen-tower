import assert from "node:assert/strict";
import test from "node:test";
import { agentModel, agentPrompt, COMPANIES } from "./companies.js";
import { agentRequest, application, choose, decided, parseJobs, search } from "./tower.js";

const job = (extra = {}) => ({
    agent: "Gauge reader",
    title: "Harbor gauge drift",
    result: "Gauge 3 reads 4 cm high against the tide table.",
    decision: { question: "Recalibrate now?", options: ["Yes", "Next week"] },
    ...extra,
});

test("reads the jobs a team brings back, with or without a code fence", () => {
    const body = JSON.stringify({ jobs: [job(), job({ decision: null, title: "Weekly note" })] });
    assert.equal(parseJobs(body).length, 2);
    assert.equal(parseJobs("```json\n" + body + "\n```")[1].decision, null);
});

test("drops unfinished jobs and decisions that offer no choice", () => {
    const jobs = parseJobs(
        JSON.stringify({
            jobs: [
                job({ decision: { question: "Only one?", options: ["Yes"] } }),
                { agent: "A", title: "No result" },
                job({ title: "" }),
            ],
        }),
    );
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].decision, null);
});

test("refuses a report that is not JSON or has no finished job", () => {
    assert.throws(() => parseJobs("Here is the day..."), /not readable/);
    assert.throws(() => parseJobs(JSON.stringify({ jobs: [] })), /without finished jobs/);
});

test("records the owner's picks and counts decisions", () => {
    let run = { jobs: [job(), job({ decision: null }), job()], choices: {} };
    assert.deepEqual(decided(run), { made: 0, total: 2 });
    run = choose(run, 0, 1);
    run = choose(run, 2, 0);
    assert.deepEqual(run.choices, { 0: 1, 2: 0 });
    assert.deepEqual(decided(run), { made: 2, total: 2 });
    assert.throws(() => choose(run, 1, 0), /No such option/);
    assert.throws(() => choose(run, 0, 5), /No such option/);
});

test("searches the directory by every word typed", () => {
    assert.deepEqual(
        search(COMPANIES, "flood harbor").map((c) => c.id),
        ["tidewatch"],
    );
    assert.equal(search(COMPANIES, "").length, COMPANIES.length);
    assert.equal(search(COMPANIES, "zzzz").length, 0);
    assert.ok(search(COMPANIES, "mara").some((c) => c.owner === "Mara"));
});

const form = {
    name: "Clay & Co",
    owner: "Rui",
    tagline: "Ceramics glaze recipes that actually work",
    agents: ["a", "b", "c", "d"],
};

test("an application becomes the next floor, with a unique id", () => {
    const company = application(form, []);
    assert.equal(company.id, "clay-co");
    assert.equal(company.mine, true);
    assert.equal(application(form, ["clay-co"]).id, "clay-co-2");
    assert.equal(application(form, ["clay-co", "clay-co-2"]).id, "clay-co-3");
});

test("an application that is incomplete says what to fix", () => {
    assert.throws(() => application({ ...form, name: "!" }, []), /name/);
    assert.throws(() => application({ ...form, owner: " " }, []), /owner/);
    assert.throws(() => application({ ...form, tagline: "short" }, []), /one line/);
    assert.throws(() => application({ ...form, agents: ["a", "b", "", "d"] }, []), /four agents/);
});

test("a company's agent carries its roster and the JSON contract", () => {
    const prompt = agentPrompt(COMPANIES[0]);
    for (const agent of COMPANIES[0].agents) assert.ok(prompt.includes(agent));
    assert.ok(prompt.includes('"jobs"'));
    assert.equal(agentModel(COMPANIES[0]), "community/tomdacatto/tower-tidewatch");
    const request = agentRequest(application(form, []));
    assert.equal(request.name, "tower-clay-co");
    assert.equal(request.visibility, "private");
    assert.ok(request.systemPrompt.includes("Rui"));
});

test("every floor has an id the agent name allows", () => {
    for (const company of COMPANIES) assert.match(`tower-${company.id}`, /^[A-Za-z0-9._:-]+$/);
    assert.equal(new Set(COMPANIES.map((c) => c.id)).size, COMPANIES.length);
});
