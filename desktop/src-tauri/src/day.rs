//! Brings your day down from the cloud (POST /api/sync, the same as the phone) and keeps a copy for when you're offline.
//! Read-only for now: it pushes nothing, so the desktop can't overwrite what you did on the phone. Chat with Kō goes
//! through his brain on the Worker, which keeps the exchange so the phone sees it too.
use crate::auth::{self, API_BASE};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::collections::BTreeMap;
use std::path::Path;

/// The tables the Today window uses. The rest of what comes down is not kept here.
const KEEP: [&str; 6] = ["chunks", "follow_ups", "goals", "messages", "settings", "workspaces"];
const MAX_PAGES: usize = 200;

#[derive(Default, Serialize, Deserialize)]
pub struct Cache {
    #[serde(default)]
    pub cursor: i64,
    #[serde(default, rename = "syncedAt")]
    pub synced_at: i64,
    #[serde(default)]
    pub tables: BTreeMap<String, BTreeMap<String, Value>>,
}

pub fn load(path: &Path) -> Cache {
    std::fs::read(path).ok().and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default()
}

fn save(path: &Path, cache: &Cache) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, serde_json::to_vec(cache).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, path).map_err(|e| e.to_string())
}

/// Applies one page of changes: the newest row replaces the old one, and a deleted row goes.
pub fn merge(cache: &mut Cache, changes: &Map<String, Value>) {
    for table in KEEP {
        let Some(rows) = changes.get(table).and_then(Value::as_array) else { continue };
        let kept = cache.tables.entry(table.to_string()).or_default();
        for row in rows {
            let Some(id) = row.get("id").and_then(Value::as_str) else { continue };
            if row.get("deleted").and_then(Value::as_i64).unwrap_or(0) != 0 {
                kept.remove(id);
            } else {
                kept.insert(id.to_string(), row.clone());
            }
        }
    }
}

#[derive(Deserialize)]
struct Page {
    cursor: i64,
    #[serde(default)]
    more: bool,
    #[serde(default)]
    changes: Map<String, Value>,
}

fn now_ms() -> i64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0)
}

/// Pulls everything after the cursor. A refused token signs you out here too ("signed_out").
pub async fn pull(http: &reqwest::Client, path: &Path) -> Result<Cache, String> {
    let account = auth::load().ok_or("signed_out")?;
    let mut cache = load(path);
    for _ in 0..MAX_PAGES {
        let reply = http
            .post(format!("{API_BASE}/api/sync"))
            .bearer_auth(&account.token)
            .json(&json!({ "cursor": cache.cursor, "changes": {} }))
            .send()
            .await
            .map_err(|_| "offline".to_string())?;
        if reply.status().as_u16() == 401 {
            auth::clear();
            let _ = std::fs::remove_file(path);
            return Err("signed_out".to_string());
        }
        if !reply.status().is_success() {
            return Err("offline".to_string());
        }
        let page: Page = reply.json().await.map_err(|_| "offline".to_string())?;
        merge(&mut cache, &page.changes);
        cache.cursor = page.cursor;
        if !page.more {
            cache.synced_at = now_ms();
            save(path, &cache)?;
            return Ok(cache);
        }
    }
    Err("offline".to_string())
}

/// Asks the cloud to import Calendar and Gmail now. Failing is fine: the pull still shows the last import.
pub async fn import_now(http: &reqwest::Client) {
    if let Some(account) = auth::load() {
        let _ = http.post(format!("{API_BASE}/api/refresh")).bearer_auth(&account.token).json(&json!({})).send().await;
    }
}

/// Asks Kō's brain. The question is passed through as it is; the Worker checks it. Errors are its short codes.
pub async fn ask(http: &reqwest::Client, mut question: Value) -> Result<Value, String> {
    let account = auth::load().ok_or("signed_out")?;
    question["save"] = json!(true);
    let reply = http
        .post(format!("{API_BASE}/api/ko"))
        .bearer_auth(&account.token)
        .timeout(std::time::Duration::from_secs(60))
        .json(&question)
        .send()
        .await
        .map_err(|_| "offline".to_string())?;
    let status = reply.status();
    let body: Value = reply.json().await.map_err(|_| "offline".to_string())?;
    if status.as_u16() == 401 {
        return Err("signed_out".to_string());
    }
    if !status.is_success() {
        return Err(body.get("error").and_then(Value::as_str).unwrap_or("brain_failed").to_string());
    }
    Ok(body)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn merge_replaces_removes_and_ignores_what_it_does_not_keep() {
        let mut cache = Cache::default();
        let page = |v: Value| v.as_object().unwrap().clone();
        merge(&mut cache, &page(json!({ "chunks": [{ "id": "a", "title": "one" }, { "id": "b", "title": "two" }], "alarms": [{ "id": "m" }] })));
        merge(&mut cache, &page(json!({ "chunks": [{ "id": "a", "title": "new" }, { "id": "b", "deleted": 1 }, { "title": "no id" }] })));
        let chunks = &cache.tables["chunks"];
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks["a"]["title"], "new");
        assert!(!cache.tables.contains_key("alarms"));
    }

    #[test]
    fn a_damaged_copy_starts_again() {
        let dir = std::env::temp_dir().join(format!("ko-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("day.json");
        std::fs::write(&path, b"{not json").unwrap();
        assert_eq!(load(&path).cursor, 0);
        let _ = std::fs::remove_dir_all(dir);
    }
}
