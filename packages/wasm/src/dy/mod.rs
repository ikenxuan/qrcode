//! 抖音码（`BEF_CODE_TYPE_DY_CODE`）编解码。
//!
//! 该模块是对抖音平台下发的抖音码的纯 Rust 移植。它不依赖标准 QR 的
//! 定位图案，而是通过中心圆盘/白色圆盘/三个定位圆环推导几何锚点，再采样
//! 四条数据环、解扰并做 Reed-Solomon 纠错。解码失败时静默返回 `None`，
//! 作为常规 QR 扫描失败后的兜底路径。
//!
//! 编码与渲染是解码的严格逆过程，默认参数与官方作品分享码一致。

mod decoder;
mod detect;
mod encoder;
mod gf256;
mod layout;
mod render;

pub use decoder::decode_gray_detailed;
pub use encoder::{encode_text, EncodeOptions};
pub use render::{render_raster, render_svg, RenderOptions};
