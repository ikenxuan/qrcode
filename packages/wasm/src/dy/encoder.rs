//! 抖音码编码器：把文本编码成四条数据环。
//!
//! 编码是解码的严格逆过程：
//!
//! 1. 文本按 QR 字节模式写成位流（4 位模式 + 8 位长度 + UTF-8 + 终止符），
//!    再用 `0xEC` / `0x11` 交替填充到消息容量；
//! 2. 按格式码对应的 RS 布局分块做系统化 Reed-Solomon 编码；
//! 3. 写入 15 位格式字段与 18 位参数字段；
//! 4. 按 480 步解扰序列的逆过程把载荷位写回四条数据环。
//!
//! 默认参数（格式码 5、参数 20、掩码 4）与官方作品分享码一致。

use super::gf256::rs_encode;
use super::layout::{
    collect_positions, descriptor_total, layout_data, mask_predicate, rs_layouts,
    scrambled_positions, CW18, DATA_RINGS, FIELD18_FALLBACK_XOR, FIELD18_LEN, FIELD18_START,
    FORMAT_CODEWORDS, FORMAT_LEN, FORMAT_START, FORMAT_XOR, RING_MODULES, STRUCT_BITS,
};

/// 传输码字固定为 52 字节。
const PAYLOAD_BYTES: usize = 52;

/// 官方样本中固定为暗色的结构模块（不参与数据）。
const FIXED_DARK_MODULES: [(usize, usize); 2] = [(0, 100), (0, 109)];

/// 编码参数。
#[derive(Clone, Copy, Debug)]
pub struct EncodeOptions {
    /// 格式码 1..6，默认 5。
    pub format_code: usize,
    /// 参数 0..63，低 4 位决定掩码 id，默认 20（掩码 4）。
    pub param: usize,
    /// 参数字段是否使用 `0x25412` 异或形式，默认 `true`。
    pub field_xor: bool,
}

impl Default for EncodeOptions {
    fn default() -> Self {
        Self {
            format_code: 5,
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
    /// 4 × 120 的环数据。
    pub rings: [[u8; RING_MODULES]; DATA_RINGS],
    /// 52 字节传输码字。
    pub payload: Vec<u8>,
    /// RS 编码前的消息字节。
    pub message: Vec<u8>,
    pub format_code: usize,
    pub param: usize,
    pub mask_id: usize,
}

/// 把文本编码成 DY 码的环数据。
pub fn encode_text(text: &str, options: EncodeOptions) -> Result<EncodedCode, String> {
    let EncodeOptions {
        format_code,
        param,
        field_xor,
    } = options;

    if !(1..=6).contains(&format_code) {
        return Err("formatCode 必须是 1..6 的整数".to_string());
    }
    if param > 63 {
        return Err("param 必须是 0..63 的整数".to_string());
    }

    let descriptor = rs_layouts(format_code)
        .iter()
        .find(|item| descriptor_total(item) <= PAYLOAD_BYTES)
        .copied()
        .ok_or_else(|| "没有可放入 52 字节传输码字的 RS 布局".to_string())?;

    let capacity = descriptor.data * descriptor.blocks;
    let message = build_qr_message(text, capacity)?;

    let mut codeword = Vec::with_capacity(descriptor_total(&descriptor));
    for block in 0..descriptor.blocks {
        let start = block * descriptor.data;
        let block_message = &message[start..start + descriptor.data];
        codeword.extend_from_slice(&rs_encode(block_message, descriptor.ecc, 0));
    }

    let mut payload = vec![0u8; PAYLOAD_BYTES];
    payload[..codeword.len()].copy_from_slice(&codeword);

    let mask_id = param & 0x0f;
    let rings = build_rings(&payload, format_code, param, mask_id, field_xor);

    Ok(EncodedCode {
        rings,
        payload,
        message,
        format_code,
        param,
        mask_id,
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

/// 写入格式字段、参数字段和数据位，得到四条环。
fn build_rings(
    payload: &[u8],
    format_code: usize,
    param: usize,
    mask_id: usize,
    field_xor: bool,
) -> [[u8; RING_MODULES]; DATA_RINGS] {
    let mut rings = STRUCT_BITS;
    for (ring, position) in FIXED_DARK_MODULES {
        rings[ring][position] = 1;
    }

    let format_positions = collect_positions(&STRUCT_BITS[0], FORMAT_START, FORMAT_LEN);
    let value15 = FORMAT_CODEWORDS[format_code - 1] ^ FORMAT_XOR;
    for (index, &position) in format_positions.iter().enumerate() {
        let shift = format_positions.len() - 1 - index;
        rings[0][position] = ((value15 >> shift) & 1) as u8;
    }

    let field_positions = collect_positions(&STRUCT_BITS[1], FIELD18_START, FIELD18_LEN);
    let value18 = CW18[param] ^ if field_xor { FIELD18_FALLBACK_XOR } else { 0 };
    for (index, &position) in field_positions.iter().enumerate() {
        let shift = field_positions.len() - 1 - index;
        rings[1][position] = ((value18 >> shift) & 1) as u8;
    }

    let layout = layout_data();
    let mut bits = Vec::with_capacity(payload.len() * 8);
    for &byte in payload {
        for shift in (0..8).rev() {
            bits.push((byte >> shift) & 1);
        }
    }

    let mut index = 0usize;
    for (ring, position) in scrambled_positions(mask_id) {
        if layout.masks[ring][position] == 0 {
            continue;
        }
        if index >= bits.len() {
            // 52 字节载荷只占 416 位，剩余 7 个有效位在官方样本中固定为 0，
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
    use crate::dy::layout::data_valid_masks;

    #[test]
    fn default_layout_is_rs_52_40() {
        let encoded = encode_text(
            "https://v.douyin.com/utbKgTJRmlI/",
            EncodeOptions::default(),
        )
        .expect("encodable");
        assert_eq!(encoded.format_code, 5);
        assert_eq!(encoded.param, 20);
        assert_eq!(encoded.mask_id, 4);
        assert_eq!(encoded.message.len(), 40);
        assert_eq!(encoded.payload.len(), 52);
    }

    #[test]
    fn rejects_text_over_capacity() {
        let text = "x".repeat(39);
        let error = encode_text(&text, EncodeOptions::default()).expect_err("too long");
        assert!(error.contains("文本过长"));
    }

    #[test]
    fn accepts_maximum_text_length() {
        let text = "x".repeat(38);
        assert!(encode_text(&text, EncodeOptions::default()).is_ok());
    }

    #[test]
    fn writes_fixed_dark_modules() {
        let encoded = encode_text("hello", EncodeOptions::default()).expect("encodable");
        assert_eq!(encoded.rings[0][100], 1);
        assert_eq!(encoded.rings[0][109], 1);
    }

    #[test]
    fn data_modules_match_payload_bits() {
        let encoded = encode_text(
            "https://v.douyin.com/utbKgTJRmlI/",
            EncodeOptions::default(),
        )
        .expect("encodable");
        let layout = data_valid_masks();
        let mask_id = encoded.mask_id;

        let mut bits = Vec::new();
        for &byte in &encoded.payload {
            for shift in (0..8).rev() {
                bits.push((byte >> shift) & 1);
            }
        }

        let mut index = 0usize;
        for (ring, position) in scrambled_positions(mask_id) {
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
    fn format_and_param_fields_are_valid() {
        let encoded = encode_text("hello", EncodeOptions::default()).expect("encodable");
        assert_eq!(
            crate::dy::layout::decode_format(&encoded.rings[0]),
            Some((5, 0))
        );
        assert_eq!(
            crate::dy::layout::decode_field18(&encoded.rings[1]),
            Some((20, 4, 0))
        );
    }

    #[test]
    fn supports_all_six_format_codes() {
        for format_code in 1..=6 {
            let encoded = encode_text(
                "hi",
                EncodeOptions {
                    format_code,
                    ..EncodeOptions::default()
                },
            )
            .expect("encodable");
            assert_eq!(encoded.format_code, format_code);
            assert_eq!(
                crate::dy::layout::decode_format(&encoded.rings[0]),
                Some((format_code, 0))
            );
        }
    }
}
