import { COMPANIES } from "./companies.js";
import {
    clearSession,
    completeSignIn,
    createAgent,
    getSession,
    PollenError,
    runCompany,
    startSignIn,
} from "./pollen.js";
import { createTower } from "./scene.js";
import { application, choose, decided, parseJobs, search } from "./tower.js";

const $ = (selector) => document.querySelector(selector);
const RENTED = "tower.rented";
const RUNS = "tower.runs";
const DRAFT = "tower.draft";

const load = (key, fallback) => {
    try {
        return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
    } catch {
        return fallback;
    }
};
const save = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {}
};

const state = {
    rented: load(RENTED, []),
    runs: load(RUNS, {}),
    selected: 0,
    tower: null,
    working: new Set(),
};
const companies = () => [...COMPANIES, ...state.rented];

function notice(message, kind = "info") {
    const box = $("#notice");
    box.hidden = !message;
    box.className = `notice ${kind === "error" ? "error" : ""}`;
    box.textContent = message ?? "";
}

function renderSession() {
    const session = getSession();
    $("#whoami").hidden = !session;
    $("#sign-out").hidden = !session;
    $("#sign-in").hidden = Boolean(session);
}

// Views.
function show(view) {
    for (const section of document.querySelectorAll(".view")) section.hidden = section.id !== `view-${view}`;
    for (const button of document.querySelectorAll("#tabs button")) {
        if (button.dataset.view === view) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
    }
    notice(null);
}

// The tower and its side panel.
function ride(index) {
    state.selected = Math.max(0, Math.min(companies().length - 1, index));
    state.tower?.select(state.selected);
    renderPanel();
}

function renderPanel() {
    const company = companies()[state.selected];
    const panel = $("#panel");
    panel.replaceChildren();
    const floor = Object.assign(document.createElement("div"), {
        className: "floor",
        textContent: `Floor ${state.selected + 1} of ${companies().length} · ${company.sector}`,
    });
    const title = Object.assign(document.createElement("h2"), { textContent: company.name });
    const owner = Object.assign(document.createElement("p"), {
        textContent: `${company.tagline} Run by ${company.owner}.`,
    });
    const roster = document.createElement("ul");
    roster.className = "roster";
    roster.append(
        ...company.agents.map((agent) => Object.assign(document.createElement("li"), { textContent: agent })),
    );
    const buttons = document.createElement("div");
    buttons.className = "row";
    const down = Object.assign(document.createElement("button"), {
        className: "button",
        type: "button",
        textContent: "▼ Down",
        disabled: state.selected === 0,
        onclick: () => ride(state.selected - 1),
    });
    const up = Object.assign(document.createElement("button"), {
        className: "button",
        type: "button",
        textContent: "▲ Up",
        disabled: state.selected === companies().length - 1,
        onclick: () => ride(state.selected + 1),
    });
    buttons.append(down, up);
    const enter = Object.assign(document.createElement("button"), {
        className: "button primary",
        type: "button",
        textContent: `Step into ${company.name}`,
        onclick: () => openOffice(company),
    });
    enter.style.width = "100%";
    panel.append(floor, title, owner, roster, buttons, enter);
}

// The directory.
function renderDirectory() {
    const list = $("#directory");
    list.replaceChildren();
    for (const company of search(companies(), $("#search").value)) {
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.innerHTML = "<span class='meta'></span><strong></strong><p></p>";
        button.querySelector(".meta").textContent = `Floor ${companies().indexOf(company) + 1} · ${company.sector}`;
        button.querySelector("strong").textContent = company.name;
        button.querySelector("p").textContent = company.tagline;
        button.onclick = () => {
            show("tower");
            ride(companies().indexOf(company));
            openOffice(company);
        };
        item.append(button);
        list.append(item);
    }
    if (!list.children.length) list.innerHTML = "<li class='fine'>No company matches.</li>";
}

// An office: the team, the day's jobs and the owner's decisions.
function openOffice(company) {
    const dialog = $("#office");
    dialog.replaceChildren();
    const inner = document.createElement("div");
    inner.className = "inner";
    const head = document.createElement("header");
    const text = document.createElement("div");
    const floor = Object.assign(document.createElement("div"), {
        className: "chip",
        textContent: `Floor ${companies().indexOf(company) + 1} · ${company.sector}`,
    });
    const name = Object.assign(document.createElement("h2"), { id: "office-title", textContent: company.name });
    const line = Object.assign(document.createElement("p"), {
        textContent: `${company.tagline} Owner: ${company.owner}.`,
    });
    line.style.color = "var(--muted)";
    text.append(floor, name, line);
    const close = Object.assign(document.createElement("button"), {
        className: "button",
        type: "button",
        textContent: "Leave the office",
        onclick: () => dialog.close(),
    });
    head.append(text, close);

    const roster = document.createElement("ul");
    roster.className = "roster";
    roster.append(
        ...company.agents.map((agent) => Object.assign(document.createElement("li"), { textContent: agent })),
    );

    const run = Object.assign(document.createElement("button"), { className: "button primary", type: "button" });
    const result = document.createElement("div");
    inner.append(head, roster, run, result);
    dialog.append(inner);

    const paint = () => {
        const session = getSession();
        const busy = state.working.has(company.id);
        run.disabled = busy;
        run.textContent = busy
            ? "The team is working…"
            : !session
              ? "Sign in with Pollen to run the day"
              : state.runs[company.id]
                ? "Run another day"
                : "Run today";
        renderRun(result, company, paint);
    };
    run.onclick = async () => {
        if (!getSession()) return startSignIn();
        state.working.add(company.id);
        paint();
        try {
            const jobs = parseJobs(await runCompany(company));
            state.runs[company.id] = { jobs, choices: {}, at: Date.now() };
            save(RUNS, state.runs);
            notice(null);
        } catch (error) {
            notice(
                error instanceof PollenError || error instanceof Error ? error.message : "Something went wrong.",
                "error",
            );
            if (error.status === 401) renderSession();
        } finally {
            state.working.delete(company.id);
            paint();
        }
    };
    paint();
    dialog.showModal();
}

function renderRun(container, company, repaint) {
    container.replaceChildren();
    const run = state.runs[company.id];
    if (!run) {
        container.append(
            Object.assign(document.createElement("p"), {
                className: "fine",
                textContent:
                    "Nothing has come in yet. Run the day: the agents do the work and bring back finished jobs, and the choices that need a person come to you.",
            }),
        );
        return;
    }
    const list = document.createElement("ul");
    list.className = "jobs";
    run.jobs.forEach((job, i) => {
        const item = document.createElement("li");
        item.className = "job";
        const agent = Object.assign(document.createElement("span"), { className: "chip", textContent: job.agent });
        const title = Object.assign(document.createElement("h3"), { textContent: job.title });
        const body = Object.assign(document.createElement("p"), { textContent: job.result });
        item.append(agent, title, body);
        if (job.decision) {
            const decision = document.createElement("div");
            decision.className = "decision";
            decision.append(Object.assign(document.createElement("strong"), { textContent: job.decision.question }));
            const options = document.createElement("div");
            options.className = "options";
            job.decision.options.forEach((option, n) => {
                options.append(
                    Object.assign(document.createElement("button"), {
                        className: "button",
                        type: "button",
                        textContent: option,
                        onclick: () => {
                            state.runs[company.id] = choose(state.runs[company.id], i, n);
                            save(RUNS, state.runs);
                            repaint();
                        },
                    }),
                );
                options.lastChild.setAttribute("aria-pressed", String(run.choices[i] === n));
            });
            decision.append(options);
            item.append(decision);
        }
        list.append(item);
    });
    const { made, total } = decided(run);
    container.append(
        list,
        Object.assign(document.createElement("p"), {
            className: "tally",
            textContent: total ? `You have decided ${made} of ${total}.` : "Nothing needs your decision today.",
        }),
    );
}

// Renting the next office.
async function rent(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = {
        name: form.elements.name.value,
        owner: form.elements.owner.value,
        tagline: form.elements.tagline.value,
        agents: [...form.querySelectorAll("[name=agent]")].map((input) => input.value),
    };
    let company;
    try {
        company = application(
            data,
            companies().map((c) => c.id),
        );
    } catch (error) {
        return notice(error.message, "error");
    }
    if (!getSession()?.keys) {
        sessionStorage.setItem(DRAFT, JSON.stringify(data));
        return startSignIn({ keys: true });
    }
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    try {
        company.model = await createAgent(company);
        state.rented.push(company);
        save(RENTED, state.rented);
        sessionStorage.removeItem(DRAFT);
        form.reset();
        state.tower?.setFloors(companies(), companies().length - 1);
        show("tower");
        ride(companies().length - 1);
        notice(
            `${company.name} has the top floor. Its agent can take a minute or two to start; then step in and run the day.`,
        );
    } catch (error) {
        notice(error.message, "error");
    } finally {
        button.disabled = false;
    }
}

function resumeDraft() {
    try {
        const draft = JSON.parse(sessionStorage.getItem(DRAFT) || "null");
        if (!draft) return;
        const form = $("#rent");
        form.elements.name.value = draft.name;
        form.elements.owner.value = draft.owner;
        form.elements.tagline.value = draft.tagline;
        form.querySelectorAll("[name=agent]").forEach((input, i) => {
            input.value = draft.agents[i] ?? "";
        });
        show("rent");
        notice("Signed in. Press Rent the office to finish.");
    } catch {}
}

// Start.
$("#sign-in").onclick = () => startSignIn();
$("#sign-out").onclick = () => {
    clearSession();
    renderSession();
};
for (const button of document.querySelectorAll("#tabs button")) {
    button.onclick = () => {
        show(button.dataset.view);
        if (button.dataset.view === "directory") renderDirectory();
    };
}
$("#search").oninput = renderDirectory;
$("#rent").onsubmit = rent;

const outcome = completeSignIn();
if (outcome && outcome !== "ok")
    notice(
        {
            denied: "Sign-in was cancelled.",
            "bad-state": "That sign-in did not match this page. Try again.",
            "bad-key": "The sign-in returned something unexpected. Try again.",
            "no-storage": "This browser blocks the storage the sign-in needs.",
        }[outcome],
        "error",
    );
renderSession();

try {
    state.tower = createTower($("#stage"), {
        onPick: (index) => ride(index),
        onRide: (step) => ride(state.selected + step),
    });
    state.tower.setFloors(companies(), 0);
} catch {
    notice("This browser cannot draw the 3D tower. The directory and the offices still work.", "error");
}
renderPanel();
if (outcome === "ok") resumeDraft();
