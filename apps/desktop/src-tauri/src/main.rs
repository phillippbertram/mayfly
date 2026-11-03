#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    mayfly_lib::run().expect("Mayfly could not start its desktop application");
}
