use qr_code_styling::{
    config::{
        BackgroundOptions, CornersSquareOptions, CornersDotOptions, DotsOptions, Gradient,
        ImageOptions, QROptions,
    },
    types::{CornerDotType, CornerSquareType, DotType},
    Mode, QRCodeStyling, ShapeType,
};
use serde::Deserialize;
use wasm_bindgen::prelude::*;

mod color;
mod dy;
mod logo;
mod scan;
use color::parse_color;
use dy::{
    encode_text, render_raster, render_svg as render_dy_svg, EncodeOptions, RenderOptions,
};
use logo::round_logo_corners;
use scan::{scan_qr, scan_qr_detailed};

// ─── 配置结构体（从 JS 侧反序列化） ───────────────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GradientOpts {
    color_from: String,
    color_to: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DotsOpts {
    dot_type: String,
    color: Option<String>,
    gradient: Option<GradientOpts>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CornersSquareOpts {
    corner_type: String,
    color: Option<String>,
    gradient: Option<GradientOpts>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CornersDotOpts {
    corner_type: String,
    color: Option<String>,
    gradient: Option<GradientOpts>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ImgOpts {
    image_size: Option<f64>,
    margin: Option<u32>,
    round: Option<f64>,
    hide_background_dots: Option<bool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackgroundOpts {
    color: Option<String>,
    transparent: Option<bool>,
    gradient: Option<GradientOpts>,
    round: Option<f64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct QRCodeOpts {
    data: String,
    size: Option<u32>,
    margin: Option<u32>,
    shape: Option<String>,
    dots_options: Option<DotsOpts>,
    corners_square_options: Option<CornersSquareOpts>,
    corners_dot_options: Option<CornersDotOpts>,
    background_options: Option<BackgroundOpts>,
    image: Option<Vec<u8>>,
    image_options: Option<ImgOpts>,
}

/// 抖音码生成配置（从 JS 侧反序列化）。
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DyCodeOpts {
    data: String,
    format_code: Option<u32>,
    param: Option<u32>,
    field_xor: Option<bool>,
    size: Option<u32>,
    scale: Option<f64>,
    margin: Option<u32>,
    dark_color: Option<String>,
    light_color: Option<String>,
    transparent: Option<bool>,
    module_style: Option<String>,
    module_radius: Option<f64>,
    frame: Option<bool>,
    frame_style: Option<String>,
    frame_width: Option<f64>,
    frame_radius: Option<f64>,
    frame_span: Option<f64>,
    frame_count: Option<u32>,
    logo: Option<bool>,
    center_image: Option<Vec<u8>>,
    badge: Option<bool>,
    badge_radius: Option<f64>,
    badge_image: Option<Vec<u8>>,
}

// ─── 类型映射 ──────────────────────────────────────────────────────────────────

fn parse_gradient(g: &GradientOpts) -> Gradient {
    Gradient::simple_linear(parse_color(&g.color_from), parse_color(&g.color_to))
}

fn map_dot_type(s: &str) -> DotType {
    match s {
        "dots" => DotType::Dots,
        "rounded" => DotType::Rounded,
        "classy" => DotType::Classy,
        "classy-rounded" => DotType::ClassyRounded,
        "extra-rounded" => DotType::ExtraRounded,
        _ => DotType::Square,
    }
}

fn map_corner_square_type(s: &str) -> CornerSquareType {
    match s {
        "dot" => CornerSquareType::Dot,
        "extra-rounded" => CornerSquareType::ExtraRounded,
        _ => CornerSquareType::Square,
    }
}

fn map_corner_dot_type(s: &str) -> CornerDotType {
    match s {
        "dot" => CornerDotType::Dot,
        _ => CornerDotType::Square,
    }
}

/// 根据配置构建 QRCodeStyling 实例
fn build_qr(opts: QRCodeOpts) -> Result<QRCodeStyling, String> {
    let mut builder = QRCodeStyling::builder();
    builder = builder.data(&opts.data);
    builder = builder.size(opts.size.unwrap_or(300));

    // 必须显式指定编码模式。默认的 encode_auto 会按 Shift_JIS 的首/尾字节区间
    // 识别汉字，而 UTF-8 中文的三字节序列（1110xxxx 10xxxxxx 10xxxxxx）恰好落进
    // 那些区间，于是被当成 Shift_JIS 双字节码写进 Kanji 模式分段 —— Kanji 模式按
    // 规范就是 Shift_JIS，这种码任何解码器读出来都是乱码，手机扫也一样。
    // 这里按 JS 版 qr-code-styling 的规则整串只用一个模式：全数字 Numeric、
    // 全大写字母数字 Alphanumeric、其余 Byte，代价只是放弃混合内容的最优切分。
    builder = builder.qr_options(QROptions::new().with_mode(Mode::detect(&opts.data)));

    if let Some(margin) = opts.margin {
        builder = builder.margin(margin);
    }

    if let Some(ref shape) = opts.shape {
        builder = builder.shape(match shape.as_str() {
            "circle" => ShapeType::Circle,
            _ => ShapeType::Square,
        });
    }

    if let Some(ref dots) = opts.dots_options {
        let mut d = DotsOptions::new(map_dot_type(&dots.dot_type));
        if let Some(ref c) = dots.color {
            d = d.with_color(parse_color(c));
        }
        if let Some(ref g) = dots.gradient {
            d = d.with_gradient(parse_gradient(g));
        }
        builder = builder.dots_options(d);
    }

    if let Some(ref cs) = opts.corners_square_options {
        let mut d = CornersSquareOptions::new(map_corner_square_type(&cs.corner_type));
        if let Some(ref c) = cs.color {
            d = d.with_color(parse_color(c));
        }
        if let Some(ref g) = cs.gradient {
            d = d.with_gradient(parse_gradient(g));
        }
        builder = builder.corners_square_options(d);
    }

    if let Some(ref cd) = opts.corners_dot_options {
        let mut d = CornersDotOptions::new(map_corner_dot_type(&cd.corner_type));
        if let Some(ref c) = cd.color {
            d = d.with_color(parse_color(c));
        }
        if let Some(ref g) = cd.gradient {
            d = d.with_gradient(parse_gradient(g));
        }
        builder = builder.corners_dot_options(d);
    }

    if let Some(ref bg) = opts.background_options {
        let bg_opts = if bg.transparent == Some(true) {
            BackgroundOptions::transparent()
        } else if let Some(ref color) = bg.color {
            let mut b = BackgroundOptions::new(parse_color(color));
            if let Some(ref g) = bg.gradient {
                b = b.with_gradient(parse_gradient(g));
            }
            if let Some(round) = bg.round {
                b = b.with_round(round);
            }
            b
        } else {
            BackgroundOptions::default()
        };
        builder = builder.background_options(bg_opts);
    }

    if let Some(ref img) = opts.image {
        let image = if let Some(round) = opts.image_options.as_ref().and_then(|io| io.round) {
            round_logo_corners(img, round)?
        } else {
            img.clone()
        };
        builder = builder.image(image);
    }

    if let Some(ref io) = opts.image_options {
        let mut d = ImageOptions::default();
        if let Some(size) = io.image_size {
            d = d.with_image_size(size);
        }
        if let Some(margin) = io.margin {
            d = d.with_margin(margin);
        }
        if let Some(hide) = io.hide_background_dots {
            d = d.with_hide_background_dots(hide);
        }
        builder = builder.image_options(d);
    }

    builder.build().map_err(|e| format!("{e}"))
}

/// 生成 QR 码光栅图（PNG/JPEG/WebP）
///
/// 统一走 SVG → resvg 渲染，避免 qr-code-styling 的 raster 特性
/// 再引入一份 resvg 和完整的字体栈。
#[wasm_bindgen]
pub fn generate(options: JsValue, format: &str) -> Result<Vec<u8>, JsError> {
    let opts: QRCodeOpts =
        serde_wasm_bindgen::from_value(options).map_err(|e| JsError::new(&e.to_string()))?;

    let qr = build_qr(opts).map_err(|e| JsError::new(&e))?;
    let svg = qr.render_svg().map_err(|e| JsError::new(&format!("{e}")))?;

    match format {
        "svg" => Ok(svg.into_bytes()),
        "png" | "jpeg" | "webp" => render_svg_raster(&svg, format),
        _ => Err(JsError::new(&format!("不支持的输出格式：{format}"))),
    }
}

/// 把 SVG 光栅化为 PNG / JPEG / WebP
///
/// tiny-skia 的像素是预乘 alpha，编码前要转回直通 alpha。
/// JPEG 不支持透明，先铺白底。
fn render_svg_raster(svg: &str, format: &str) -> Result<Vec<u8>, JsError> {
    use image::{DynamicImage, ImageFormat, RgbaImage};
    use resvg::tiny_skia::{Color, Pixmap, Transform};
    use resvg::usvg::{Options, Tree};
    use std::io::Cursor;

    let tree = Tree::from_str(svg, &Options::default())
        .map_err(|e| JsError::new(&format!("SVG parse error: {e}")))?;

    let size = tree.size();
    let width = size.width() as u32;
    let height = size.height() as u32;

    let mut pixmap = Pixmap::new(width, height)
        .ok_or_else(|| JsError::new("Failed to create pixmap"))?;

    if format == "jpeg" {
        pixmap.fill(Color::WHITE);
    }

    resvg::render(&tree, Transform::default(), &mut pixmap.as_mut());

    let data: Vec<u8> = pixmap
        .pixels()
        .iter()
        .flat_map(|p| {
            let c = p.demultiply();
            [c.red(), c.green(), c.blue(), c.alpha()]
        })
        .collect();
    let image = RgbaImage::from_raw(width, height, data)
        .ok_or_else(|| JsError::new("Failed to create image"))?;
    let image = DynamicImage::ImageRgba8(image);

    let mut buf = Cursor::new(Vec::new());
    let image_format = match format {
        "jpeg" => ImageFormat::Jpeg,
        "webp" => ImageFormat::WebP,
        _ => ImageFormat::Png,
    };

    if format == "jpeg" {
        DynamicImage::ImageRgb8(image.to_rgb8())
            .write_to(&mut buf, image_format)
            .map_err(|e| JsError::new(&format!("JPEG encode error: {e}")))?;
    } else {
        image
            .write_to(&mut buf, image_format)
            .map_err(|e| JsError::new(&format!("{format} encode error: {e}")))?;
    }

    Ok(buf.into_inner())
}

/// 生成 QR 码 SVG 字符串
#[wasm_bindgen(js_name = "generateSvg")]
pub fn generate_svg(options: JsValue) -> Result<String, JsError> {
    let opts: QRCodeOpts =
        serde_wasm_bindgen::from_value(options).map_err(|e| JsError::new(&e.to_string()))?;

    let qr = build_qr(opts).map_err(|e| JsError::new(&e))?;
    qr.render_svg().map_err(|e| JsError::new(&format!("{e}")))
}

/// 扫描图片中的 QR 码
///
/// 支持 PNG、JPEG、WebP 格式，返回解码后的文本内容
#[wasm_bindgen]
pub fn scan(image_data: &[u8]) -> Option<String> {
    scan_qr(image_data)
}

/// 扫描图片中的 QR 码，返回文本和原图坐标下的位置信息
///
/// 返回 `{ text, width, height, points, circle }`。`points` 是定位点：
/// 标准二维码为定位图案中心，抖音码为圆心或三个圆形标记中心；
/// 抖音码的 `circle` 是覆盖数据环的圆形范围。
#[wasm_bindgen(js_name = "scanDetailed")]
pub fn scan_detailed(image_data: &[u8]) -> Option<JsValue> {
    let outcome = scan_qr_detailed(image_data)?;
    serde_wasm_bindgen::to_value(&outcome).ok()
}

/// 解析抖音码生成参数。
fn dy_settings(options: JsValue) -> Result<(String, EncodeOptions, RenderOptions), JsError> {
    let opts: DyCodeOpts =
        serde_wasm_bindgen::from_value(options).map_err(|e| JsError::new(&e.to_string()))?;

    let defaults = RenderOptions::default();
    let render = RenderOptions {
        scale: opts.scale,
        size: opts.size,
        margin: opts.margin.unwrap_or(defaults.margin),
        dark_color: opts.dark_color.unwrap_or(defaults.dark_color),
        light_color: opts.light_color.unwrap_or(defaults.light_color),
        transparent: opts.transparent.unwrap_or(defaults.transparent),
        module_style: opts.module_style.unwrap_or(defaults.module_style),
        module_radius: opts.module_radius.unwrap_or(defaults.module_radius),
        frame: opts.frame.unwrap_or(defaults.frame),
        frame_style: opts.frame_style.unwrap_or(defaults.frame_style),
        frame_width: opts.frame_width.unwrap_or(defaults.frame_width),
        frame_radius: opts.frame_radius.unwrap_or(defaults.frame_radius),
        frame_span: opts.frame_span.unwrap_or(defaults.frame_span),
        frame_count: opts.frame_count.unwrap_or(defaults.frame_count),
        logo: opts.logo.unwrap_or(defaults.logo),
        center_image: opts.center_image,
        badge: opts.badge.unwrap_or(defaults.badge),
        badge_radius: opts.badge_radius.unwrap_or(defaults.badge_radius),
        badge_image: opts.badge_image,
    };
    let encode = EncodeOptions {
        format_code: opts.format_code.map(|value| value as usize),
        param: opts.param.unwrap_or(20) as usize,
        field_xor: opts.field_xor.unwrap_or(true),
    };

    Ok((opts.data, encode, render))
}

/// 生成抖音码位图（PNG / JPEG / WebP）。
///
/// 默认复刻官方作品分享码版式：深色中心圆盘、四条数据环、三个定位圆环、
/// 四段外框装饰弧和中心播放图标。默认格式码 5、参数 20（掩码 4），
/// 消息容量 40 字节，UTF-8 文本最多 38 字节；更长的文本（最多 51 字节）
/// 会自动改用格式码 6 的五环版式。也可以通过 `formatCode` 显式指定
/// 4（三环）、5（四环）或 6（五环）。
///
/// 可通过 `size` / `scale` / `margin` / `darkColor` / `lightColor` /
/// `transparent` / `moduleStyle` / `moduleRadius` / `frame` / `frameStyle` /
/// `frameWidth` / `frameRadius` / `frameSpan` / `frameCount` / `logo` /
/// `centerImage` / `badgeRadius` / `badgeImage` 调整观感。
#[wasm_bindgen(js_name = "generateDy")]
pub fn generate_dy(options: JsValue, format: &str) -> Result<Vec<u8>, JsError> {
    let (data, encode, render) = dy_settings(options)?;
    let encoded = encode_text(&data, encode).map_err(|e| JsError::new(&e))?;

    if format == "svg" {
        return render_dy_svg(&encoded, &render)
            .map(String::into_bytes)
            .map_err(|e| JsError::new(&e));
    }

    render_raster(&encoded, &render, format).map_err(|e| JsError::new(&e))
}

/// 生成抖音码 SVG 字符串。
#[wasm_bindgen(js_name = "generateDySvg")]
pub fn generate_dy_svg(options: JsValue) -> Result<String, JsError> {
    let (data, encode, render) = dy_settings(options)?;
    let encoded = encode_text(&data, encode).map_err(|e| JsError::new(&e))?;
    render_dy_svg(&encoded, &render).map_err(|e| JsError::new(&e))
}

#[cfg(test)]
mod tests {
    use super::render_svg_raster;

    /// tiny-skia 输出预乘 alpha，编码前必须转回直通 alpha，
    /// 否则半透明颜色会整体变暗。
    #[test]
    fn semi_transparent_png_uses_straight_alpha() {
        let svg = r##"<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#ff00007f"/></svg>"##;
        let png = render_svg_raster(svg, "png").unwrap();
        let image = image::load_from_memory(&png).unwrap().to_rgba8();
        assert_eq!(image.get_pixel(4, 4).0, [255, 0, 0, 127]);
    }

    /// JPEG 没有 alpha 通道，透明区域应铺白底。
    #[test]
    fn jpeg_gets_white_background() {
        let svg = r#"<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"></svg>"#;
        let jpeg = render_svg_raster(svg, "jpeg").unwrap();
        let image = image::load_from_memory(&jpeg).unwrap().to_rgb8();
        assert!(image.get_pixel(4, 4).0.iter().all(|&v| v >= 250));
    }
}
