//! Kō on the desktop: a small transparent window that roams the screen, and a Today window.
//! The roaming itself is in ui/ko.js; this side does what a page can't.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod auth;
mod day;
mod platform;

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, WebviewWindow, WindowEvent};

/// Five minutes without touching anything and Kō has a nap.
const IDLE_AFTER: u32 = 5 * 60;

#[derive(Default, Clone, Copy)]
struct Hit {
    cx: f64,
    cy: f64,
    r: f64,
    bx: f64,
    by: f64,
    bw: f64,
    bh: f64,
}

impl Hit {
    /// x, y: logical pixels inside Kō's window.
    fn contains(&self, x: f64, y: f64) -> bool {
        let (dx, dy) = (x - self.cx, y - self.cy);
        dx * dx + dy * dy <= self.r * self.r
            || (self.bw > 0.0 && x >= self.bx && x <= self.bx + self.bw && y >= self.by && y <= self.by + self.bh)
    }
}

struct Shared {
    hit: Mutex<Hit>,
    dragging: AtomicBool,
    user_visible: AtomicBool,
    http: reqwest::Client,
    syncing: tokio::sync::Mutex<()>,
    signing_in: AtomicBool,
}

fn day_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map(|d| d.join("day.json")).map_err(|e| e.to_string())
}

fn ko(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("ko")
}

// ---- commands for ui/ko.js ----------------------------------------------------------------------------------------
#[derive(serde::Serialize)]
struct Area {
    x: i32,
    y: i32,
    w: u32,
    h: u32,
    scale: f64,
}

/// The usable part of the display Kō is on (without the taskbar), in physical pixels.
#[tauri::command]
fn ko_area(app: AppHandle) -> Result<Area, String> {
    let win = ko(&app).ok_or("no window")?;
    let monitor = win
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| win.primary_monitor().ok().flatten())
        .ok_or("no display")?;
    let work = monitor.work_area();
    Ok(Area { x: work.position.x, y: work.position.y, w: work.size.width, h: work.size.height, scale: monitor.scale_factor() })
}

#[tauri::command]
fn move_ko(app: AppHandle, x: i32, y: i32) -> Result<(), String> {
    ko(&app).ok_or("no window")?.set_position(PhysicalPosition::new(x, y)).map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
fn set_hit(app: AppHandle, cx: f64, cy: f64, r: f64, bx: f64, by: f64, bw: f64, bh: f64) {
    *app.state::<Shared>().hit.lock().unwrap() = Hit { cx, cy, r, bx, by, bw, bh };
}

#[tauri::command]
fn set_dragging(app: AppHandle, dragging: bool) {
    app.state::<Shared>().dragging.store(dragging, Ordering::SeqCst);
}

fn show_panel(app: &AppHandle) {
    if let Some(p) = app.get_webview_window("panel") {
        let _ = p.unminimize();
        let _ = p.show();
        let _ = p.set_focus();
        let _ = app.emit_to("panel", "panel-open", ());
    }
}

#[tauri::command]
fn open_panel(app: AppHandle) {
    show_panel(&app);
}

// ---- commands for your day and your account ---------------------------------------------------------------------------
#[tauri::command]
fn get_day(app: AppHandle) -> Result<day::Cache, String> {
    Ok(day::load(&day_path(&app)?))
}

async fn pull_and_tell(app: &AppHandle) -> Result<day::Cache, String> {
    let path = day_path(app)?;
    let shared = app.state::<Shared>();
    let _one_at_a_time = shared.syncing.lock().await;
    match day::pull(&shared.http, &path).await {
        Ok(cache) => {
            let _ = app.emit("day-updated", &cache);
            Ok(cache)
        }
        Err(e) => {
            if e == "signed_out" {
                let _ = app.emit("auth-changed", Option::<auth::AccountView>::None);
            }
            Err(e)
        }
    }
}

#[tauri::command]
async fn sync_day(app: AppHandle) -> Result<day::Cache, String> {
    pull_and_tell(&app).await
}

#[tauri::command]
async fn refresh_day(app: AppHandle) -> Result<day::Cache, String> {
    day::import_now(&app.state::<Shared>().http).await;
    pull_and_tell(&app).await
}

#[tauri::command]
fn get_account() -> Option<auth::AccountView> {
    auth::load().as_ref().map(auth::AccountView::from)
}

#[tauri::command]
async fn sign_in(app: AppHandle) -> Result<auth::AccountView, String> {
    let shared = app.state::<Shared>();
    if shared.signing_in.swap(true, Ordering::SeqCst) {
        return Err("cancelled".to_string());
    }
    let result = async {
        let (code, verifier) = tauri::async_runtime::spawn_blocking(auth::browser_sign_in).await.map_err(|_| "failed".to_string())??;
        auth::redeem(&shared.http, code, verifier).await
    }
    .await;
    shared.signing_in.store(false, Ordering::SeqCst);
    let view = auth::AccountView::from(&result?);
    let _ = app.emit("auth-changed", Some(view.clone()));
    show_panel(&app);
    Ok(view)
}

#[tauri::command]
fn sign_out(app: AppHandle) {
    auth::clear();
    if let Ok(path) = day_path(&app) {
        let _ = std::fs::remove_file(path);
    }
    let _ = app.emit("auth-changed", Option::<auth::AccountView>::None);
}

// ---- the watcher: lets clicks through everywhere but on Kō, and keeps him out of the way ----------------------------------
fn watch(app: AppHandle) {
    std::thread::spawn(move || {
        let (mut through, mut hovering, mut visible, mut idle, mut tick) = (None, false, false, false, 0u32);
        loop {
            std::thread::sleep(Duration::from_millis(40));
            let Some(win) = ko(&app) else { continue };
            let shared = app.state::<Shared>();

            // Clicks, about 25 times a second. While dragged he keeps the pointer even if it outruns him.
            let over = shared.dragging.load(Ordering::SeqCst)
                || match (app.cursor_position(), win.outer_position(), win.scale_factor()) {
                    (Ok(c), Ok(p), Ok(s)) => {
                        let hit = *shared.hit.lock().unwrap();
                        visible && hit.contains((c.x - p.x as f64) / s, (c.y - p.y as f64) / s)
                    }
                    _ => false,
                };
            if through != Some(!over) {
                through = Some(!over);
                let _ = win.set_ignore_cursor_events(!over);
            }
            if over != hovering {
                hovering = over;
                let _ = app.emit_to("ko", "ko-hover", over);
            }

            // Full-screen apps and your breaks, every couple of seconds.
            tick += 1;
            if tick >= 50 {
                tick = 0;
                let now_idle = platform::idle_seconds() >= IDLE_AFTER;
                if now_idle != idle {
                    idle = now_idle;
                    let _ = app.emit_to("ko", "ko-idle", idle);
                }
            }
            if tick % 50 == 0 {
                let want = shared.user_visible.load(Ordering::SeqCst) && !platform::should_stay_out_of_the_way();
                if want != visible {
                    visible = want;
                    let _ = if want { win.show() } else { win.hide() };
                    let _ = app.emit_to("ko", "ko-visible", want);
                }
            }
        }
    });
}

// ---- the tray ---------------------------------------------------------------------------------------------------------
fn tray(app: &AppHandle) -> tauri::Result<()> {
    let today = MenuItem::with_id(app, "today", "Today", true, None::<&str>)?;
    let roaming = CheckMenuItem::with_id(app, "roaming", "Let Kō roam", true, true, None::<&str>)?;
    let show = CheckMenuItem::with_id(app, "show", "Show Kō", true, true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&today, &roaming, &show, &PredefinedMenuItem::separator(app)?, &quit])?;
    let (roaming_item, show_item) = (roaming.clone(), show.clone());
    let mut builder = TrayIconBuilder::with_id("ko").tooltip("Kō").menu(&menu).show_menu_on_left_click(false);
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "today" => show_panel(app),
            "roaming" => {
                let on = roaming_item.is_checked().unwrap_or(true);
                let _ = app.emit_to("ko", "ko-roaming", on);
            }
            "show" => {
                let on = show_item.is_checked().unwrap_or(true);
                app.state::<Shared>().user_visible.store(on, Ordering::SeqCst);
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                show_panel(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        // Opening Kō again shows Today rather than a second Kō.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_panel(app)))
        .manage(Shared {
            hit: Mutex::new(Hit::default()),
            dragging: AtomicBool::new(false),
            user_visible: AtomicBool::new(true),
            http: reqwest::Client::builder().timeout(Duration::from_secs(30)).build().expect("HTTP client"),
            syncing: tokio::sync::Mutex::new(()),
            signing_in: AtomicBool::new(false),
        })
        .invoke_handler(tauri::generate_handler![
            ko_area, move_ko, set_hit, set_dragging, open_panel, get_day, sync_day, refresh_day, get_account, sign_in, sign_out
        ])
        .on_window_event(|window, event| {
            // Closing Today only hides it; Kō keeps going until Quit in the tray.
            if let (WindowEvent::CloseRequested { api, .. }, "panel") = (event, window.label()) {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .setup(|app| {
            tray(app.handle())?;
            watch(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Kō could not start");
}

#[cfg(test)]
mod tests {
    use super::Hit;

    #[test]
    fn clicks_land_only_on_ko_and_his_bubble() {
        let mut hit = Hit { cx: 120.0, cy: 162.0, r: 74.0, ..Hit::default() };
        assert!(hit.contains(120.0, 162.0));
        assert!(!hit.contains(5.0, 5.0));
        hit.bx = 6.0;
        hit.by = 4.0;
        hit.bw = 228.0;
        hit.bh = 50.0;
        assert!(hit.contains(10.0, 10.0));
    }
}
