//! What only Windows can tell us: whether something full-screen is up, and how long since you last touched anything.

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

#[cfg(not(windows))]
pub fn should_stay_out_of_the_way() -> bool {
    false
}

#[cfg(not(windows))]
pub fn idle_seconds() -> u32 {
    0
}
