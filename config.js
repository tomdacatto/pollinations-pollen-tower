// What a visitor's key may spend and for how long. Pollen is per visitor.
// One "Run today" is a single call to a small model and costs a fraction of a cent.
export const BUDGET = 0.2;
export const EXPIRY_DAYS = 1;

// The app's publishable App Key (pk_...), sent as client_id so the consent screen names the app and usage is
// attributed. Its redirect URI must be this page's address exactly. Empty until the key exists.
export const APP_KEY = "";
