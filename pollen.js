// Bring Your Own Pollen for a static page. The visitor signs in on enter.pollinations.ai
// and is sent back here. The key comes back in the URL fragment, which the browser never
// sends to a server, and is kept in sessionStorage for this tab only.
// Flow reference: https://github.com/pollinations/pollinations/blob/main/BRING_YOUR_OWN_POLLEN.md
import { agentModel } from "./companies.js";
import { BUDGET, EXPIRY_DAYS } from "./config.js";
import { agentRequest, RUN_MESSAGE } from "./tower.js";

const ENTER = "https://enter.pollinations.ai";
const GEN = "https://gen.pollinations.ai";
const SESSION = "pollen.session";
const PENDING = "pollen.pending";
const DAY_MS = 86_400_000;

export class PollenError extends Error {
    constructor(message, status = 0) {
        super(message);
        this.status = status;
    }
}

// The address the app is served from, without index.html, query or fragment.
export function appUrl(href = location.href) {
    return new URL("./", href).href;
}

// `keys` also asks to create agents in the visitor's account, which renting an office needs.
export function buildAuthorizeUrl({ redirectUri, state, keys = false }) {
    const params = new URLSearchParams({
        redirect_uri: redirectUri,
        state,
        budget: String(BUDGET),
        expiry: String(EXPIRY_DAYS),
    });
    if (keys) params.set("permissions", "keys");
    return `${ENTER}/authorize?${params}`;
}

// Reads the legacy fragment: #api_key=sk_...&state=... or #error=access_denied.
export function readReturn(hash, expectedState) {
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    if (params.has("error")) return { status: "denied" };
    if (!params.has("api_key")) return { status: "none" };
    if (!expectedState || params.get("state") !== expectedState) return { status: "bad-state" };
    const key = params.get("api_key");
    if (!/^sk_\S{8,}$/.test(key)) return { status: "bad-key" };
    return { status: "ok", key };
}

export function getSession() {
    try {
        const session = JSON.parse(sessionStorage.getItem(SESSION) || "null");
        if (session?.key && session.expiresAt > Date.now()) return session;
    } catch {}
    clearSession();
    return null;
}

export function clearSession() {
    try {
        sessionStorage.removeItem(SESSION);
    } catch {}
}

const randomState = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");

export function startSignIn({ keys = false } = {}) {
    const state = randomState();
    sessionStorage.setItem(PENDING, JSON.stringify({ state, keys }));
    location.assign(buildAuthorizeUrl({ redirectUri: appUrl(), state, keys }));
}

// Call once on page load. Returns "ok", "denied", "bad-state", "bad-key", "no-storage",
// or null when the page was not opened from a sign-in.
export function completeSignIn(hash = location.hash) {
    let pending = null;
    try {
        pending = JSON.parse(sessionStorage.getItem(PENDING) || "null");
    } catch {}
    const result = readReturn(hash, pending?.state);
    if (result.status === "none") return null;
    try {
        sessionStorage.removeItem(PENDING);
    } catch {}
    // Drop the fragment so the key is not left in the address bar.
    history.replaceState(null, "", location.pathname + location.search);
    if (result.status !== "ok") return result.status;
    try {
        sessionStorage.setItem(
            SESSION,
            JSON.stringify({
                key: result.key,
                keys: Boolean(pending.keys),
                expiresAt: Date.now() + EXPIRY_DAYS * DAY_MS,
            }),
        );
    } catch {
        return "no-storage";
    }
    return "ok";
}

async function call(path, body, { signal } = {}) {
    const session = getSession();
    if (!session) throw new PollenError("Sign in with your Pollen to continue.", 401);
    const res = await fetch(`${GEN}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.key}` },
        body: JSON.stringify(body),
        signal,
    });
    if (res.ok) return res.json();
    const detail = (await res.json().catch(() => ({}))).error?.message ?? `Request failed (${res.status})`;
    if (res.status === 401) {
        clearSession();
        throw new PollenError("Your sign-in expired. Sign in again to continue.", 401);
    }
    if (res.status === 402) throw new PollenError("Out of Pollen. Top up at enter.pollinations.ai.", 402);
    if (res.status === 403) throw new PollenError(`This sign-in is not allowed to do that: ${detail}`, 403);
    if (/invalid model/i.test(detail))
        throw new PollenError(
            "The team is not reachable yet. A new agent can take a minute or two to start. Try again shortly.",
            res.status,
        );
    throw new PollenError(detail, res.status);
}

/** Asks a company's agent to run the day; resolves to the raw reply text. */
export async function runCompany(company, options) {
    const body = await call(
        "/v1/chat/completions",
        { model: company.model ?? agentModel(company), messages: [{ role: "user", content: RUN_MESSAGE }] },
        options,
    );
    return body.choices?.[0]?.message?.content ?? "";
}

/** Creates the company's agent in the visitor's own account; resolves to its model name. */
export async function createAgent(company) {
    const session = getSession();
    if (!session?.keys) throw new PollenError("Renting an office needs a sign-in that may create agents.", 403);
    const agent = await call("/account/agents", agentRequest(company));
    return agent.model;
}
