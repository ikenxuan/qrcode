//! 抖音码（`BEF_CODE_TYPE_DY_CODE`）解码。
//!
//! 该模块是对抖音平台下发的抖音码的纯 Rust 移植。它不依赖标准 QR 的
//! 定位图案，而是通过中心圆盘/白色圆盘/三个定位圆环推导几何锚点，再采样
//! 四条数据环、解扰并做 Reed-Solomon 纠错。解码失败时静默返回 `None`，
//! 作为常规 QR 扫描失败后的兜底路径。

mod decoder;
mod detect;
mod gf256;
mod layout;

pub use decoder::decode_gray;
