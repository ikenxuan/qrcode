//! 抖音码（`BEF_CODE_TYPE_DY_CODE`）的静态布局。
//!
//! 抖音码由若干同心环组成。当前实现针对版本 3：4 条数据环，每环 120 个模块
//! （每个模块 3 度）。载荷是经过 Reed-Solomon 保护的 QR 风格位流，
//! 位到模块的映射经过刻意打乱；本文件给出解扰所需的全部静态表。

use std::sync::OnceLock;

// ---------------------------------------------------------------------------
// 几何参数
// ---------------------------------------------------------------------------

pub const RING_MODULES: usize = 120;
pub const DATA_RINGS: usize = 4;

/// 四条数据环的设计半径（warped 单位），由外向内。
pub const RING_RADII: [f64; 4] = [86.0, 71.0, 63.0, 55.0];

/// 中心实心圆盘的设计半径，单位与环半径相同。
pub const DISK_RADIUS: f64 = 48.36;

// ---------------------------------------------------------------------------
// 结构掩码
// ---------------------------------------------------------------------------

/// 每环一个 120 位有效位掩码，按 LSB-first 打包。
/// 0 表示该模块不承载数据（对齐标记、间隙、格式字段等）。
pub const STRUCT_MASKS: [[u8; 15]; 4] = [
    [
        0xff, 0x3f, 0xff, 0xff, 0xff, 0xcf, 0xff, 0xff, 0xff, 0xf3, 0xff, 0xff, 0x07, 0x80,
        0xff,
    ],
    [
        0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x3f, 0xf0,
        0xff,
    ],
    [0xff; 15],
    [0xff; 15],
];

/// 把打包的有效位掩码展开成每个模块一位（LSB 优先）。
pub const fn mask_bits(mask: &[u8; 15]) -> [u8; RING_MODULES] {
    let mut out = [0u8; RING_MODULES];
    let mut i = 0;
    while i < RING_MODULES {
        out[i] = (mask[i >> 3] >> (i & 7)) & 1;
        i += 1;
    }
    out
}

pub const STRUCT_BITS: [[u8; RING_MODULES]; DATA_RINGS] = [
    mask_bits(&STRUCT_MASKS[0]),
    mask_bits(&STRUCT_MASKS[1]),
    mask_bits(&STRUCT_MASKS[2]),
    mask_bits(&STRUCT_MASKS[3]),
];

// ---------------------------------------------------------------------------
// 格式信息（环 0，15 位）
// ---------------------------------------------------------------------------

/// 从环 0 的第 105 个模块开始，取前 15 个有效位置，必要时环绕。
pub const FORMAT_START: usize = 105;
pub const FORMAT_LEN: usize = 15;
pub const FORMAT_XOR: u32 = 0x6492;
pub const FORMAT_MAX_HAMMING: u32 = 3;

/// 合法的 15 位码字；下标加 1 即格式码（1..6）。
pub const FORMAT_CODEWORDS: [u32; 6] = [0x0537, 0x0a6e, 0x0f59, 0x11eb, 0x14dc, 0x1b85];

// ---------------------------------------------------------------------------
// 掩码 / 参数信息（环 1，18 位）
// ---------------------------------------------------------------------------

/// 从环 1 的第 45 个模块开始，取前 18 个有效位置，必要时环绕。
pub const FIELD18_START: usize = 45;
pub const FIELD18_LEN: usize = 18;
pub const FIELD18_MAX_HAMMING: u32 = 3;

/// 部分码字以反码形式存储。直接查表失败时，用该值异或后重试一次。
pub const FIELD18_FALLBACK_XOR: u32 = 0x25412;

/// 合法的 18 位码字。下标即参数 `param`，低 4 位是掩码 id。
pub const CW18: [u32; 64] = [
    0x00000, 0x01f25, 0x0216f, 0x03e4a, 0x042de, 0x05dfb, 0x063b1, 0x07c94, 0x085bc, 0x09a99,
    0x0a4d3, 0x0bbf6, 0x0c762, 0x0d847, 0x0e60d, 0x0f928, 0x10b78, 0x1145d, 0x12a17, 0x13532,
    0x149a6, 0x15683, 0x168c9, 0x177ec, 0x18ec4, 0x191e1, 0x1afab, 0x1b08e, 0x1cc1a, 0x1d33f,
    0x1ed75, 0x1f250, 0x209d5, 0x216f0, 0x228ba, 0x2379f, 0x24b0b, 0x2542e, 0x26a64, 0x27541,
    0x28c69, 0x2934c, 0x2ad06, 0x2b223, 0x2ceb7, 0x2d192, 0x2efd8, 0x2f0fd, 0x302ad, 0x31d88,
    0x323c2, 0x33ce7, 0x34073, 0x35f56, 0x3611c, 0x37e39, 0x38711, 0x39834, 0x3a67e, 0x3b95b,
    0x3c5cf, 0x3daea, 0x3e4a0, 0x3fb85,
];

// ---------------------------------------------------------------------------
// 数据解扰
// ---------------------------------------------------------------------------

/// 遍历一条环的 120 个模块时使用的四分之一置换，由掩码 id 的奇偶选择。
pub const T_EVEN: [usize; 4] = [0, 2, 1, 3];
pub const T_ODD: [usize; 4] = [2, 0, 3, 1];

/// 位置 `w`（0..119）的掩码生成谓词。
///
/// 存储位等于采样位；当谓词结果为 0 时再异或 1。
/// 9 组公式覆盖掩码 id 0..8。
pub fn mask_predicate(mask_id: usize, w: usize) -> u32 {
    match mask_id {
        0 => (w & 1) as u32,
        1 => (w % 3) as u32,
        2 => ((w & (w - w / 3)) & 1) as u32,
        3 => ((w % 3) & (w % 5)) as u32,
        4 => ((w & (w + w / 7)) & 1) as u32,
        5 => ((w % 3) & (w % 7)) as u32,
        6 => (((w & (w - w / 3)) & (w - w / 5)) & 1) as u32,
        7 | 8 => (((w & (w - w / 5)) & (w + w / 7)) & 1) as u32,
        _ => 0,
    }
}

/// 按载荷位顺序返回 `(环号, 环内位置)`。
///
/// 遍历固定的 480 步序列 `w2`，每一步映射到一条环和一个模块位置。
/// 格式字段和参数字段已在有效性掩码中清零，取满载荷后停止。
pub fn scrambled_positions(mask_id: usize) -> Vec<(usize, usize)> {
    let t = if mask_id & 1 != 0 { T_ODD } else { T_EVEN };
    let mut out = Vec::with_capacity(480);
    for w2 in 0..480 {
        let w9 = w2 / 30;
        let w12 = (w9 % 2) + 2 * (w9 / 8);
        let ring = (w2 % 240) / 60;
        let w21 = 30 * t[w12] + (w2 % 30);
        out.push((ring, w21));
    }
    out
}

// ---------------------------------------------------------------------------
// Reed-Solomon 布局表
// ---------------------------------------------------------------------------

/// 一个格式码对应的一种 Reed-Solomon 布局。
///
/// `ecc` 是每块校验字节数，`blocks` 是交织块数，`data` 是每块消息字节数。
/// 完整码字长度为 `blocks * (data + ecc)` 字节。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct RSDescriptor {
    pub ecc: usize,
    pub blocks: usize,
    pub data: usize,
}

pub const fn descriptor_total(descriptor: &RSDescriptor) -> usize {
    descriptor.blocks * (descriptor.data + descriptor.ecc)
}

const RS1: [RSDescriptor; 4] = [rs(4, 1, 16), rs(6, 1, 14), rs(10, 1, 10), rs(12, 1, 8)];
const RS2: [RSDescriptor; 4] = [rs(6, 1, 23), rs(10, 1, 19), rs(16, 1, 13), rs(18, 1, 11)];
const RS3: [RSDescriptor; 4] = [rs(8, 1, 30), rs(12, 1, 26), rs(20, 1, 18), rs(24, 1, 14)];
const RS4: [RSDescriptor; 4] = [rs(8, 1, 29), rs(12, 1, 25), rs(20, 1, 17), rs(24, 1, 13)];
const RS5: [RSDescriptor; 4] = [rs(12, 1, 40), rs(16, 1, 36), rs(26, 1, 26), rs(16, 2, 10)];
const RS6: [RSDescriptor; 4] = [rs(14, 1, 53), rs(22, 1, 45), rs(17, 1, 16), rs(21, 1, 12)];

const fn rs(ecc: usize, blocks: usize, data: usize) -> RSDescriptor {
    RSDescriptor { ecc, blocks, data }
}

/// 按 `format_code - 1` 索引。
/// 解码时依次尝试每种布局，直到 RS 校验和 QR 位流解析都成功。
pub fn rs_layouts(format_code: usize) -> &'static [RSDescriptor] {
    match format_code {
        1 => &RS1,
        2 => &RS2,
        3 => &RS3,
        4 => &RS4,
        5 => &RS5,
        6 => &RS6,
        _ => &[],
    }
}

// ---------------------------------------------------------------------------
// 字段解码辅助函数
// ---------------------------------------------------------------------------

/// 计算两个整数的 Hamming 距离。
fn hamming(a: u32, b: u32) -> u32 {
    (a ^ b).count_ones()
}

/// 从 `start` 开始，返回前 `count` 个有效位置。
pub fn collect_positions(struct_bits: &[u8; RING_MODULES], start: usize, count: usize) -> Vec<usize> {
    let mut positions = Vec::with_capacity(count);
    let mut i = start;
    for _ in 0..RING_MODULES * 4 {
        let j = i % RING_MODULES;
        if struct_bits[j] != 0 {
            positions.push(j);
            if positions.len() == count {
                return positions;
            }
        }
        i += 1;
    }
    positions
}

/// 按给定位置把位序列拼成一个整数。
pub fn bits_to_int(bits: &[u8], positions: &[usize]) -> u32 {
    let mut value = 0u32;
    for &p in positions {
        value = (value << 1) | (bits[p] as u32 & 1);
    }
    value
}

/// 解码 15 位格式字段，返回 `(format_code, distance)`。
pub fn decode_format(bits_ring0: &[u8; RING_MODULES]) -> Option<(usize, u32)> {
    let positions = collect_positions(&STRUCT_BITS[0], FORMAT_START, FORMAT_LEN);
    let value = bits_to_int(bits_ring0, &positions) ^ FORMAT_XOR;
    let mut best_code = 0usize;
    let mut best_distance = u32::MAX;
    for (index, &codeword) in FORMAT_CODEWORDS.iter().enumerate() {
        let distance = hamming(value, codeword);
        if distance < best_distance {
            best_code = index + 1;
            best_distance = distance;
        }
    }
    if best_distance > FORMAT_MAX_HAMMING {
        return None;
    }
    Some((best_code, best_distance))
}

/// 解码 18 位参数字段，返回 `(param, mask_id, distance)`。
///
/// 先尝试原值，失败后再用 [`FIELD18_FALLBACK_XOR`] 重试。
pub fn decode_field18(bits_ring1: &[u8; RING_MODULES]) -> Option<(usize, usize, u32)> {
    let positions = collect_positions(&STRUCT_BITS[1], FIELD18_START, FIELD18_LEN);
    let value = bits_to_int(bits_ring1, &positions);
    for candidate in [value, value ^ FIELD18_FALLBACK_XOR] {
        let mut best_index = 0usize;
        let mut best_distance = u32::MAX;
        for (index, &codeword) in CW18.iter().enumerate() {
            let distance = hamming(candidate, codeword);
            if distance < best_distance {
                best_index = index;
                best_distance = distance;
            }
        }
        if best_distance <= FIELD18_MAX_HAMMING {
            return Some((best_index, best_index & 0x0f, best_distance));
        }
    }
    None
}

/// 去掉格式字段和参数字段后的每环有效位掩码。
pub struct DataLayout {
    pub masks: [[u8; RING_MODULES]; DATA_RINGS],
    #[allow(dead_code)] // 解码器只使用 masks；位置表供测试与诊断使用
    pub format_positions: Vec<usize>,
    #[allow(dead_code)]
    pub field_positions: Vec<usize>,
}

/// 构造每环的有效位掩码，并把格式/参数字段的位置清零。
pub fn data_valid_masks() -> DataLayout {
    let format_positions = collect_positions(&STRUCT_BITS[0], FORMAT_START, FORMAT_LEN);
    let field_positions = collect_positions(&STRUCT_BITS[1], FIELD18_START, FIELD18_LEN);
    let mut masks = STRUCT_BITS;
    for &p in &format_positions {
        masks[0][p] = 0;
    }
    for &p in &field_positions {
        masks[1][p] = 0;
    }
    DataLayout {
        masks,
        format_positions,
        field_positions,
    }
}

static LAYOUT: OnceLock<DataLayout> = OnceLock::new();

/// 全局共享的布局数据（WASM 单线程，只初始化一次）。
pub fn layout_data() -> &'static DataLayout {
    LAYOUT.get_or_init(data_valid_masks)
}
