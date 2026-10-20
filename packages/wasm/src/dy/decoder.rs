//! 抖音码（`BEF_CODE_TYPE_DY_CODE`）的纯 Rust 解码器。
//!
//! 处理流程
//! --------
//! 1. 找到码的几何锚点，推导模块尺度；
//! 2. 采样五条各 120 个模块的数据环（四环版式忽略多出的第五条）；
//! 3. 搜索 120 种旋转角和两种遍历方向；
//! 4. 读取环 0 的 15 位格式字段，按格式码确定环数，再读环 1 的 18 位参数字段；
//! 5. 解扰数据模块，得到字节流；
//! 6. 按格式码选择 RS 布局并纠错（格式码 6 的部分布局含两个块组）；
//! 7. 解析 QR 风格的位流（模式 / 长度 / 载荷）得到文本。

use image::GrayImage;

use super::detect::{locator_candidates, sample_rings, scale_grid, Locator};
use super::gf256::rs_correct;
use super::layout::{
    decode_field18, decode_format, descriptor_total, layout_for_format, mask_predicate, rs_layouts,
    scrambled_positions, DataLayout, RSDescriptor, RSGroup, RING_MODULES, RING_RADII_5,
};

/// 把采样得到的环旋转/翻转到解码方向。
fn reindex_rings(
    rings: &[[u8; RING_MODULES]],
    rotation: usize,
    reverse: bool,
) -> Vec<[u8; RING_MODULES]> {
    rings
        .iter()
        .map(|ring| {
            let mut out = [0u8; RING_MODULES];
            for (i, value) in out.iter_mut().enumerate() {
                let index = if reverse {
                    (rotation + RING_MODULES - i) % RING_MODULES
                } else {
                    (i + rotation) % RING_MODULES
                };
                *value = ring[index];
            }
            out
        })
        .collect()
}

/// 解扰数据模块，得到传输字节流。
fn unpack_payload(
    rings: &[[u8; RING_MODULES]],
    mask_id: usize,
    layout: &DataLayout,
) -> Vec<u8> {
    let mut out = Vec::with_capacity(layout.capacity);
    let mut current = 0u16;
    let mut nbits = 0usize;

    for (ring, w) in
        scrambled_positions(mask_id, layout.ring_count, layout.modules_per_ring)
    {
        if ring >= rings.len() || layout.masks[ring][w] == 0 {
            continue;
        }
        let mut bit = rings[ring][w] & 1;
        if mask_predicate(mask_id, w) == 0 {
            bit ^= 1;
        }
        current = (current << 1) | bit as u16;
        nbits += 1;
        if nbits == 8 {
            out.push(current as u8);
            current = 0;
            nbits = 0;
        }
    }
    out
}

/// 返回一个块组的可能分块方式（连续存放或字节交织）。
fn group_arrangements(segment: &[u8], group: RSGroup) -> Vec<Vec<Vec<u8>>> {
    let size = group.data + group.ecc;
    if group.blocks == 1 {
        return vec![vec![segment[..size].to_vec()]];
    }

    // 方式 A：每个完整码字连续存放。
    let contiguous = (0..group.blocks)
        .map(|block| segment[block * size..(block + 1) * size].to_vec())
        .collect();
    // 方式 B：字节在多个块之间交织。
    let mut interleaved = vec![vec![0u8; size]; group.blocks];
    for i in 0..size {
        for block in 0..group.blocks {
            interleaved[block][i] = segment[i * group.blocks + block];
        }
    }
    vec![contiguous, interleaved]
}

/// 返回描述符对应的所有可能分块方式。
///
/// 一个描述符可能包含多个块组（格式码 6 的后两种布局）。
/// 每个块组内部再尝试连续存放和字节交织两种排列。
fn split_blocks(payload: &[u8], descriptor: &RSDescriptor) -> Vec<Vec<Vec<u8>>> {
    let groups: Vec<RSGroup> = descriptor.groups().collect();
    let mut segments: Vec<&[u8]> = Vec::with_capacity(groups.len());
    let mut offset = 0usize;
    for group in &groups {
        let total = group.blocks * (group.data + group.ecc);
        if offset + total > payload.len() {
            return Vec::new();
        }
        segments.push(&payload[offset..offset + total]);
        offset += total;
    }

    let mut combinations: Vec<Vec<Vec<Vec<u8>>>> = vec![Vec::new()];
    for (group, segment) in groups.iter().zip(segments) {
        let arrangements = group_arrangements(segment, *group);
        let mut next = Vec::new();
        for combination in &combinations {
            for arrangement in &arrangements {
                let mut merged = combination.clone();
                merged.push(arrangement.clone());
                next.push(merged);
            }
        }
        combinations = next;
    }

    combinations
        .into_iter()
        .map(|combination| combination.into_iter().flatten().collect())
        .collect()
}

/// 按给定描述符对载荷做 RS 纠错，成功时返回 `(message, errors)`。
fn correct_payload(payload: &[u8], descriptor: &RSDescriptor) -> Option<(Vec<u8>, usize)> {
    let groups: Vec<RSGroup> = descriptor.groups().collect();

    for blocks in split_blocks(payload, descriptor) {
        let mut parts: Vec<u8> = Vec::new();
        let mut total_errors = 0usize;
        let mut ok = true;
        let mut block_index = 0usize;

        for group in &groups {
            for _ in 0..group.blocks {
                let block = &blocks[block_index];
                block_index += 1;
                match rs_correct(block, group.ecc, 0) {
                    Ok((corrected, errors)) => {
                        parts.extend_from_slice(&corrected[..group.data]);
                        total_errors += errors;
                    }
                    Err(()) => {
                        ok = false;
                        break;
                    }
                }
            }
            if !ok {
                break;
            }
        }

        if ok {
            return Some((parts, total_errors));
        }
    }
    None
}

// ---------------------------------------------------------------------------
// QR 风格位流
// ---------------------------------------------------------------------------

const ALPHANUMERIC: &[u8] = b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

/// 从位流中读取 `count` 位，返回数值并推进读取位置。
fn read_bits(data: &[u8], pos: &mut usize, count: usize) -> Result<u32, ()> {
    if *pos + count > data.len() * 8 {
        return Err(());
    }
    let mut value = 0u32;
    for _ in 0..count {
        let byte = data[*pos / 8];
        let bit = (byte >> (7 - (*pos % 8))) & 1;
        value = (value << 1) | bit as u32;
        *pos += 1;
    }
    Ok(value)
}

/// 解析抖音码内部的 QR 风格段流。
///
/// 字节模式使用 8 位字符计数；载荷不是完整 QR 符号，
/// 因此不采用版本相关的计数宽度。
fn parse_qr_bitstream(data: &[u8]) -> Result<String, ()> {
    let mut pos = 0usize;
    let total_bits = data.len() * 8;
    let mut chunks: Vec<String> = Vec::new();

    while pos + 4 <= total_bits {
        let mode = read_bits(data, &mut pos, 4)?;
        if mode == 0 {
            break;
        }
        match mode {
            // 数字模式
            1 => {
                let mut length = read_bits(data, &mut pos, 10)? as usize;
                let mut digits = String::new();
                while length >= 3 {
                    let value = read_bits(data, &mut pos, 10)?;
                    digits.push_str(&format!("{value:03}"));
                    length -= 3;
                }
                if length == 2 {
                    let value = read_bits(data, &mut pos, 7)?;
                    digits.push_str(&format!("{value:02}"));
                } else if length == 1 {
                    let value = read_bits(data, &mut pos, 4)?;
                    digits.push_str(&format!("{value}"));
                }
                chunks.push(digits);
            }
            // 字母数字模式
            2 => {
                let mut length = read_bits(data, &mut pos, 9)? as usize;
                let mut chars = String::new();
                while length >= 2 {
                    let value = read_bits(data, &mut pos, 11)? as usize;
                    let high = value / 45;
                    let low = value % 45;
                    if high >= ALPHANUMERIC.len() || low >= ALPHANUMERIC.len() {
                        return Err(());
                    }
                    chars.push(ALPHANUMERIC[high] as char);
                    chars.push(ALPHANUMERIC[low] as char);
                    length -= 2;
                }
                if length == 1 {
                    let value = read_bits(data, &mut pos, 6)? as usize;
                    if value >= ALPHANUMERIC.len() {
                        return Err(());
                    }
                    chars.push(ALPHANUMERIC[value] as char);
                }
                chunks.push(chars);
            }
            // 字节模式
            4 => {
                let length = read_bits(data, &mut pos, 8)? as usize;
                let mut raw = Vec::with_capacity(length);
                for _ in 0..length {
                    raw.push(read_bits(data, &mut pos, 8)? as u8);
                }
                let text = std::str::from_utf8(&raw).map_err(|_| ())?;
                chunks.push(text.to_string());
            }
            // ECI 指示符，不属于文本内容
            7 => {
                read_bits(data, &mut pos, 8)?;
            }
            _ => return Err(()),
        }
    }

    Ok(chunks.concat())
}

// ---------------------------------------------------------------------------
// 候选解码
// ---------------------------------------------------------------------------

/// 一组已定向的环解码出的元数据与载荷。
struct RingCandidate {
    format_code: usize,
    #[allow(dead_code)] // 供测试断言
    mask_id: usize,
    payload: Vec<u8>,
}

/// 解码一组已经定向的环（格式字段 + 载荷）。
fn decode_rings(rings: &[[u8; RING_MODULES]]) -> Option<RingCandidate> {
    if rings.len() < 2 {
        return None;
    }
    let (format_code, _) = decode_format(&rings[0])?;
    // 版本 5 的版式尚未实现；先跳过，避免误判。
    let layout = layout_for_format(format_code)?;
    if rings.len() < layout.ring_count {
        return None;
    }
    let (_, mask_id, _) = decode_field18(&rings[1])?;
    let payload = unpack_payload(rings, mask_id, layout);
    Some(RingCandidate {
        format_code,
        mask_id,
        payload,
    })
}

struct CandidateDecode {
    text: String,
    errors: usize,
}

/// 按格式码尝试所有 RS 布局，并解析 QR 位流。
fn decode_candidate(candidate: &RingCandidate) -> Option<CandidateDecode> {
    for descriptor in rs_layouts(candidate.format_code) {
        if descriptor_total(descriptor) > candidate.payload.len() {
            continue;
        }
        let Some((message, errors)) = correct_payload(&candidate.payload, descriptor) else {
            continue;
        };
        let Ok(text) = parse_qr_bitstream(&message) else {
            continue;
        };
        if text.is_empty() {
            continue;
        }
        return Some(CandidateDecode { text, errors });
    }
    None
}

/// 抖音码的解码结果与位置。
pub struct DyDecode {
    pub text: String,
    /// 码心在原图中的坐标。
    pub center: (f64, f64),
    /// 覆盖数据环的半径（含少量留白）。
    pub radius: f64,
    /// 定位点（原图坐标）。
    ///
    /// 作品分享码是中心圆盘的圆心；名片码是三个圆形定位标记的中心。
    pub points: Vec<(f64, f64)>,
}

/// 从灰度图中解码抖音码，返回文本与位置。
///
/// 没有任何候选可解时返回 `None`。完整的 120 × 2 方向搜索保证解码不依赖
/// 图片拍摄角度；每个定位器保留纠错数最少的候选，零错误时立即返回。
///
/// 小尺寸图片的模块只有两三个像素，固定像素的环采样容易失败，因此会先
/// 放大图片再解码（2x，必要时 4x），最后把位置换算回原图坐标。
pub fn decode_gray_detailed(gray: &GrayImage) -> Option<DyDecode> {
    let (width, height) = gray.dimensions();
    let min_side = width.min(height);

    // 很小的图直接先放大，避免在低分辨率上做无效搜索。
    if min_side < 320 {
        if let Some(decoded) = decode_gray_upscaled(gray, 2) {
            return Some(decoded);
        }
        if let Some(decoded) = decode_gray_upscaled(gray, 4) {
            return Some(decoded);
        }
    }

    if let Some(decoded) = decode_gray_impl(gray) {
        return Some(decoded);
    }

    // 中等尺寸也可能因为模块偏小而失败，放大后重试。
    if min_side < 640 {
        if let Some(decoded) = decode_gray_upscaled(gray, 2) {
            return Some(decoded);
        }
        if let Some(decoded) = decode_gray_upscaled(gray, 4) {
            return Some(decoded);
        }
    }

    None
}

/// 放大图片后解码，并把圆心/半径换算回原图坐标。
fn decode_gray_upscaled(gray: &GrayImage, factor: u32) -> Option<DyDecode> {
    let upscaled = image::imageops::resize(
        gray,
        gray.width() * factor,
        gray.height() * factor,
        image::imageops::FilterType::Lanczos3,
    );
    let mut decoded = decode_gray_impl(&upscaled)?;
    let factor = factor as f64;
    decoded.center = (decoded.center.0 / factor, decoded.center.1 / factor);
    decoded.radius /= factor;
    decoded.points = decoded
        .points
        .iter()
        .map(|&(x, y)| (x / factor, y / factor))
        .collect();
    Some(decoded)
}

fn decode_gray_impl(gray: &GrayImage) -> Option<DyDecode> {
    let locators = locator_candidates(gray);
    if locators.is_empty() {
        return None;
    }

    for locator in locators {
        let scales = scale_grid(locator.scale_base, locator.steps, locator.span);
        let (hit, best) = search_scales(gray, locator.center, &scales);

        if let Some((text, scale)) = hit {
            return Some(DyDecode {
                text,
                center: locator.center,
                radius: RING_RADII_5[0] * scale * 1.08,
                points: locator.points.clone(),
            });
        }

        // 原尺寸下模块可能只有两三个像素，采样容易错位。放大码所在区域
        // 再搜索一次，比放大整张截图便宜得多。
        if let Some((text, scale)) = search_locator_upscaled(gray, &locator) {
            return Some(DyDecode {
                text,
                center: locator.center,
                radius: RING_RADII_5[0] * scale * 1.08,
                points: locator.points.clone(),
            });
        }

        if let Some((_, text, scale)) = best {
            return Some(DyDecode {
                text,
                center: locator.center,
                radius: RING_RADII_5[0] * scale * 1.08,
                points: locator.points.clone(),
            });
        }
    }

    None
}

/// 在一组尺度上搜索：返回零错误命中，以及纠错数最少的候选。
fn search_scales(
    gray: &GrayImage,
    center: (f64, f64),
    scales: &[f64],
) -> (Option<(String, f64)>, Option<(usize, String, f64)>) {
    let mut best: Option<(usize, String, f64)> = None;

    for &scale in scales {
        let rings = sample_rings(gray, center.0, center.1, scale);
        for reverse in [false, true] {
            for rotation in 0..RING_MODULES {
                let oriented = reindex_rings(&rings, rotation, reverse);
                let Some(candidate) = decode_rings(&oriented) else {
                    continue;
                };
                let Some(decoded) = decode_candidate(&candidate) else {
                    continue;
                };
                if decoded.errors == 0 {
                    return (Some((decoded.text, scale)), best);
                }
                if best
                    .as_ref()
                    .is_none_or(|(errors, _, _)| decoded.errors < *errors)
                {
                    best = Some((decoded.errors, decoded.text, scale));
                }
            }
        }
    }

    (None, best)
}

/// 放大码心附近的区域后重新搜索。
///
/// 只截取环覆盖范围（含留白），因此即使整张截图很大，代价也只跟码的
/// 像素尺寸有关。估计尺寸已经很大的码不需要放大，直接跳过。
fn search_locator_upscaled(gray: &GrayImage, locator: &Locator) -> Option<(String, f64)> {
    const MAX_REGION_SIDE: f64 = 640.0;

    let margin = RING_RADII_5[0] * locator.scale_base * (1.0 + locator.span) * 1.2;
    let side = margin * 2.0;
    if !(32.0..=MAX_REGION_SIDE).contains(&side) {
        return None;
    }

    let (width, height) = gray.dimensions();
    let left = (locator.center.0 - margin).floor().max(0.0);
    let top = (locator.center.1 - margin).floor().max(0.0);
    let right = (locator.center.0 + margin).ceil().min(width as f64);
    let bottom = (locator.center.1 + margin).ceil().min(height as f64);
    if right - left < 24.0 || bottom - top < 24.0 {
        return None;
    }

    let crop = image::imageops::crop_imm(
        gray,
        left as u32,
        top as u32,
        (right - left) as u32,
        (bottom - top) as u32,
    )
    .to_image();

    for factor in [2u32, 4u32] {
        let upscaled = image::imageops::resize(
            &crop,
            crop.width() * factor,
            crop.height() * factor,
            image::imageops::FilterType::Lanczos3,
        );
        let center = (
            (locator.center.0 - left) * factor as f64,
            (locator.center.1 - top) * factor as f64,
        );
        // 放大后模块更清晰，用更细的尺度网格提高命中率。
        let steps = locator.steps.max(17);
        let scales = scale_grid(locator.scale_base * factor as f64, steps, locator.span);
        let (hit, _) = search_scales(&upscaled, center, &scales);
        if let Some((text, scale)) = hit {
            return Some((text, scale / factor as f64));
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dy::encoder::{encode_text, EncodeOptions};
    use crate::dy::layout::{
        bits_to_int, data_valid_masks, layout_for_format, mask_predicate, scrambled_positions,
        CW18, FIELD18_FALLBACK_XOR, FORMAT_CODEWORDS, FORMAT_XOR, RING_MODULES, STRUCT_BITS,
    };

    #[test]
    fn reads_known_bitstream() {
        // 用编码器生成的消息验证字节模式解析。
        let encoded = encode_text("https://bing.com", EncodeOptions::default()).expect("encodable");
        assert_eq!(
            parse_qr_bitstream(&encoded.message).unwrap(),
            "https://bing.com"
        );
    }

    /// 按编码器的规则手工搭出一组环，验证解码链路本身。
    fn synthetic_rings(text: &str, format_code: usize, param: usize) -> Vec<[u8; RING_MODULES]> {
        let encoded = encode_text(
            text,
            EncodeOptions {
                format_code: Some(format_code),
                param,
                field_xor: true,
            },
        )
        .expect("encodable");
        let layout = layout_for_format(format_code).expect("layout");
        let mask_id = param & 0x0f;

        let mut rings = STRUCT_BITS[..layout.ring_count].to_vec();
        let value15 = FORMAT_CODEWORDS[format_code - 1] ^ FORMAT_XOR;
        for (i, &pos) in layout.format_positions.iter().enumerate() {
            rings[0][pos] = ((value15 >> (layout.format_positions.len() - 1 - i)) & 1) as u8;
        }
        let value18 = CW18[param] ^ FIELD18_FALLBACK_XOR;
        for (i, &pos) in layout.field_positions.iter().enumerate() {
            rings[1][pos] = ((value18 >> (layout.field_positions.len() - 1 - i)) & 1) as u8;
        }

        let payload = &encoded.payload;
        let mut index = 0usize;
        for (ring, w) in
            scrambled_positions(mask_id, layout.ring_count, layout.modules_per_ring)
        {
            if layout.masks[ring][w] == 0 {
                continue;
            }
            let bit = if index < payload.len() * 8 {
                (payload[index / 8] >> (7 - index % 8)) & 1
            } else {
                0
            };
            index += 1;
            rings[ring][w] = if mask_predicate(mask_id, w) == 0 {
                bit ^ 1
            } else {
                bit
            };
        }
        rings
    }

    #[test]
    fn decodes_synthetic_four_ring_code() {
        let rings = synthetic_rings("https://bing.com", 5, 20);
        let candidate = decode_rings(&rings).expect("rings decode");
        assert_eq!(candidate.format_code, 5);
        assert_eq!(candidate.mask_id, 4);
        let decoded = decode_candidate(&candidate).expect("candidate decode");
        assert_eq!(decoded.text, "https://bing.com");
        assert_eq!(decoded.errors, 0);
        let layout = data_valid_masks();
        let value18 = CW18[20] ^ FIELD18_FALLBACK_XOR;
        assert_eq!(bits_to_int(&rings[1], &layout.field_positions), value18);
    }

    #[test]
    fn decodes_synthetic_five_ring_code() {
        let text = "x".repeat(51);
        let rings = synthetic_rings(&text, 6, 20);
        assert_eq!(rings.len(), 5);
        let candidate = decode_rings(&rings).expect("rings decode");
        assert_eq!(candidate.format_code, 6);
        assert_eq!(candidate.payload.len(), 67);
        let decoded = decode_candidate(&candidate).expect("candidate decode");
        assert_eq!(decoded.text, text);
        assert_eq!(decoded.errors, 0);
    }
}
