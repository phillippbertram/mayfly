#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    filehop_lib::run().expect("FileHop could not start its desktop application");
}
