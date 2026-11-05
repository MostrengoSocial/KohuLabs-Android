//! Google sign-in through the same Worker as the phone (api/index.js): the browser opens, and the Worker sends a
//! one-time code back to a loopback address only this computer can receive. The code is useless without the PKCE
//! verifier held here. The 90-day token lives in Windows Credential Manager, never on disk.
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::time::{Duration, Instant};

pub const API_BASE: &str = "https://android.kohulabs.com";
const SERVICE: &str = "com.kohulabs.ko";
const USER: &str = "account";
const WAIT: Duration = Duration::from_secs(5 * 60);

#[derive(Clone, Serialize, Deserialize)]
pub struct Account {
    pub token: String,
    pub email: String,
    pub name: String,
}

/// Who is signed in, without the token: all a page ever gets to see.
#[derive(Clone, Serialize)]
pub struct AccountView {
    pub email: String,
    pub name: String,
}

impl From<&Account> for AccountView {
    fn from(a: &Account) -> Self {
        AccountView { email: a.email.clone(), name: a.name.clone() }
    }
}

fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, USER).map_err(|_| "keyring".to_string())
}

pub fn load() -> Option<Account> {
    serde_json::from_str(&entry().ok()?.get_password().ok()?).ok()
}

fn save(account: &Account) -> Result<(), String> {
    let text = serde_json::to_string(account).map_err(|_| "keyring".to_string())?;
    entry()?.set_password(&text).map_err(|_| "keyring".to_string())
}

pub fn clear() {
    if let Ok(e) = entry() {
        let _ = e.delete_credential();
    }
}

fn random_token() -> Result<String, String> {
    let mut bytes = [0u8; 32];
    getrandom::getrandom(&mut bytes).map_err(|_| "failed".to_string())?;
    Ok(URL_SAFE_NO_PAD.encode(bytes))
}

fn query_value(url: &str, name: &str) -> Option<String> {
    let query = url.split_once('?')?.1;
    query.split('&').find_map(|pair| {
        let (k, v) = pair.split_once('=')?;
        (k == name).then(|| percent_decode(v))
    })
}

fn percent_decode(v: &str) -> String {
    let bytes = v.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(b) = u8::from_str_radix(&v[i + 1..i + 3], 16) {
                out.push(b);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Opens the browser and waits for the Worker to come back. Blocking: run off the main thread.
/// Returns the one-time code and the verifier that redeems it.
pub fn browser_sign_in() -> Result<(String, String), String> {
    let server = tiny_http::Server::http("127.0.0.1:0").map_err(|_| "failed".to_string())?;
    let port = server.server_addr().to_ip().ok_or("failed")?.port();
    let verifier = random_token()?;
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let redirect = format!("http%3A%2F%2F127.0.0.1%3A{port}%2Fsigned-in");
    open::that_detached(format!("{API_BASE}/auth/google?challenge={challenge}&redirect={redirect}")).map_err(|_| "failed".to_string())?;

    let started = Instant::now();
    while started.elapsed() < WAIT {
        let Ok(Some(request)) = server.recv_timeout(Duration::from_millis(500)) else { continue };
        let url = request.url().to_string();
        if url != "/signed-in" && !url.starts_with("/signed-in?") {
            let _ = request.respond(tiny_http::Response::empty(404));
            continue;
        }
        let code = query_value(&url, "code");
        let error = query_value(&url, "error");
        let page = if code.is_some() {
            "<!doctype html><meta charset=utf-8><title>Kō</title><body style='background:#090b11;color:#eeeae0;font:18px sans-serif;padding:48px'>You're signed in. You can close this tab and go back to Kō.</body>"
        } else {
            "<!doctype html><meta charset=utf-8><title>Kō</title><body style='background:#090b11;color:#eeeae0;font:18px sans-serif;padding:48px'>That did not work. Go back to Kō and try again.</body>"
        };
        let header = tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"text/html; charset=utf-8"[..]).map_err(|_| "failed".to_string())?;
        let _ = request.respond(tiny_http::Response::from_string(page).with_header(header));
        return match code {
            Some(code) => Ok((code, verifier)),
            None => Err(error.filter(|e| e == "not_invited" || e == "cancelled").unwrap_or_else(|| "failed".to_string())),
        };
    }
    Err("cancelled".to_string())
}

#[derive(Deserialize)]
struct TokenReply {
    token: String,
    email: String,
    name: String,
}

/// Trades the one-time code for the app's token, and keeps it.
pub async fn redeem(http: &reqwest::Client, code: String, verifier: String) -> Result<Account, String> {
    let reply = http
        .post(format!("{API_BASE}/api/token"))
        .json(&serde_json::json!({ "code": code, "verifier": verifier }))
        .send()
        .await
        .map_err(|_| "failed".to_string())?;
    if !reply.status().is_success() {
        return Err("failed".to_string());
    }
    let t: TokenReply = reply.json().await.map_err(|_| "failed".to_string())?;
    let account = Account { token: t.token, email: t.email, name: t.name };
    save(&account)?;
    Ok(account)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_code_from_the_way_back() {
        assert_eq!(query_value("/signed-in?code=a%2Eb.c", "code").as_deref(), Some("a.b.c"));
        assert_eq!(query_value("/signed-in?error=not_invited", "code"), None);
        assert_eq!(query_value("/signed-in", "code"), None);
    }

    #[test]
    fn decoding_survives_bad_input() {
        assert_eq!(percent_decode("100%"), "100%");
        assert_eq!(percent_decode("a%zz"), "a%zz");
    }
}
