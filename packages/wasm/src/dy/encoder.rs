//! 抖音码编码器：把文本编码成数据环。
//!
//! 编码是解码的严格逆过程：
//!
//! 1. 文本按 QR 字节模式写成位流（4 位模式 + 8 位长度 + UTF-8 + 终止符），
//!    再用 `0xEC` / `0x11` 交替填充到消息容量；
//! 2. 按格式码对应的 RS 布局分块做系统化 Reed-Solomon 编码；
//! 3. 写入 15 位格式字段与 18 位参数字段；
//! 4. 按解扰序列的逆过程把载荷位写回数据环。
//!
//! 默认参数（参数 20、掩码 4）与官方作品分享码一致。未指定格式码时，
//! 38 字节以内的文本用格式码 5（四环，52 字节码字），更长的文本自动
//! 改用格式码 6（五环，67 字节码字）。

use super::gf256::rs_encode;
use super::layout::{
    descriptor_data, descriptor_total, format_version, layout_for_format, mask_predicate,
    rs_layouts, scrambled_positions, CW18, FIELD18_FALLBACK_XOR, FORMAT_CODEWORDS, FORMAT_XOR,
    RING_MODULES, RSDescriptor,
};

/// 官方样本中固定为暗色的结构模块（不参与数据）。
const FIXED_DARK_MODULES: [(usize, usize); 2] = [(0, 100), (0, 109)];

/// 编码参数。
#[derive(Clone, Copy, Debug)]
pub struct EncodeOptions {
    /// 格式码 4..6（版本 3，三/四/五环）。
    ///
    /// `None` 时按文本长度自动选择：能放进格式码 5 就用 5，否则用 6。
    pub format_code: Option<usize>,
    /// 参数 0..63，低 4 位决定掩码 id，默认 20（掩码 4）。
    pub param: usize,
    /// 参数字段是否使用 `0x25412` 异或形式，默认 `true`。
    pub field_xor: bool,
}

impl Default for EncodeOptions {
    fn default() -> Self {
        Self {
            format_code: None,
            param: 20,
            field_xor: true,
        }
    }
}

/// 编码结果。
///
/// `payload` / `message` 等字段不参与渲染，保留给测试与诊断使用。
#[derive(Clone, Debug)]
#[allow(dead_code)]
pub struct EncodedCode {
    /// 每条环 120 个模块；环数由格式码决定。
    pub rings: Vec<[u8; RING_MODULES]>,
    /// 传输码字（格式码 5 为 52 字节，格式码 6 为 67 字节）。
    pub payload: Vec<u8>,
    /// RS 编码前的消息字节。
    pub message: Vec<u8>,
    pub format_code: usize,
    pub param: usize,
    pub mask_id: usize,
    pub descriptor: RSDescriptor,
}

impl EncodedCode {
    /// 数据环数量。
    pub fn ring_count(&self) -> usize {
        self.rings.len()
    }
}

/// 选择与格式码容量匹配的 RS 描述符。
fn descriptor_for(format_code: usize, capacity: usize) -> Option<RSDescriptor> {
    rs_layouts(format_code)
        .iter()
        .find(|item| descriptor_total(item) == capacity && descriptor_data(item) > 0)
        .copied()
}

/// 未指定格式码时，按文本长度在格式码 5 和 6 之间选择。
fn auto_format_code(text: &str) -> usize {
    let fits = |format_code: usize| -> bool {
        let Some(layout) = layout_for_format(format_code) else {
            return false;
        };
        let Some(descriptor) = descriptor_for(format_code, layout.capacity) else {
            return false;
        };
        text.len() <= descriptor_data(&descriptor).saturating_sub(2)
    };
    if fits(5) {
        5
    } else {
        6
    }
}

/// 把文本编码成 DY 码的环数据。
pub fn encode_text(text: &str, options: EncodeOptions) -> Result<EncodedCode, String> {
    let EncodeOptions {
        format_code,
        param,
        field_xor,
    } = options;

    if param > 63 {
        return Err("param 必须是 0..63 的整数".to_string());
    }

    let format_code = format_code.unwrap_or_else(|| auto_format_code(text));
    if !(1..=6).contains(&format_code) {
        return Err("formatCode 必须是 1..6 的整数".to_string());
    }
    let layout = layout_for_format(format_code).ok_or_else(|| {
        format!(
            "格式码 {format_code} 属于版本 {}，当前只实现版本 3（格式码 4..6）",
            format_version(format_code).unwrap_or(0)
        )
    })?;

    let descriptor = descriptor_for(format_code, layout.capacity)
        .ok_or_else(|| "没有与版式容量匹配的 RS 布局".to_string())?;

    let capacity = descriptor_data(&descriptor);
    let message = build_qr_message(text, capacity)?;

    let mut payload = vec![0u8; layout.capacity];
    let mut offset = 0usize;
    let mut message_offset = 0usize;
    for group in descriptor.groups() {
        let block_size = group.data + group.ecc;
        for block in 0..group.blocks {
            let start = message_offset;
            let block_message = &message[start..start + group.data];
            let encoded = rs_encode(block_message, group.ecc, 0);
            let target = offset + block * block_size;
            payload[target..target + encoded.len()].copy_from_slice(&encoded);
            message_offset += group.data;
        }
        offset += group.blocks * block_size;
    }
    debug_assert_eq!(offset, layout.capacity);
    debug_assert_eq!(message_offset, message.len());

    let mask_id = param & 0x0f;
    let rings = build_rings(&payload, layout, format_code, param, mask_id, field_xor);

    Ok(EncodedCode {
        rings,
        payload,
        message,
        format_code,
        param,
        mask_id,
        descriptor,
    })
}

/// 把文本写成 QR 字节模式位流，并填充到指定容量。
fn build_qr_message(text: &str, capacity_bytes: usize) -> Result<Vec<u8>, String> {
    if text.is_empty() {
        return Err("文本不能为空".to_string());
    }

    let bytes = text.as_bytes();
    let limit = capacity_bytes.saturating_sub(2);
    if bytes.len() > limit {
        return Err(format!(
            "文本过长：UTF-8 编码后 {} 字节，当前布局最多 {} 字节",
            bytes.len(),
            limit
        ));
    }
    if bytes.len() > u8::MAX as usize {
        return Err("文本过长：字节模式长度字段最多表示 255 字节".to_string());
    }

    let mut bits: Vec<u8> = Vec::with_capacity(capacity_bytes * 8);
    push_bits(&mut bits, 0b0100, 4);
    push_bits(&mut bits, bytes.len() as u32, 8);
    for &byte in bytes {
        push_bits(&mut bits, byte as u32, 8);
    }

    let capacity_bits = capacity_bytes * 8;
    let terminator = 4.min(capacity_bits.saturating_sub(bits.len()));
    for _ in 0..terminator {
        bits.push(0);
    }
    while bits.len() % 8 != 0 {
        bits.push(0);
    }
    if bits.len() > capacity_bits {
        return Err("文本过长".to_string());
    }

    let mut out = vec![0u8; capacity_bytes];
    for (index, chunk) in bits.chunks_exact(8).enumerate() {
        let mut value = 0u8;
        for &bit in chunk {
            value = (value << 1) | bit;
        }
        out[index] = value;
    }

    let mut pad = 0usize;
    for byte in out.iter_mut().skip(bits.len() / 8) {
        *byte = if pad % 2 == 0 { 0xec } else { 0x11 };
        pad += 1;
    }

    Ok(out)
}

fn push_bits(bits: &mut Vec<u8>, value: u32, count: usize) {
    for shift in (0..count).rev() {
        bits.push(((value >> shift) & 1) as u8);
    }
}

/// 写入格式字段、参数字段和数据位，得到数据环。
fn build_rings(
    payload: &[u8],
    layout: &super::layout::DataLayout,
    format_code: usize,
    param: usize,
    mask_id: usize,
    field_xor: bool,
) -> Vec<[u8; RING_MODULES]> {
    let mut rings = layout.masks.clone();
    for (ring, position) in FIXED_DARK_MODULES {
        if ring < rings.len() {
            rings[ring][position] = 1;
        }
    }

    let value15 = FORMAT_CODEWORDS[format_code - 1] ^ FORMAT_XOR;
    for (index, &position) in layout.format_positions.iter().enumerate() {
        let shift = layout.format_positions.len() - 1 - index;
        rings[0][position] = ((value15 >> shift) & 1) as u8;
    }

    let value18 = CW18[param] ^ if field_xor { FIELD18_FALLBACK_XOR } else { 0 };
    for (index, &position) in layout.field_positions.iter().enumerate() {
        let shift = layout.field_positions.len() - 1 - index;
        rings[1][position] = ((value18 >> shift) & 1) as u8;
    }

    let mut bits = Vec::with_capacity(payload.len() * 8);
    for &byte in payload {
        for shift in (0..8).rev() {
            bits.push((byte >> shift) & 1);
        }
    }

    let mut index = 0usize;
    for (ring, position) in scrambled_positions(
        mask_id,
        layout.ring_count,
        layout.modules_per_ring,
    ) {
        // 用去掉格式/参数字段后的掩码判断，而不是已经写入字段位的 rings。
        if layout.masks[ring][position] == 0 {
            continue;
        }
        if index >= bits.len() {
            // 67 字节载荷只占 536 位，剩余 7 个有效位在官方版式中固定为 0，
            // 且不参与掩码异或。
            rings[ring][position] = 0;
            index += 1;
            continue;
        }
        let mut bit = bits[index];
        index += 1;
        if mask_predicate(mask_id, position) == 0 {
            bit ^= 1;
        }
        rings[ring][position] = bit;
    }

    rings
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dy::layout::{decode_field18, decode_format, layout_data};

    #[test]
    fn default_layout_is_rs_52_40() {
        let encoded = encode_text("https://bing.com", EncodeOptions::default()).expect("encodable");
        assert_eq!(encoded.format_code, 5);
        assert_eq!(encoded.param, 20);
        assert_eq!(encoded.mask_id, 4);
        assert_eq!(encoded.ring_count(), 4);
        assert_eq!(encoded.message.len(), 40);
        assert_eq!(encoded.payload.len(), 52);
    }

    #[test]
    fn long_text_auto_selects_five_rings() {
        let text = "x".repeat(39);
        let encoded = encode_text(&text, EncodeOptions::default()).expect("encodable");
        assert_eq!(encoded.format_code, 6);
        assert_eq!(encoded.ring_count(), 5);
        assert_eq!(encoded.message.len(), 53);
        assert_eq!(encoded.payload.len(), 67);
    }

    #[test]
    fn format_six_accepts_fifty_one_bytes() {
        let text = "x".repeat(51);
        let encoded = encode_text(
            &text,
            EncodeOptions {
                format_code: Some(6),
                ..EncodeOptions::default()
            },
        )
        .expect("encodable");
        assert_eq!(encoded.message.len(), 53);
        assert_eq!(encoded.payload.len(), 67);
    }

    #[test]
    fn rejects_text_over_five_ring_capacity() {
        let text = "x".repeat(52);
        let error = encode_text(
            &text,
            EncodeOptions {
                format_code: Some(6),
                ..EncodeOptions::default()
            },
        )
        .expect_err("too long");
        assert!(error.contains("文本过长"));
    }

    #[test]
    fn explicit_four_ring_layout_still_rejects_long_text() {
        let text = "x".repeat(39);
        let error = encode_text(
            &text,
            EncodeOptions {
                format_code: Some(5),
                ..EncodeOptions::default()
            },
        )
        .expect_err("too long");
        assert!(error.contains("文本过长"));
    }

    #[test]
    fn accepts_maximum_four_ring_text_length() {
        let text = "x".repeat(38);
        assert!(encode_text(&text, EncodeOptions::default()).is_ok());
    }

    #[test]
    fn version_five_formats_are_rejected() {
        for format_code in 1..=3 {
            let error = encode_text(
                "hi",
                EncodeOptions {
                    format_code: Some(format_code),
                    ..EncodeOptions::default()
                },
            )
            .expect_err("unimplemented version");
            assert!(error.contains("版本 5"), "{format_code}: {error}");
        }
    }

    #[test]
    fn supports_version_three_format_codes() {
        for format_code in 4..=6 {
            let encoded = encode_text(
                "hi",
                EncodeOptions {
                    format_code: Some(format_code),
                    ..EncodeOptions::default()
                },
            )
            .expect("encodable");
            assert_eq!(encoded.format_code, format_code);
            assert_eq!(encoded.ring_count(), crate::dy::layout::format_rings(format_code).unwrap());
            assert_eq!(
                decode_format(&encoded.rings[0]),
                Some((format_code, 0))
            );
        }
    }

    #[test]
    fn writes_fixed_dark_modules() {
        let encoded = encode_text("hello", EncodeOptions::default()).expect("encodable");
        assert_eq!(encoded.rings[0][100], 1);
        assert_eq!(encoded.rings[0][109], 1);
    }

    #[test]
    fn data_modules_match_payload_bits() {
        let encoded = encode_text("https://bing.com", EncodeOptions::default()).expect("encodable");
        let layout = layout_data();
        let mask_id = encoded.mask_id;

        let mut bits = Vec::new();
        for &byte in &encoded.payload {
            for shift in (0..8).rev() {
                bits.push((byte >> shift) & 1);
            }
        }

        let mut index = 0usize;
        for (ring, position) in
            scrambled_positions(mask_id, layout.ring_count, layout.modules_per_ring)
        {
            if layout.masks[ring][position] == 0 {
                continue;
            }
            let expected = if index < bits.len() {
                let mut bit = bits[index];
                if mask_predicate(mask_id, position) == 0 {
                    bit ^= 1;
                }
                bit
            } else {
                0
            };
            assert_eq!(
                encoded.rings[ring][position], expected,
                "ring {ring} pos {position}"
            );
            index += 1;
        }
        assert_eq!(index, 423);
    }

    #[test]
    fn five_ring_layout_has_543_data_bits() {
        let encoded = encode_text(
            &"x".repeat(51),
            EncodeOptions {
                format_code: Some(6),
                ..EncodeOptions::default()
            },
        )
        .expect("encodable");
        let layout = layout_for_format(6).expect("layout");
        let index = scrambled_positions(encoded.mask_id, layout.ring_count, layout.modules_per_ring)
            .into_iter()
            .filter(|&(ring, position)| layout.masks[ring][position] != 0)
            .count();
        assert_eq!(index, 543);
    }

    #[test]
    fn format_and_param_fields_are_valid() {
        let encoded = encode_text("hello", EncodeOptions::default()).expect("encodable");
        assert_eq!(decode_format(&encoded.rings[0]), Some((5, 0)));
        assert_eq!(decode_field18(&encoded.rings[1]), Some((20, 4, 0)));
    }
}
