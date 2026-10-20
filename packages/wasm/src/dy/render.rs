//! 抖音码渲染器：复刻官方作品分享码的默认版式。
//!
//! 固定结构（始终绘制）：
//!
//! - 深色中心圆盘，同时是解码器的定位锚点；
//! - 四条数据环，模块为沿切向的环形扇区，相邻的 1 合并成长弧；
//! - 三个定位圆环，位于 45° / 135° / 225°。
//!
//! 只影响观感、不影响协议的元素：
//!
//! - 外圈装饰（`frame` + `frame_style`），圆环类会在定位圆环和右上角图片处断开；
//! - 中心播放图标（`logo`）或覆盖整个中心圆盘的图片（`center_image`）；
//! - 右上角圆形图片槽位（`badge` + `badge_image`）；
//! - 前景色 / 背景色、透明背景、模块形状与圆角。

use std::fmt::Write as _;
use std::io::Cursor;

use base64::Engine as _;
use resvg::tiny_skia::Pixmap;
use resvg::usvg::{Options as UsvgOptions, Tree};

use crate::color::parse_color;

use super::encoder::EncodedCode;
use super::layout::{DATA_RINGS, DISK_RADIUS, RING_MODULES, RING_RADII};

/// 官方作品分享码使用的深色。
const DARK_COLOR: &str = "#161823";
const LIGHT_COLOR: &str = "#ffffff";

/// 外圈装饰：外半径 109、默认宽度 9（内半径 100）个设计单位。
const FRAME_OUTER_RADIUS: f64 = 109.0;
const FRAME_WIDTH: f64 = 9.0;
const FRAME_SPAN: f64 = 64.0;
const FRAME_COUNT: u32 = 24;
const FRAME_MIN_WIDTH: f64 = 1.0;
const FRAME_MAX_WIDTH: f64 = 16.0;

/// 三个定位圆环：中心在半径 100 处，暗环 7..11，中心点半径 3。
const FINDER_DISTANCE: f64 = 100.0;
const FINDER_RING_RADIUS: f64 = 9.0;
const FINDER_RING_WIDTH: f64 = 4.0;
const FINDER_DOT_RADIUS: f64 = 3.0;
const FINDER_ANGLES: [f64; 3] = [45.0, 135.0, 225.0];

/// 右上角徽标：中心在定位圆环的半径上。
const BADGE_ANGLE: f64 = 315.0;
const BADGE_DISTANCE: f64 = 100.0;
const BADGE_RADIUS: f64 = 21.0;

/// 中心播放图标。
const LOGO_RING_RADIUS: f64 = 18.6;
const LOGO_RING_WIDTH: f64 = 2.0;
const LOGO_TRIANGLE: [(f64, f64); 3] = [(-3.3, -8.2), (8.7, 0.0), (-3.3, 8.2)];
const LOGO_TRIANGLE_WIDTH: f64 = 2.2;

/// 各数据环模块的径向厚度（设计单位）。
const MODULE_THICKNESS: [f64; DATA_RINGS] = [5.2, 3.1, 3.1, 3.1];

/// 单个模块在切向上与相邻模块之间保留的角向间隙（弧度）。
const MODULE_ANGULAR_GAP_DEG: f64 = 0.18;

/// 模块圆角半径（设计单位）。
const MODULE_CORNER_RADIUS: f64 = 1.2;

const DEFAULT_SCALE: f64 = 1.833;
const DEFAULT_MARGIN: u32 = 16;

/// 渲染参数。
#[derive(Clone, Debug)]
pub struct RenderOptions {
    /// 每个设计单位对应的像素数。提供 `size` 而未提供本项时会反推。
    pub scale: Option<f64>,
    /// 输出图片边长（像素）。
    pub size: Option<u32>,
    /// 图片边距（像素）。
    pub margin: u32,
    /// 前景色：数据环、定位环、外框、中心圆盘。
    pub dark_color: String,
    /// 背景色：背景、中心图标。
    pub light_color: String,
    /// 是否输出透明背景。开启后不再绘制背景矩形。
    pub transparent: bool,
    /// 数据模块形状：`rounded` / `square` / `pill`。
    pub module_style: String,
    /// `rounded` 模式的圆角半径（设计单位）。
    pub module_radius: f64,
    /// 是否绘制外圈装饰。
    pub frame: bool,
    /// 外圈样式：`arcs` / `ring` / `dashes` / `dots` / `ticks` / `double` /
    /// `segments` / `spark` / `orbit` / `gear`。
    pub frame_style: String,
    /// 外圈径向宽度（设计单位）。
    pub frame_width: f64,
    /// 外圈端点的圆角半径（设计单位）；`ring` / `double` 不受影响。
    pub frame_radius: f64,
    /// `arcs` 样式每段弧的角度（度）。
    pub frame_span: f64,
    /// `dashes` / `dots` / `ticks` 样式的元素数量。
    pub frame_count: u32,
    /// 是否绘制中心播放图标。提供 `center_image` 时由图片替代。
    pub logo: bool,
    /// 覆盖中心圆盘的圆形图片；提供后不再绘制播放图标。
    pub center_image: Option<Vec<u8>>,
    /// 是否绘制右上角图片槽位；仅在提供 `badge_image` 时生效。
    pub badge: bool,
    /// 右上角圆形图片的半径（设计单位）。
    pub badge_radius: f64,
    /// 右上角圆形图片。
    pub badge_image: Option<Vec<u8>>,
}

impl Default for RenderOptions {
    fn default() -> Self {
        Self {
            scale: None,
            size: None,
            margin: DEFAULT_MARGIN,
            dark_color: DARK_COLOR.to_string(),
            light_color: LIGHT_COLOR.to_string(),
            transparent: false,
            module_style: "rounded".to_string(),
            module_radius: MODULE_CORNER_RADIUS,
            frame: true,
            frame_style: "arcs".to_string(),
            frame_width: FRAME_WIDTH,
            frame_radius: 0.0,
            frame_span: FRAME_SPAN,
            frame_count: FRAME_COUNT,
            logo: true,
            center_image: None,
            badge: true,
            badge_radius: BADGE_RADIUS,
            badge_image: None,
        }
    }
}

/// 把编码后的环渲染成 PNG。
pub fn render_png(encoded: &EncodedCode, options: &RenderOptions) -> Result<Vec<u8>, String> {
    let (data, size) = rasterize(encoded, options)?;
    encode_png(&data, size, size)
}

/// 把编码后的环渲染成无损 WebP。
pub fn render_webp(encoded: &EncodedCode, options: &RenderOptions) -> Result<Vec<u8>, String> {
    let (data, size) = rasterize(encoded, options)?;
    encode_webp(&data, size, size)
}

/// 把编码后的环渲染成 JPEG。JPEG 不支持 alpha，透明区域会填充白色。
pub fn render_jpeg(encoded: &EncodedCode, options: &RenderOptions) -> Result<Vec<u8>, String> {
    let (data, size) = rasterize(encoded, options)?;
    encode_jpeg(&data, size, size)
}

/// 按格式渲染光栅图。
pub fn render_raster(
    encoded: &EncodedCode,
    options: &RenderOptions,
    format: &str,
) -> Result<Vec<u8>, String> {
    match format {
        "png" => render_png(encoded, options),
        "webp" => render_webp(encoded, options),
        "jpeg" | "jpg" => render_jpeg(encoded, options),
        _ => Err("format 必须是 \"png\"、\"jpeg\" 或 \"webp\"".to_string()),
    }
}

/// 把编码后的环渲染成 SVG 字符串。图片会以 data URI 内嵌。
pub fn render_svg(encoded: &EncodedCode, options: &RenderOptions) -> Result<String, String> {
    let (scale, size) = geometry(options)?;
    validate(options)?;
    Ok(build_svg(encoded, options, scale, size, true)?.svg)
}

/// 计算渲染比例和输出边长。
fn geometry(options: &RenderOptions) -> Result<(f64, u32), String> {
    let margin = options.margin as f64;
    let scale = match options.scale {
        Some(scale) => scale,
        None => match options.size {
            Some(size) => (size as f64 / 2.0 - margin) / FRAME_OUTER_RADIUS,
            None => DEFAULT_SCALE,
        },
    };
    if !scale.is_finite() || scale <= 0.0 {
        return Err("scale 必须是正数".to_string());
    }

    let size = match options.size {
        Some(size) => size,
        None => (2.0 * (FRAME_OUTER_RADIUS * scale + margin)).ceil() as u32,
    };
    if size as f64 <= margin * 2.0 {
        return Err("size 必须是大于两倍 margin 的整数".to_string());
    }

    Ok((scale, size))
}

fn validate(options: &RenderOptions) -> Result<(), String> {
    if options.dark_color.trim().is_empty() {
        return Err("darkColor 必须是非空颜色字符串".to_string());
    }
    if options.light_color.trim().is_empty() {
        return Err("lightColor 必须是非空颜色字符串".to_string());
    }
    if !matches!(options.module_style.as_str(), "rounded" | "square" | "pill") {
        return Err("moduleStyle 必须是 \"rounded\"、\"square\" 或 \"pill\"".to_string());
    }
    if !options.module_radius.is_finite() || options.module_radius < 0.0 {
        return Err("moduleRadius 必须是非负数".to_string());
    }
    if !matches!(
        options.frame_style.as_str(),
        "arcs" | "ring" | "dashes" | "dots" | "ticks" | "double" | "segments" | "spark" | "orbit"
            | "gear"
    ) {
        return Err(
            "frameStyle 必须是 \"arcs\"、\"ring\"、\"dashes\"、\"dots\"、\"ticks\"、\"double\"、\
             \"segments\"、\"spark\"、\"orbit\" 或 \"gear\""
                .to_string(),
        );
    }
    if !options.frame_width.is_finite()
        || !(FRAME_MIN_WIDTH..=FRAME_MAX_WIDTH).contains(&options.frame_width)
    {
        return Err("frameWidth 必须在 1..16 之间".to_string());
    }
    if !options.frame_radius.is_finite() || options.frame_radius < 0.0 {
        return Err("frameRadius 必须是非负数".to_string());
    }
    if !options.frame_span.is_finite() || !(4.0..=120.0).contains(&options.frame_span) {
        return Err("frameSpan 必须在 4..120 之间".to_string());
    }
    if !(4..=120).contains(&options.frame_count) {
        return Err("frameCount 必须在 4..120 之间".to_string());
    }
    if !options.badge_radius.is_finite()
        || options.badge_radius <= 0.0
        || options.badge_radius > 40.0
    {
        return Err("badgeRadius 必须在 0..40 之间".to_string());
    }
    Ok(())
}

struct SvgOutput {
    svg: String,
    badge_center: Option<(f64, f64)>,
}

/// 构建 SVG。
///
/// `embed_badge` 为 true 时把图片以 data URI 嵌入 SVG（用于 SVG 输出）；
/// 为 false 时只绘制图片底衬，由光栅化阶段以更高画质合成。
fn build_svg(
    encoded: &EncodedCode,
    options: &RenderOptions,
    scale: f64,
    size: u32,
    embed_badge: bool,
) -> Result<SvgOutput, String> {
    let dark = color_css(&options.dark_color);
    let light = color_css(&options.light_color);
    let cx = size as f64 / 2.0;
    let cy = size as f64 / 2.0;

    let mut svg = String::with_capacity(16_384);
    let _ = write!(
        svg,
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{size}\" height=\"{size}\" \
         viewBox=\"0 0 {size} {size}\">"
    );
    if !options.transparent {
        let _ = write!(
            svg,
            "<rect width=\"{size}\" height=\"{size}\" fill=\"{light}\"/>"
        );
    }

    // 外圈装饰。数据全部位于内圈，外圈只影响观感，可以自由换样式。
    if options.frame {
        draw_frame(&mut svg, options, &dark, cx, cy, scale);
    }

    // 数据环：把连续的 1 合并成一条切向短条。
    let module_arc = std::f64::consts::TAU / RING_MODULES as f64;
    for ring in 0..DATA_RINGS {
        let bits = &encoded.rings[ring];
        let radius = RING_RADII[ring] * scale;
        let thickness = MODULE_THICKNESS[ring] * scale;
        let corner_radius = match options.module_style.as_str() {
            "square" => 0.0,
            "pill" => thickness / 2.0,
            _ => (options.module_radius * scale).min(thickness / 2.0),
        };

        let offset = bits.iter().position(|&bit| bit == 0).unwrap_or(0);
        let mut position = 0usize;
        while position < RING_MODULES {
            let actual = (offset + position) % RING_MODULES;
            if bits[actual] == 0 {
                position += 1;
                continue;
            }

            let mut length = 0usize;
            while length < RING_MODULES && bits[(offset + position + length) % RING_MODULES] == 1 {
                length += 1;
            }

            if length == RING_MODULES {
                let _ = write!(
                    svg,
                    "<circle cx=\"{}\" cy=\"{}\" r=\"{}\" fill=\"none\" stroke=\"{dark}\" \
                     stroke-width=\"{}\"/>",
                    svg_number(cx),
                    svg_number(cy),
                    svg_number(radius),
                    svg_number(thickness),
                );
            } else {
                let gap = MODULE_ANGULAR_GAP_DEG
                    .to_radians()
                    .min(length as f64 * module_arc / 4.0);
                let start_angle = (offset + position) as f64 * module_arc + gap;
                let end_angle = (offset + position + length) as f64 * module_arc - gap;
                let _ = write!(
                    svg,
                    "<path d=\"{}\" fill=\"{dark}\"/>",
                    module_path(
                        cx,
                        cy,
                        radius,
                        thickness,
                        start_angle,
                        end_angle,
                        corner_radius
                    ),
                );
            }
            position += length;
        }
    }

    // 中心圆盘和播放图标。圆盘同时是解码器的定位锚点。
    let _ = write!(
        svg,
        "<circle cx=\"{}\" cy=\"{}\" r=\"{}\" fill=\"{dark}\"/>",
        svg_number(cx),
        svg_number(cy),
        svg_number(DISK_RADIUS * scale),
    );
    if let Some(image) = options.center_image.as_deref() {
        // 中心图片覆盖整个圆盘，并替代播放图标。光栅化阶段会以更高画质合成。
        if embed_badge {
            let uri = badge_data_uri(image)?;
            let radius = DISK_RADIUS * scale;
            let _ = write!(
                svg,
                "<defs><clipPath id=\"dy-center-clip\"><circle cx=\"{}\" cy=\"{}\" r=\"{}\"/>\
                 </clipPath></defs>",
                svg_number(cx),
                svg_number(cy),
                svg_number(radius),
            );
            let _ = write!(
                svg,
                "<image x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" href=\"{uri}\" \
                 preserveAspectRatio=\"xMidYMid slice\" clip-path=\"url(#dy-center-clip)\"/>",
                svg_number(cx - radius),
                svg_number(cy - radius),
                svg_number(radius * 2.0),
                svg_number(radius * 2.0),
            );
        }
    } else if options.logo {
        let _ = write!(
            svg,
            "<circle cx=\"{}\" cy=\"{}\" r=\"{}\" fill=\"none\" stroke=\"{light}\" \
             stroke-width=\"{}\"/>",
            svg_number(cx),
            svg_number(cy),
            svg_number(LOGO_RING_RADIUS * scale),
            svg_number(LOGO_RING_WIDTH * scale),
        );
        let triangle = LOGO_TRIANGLE
            .iter()
            .map(|&(x, y)| {
                format!(
                    "{} {}",
                    svg_number(cx + x * scale),
                    svg_number(cy + y * scale)
                )
            })
            .collect::<Vec<_>>();
        let _ = write!(
            svg,
            "<path d=\"M {} L {} L {} Z\" fill=\"none\" stroke=\"{light}\" \
             stroke-width=\"{}\" stroke-linejoin=\"round\"/>",
            triangle[0],
            triangle[1],
            triangle[2],
            svg_number(LOGO_TRIANGLE_WIDTH * scale),
        );
    }

    // 三个定位圆环。
    for angle_deg in FINDER_ANGLES {
        let angle = angle_deg.to_radians();
        let fx = cx + FINDER_DISTANCE * scale * angle.cos();
        let fy = cy + FINDER_DISTANCE * scale * angle.sin();
        let _ = write!(
            svg,
            "<circle cx=\"{}\" cy=\"{}\" r=\"{}\" fill=\"none\" stroke=\"{dark}\" \
             stroke-width=\"{}\"/>",
            svg_number(fx),
            svg_number(fy),
            svg_number(FINDER_RING_RADIUS * scale),
            svg_number(FINDER_RING_WIDTH * scale),
        );
        let _ = write!(
            svg,
            "<circle cx=\"{}\" cy=\"{}\" r=\"{}\" fill=\"{dark}\"/>",
            svg_number(fx),
            svg_number(fy),
            svg_number(FINDER_DOT_RADIUS * scale),
        );
    }

    // 右上角图片槽位：只有传入 badgeImage 时才绘制，未提供时保持空白。
    let badge_center = if options.badge && options.badge_image.is_some() {
        let angle = BADGE_ANGLE.to_radians();
        let radius = options.badge_radius;
        let bx = cx + BADGE_DISTANCE * scale * angle.cos();
        let by = cy + BADGE_DISTANCE * scale * angle.sin();
        if !options.transparent {
            let _ = write!(
                svg,
                "<circle cx=\"{}\" cy=\"{}\" r=\"{}\" fill=\"{light}\"/>",
                svg_number(bx),
                svg_number(by),
                svg_number(radius * scale),
            );
        }
        if embed_badge {
            let uri = badge_data_uri(options.badge_image.as_deref().unwrap_or_default())?;
            let _ = write!(
                svg,
                "<defs><clipPath id=\"dy-badge-clip\"><circle cx=\"{}\" cy=\"{}\" r=\"{}\"/>\
                 </clipPath></defs>",
                svg_number(bx),
                svg_number(by),
                svg_number(radius * scale),
            );
            let _ = write!(
                svg,
                "<image x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" href=\"{uri}\" \
                 preserveAspectRatio=\"xMidYMid slice\" clip-path=\"url(#dy-badge-clip)\"/>",
                svg_number(bx - radius * scale),
                svg_number(by - radius * scale),
                svg_number(radius * 2.0 * scale),
                svg_number(radius * 2.0 * scale),
            );
        }
        Some((bx, by))
    } else {
        None
    };
    svg.push_str("</svg>");

    Ok(SvgOutput { svg, badge_center })
}

/// 把 SVG 光栅化，并合成右上角图片。
fn rasterize(encoded: &EncodedCode, options: &RenderOptions) -> Result<(Vec<u8>, u32), String> {
    let (scale, size) = geometry(options)?;
    validate(options)?;
    let built = build_svg(encoded, options, scale, size, false)?;

    let tree = Tree::from_str(&built.svg, &UsvgOptions::default())
        .map_err(|error| format!("SVG 解析失败：{error}"))?;
    let mut pixmap = Pixmap::new(size, size).ok_or_else(|| "无法创建画布".to_string())?;
    resvg::render(
        &tree,
        resvg::tiny_skia::Transform::default(),
        &mut pixmap.as_mut(),
    );

    if let Some(center_image) = options.center_image.as_ref() {
        let diameter = ((DISK_RADIUS * 2.0 * scale).round() as u32).max(1);
        let image = circular_image(center_image, diameter)?;
        let center = size as f64 / 2.0;
        let left = (center - diameter as f64 / 2.0).round() as i32;
        let top = (center - diameter as f64 / 2.0).round() as i32;
        composite_over(
            pixmap.data_mut(),
            size,
            size,
            &image,
            diameter,
            left,
            top,
        );
    }

    if let (Some((bx, by)), Some(badge_image)) = (built.badge_center, options.badge_image.as_ref()) {
        let badge_size = ((options.badge_radius * 2.0 * scale).round() as u32).max(1);
        let badge = circular_image(badge_image, badge_size)?;
        let left = (bx - badge_size as f64 / 2.0).round() as i32;
        let top = (by - badge_size as f64 / 2.0).round() as i32;
        composite_over(pixmap.data_mut(), size, size, &badge, badge_size, left, top);
    }

    Ok((pixmap.data().to_vec(), size))
}

/// 把图片转成 PNG data URI，用于 SVG 内嵌。
fn badge_data_uri(image: &[u8]) -> Result<String, String> {
    let decoded = image::load_from_memory(image)
        .map_err(|error| format!("badgeImage 无法读取：{error}"))?;
    let mut png = Vec::new();
    decoded
        .write_to(&mut Cursor::new(&mut png), image::ImageFormat::Png)
        .map_err(|error| format!("badgeImage 转码失败：{error}"))?;
    Ok(format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(png)
    ))
}

/// 把 CSS 颜色字符串规范化成 SVG 可以安全使用的形式。
fn color_css(value: &str) -> String {
    let color = parse_color(value);
    if color.a == 255 {
        format!("#{:02x}{:02x}{:02x}", color.r, color.g, color.b)
    } else {
        format!(
            "rgba({},{},{},{})",
            color.r,
            color.g,
            color.b,
            color.a as f64 / 255.0
        )
    }
}

/// 去掉多余的小数位，减小 SVG 体积。
fn svg_number(value: f64) -> String {
    let rounded = (value * 1000.0).round() / 1000.0;
    if rounded == 0.0 {
        return "0".to_string();
    }
    let mut text = format!("{rounded:.3}");
    while text.ends_with('0') {
        text.pop();
    }
    if text.ends_with('.') {
        text.pop();
    }
    text
}

/// 绘制外圈装饰。
fn draw_frame(
    svg: &mut String,
    options: &RenderOptions,
    dark: &str,
    cx: f64,
    cy: f64,
    scale: f64,
) {
    let width = options.frame_width.clamp(FRAME_MIN_WIDTH, FRAME_MAX_WIDTH);
    let outer = FRAME_OUTER_RADIUS;
    let inner = outer - width;
    let mid = outer - width / 2.0;
    let corner = options.frame_radius.min(width / 2.0);
    let count = options.frame_count.clamp(4, 120);

    match options.frame_style.as_str() {
        "ring" => {
            draw_broken_ring(
                svg,
                dark,
                cx,
                cy,
                scale,
                inner,
                outer,
                corner,
                &frame_gaps(options),
            );
        }
        "double" => {
            let band = width * 0.42;
            let gaps = frame_gaps(options);
            draw_broken_ring(svg, dark, cx, cy, scale, outer - band, outer, corner, &gaps);
            draw_broken_ring(svg, dark, cx, cy, scale, inner, inner + band, corner, &gaps);
        }
        "gear" => {
            let band = width * 0.45;
            let gaps = frame_gaps(options);
            draw_broken_ring(svg, dark, cx, cy, scale, inner + band, outer, corner, &gaps);

            let step = 360.0 / count as f64;
            let span = step * 0.36;
            let tooth_mid = inner + band / 2.0;
            for index in 0..count {
                let center = index as f64 * step;
                if frame_conflicts(options, center, span / 2.0) {
                    continue;
                }
                let _ = write!(
                    svg,
                    "<path d=\"{}\" fill=\"{dark}\"/>",
                    module_path(
                        cx,
                        cy,
                        tooth_mid * scale,
                        band * scale,
                        (center - span / 2.0).to_radians(),
                        (center + span / 2.0).to_radians(),
                        corner * scale,
                    ),
                );
            }
        }
        "dots" | "orbit" => {
            let step = 360.0 / count as f64;
            let mut rows = vec![(mid, 0.0)];
            if options.frame_style == "orbit" {
                rows = vec![(mid + width * 0.25, 0.0), (mid - width * 0.25, step / 2.0)];
            }
            let dot_radius = if options.frame_style == "orbit" {
                width * 0.17
            } else {
                width / 2.0 * 0.85
            };
            for (row_radius, offset) in rows {
                let half_deg = (dot_radius / row_radius).asin().to_degrees();
                for index in 0..count {
                    let center = index as f64 * step + offset;
                    if frame_conflicts(options, center, half_deg) {
                        continue;
                    }
                    let angle = center.to_radians();
                    let _ = write!(
                        svg,
                        "<circle cx=\"{}\" cy=\"{}\" r=\"{}\" fill=\"{dark}\"/>",
                        svg_number(cx + row_radius * scale * angle.cos()),
                        svg_number(cy + row_radius * scale * angle.sin()),
                        svg_number(dot_radius * scale),
                    );
                }
            }
        }
        "dashes" | "ticks" | "segments" | "spark" => {
            let step = 360.0 / count as f64;
            for index in 0..count {
                let center = index as f64 * step;
                let span = match options.frame_style.as_str() {
                    "ticks" => step * 0.22,
                    "segments" => step * 0.82,
                    "spark" => {
                        if index % 2 == 0 {
                            step * 0.62
                        } else {
                            step * 0.26
                        }
                    }
                    _ => step * 0.55,
                };
                if frame_conflicts(options, center, span / 2.0) {
                    continue;
                }
                let _ = write!(
                    svg,
                    "<path d=\"{}\" fill=\"{dark}\"/>",
                    module_path(
                        cx,
                        cy,
                        mid * scale,
                        width * scale,
                        (center - span / 2.0).to_radians(),
                        (center + span / 2.0).to_radians(),
                        corner * scale,
                    ),
                );
            }
        }
        _ => {
            let span = options.frame_span.clamp(4.0, 120.0);
            for center in [0.0, 90.0, 180.0, 270.0] {
                let _ = write!(
                    svg,
                    "<path d=\"{}\" fill=\"{dark}\"/>",
                    module_path(
                        cx,
                        cy,
                        mid * scale,
                        width * scale,
                        (center - span / 2.0).to_radians(),
                        (center + span / 2.0).to_radians(),
                        corner * scale,
                    ),
                );
            }
        }
    }
}

/// 定位圆环在圆周上占用的半角（度），额外留 1° 间距。
fn finder_gap_half() -> f64 {
    ((FINDER_RING_RADIUS + FINDER_RING_WIDTH / 2.0) / FINDER_DISTANCE)
        .asin()
        .to_degrees()
        + 1.0
}

/// 右上角图片在圆周上占用的半角（度），额外留 1° 间距。
fn badge_gap_half(options: &RenderOptions) -> f64 {
    ((options.badge_radius + 1.0) / BADGE_DISTANCE)
        .asin()
        .to_degrees()
        + 1.0
}

/// 定位圆环与右上角图片在圆周上占用的角度区间（度），用于给圆环留出缺口。
fn frame_gaps(options: &RenderOptions) -> Vec<(f64, f64)> {
    let finder_half = finder_gap_half();
    let badge_half = badge_gap_half(options);

    let mut raw = Vec::with_capacity(4);
    for angle in FINDER_ANGLES {
        raw.push((angle - finder_half, angle + finder_half));
    }
    raw.push((BADGE_ANGLE - badge_half, BADGE_ANGLE + badge_half));

    let mut gaps = Vec::with_capacity(5);
    for (start, end) in raw {
        let start = start.rem_euclid(360.0);
        let end = end.rem_euclid(360.0);
        if end > start {
            gaps.push((start, end));
        } else {
            gaps.push((start, 360.0));
            gaps.push((0.0, end));
        }
    }
    gaps.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
    gaps
}

/// 绘制带缺口的圆环；缺口角度由 `gaps` 给出，端点可以倒圆。
#[allow(clippy::too_many_arguments)]
fn draw_broken_ring(
    svg: &mut String,
    dark: &str,
    cx: f64,
    cy: f64,
    scale: f64,
    inner: f64,
    outer: f64,
    corner: f64,
    gaps: &[(f64, f64)],
) {
    let mid = (inner + outer) / 2.0;
    let thickness = outer - inner;
    let count = gaps.len();

    for index in 0..count {
        let start = gaps[index].1;
        let mut end = if index + 1 < count {
            gaps[index + 1].0
        } else {
            gaps[0].0 + 360.0
        };
        if end <= start {
            end += 360.0;
        }
        if end - start < 0.01 {
            continue;
        }
        let _ = write!(
            svg,
            "<path d=\"{}\" fill=\"{dark}\"/>",
            module_path(
                cx,
                cy,
                mid * scale,
                thickness * scale,
                start.to_radians(),
                end.to_radians(),
                corner * scale,
            ),
        );
    }
}

/// 判断外圈分段是否与定位圆环或右上角图片重叠。
fn frame_conflicts(options: &RenderOptions, center_deg: f64, half_span_deg: f64) -> bool {
    let distance = |target: f64| {
        let diff = (center_deg - target).rem_euclid(360.0);
        diff.min(360.0 - diff)
    };
    let finder_half = finder_gap_half();
    let badge_half = badge_gap_half(options);
    FINDER_ANGLES
        .iter()
        .any(|&angle| distance(angle) < finder_half + half_span_deg)
        || distance(BADGE_ANGLE) < badge_half + half_span_deg
}

/// 生成一段沿圆周弯曲的模块路径。
///
/// 内外两条同心圆弧构成环形扇区，四个角用二次曲线倒圆。
/// 这样长条模块的每一点都围绕码心，不会像直边矩形那样变成弦。
#[allow(clippy::too_many_arguments)]
fn module_path(
    cx: f64,
    cy: f64,
    radius: f64,
    thickness: f64,
    start_angle: f64,
    end_angle: f64,
    corner_radius: f64,
) -> String {
    let span = end_angle - start_angle;
    if span <= 0.0 {
        return String::new();
    }
    let outer = radius + thickness / 2.0;
    let inner = radius - thickness / 2.0;
    let point = |r: f64, angle: f64| (cx + r * angle.cos(), cy + r * angle.sin());

    // 圆角不能超过径向厚度的一半，也不能吃掉整段圆弧。
    let max_corner = (thickness / 2.0).min(span / (1.0 / outer + 1.0 / inner) * 0.9);
    let corner = corner_radius.clamp(0.0, max_corner);

    if corner <= 1e-6 {
        let (ox1, oy1) = point(outer, start_angle);
        let (ox2, oy2) = point(outer, end_angle);
        let (ix1, iy1) = point(inner, start_angle);
        let (ix2, iy2) = point(inner, end_angle);
        let large_arc = if span > std::f64::consts::PI { 1 } else { 0 };
        return format!(
            "M {} {} A {} {} 0 {large_arc} 1 {} {} L {} {} A {} {} 0 {large_arc} 0 {} {} Z",
            svg_number(ox1),
            svg_number(oy1),
            svg_number(outer),
            svg_number(outer),
            svg_number(ox2),
            svg_number(oy2),
            svg_number(ix2),
            svg_number(iy2),
            svg_number(inner),
            svg_number(inner),
            svg_number(ix1),
            svg_number(iy1),
        );
    }

    let outer_corner_angle = corner / outer;
    let inner_corner_angle = corner / inner;
    let outer_arc_span = span - 2.0 * outer_corner_angle;
    let inner_arc_span = span - 2.0 * inner_corner_angle;
    let outer_large_arc = if outer_arc_span > std::f64::consts::PI {
        1
    } else {
        0
    };
    let inner_large_arc = if inner_arc_span > std::f64::consts::PI {
        1
    } else {
        0
    };

    let (oasx, oasy) = point(outer, start_angle + outer_corner_angle);
    let (oaex, oaey) = point(outer, end_angle - outer_corner_angle);
    let (octx, octy) = point(outer, end_angle);
    let (oradx, orady) = point(outer - corner, end_angle);
    let (iradx, irady) = point(inner + corner, end_angle);
    let (ictx, icty) = point(inner, end_angle);
    let (iaex, iaey) = point(inner, end_angle - inner_corner_angle);
    let (iasx, iasy) = point(inner, start_angle + inner_corner_angle);
    let (ict2x, ict2y) = point(inner, start_angle);
    let (irad2x, irad2y) = point(inner + corner, start_angle);
    let (orad2x, orad2y) = point(outer - corner, start_angle);
    let (octx2, octy2) = point(outer, start_angle);

    format!(
        "M {} {} A {} {} 0 {outer_large_arc} 1 {} {} Q {} {} {} {} L {} {} Q {} {} {} {} \
         A {} {} 0 {inner_large_arc} 0 {} {} Q {} {} {} {} L {} {} Q {} {} {} {} Z",
        svg_number(oasx),
        svg_number(oasy),
        svg_number(outer),
        svg_number(outer),
        svg_number(oaex),
        svg_number(oaey),
        svg_number(octx),
        svg_number(octy),
        svg_number(oradx),
        svg_number(orady),
        svg_number(iradx),
        svg_number(irady),
        svg_number(ictx),
        svg_number(icty),
        svg_number(iaex),
        svg_number(iaey),
        svg_number(inner),
        svg_number(inner),
        svg_number(iasx),
        svg_number(iasy),
        svg_number(ict2x),
        svg_number(ict2y),
        svg_number(irad2x),
        svg_number(irad2y),
        svg_number(orad2x),
        svg_number(orad2y),
        svg_number(octx2),
        svg_number(octy2),
        svg_number(oasx),
        svg_number(oasy),
    )
}

/// 把图片按 cover 方式居中裁剪、缩放并裁成圆形，返回预乘 alpha 的 RGBA。
fn circular_image(image: &[u8], diameter: u32) -> Result<Vec<u8>, String> {
    let decoded = image::load_from_memory(image)
        .map_err(|error| format!("badgeImage 无法读取：{error}"))?
        .to_rgba8();
    let (width, height) = decoded.dimensions();
    let side = width.min(height).max(1);
    let left = (width - side) / 2;
    let top = (height - side) / 2;
    let cropped = image::imageops::crop_imm(&decoded, left, top, side, side).to_image();
    let resized = image::imageops::resize(
        &cropped,
        diameter,
        diameter,
        image::imageops::FilterType::Lanczos3,
    );

    let radius = diameter as f64 / 2.0;
    let mut out = vec![0u8; (diameter * diameter * 4) as usize];
    for y in 0..diameter {
        for x in 0..diameter {
            let dx = x as f64 + 0.5 - radius;
            let dy = y as f64 + 0.5 - radius;
            let distance = (dx * dx + dy * dy).sqrt();
            if distance >= radius {
                continue;
            }
            // 边缘一像素宽的抗锯齿。
            let coverage = (radius - distance + 0.5).clamp(0.0, 1.0);
            let pixel = resized.get_pixel(x, y);
            let alpha = pixel[3] as f64 / 255.0 * coverage;
            if alpha <= 0.0 {
                continue;
            }
            let index = ((y * diameter + x) * 4) as usize;
            out[index] = (pixel[0] as f64 * alpha).round() as u8;
            out[index + 1] = (pixel[1] as f64 * alpha).round() as u8;
            out[index + 2] = (pixel[2] as f64 * alpha).round() as u8;
            out[index + 3] = (alpha * 255.0).round() as u8;
        }
    }
    Ok(out)
}

/// 把预乘 alpha 的覆盖层合成到画布上（source-over）。
fn composite_over(
    base: &mut [u8],
    width: u32,
    height: u32,
    overlay: &[u8],
    overlay_size: u32,
    left: i32,
    top: i32,
) {
    for y in 0..overlay_size {
        let destination_y = top + y as i32;
        if destination_y < 0 || destination_y >= height as i32 {
            continue;
        }
        for x in 0..overlay_size {
            let destination_x = left + x as i32;
            if destination_x < 0 || destination_x >= width as i32 {
                continue;
            }
            let source_index = ((y * overlay_size + x) * 4) as usize;
            let alpha = overlay[source_index + 3] as u32;
            if alpha == 0 {
                continue;
            }
            let destination_index =
                ((destination_y as u32 * width + destination_x as u32) * 4) as usize;
            let inverse = 255 - alpha;
            for channel in 0..3 {
                base[destination_index + channel] = (overlay[source_index + channel] as u32
                    + base[destination_index + channel] as u32 * inverse / 255)
                    .min(255) as u8;
            }
            base[destination_index + 3] =
                (alpha + base[destination_index + 3] as u32 * inverse / 255).min(255) as u8;
        }
    }
}

/// 把预乘 alpha 转成非预乘 alpha。
fn straighten_rgba(data: &[u8]) -> Vec<u8> {
    let mut straight = data.to_vec();
    for pixel in straight.chunks_exact_mut(4) {
        let alpha = pixel[3];
        if alpha > 0 && alpha < 255 {
            let inverse = 255.0 / alpha as f64;
            for channel in &mut pixel[..3] {
                *channel = (*channel as f64 * inverse).round().min(255.0) as u8;
            }
        }
    }
    straight
}

/// 把 RGBA 像素写成 PNG（PNG 使用非预乘 alpha）。
fn encode_png(data: &[u8], width: u32, height: u32) -> Result<Vec<u8>, String> {
    use image::codecs::png::PngEncoder;
    use image::{ColorType, ImageEncoder};

    let straight = straighten_rgba(data);
    let mut out = Vec::new();
    PngEncoder::new(&mut out)
        .write_image(&straight, width, height, ColorType::Rgba8.into())
        .map_err(|error| format!("PNG 编码失败：{error}"))?;
    Ok(out)
}

/// 把 RGBA 像素写成无损 WebP。
fn encode_webp(data: &[u8], width: u32, height: u32) -> Result<Vec<u8>, String> {
    use image::codecs::webp::WebPEncoder;
    use image::{ColorType, ImageEncoder};

    let straight = straighten_rgba(data);
    let mut out = Vec::new();
    WebPEncoder::new_lossless(&mut out)
        .write_image(&straight, width, height, ColorType::Rgba8.into())
        .map_err(|error| format!("WebP 编码失败：{error}"))?;
    Ok(out)
}

/// 把 RGBA 像素写成 JPEG。透明区域填充白色。
fn encode_jpeg(data: &[u8], width: u32, height: u32) -> Result<Vec<u8>, String> {
    use image::codecs::jpeg::JpegEncoder;
    use image::{ColorType, ImageEncoder};

    let straight = straighten_rgba(data);
    let mut rgb = Vec::with_capacity((width * height * 3) as usize);
    for pixel in straight.chunks_exact(4) {
        let alpha = pixel[3] as f64 / 255.0;
        for channel in &pixel[..3] {
            rgb.push((*channel as f64 * alpha + 255.0 * (1.0 - alpha)).round() as u8);
        }
    }

    let mut out = Vec::new();
    JpegEncoder::new_with_quality(&mut out, 90)
        .write_image(&rgb, width, height, ColorType::Rgb8.into())
        .map_err(|error| format!("JPEG 编码失败：{error}"))?;
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dy::encoder::{encode_text, EncodeOptions};

    fn render(text: &str, options: RenderOptions) -> Pixmap {
        let encoded = encode_text(text, EncodeOptions::default()).expect("encodable");
        let png = render_png(&encoded, &options).expect("renderable");
        let image = image::load_from_memory(&png).expect("valid png").to_rgba8();
        let mut pixmap = Pixmap::new(image.width(), image.height()).expect("pixmap");
        pixmap.data_mut().copy_from_slice(image.as_raw());
        pixmap
    }

    fn is_dark(pixel: &[u8]) -> bool {
        pixel[0] < 100 && pixel[1] < 100 && pixel[2] < 100
    }

    fn red_png() -> Vec<u8> {
        use image::codecs::png::PngEncoder;
        use image::{ColorType, ImageEncoder};
        let mut out = Vec::new();
        PngEncoder::new(&mut out)
            .write_image(&[255, 0, 0, 255], 1, 1, ColorType::Rgba8.into())
            .expect("encode");
        out
    }

    fn white_png() -> Vec<u8> {
        use image::codecs::png::PngEncoder;
        use image::{ColorType, ImageEncoder};
        let mut out = Vec::new();
        PngEncoder::new(&mut out)
            .write_image(&[255, 255, 255, 255], 1, 1, ColorType::Rgba8.into())
            .expect("encode");
        out
    }

    #[test]
    fn renders_default_square_png() {
        let options = RenderOptions::default();
        let encoded = encode_text("hello", EncodeOptions::default()).expect("encodable");
        let png = render_png(&encoded, &options).expect("renderable");
        let image = image::load_from_memory(&png).expect("valid png");
        let expected = (2.0 * (FRAME_OUTER_RADIUS * DEFAULT_SCALE + DEFAULT_MARGIN as f64)).ceil();
        assert_eq!(image.width(), expected as u32);
        assert_eq!(image.width(), image.height());
    }

    #[test]
    fn center_disk_is_dark() {
        let pixmap = render("hello", RenderOptions::default());
        let center = pixmap.width() / 2;
        let pixel = pixmap.pixel(center, center).expect("pixel");
        assert!(is_dark(&[
            pixel.red(),
            pixel.green(),
            pixel.blue(),
            pixel.alpha()
        ]));
    }

    #[test]
    fn finder_rings_are_drawn() {
        let pixmap = render("hello", RenderOptions::default());
        let scale = DEFAULT_SCALE;
        let center = pixmap.width() as f64 / 2.0;
        for angle_deg in FINDER_ANGLES {
            let angle = angle_deg.to_radians();
            let x = (center + FINDER_DISTANCE * scale * angle.cos()).round() as u32;
            let y = (center + FINDER_DISTANCE * scale * angle.sin()).round() as u32;
            let pixel = pixmap.pixel(x, y).expect("pixel");
            assert!(
                is_dark(&[pixel.red(), pixel.green(), pixel.blue(), pixel.alpha()]),
                "finder dot at {angle_deg}° should be dark"
            );
        }
    }

    #[test]
    fn square_style_renders() {
        let options = RenderOptions {
            module_style: "square".to_string(),
            ..RenderOptions::default()
        };
        let encoded = encode_text("hello", EncodeOptions::default()).expect("encodable");
        assert!(render_png(&encoded, &options).is_ok());
    }

    #[test]
    fn rejects_invalid_module_style() {
        let options = RenderOptions {
            module_style: "triangle".to_string(),
            ..RenderOptions::default()
        };
        let encoded = encode_text("hello", EncodeOptions::default()).expect("encodable");
        assert!(render_png(&encoded, &options).is_err());
    }

    #[test]
    fn rejects_too_small_size() {
        let options = RenderOptions {
            size: Some(20),
            ..RenderOptions::default()
        };
        let encoded = encode_text("hello", EncodeOptions::default()).expect("encodable");
        assert!(render_png(&encoded, &options).is_err());
    }

    #[test]
    fn badge_image_is_drawn_when_provided() {
        let options = RenderOptions {
            badge_image: Some(red_png()),
            ..RenderOptions::default()
        };
        let pixmap = render("hello", options);
        let scale = DEFAULT_SCALE;
        let center = pixmap.width() as f64 / 2.0;
        let angle = BADGE_ANGLE.to_radians();
        let x = (center + BADGE_DISTANCE * scale * angle.cos()).round() as u32;
        let y = (center + BADGE_DISTANCE * scale * angle.sin()).round() as u32;
        let pixel = pixmap.pixel(x, y).expect("pixel");
        assert!(pixel.red() > 200 && pixel.green() < 60 && pixel.blue() < 60);
    }

    #[test]
    fn transparent_background_keeps_alpha() {
        let options = RenderOptions {
            transparent: true,
            ..RenderOptions::default()
        };
        let encoded = encode_text("hello", EncodeOptions::default()).expect("encodable");
        let png = render_png(&encoded, &options).expect("renderable");
        let image = image::load_from_memory(&png).expect("valid png").to_rgba8();
        assert_eq!(image.get_pixel(0, 0)[3], 0, "corner should be transparent");
        assert!(
            image.get_pixel(image.width() / 2, image.height() / 2)[3] > 0,
            "center disk should be opaque"
        );
    }

    #[test]
    fn renders_webp_and_jpeg() {
        let encoded = encode_text("hello", EncodeOptions::default()).expect("encodable");
        let webp = render_webp(&encoded, &RenderOptions::default()).expect("webp");
        let jpeg = render_jpeg(&encoded, &RenderOptions::default()).expect("jpeg");
        assert_eq!(
            image::guess_format(&webp).expect("webp format"),
            image::ImageFormat::WebP
        );
        assert_eq!(
            image::guess_format(&jpeg).expect("jpeg format"),
            image::ImageFormat::Jpeg
        );
    }

    #[test]
    fn svg_contains_background_and_embedded_badge() {
        let encoded = encode_text("hello", EncodeOptions::default()).expect("encodable");
        let svg = render_svg(&encoded, &RenderOptions::default()).expect("svg");
        assert!(svg.contains("<rect"), "default SVG should paint a background");

        let transparent = render_svg(
            &encoded,
            &RenderOptions {
                transparent: true,
                ..RenderOptions::default()
            },
        )
        .expect("svg");
        assert!(
            !transparent.contains("<rect"),
            "transparent SVG should omit the background"
        );

        let with_badge = render_svg(
            &encoded,
            &RenderOptions {
                badge_image: Some(red_png()),
                ..RenderOptions::default()
            },
        )
        .expect("svg");
        assert!(with_badge.contains("<image"), "badge should be embedded");
        assert!(with_badge.contains("data:image/png;base64,"));
    }

    #[test]
    fn all_frame_styles_render_and_decode() {
        let text = "https://bing.com";
        let encoded = encode_text(text, EncodeOptions::default()).expect("encodable");
        for style in [
            "arcs", "ring", "dashes", "dots", "ticks", "double", "segments", "spark", "orbit",
            "gear",
        ] {
            let options = RenderOptions {
                frame_style: style.to_string(),
                frame_radius: 3.0,
                ..RenderOptions::default()
            };
            let png = render_png(&encoded, &options).expect(style);
            let gray = image::load_from_memory(&png).expect("valid png").to_luma8();
            let decoded = crate::dy::decode_gray_detailed(&gray).expect("decodable");
            assert_eq!(decoded.text, text, "{style} should stay decodable");
        }
    }

    #[test]
    fn frame_corner_radius_rounds_arc_ends() {
        let encoded = encode_text("hello", EncodeOptions::default()).expect("encodable");
        let base = RenderOptions {
            module_style: "square".to_string(),
            ..RenderOptions::default()
        };
        let sharp = render_svg(&encoded, &base).expect("svg");
        assert!(!sharp.contains("Q"), "square frame should have square ends");

        let rounded = render_svg(
            &encoded,
            &RenderOptions {
                frame_radius: 4.0,
                ..base
            },
        )
        .expect("svg");
        assert!(
            rounded.contains("Q"),
            "rounded frame should use quadratic corners"
        );
    }

    #[test]
    fn ring_frame_breaks_at_finders_and_badge() {
        let pixmap = render(
            "hello",
            RenderOptions {
                frame_style: "ring".to_string(),
                ..RenderOptions::default()
            },
        );
        let scale = DEFAULT_SCALE;
        let center = pixmap.width() as f64 / 2.0;

        for angle_deg in [45.0_f64, 135.0, 225.0, 315.0] {
            let angle = angle_deg.to_radians();
            let radius = 106.0 * scale;
            let x = (center + radius * angle.cos()).round() as u32;
            let y = (center + radius * angle.sin()).round() as u32;
            let pixel = pixmap.pixel(x, y).expect("pixel");
            assert!(
                !is_dark(&[pixel.red(), pixel.green(), pixel.blue(), pixel.alpha()]),
                "ring should be broken at {angle_deg}°"
            );
        }

        let x = (center + 106.0 * scale).round() as u32;
        let y = center.round() as u32;
        let pixel = pixmap.pixel(x, y).expect("pixel");
        assert!(
            is_dark(&[pixel.red(), pixel.green(), pixel.blue(), pixel.alpha()]),
            "ring should stay solid at 0°"
        );
    }

    #[test]
    fn center_image_covers_disk_and_still_decodes() {
        let text = "https://bing.com";
        let options = RenderOptions {
            center_image: Some(white_png()),
            ..RenderOptions::default()
        };
        let pixmap = render(text, options.clone());
        let center = pixmap.width() / 2;
        let pixel = pixmap.pixel(center, center).expect("pixel");
        assert!(
            pixel.red() > 240 && pixel.green() > 240 && pixel.blue() > 240,
            "center image should cover the dark disk"
        );

        let encoded = encode_text(text, EncodeOptions::default()).expect("encodable");
        let png = render_png(&encoded, &options).expect("renderable");
        let gray = image::load_from_memory(&png).expect("valid png").to_luma8();
        let decoded = crate::dy::decode_gray_detailed(&gray).expect("decodable");
        assert_eq!(decoded.text, text);
    }

    #[test]
    fn rejects_invalid_frame_style() {
        let encoded = encode_text("hello", EncodeOptions::default()).expect("encodable");
        let options = RenderOptions {
            frame_style: "spiral".to_string(),
            ..RenderOptions::default()
        };
        assert!(render_png(&encoded, &options).is_err());
    }

    #[test]
    fn generated_code_decodes_back() {
        let text = "https://bing.com";
        let encoded = encode_text(text, EncodeOptions::default()).expect("encodable");
        let png = render_png(&encoded, &RenderOptions::default()).expect("renderable");
        let gray = image::load_from_memory(&png).expect("valid png").to_luma8();
        let decoded = crate::dy::decode_gray_detailed(&gray).expect("decodable");
        assert_eq!(decoded.text, text);
    }

    #[test]
    fn custom_style_still_decodes() {
        let text = "https://bing.com";
        let options = RenderOptions {
            size: Some(400),
            dark_color: "#1f3a5f".to_string(),
            light_color: "#f7f2e8".to_string(),
            module_style: "square".to_string(),
            frame: false,
            logo: false,
            ..RenderOptions::default()
        };
        let encoded = encode_text(text, EncodeOptions::default()).expect("encodable");
        let png = render_png(&encoded, &options).expect("renderable");
        let gray = image::load_from_memory(&png).expect("valid png").to_luma8();
        let decoded = crate::dy::decode_gray_detailed(&gray).expect("decodable");
        assert_eq!(decoded.text, text);
    }
}
