//! What only Windows can tell us: whether something full-screen is up, how long since you last touched anything, and
//! where you are working. Nothing here can see which keys you press or what a window holds: no keyboard hook, no window
//! titles, no screen contents. "Typing" is only "there was input, and the mouse did not move".

/// True during a full-screen game or video, a presentation, or while Windows is in "do not disturb" for a full-screen app.
#[cfg(windows)]
pub fn should_stay_out_of_the_way() -> bool {
    use windows_sys::Win32::UI::Shell::{
        SHQueryUserNotificationState, QUNS_BUSY, QUNS_PRESENTATION_MODE, QUNS_RUNNING_D3D_FULL_SCREEN,
    };
    let mut state = 0;
    // SAFETY: the call only writes to the state we pass.
    let result = unsafe { SHQueryUserNotificationState(&mut state) };
    result >= 0 && (state == QUNS_BUSY || state == QUNS_RUNNING_D3D_FULL_SCREEN || state == QUNS_PRESENTATION_MODE)
}

/// Seconds since the last key press or mouse move, anywhere.
#[cfg(windows)]
pub fn idle_seconds() -> u32 {
    use windows_sys::Win32::System::SystemInformation::GetTickCount;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
    let mut info = LASTINPUTINFO { cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32, dwTime: 0 };
    // SAFETY: cbSize is set as the call requires, and it only writes to the struct we pass.
    if unsafe { GetLastInputInfo(&mut info) } == 0 {
        return 0;
    }
    // SAFETY: takes no arguments. Both are tick counts that wrap together, hence wrapping_sub.
    unsafe { GetTickCount() }.wrapping_sub(info.dwTime) / 1000
}

/// A number that changes whenever there is input of any kind.
#[cfg(windows)]
pub fn last_input() -> u32 {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
    let mut info = LASTINPUTINFO { cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32, dwTime: 0 };
    // SAFETY: as in idle_seconds.
    if unsafe { GetLastInputInfo(&mut info) } == 0 {
        return 0;
    }
    info.dwTime
}

/// A point on the screen and whether it is the text cursor itself (true) or just the middle of the window (false).
#[derive(Clone, Copy, PartialEq, serde::Serialize)]
pub struct Focus {
    pub x: f64,
    pub y: f64,
    pub exact: bool,
}

/// Which window you are in, unless it is one of Kō's own: an id to notice a change, and where you are in it.
/// The text cursor is only known in apps that report it (many browsers and Electron apps don't).
#[cfg(windows)]
pub fn focus() -> Option<(isize, Focus)> {
    use windows_sys::Win32::Foundation::{POINT, RECT};
    use windows_sys::Win32::Graphics::Gdi::ClientToScreen;
    use windows_sys::Win32::System::Threading::GetCurrentProcessId;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetGUIThreadInfo, GetWindowRect, GetWindowThreadProcessId, GUITHREADINFO,
    };
    // SAFETY: each call gets a valid handle or a struct of ours to write to, sized where the call asks for it; a window
    // that has just closed makes them fail, which is handled.
    unsafe {
        let window = GetForegroundWindow();
        if window.is_null() {
            return None;
        }
        let mut process = 0u32;
        let thread = GetWindowThreadProcessId(window, &mut process);
        if thread == 0 || process == GetCurrentProcessId() {
            return None;
        }
        let id = window as isize;
        let mut info: GUITHREADINFO = std::mem::zeroed();
        info.cbSize = std::mem::size_of::<GUITHREADINFO>() as u32;
        if GetGUIThreadInfo(thread, &mut info) != 0 && !info.hwndCaret.is_null() {
            let mut p = POINT { x: info.rcCaret.left, y: info.rcCaret.bottom };
            if ClientToScreen(info.hwndCaret, &mut p) != 0 {
                return Some((id, Focus { x: p.x as f64, y: p.y as f64, exact: true }));
            }
        }
        let mut r: RECT = std::mem::zeroed();
        if GetWindowRect(window, &mut r) == 0 {
            return None;
        }
        Some((id, Focus { x: (r.left + r.right) as f64 / 2.0, y: (r.top + r.bottom) as f64 / 2.0, exact: false }))
    }
}

#[cfg(not(windows))]
pub fn last_input() -> u32 {
    0
}

#[cfg(not(windows))]
pub fn focus() -> Option<(isize, Focus)> {
    None
}

#[cfg(not(windows))]
pub fn should_stay_out_of_the_way() -> bool {
    false
}

#[cfg(not(windows))]
pub fn idle_seconds() -> u32 {
    0
}
