//! QR 码扫描模块
//!
//! 从图片二进制数据中检测并解码 QR 码。
//! 支持 PNG、JPEG、WebP 格式，内部使用多区域分块扫描与多种图像预处理策略
//! 来提高在复杂场景（暗色背景、低对比度、小尺寸二维码等）下的识别率。

use image::{DynamicImage, GrayImage, Luma};
use rxing::{
    common::HybridBinarizer, BinaryBitmap, DecodeHints,
    Luma8LuminanceSource, Point, Reader,
};
use rxing::qrcode::QRCodeReader;
use serde::Serialize;

/// 图片坐标系中的一个定位点。
#[derive(Serialize, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub struct ScanPoint {
    pub x: f32,
    pub y: f32,
}

/// 抖音码等圆形码的位置。
#[derive(Serialize, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub struct ScanCircle {
    pub cx: f32,
    pub cy: f32,
    pub r: f32,
}

/// 一次成功扫描的结果，包含文本和原图坐标下的位置。
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanOutcome {
    pub text: String,
    pub width: u32,
    pub height: u32,
    /// 定位点（原图坐标）。标准二维码是三个定位图案中心，可能附带对齐图案
    /// 中心；抖音码作品分享码是中心圆盘圆心，名片码是三个圆形定位标记中心。
    pub points: Vec<ScanPoint>,
    /// 抖音码的圆形范围；标准二维码为空。
    pub circle: Option<ScanCircle>,
}

/// 内部解码结果，位置信息可能来自 rxing 定位点或抖音码检测器。
struct LocatedText {
    text: String,
    points: Vec<ScanPoint>,
    circle: Option<ScanCircle>,
}

impl LocatedText {
    fn from_points(text: String, points: &[Point]) -> Self {
        Self {
            text,
            points: points
                .iter()
                .map(|point| ScanPoint { x: point.x, y: point.y })
                .collect(),
            circle: None,
        }
    }

    fn offset(&mut self, dx: u32, dy: u32) {
        for point in &mut self.points {
            point.x += dx as f32;
            point.y += dy as f32;
        }
        if let Some(circle) = &mut self.circle {
            circle.cx += dx as f32;
            circle.cy += dy as f32;
        }
    }
}

/// 扫描图片中的 QR 码，返回文本与位置信息
///
/// # Arguments
/// * `image_bytes` - 图片文件的原始字节（PNG/JPEG/WebP）
///
/// # Returns
/// 解码成功返回文本、图片尺寸和原图坐标下的位置，否则返回 None
pub fn scan_qr_detailed(image_bytes: &[u8]) -> Option<ScanOutcome> {
    let img = image::load_from_memory(image_bytes).ok()?;
    let gray = to_gray_with_white_bg(&img);
    let (width, height) = gray.dimensions();
    let found = scan_gray_detailed(&gray)?;

    Some(ScanOutcome {
        text: found.text,
        width,
        height,
        points: found.points,
        circle: found.circle,
    })
}

/// 扫描图片中的 QR 码
///
/// # Arguments
/// * `image_bytes` - 图片文件的原始字节（PNG/JPEG/WebP）
///
/// # Returns
/// 解码成功返回 QR 码文本内容，否则返回 None
pub fn scan_qr(image_bytes: &[u8]) -> Option<String> {
    scan_qr_detailed(image_bytes).map(|outcome| outcome.text)
}

fn scan_gray_detailed(gray: &GrayImage) -> Option<LocatedText> {
    let (width, height) = gray.dimensions();

    // 优先尝试直接解码全图
    if let Some(r) = try_decode(gray) { return Some(r); }
    // 常规检测器失败时，改按「整图即条码」再试一次
    if let Some(r) = try_decode_pure(gray) { return Some(r); }
    // 抖音码没有标准 QR 的定位图案，走独立的环采样解码
    if let Some(r) = crate::dy::decode_gray_detailed(gray) {
        return Some(LocatedText {
            text: r.text,
            points: r
                .points
                .iter()
                .map(|&(x, y)| ScanPoint {
                    x: x as f32,
                    y: y as f32,
                })
                .collect(),
            circle: Some(ScanCircle {
                cx: r.center.0 as f32,
                cy: r.center.1 as f32,
                r: r.radius as f32,
            }),
        });
    }
    // 全图多策略预处理后重试
    if let Some(r) = try_all_strategies(gray) { return Some(r); }
    // 大图启用分块扫描，逐区域检测
    if width > 1024 || height > 1024 {
        return scan_regions(gray, width, height);
    }
    None
}

/// 将图片转为灰度，透明像素合成到白色背景上
///
/// 直接 `to_luma8()` 会忽略 alpha 通道，导致透明像素变为黑色，
/// 与黑色 QR 码点阵无法区分。此函数先做 alpha compositing 再转灰度。
pub(crate) fn to_gray_with_white_bg(img: &DynamicImage) -> GrayImage {
    let rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();
    GrayImage::from_fn(w, h, |x, y| {
        let p = rgba.get_pixel(x, y);
        let a = p[3] as f64 / 255.0;
        // src * alpha + white * (1 - alpha)
        let r = p[0] as f64 * a + 255.0 * (1.0 - a);
        let g = p[1] as f64 * a + 255.0 * (1.0 - a);
        let b = p[2] as f64 * a + 255.0 * (1.0 - a);
        Luma([(0.299 * r + 0.587 * g + 0.114 * b) as u8])
    })
}
/// 使用 rxing QRCodeReader 尝试解码灰度图中的 QR 码
///
/// 启用 TryHarder 模式，会花更多时间寻找 QR 码，提高检测率。
///
/// 字符集：Byte 分段不带 ECI 时，规范没有约定编码，rxing 会退回 ZXing 的启发式
/// 猜测（ISO-8859-1 / UTF-8 / Shift_JIS 三选一）。本库生成的一律是 UTF-8，所以
/// 固定按 UTF-8 解；只有解出替换字符（说明内容确实不是 UTF-8）才退回启发式，
/// 兼顾按老编码生成的存量二维码。
fn try_decode(gray: &GrayImage) -> Option<LocatedText> {
    match decode_with(gray, Some("UTF-8"), false) {
        Some(text) if text.text.contains('\u{FFFD}') => decode_with(gray, None, false),
        other => other,
    }
}

/// 按「整图即条码」的假设再试一次
///
/// rxing 的常规检测器在部分「符号 × 缩放」组合上会推出错误的采样网格，直接以
/// NotFoundException 失败 —— 但二维码本身是完好的：同样的符号换个尺寸就能过，
/// jsQR 等其它解码器也能正常读出。PURE_BARCODE 让检测器跳过透视校正、直接按
/// 定位图案推算模块网格，正好治这一类。
///
/// 它假定二维码铺满整图，所以只能作为兜底，不能取代常规路径。
fn try_decode_pure(gray: &GrayImage) -> Option<LocatedText> {
    match decode_with(gray, Some("UTF-8"), true) {
        Some(text) if text.text.contains('\u{FFFD}') => decode_with(gray, None, true),
        other => other,
    }
}

/// 解码一次；`charset` 为 None 时交给 rxing 的启发式猜测，
/// `pure` 为 true 时启用 PURE_BARCODE 路径
fn decode_with(gray: &GrayImage, charset: Option<&str>, pure: bool) -> Option<LocatedText> {
    let (w, h) = gray.dimensions();
    let data = gray.as_raw().clone();
    let source = Luma8LuminanceSource::new(data, w, h).ok()?;
    let mut bitmap = BinaryBitmap::new(HybridBinarizer::new(source));
    let mut hints = DecodeHints::default();
    hints.TryHarder = Some(true);
    hints.PureBarcode = Some(pure);
    if let Some(name) = charset {
        hints.CharacterSet = Some(name.to_string());
    }
    let mut reader = QRCodeReader;
    match reader.decode_with_hints(&mut bitmap, &hints) {
        Ok(result) => {
            let text = result.getText().to_string();
            if text.is_empty() {
                None
            } else {
                Some(LocatedText::from_points(text, result.getPoints()))
            }
        }
        Err(_) => None,
    }
}

/// 依次尝试多种图像预处理策略后解码
///
/// 当直接解码失败时，通过不同的预处理手段增强图像特征：
/// - 二值化：使用 Otsu 自动阈值将灰度图转为黑白，消除中间灰度干扰
/// - 锐化：增强边缘，使 QR 码轮廓更清晰
/// - 对比度增强：直方图均衡化，改善低对比度图像
/// - 组合策略：增强+二值化、锐化+二值化
/// - 反色：处理白色 QR 码在深色背景上的情况
/// - 二值化+反色：综合处理
fn try_all_strategies(gray: &GrayImage) -> Option<LocatedText> {
    let bin = binarize_otsu(gray);
    if let Some(r) = try_decode(&bin) { return Some(r); }
    let sharp = sharpen(gray);
    if let Some(r) = try_decode(&sharp) { return Some(r); }
    let contrast = enhance_contrast(gray);
    if let Some(r) = try_decode(&contrast) { return Some(r); }
    let con_bin = binarize_otsu(&contrast);
    if let Some(r) = try_decode(&con_bin) { return Some(r); }
    let sharp_bin = binarize_otsu(&sharp);
    if let Some(r) = try_decode(&sharp_bin) { return Some(r); }
    let inv = invert(gray);
    if let Some(r) = try_decode(&inv) { return Some(r); }
    let bin_inv = invert(&bin);
    if let Some(r) = try_decode(&bin_inv) { return Some(r); }
    None
}

/// 多区域分块扫描
///
/// 对大图进行分块，在每个区域内独立执行完整的检测流程。
/// 区域覆盖四角、边缘中点和中心，使用小/中/大三种块尺寸，
/// 确保不同位置和大小的 QR 码都能被检测到。
fn scan_regions(gray: &GrayImage, width: u32, height: u32) -> Option<LocatedText> {
    let small = 400.min((width.min(height) as f64 * 0.3) as u32);
    let medium = 600.min((width.min(height) as f64 * 0.5) as u32);
    let large = 800.min((width.max(height) as f64 * 0.6) as u32);
    let regions = build_regions(width, height, small, medium, large);

    for (x, y, w, h) in regions {
        let region = extract_region(gray, x, y, w, h);
        let mut found = try_decode(&region);
        if found.is_none() { found = try_decode_pure(&region); }
        if found.is_none() { found = try_all_strategies(&region); }
        if let Some(mut found) = found {
            found.offset(x, y);
            return Some(found);
        }
    }
    None
}

/// 构建扫描区域列表
///
/// 返回 (x, y, width, height) 元组的列表，覆盖：
/// - 四角（小/中/大三种尺寸）
/// - 顶部/底部中间
/// - 左右中间
/// - 图片中心
fn build_regions(w: u32, h: u32, s: u32, m: u32, l: u32) -> Vec<(u32, u32, u32, u32)> {
    let mut r = Vec::new();
    let (sw, sh) = (s.min(w), s.min(h));
    let (mw, mh) = (m.min(w), m.min(h));
    let (bw, bh) = (l.min(w), l.min(h));

    // 四角 - 小块
    r.push((0, 0, sw, sh));
    r.push((w.saturating_sub(sw), 0, sw, sh));
    r.push((0, h.saturating_sub(sh), sw, sh));
    r.push((w.saturating_sub(sw), h.saturating_sub(sh), sw, sh));
    // 四角 - 中块
    r.push((0, 0, mw, mh));
    r.push((w.saturating_sub(mw), 0, mw, mh));
    r.push((0, h.saturating_sub(mh), mw, mh));
    r.push((w.saturating_sub(mw), h.saturating_sub(mh), mw, mh));
    // 四角 - 大块
    r.push((0, 0, bw, bh));
    r.push((w.saturating_sub(bw), 0, bw, bh));
    r.push((0, h.saturating_sub(bh), bw, bh));
    r.push((w.saturating_sub(bw), h.saturating_sub(bh), bw, bh));
    // 顶部/底部中间
    if w > mw + mw / 2 {
        r.push(((w - sw) / 2, 0, sw, sh));
        if h > mh + mh / 2 {
            r.push(((w - sw) / 2, h.saturating_sub(sh), sw, sh));
        }
    }
    // 左右中间
    if h > mh + mh / 2 {
        let mid_y = (h - sh) / 2;
        r.push((0, mid_y, sw, sh));
        if w > mw + mw / 2 {
            r.push((w.saturating_sub(sw), mid_y, sw, sh));
        }
    }
    // 中心
    if w > mw && h > mh {
        r.push(((w - sw) / 2, (h - sh) / 2, sw, sh));
    }
    r
}

/// 从灰度图中提取指定矩形区域
fn extract_region(gray: &GrayImage, x: u32, y: u32, w: u32, h: u32) -> GrayImage {
    let mut region = GrayImage::new(w, h);
    for dy in 0..h {
        for dx in 0..w {
            let sx = x + dx;
            let sy = y + dy;
            if sx < gray.width() && sy < gray.height() {
                region.put_pixel(dx, dy, *gray.get_pixel(sx, sy));
            }
        }
    }
    region
}

/// 反色处理，用于检测白底黑码被反转的情况（如深色背景上的浅色 QR 码）
fn invert(gray: &GrayImage) -> GrayImage {
    GrayImage::from_fn(gray.width(), gray.height(), |x, y| {
        Luma([255 - gray.get_pixel(x, y).0[0]])
    })
}

/// Otsu 自适应阈值二值化
///
/// 通过最大化类间方差自动计算最佳阈值，将灰度图转为纯黑白图像。
/// 适用于光照不均匀或对比度不足的场景。
fn binarize_otsu(gray: &GrayImage) -> GrayImage {
    let mut histogram = [0u32; 256];
    for p in gray.pixels() { histogram[p.0[0] as usize] += 1; }
    let total = gray.width() * gray.height();
    let mut sum: f64 = 0.0;
    for (i, &c) in histogram.iter().enumerate() { sum += i as f64 * c as f64; }

    let (mut sum_b, mut w_b, mut max_var, mut threshold) = (0.0f64, 0u32, 0.0f64, 0u8);
    for (t, &c) in histogram.iter().enumerate() {
        w_b += c;
        if w_b == 0 { continue; }
        let w_f = total - w_b;
        if w_f == 0 { break; }
        sum_b += t as f64 * c as f64;
        let diff = sum_b / w_b as f64 - (sum - sum_b) / w_f as f64;
        let var = w_b as f64 * w_f as f64 * diff * diff;
        if var > max_var { max_var = var; threshold = t as u8; }
    }

    GrayImage::from_fn(gray.width(), gray.height(), |x, y| {
        Luma([if gray.get_pixel(x, y).0[0] > threshold { 255 } else { 0 }])
    })
}

/// 直方图均衡化增强对比度
///
/// 通过累积分布函数重新映射像素值，使灰度分布更均匀，
/// 提升低对比度图像中 QR 码与背景的区分度。
fn enhance_contrast(gray: &GrayImage) -> GrayImage {
    let mut histogram = [0u32; 256];
    for p in gray.pixels() { histogram[p.0[0] as usize] += 1; }
    let total = (gray.width() * gray.height()) as f64;
    let mut cdf = [0f64; 256];
    cdf[0] = histogram[0] as f64;
    for i in 1..256 { cdf[i] = cdf[i - 1] + histogram[i] as f64; }
    let cdf_min = cdf.iter().copied().find(|&v| v > 0.0).unwrap_or(0.0);

    GrayImage::from_fn(gray.width(), gray.height(), |x, y| {
        let v = gray.get_pixel(x, y).0[0] as usize;
        Luma([((cdf[v] - cdf_min) / (total - cdf_min) * 255.0) as u8])
    })
}

/// 3x3 拉普拉斯锐化
///
/// 使用卷积核 [0,-1,0; -1,5,-1; 0,-1,0] 增强边缘，
/// 使模糊的 QR 码边界更加清晰。
fn sharpen(gray: &GrayImage) -> GrayImage {
    let (w, h) = gray.dimensions();
    let k: [i32; 9] = [0, -1, 0, -1, 5, -1, 0, -1, 0];
    GrayImage::from_fn(w, h, |x, y| {
        // 边缘像素直接保留原值
        if x == 0 || y == 0 || x >= w - 1 || y >= h - 1 {
            return *gray.get_pixel(x, y);
        }
        let mut s: i32 = 0;
        for ky in 0..3i32 {
            for kx in 0..3i32 {
                s += gray.get_pixel(
                    (x as i32 + kx - 1) as u32,
                    (y as i32 + ky - 1) as u32,
                ).0[0] as i32 * k[(ky * 3 + kx) as usize];
            }
        }
        Luma([s.clamp(0, 255) as u8])
    })
}