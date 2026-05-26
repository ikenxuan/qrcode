use qr_code_styling::{
    config::{BackgroundOptions, Color, CornersSquareOptions, CornersDotOptions, DotsOptions, Gradient, ImageOptions},
    types::{CornerDotType, CornerSquareType, DotType},
    OutputFormat, QRCodeStyling, ShapeType,
};
use serde::Deserialize;
use wasm_bindgen::prelude::*;

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

fn parse_color(hex: &str) -> Color {
    Color::from_hex(hex).unwrap_or(Color::rgb(0, 0, 0))
}

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

fn build_qr(opts: QRCodeOpts) -> Result<QRCodeStyling, String> {
    let mut builder = QRCodeStyling::builder();
    builder = builder.data(&opts.data);
    builder = builder.size(opts.size.unwrap_or(300));

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
        builder = builder.image(img.clone());
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

#[wasm_bindgen]
pub fn generate(options: JsValue, format: &str) -> Result<Vec<u8>, JsError> {
    let opts: QRCodeOpts =
        serde_wasm_bindgen::from_value(options).map_err(|e| JsError::new(&e.to_string()))?;

    let needs_transparent_raster = opts
        .background_options
        .as_ref()
        .map(|bg| bg.transparent == Some(true))
        .unwrap_or(false)
        && matches!(format, "png" | "webp");

    let qr = build_qr(opts).map_err(|e| JsError::new(&e))?;

    if needs_transparent_raster {
        let svg = qr.render_svg().map_err(|e| JsError::new(&format!("{e}")))?;
        render_svg_transparent(&svg, format)
    } else {
        let output_format = match format {
            "png" => OutputFormat::Png,
            "jpeg" => OutputFormat::Jpeg,
            "webp" => OutputFormat::WebP,
            _ => OutputFormat::Svg,
        };
        qr.render(output_format).map_err(|e| JsError::new(&format!("{e}")))
    }
}

fn render_svg_transparent(svg: &str, format: &str) -> Result<Vec<u8>, JsError> {
    use image::codecs::png::PngEncoder;
    use image::codecs::webp::WebPEncoder;
    use image::{ColorType, ImageEncoder};
    use resvg::tiny_skia::Pixmap;
    use resvg::usvg::{Options, Tree};

    let tree = Tree::from_str(svg, &Options::default())
        .map_err(|e| JsError::new(&format!("SVG parse error: {e}")))?;

    let size = tree.size();
    let width = size.width() as u32;
    let height = size.height() as u32;

    let mut pixmap = Pixmap::new(width, height)
        .ok_or_else(|| JsError::new("Failed to create pixmap"))?;

    // 不填充白色背景，pixmap 默认是全透明 (RGBA 0,0,0,0)
    resvg::render(&tree, resvg::tiny_skia::Transform::default(), &mut pixmap.as_mut());

    let data = pixmap.data();
    let mut buf = Vec::new();

    match format {
        "webp" => {
            WebPEncoder::new_lossless(&mut buf)
                .write_image(data, width, height, ColorType::Rgba8.into())
                .map_err(|e| JsError::new(&format!("WebP encode error: {e}")))?;
        }
        _ => {
            PngEncoder::new(&mut buf)
                .write_image(data, width, height, ColorType::Rgba8.into())
                .map_err(|e| JsError::new(&format!("PNG encode error: {e}")))?;
        }
    }

    Ok(buf)
}

#[wasm_bindgen(js_name = "generateSvg")]
pub fn generate_svg(options: JsValue) -> Result<String, JsError> {
    let opts: QRCodeOpts =
        serde_wasm_bindgen::from_value(options).map_err(|e| JsError::new(&e.to_string()))?;

    let qr = build_qr(opts).map_err(|e| JsError::new(&e))?;
    qr.render_svg().map_err(|e| JsError::new(&format!("{e}")))
}
