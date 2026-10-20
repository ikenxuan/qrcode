//! 抖音码使用的 GF(256) 运算与 Reed-Solomon 纠错。
//!
//! 载荷是 GF(256) 上的系统化 RS(n, n-nsym) 码字，本原多项式为 0x11D，
//! 生成多项式为 `g(x) = (x - a^0)(x - a^1)...(x - a^(nsym-1))`，
//! 其中 fcr = 0。码字按传输顺序存储：`codeword[0]` 是最高次项系数。
//!
//! 实际样本使用 RS(52, 40)：40 个消息字节后跟 12 个校验字节。

const PRIMITIVE_POLY: u16 = 0x11d;

const fn build_tables() -> ([u8; 512], [u8; 256]) {
    let mut exp = [0u8; 512];
    let mut log = [0u8; 256];
    let mut x: u16 = 1;
    let mut i = 0;
    while i < 255 {
        exp[i] = x as u8;
        log[x as usize] = i as u8;
        x <<= 1;
        if x & 0x100 != 0 {
            x ^= PRIMITIVE_POLY;
        }
        i += 1;
    }
    let mut i = 255;
    while i < 512 {
        exp[i] = exp[i - 255];
        i += 1;
    }
    (exp, log)
}

static TABLES: ([u8; 512], [u8; 256]) = build_tables();

#[inline]
fn exp(index: usize) -> u8 {
    TABLES.0[index]
}

#[inline]
fn log(value: u8) -> usize {
    TABLES.1[value as usize] as usize
}

#[inline]
pub fn gf_mul(a: u8, b: u8) -> u8 {
    if a == 0 || b == 0 {
        return 0;
    }
    exp(log(a) + log(b))
}

pub fn gf_div(a: u8, b: u8) -> Result<u8, ()> {
    if b == 0 {
        return Err(());
    }
    if a == 0 {
        return Ok(0);
    }
    Ok(exp((log(a) + 255 - log(b)) % 255))
}

pub fn gf_pow(a: u8, n: usize) -> u8 {
    if n == 0 {
        return 1;
    }
    if a == 0 {
        return 0;
    }
    exp((log(a) * n) % 255)
}

pub fn gf_inv(a: u8) -> Result<u8, ()> {
    if a == 0 {
        return Err(());
    }
    Ok(exp(255 - log(a)))
}

/// 按最高次项在前的系数求多项式的值。
pub fn poly_eval(coeffs: &[u8], x: u8) -> u8 {
    let mut y = 0u8;
    for &c in coeffs {
        y = gf_mul(y, x) ^ c;
    }
    y
}

/// 返回码字的 `nsym` 个校验子（最高次项在前）。
pub fn syndromes(codeword: &[u8], nsym: usize, fcr: usize) -> Vec<u8> {
    (0..nsym)
        .map(|j| poly_eval(codeword, gf_pow(2, fcr + j)))
        .collect()
}

/// 返回 RS 生成多项式 `g(x) = ∏(x - a^(fcr+j))`（最高次项在前）。
pub fn generator_poly(nsym: usize, fcr: usize) -> Vec<u8> {
    let mut g = vec![1u8];
    for j in 0..nsym {
        let root = gf_pow(2, fcr + j);
        let mut next = vec![0u8; g.len() + 1];
        for (i, &coefficient) in g.iter().enumerate() {
            next[i] ^= coefficient;
            next[i + 1] ^= gf_mul(coefficient, root);
        }
        g = next;
    }
    g
}

/// 系统化 RS 编码：消息字节在前，`nsym` 个校验字节在后。
pub fn rs_encode(message: &[u8], nsym: usize, fcr: usize) -> Vec<u8> {
    let g = generator_poly(nsym, fcr);
    let mut work = vec![0u8; message.len() + nsym];
    work[..message.len()].copy_from_slice(message);
    for i in 0..message.len() {
        let coefficient = work[i];
        if coefficient == 0 {
            continue;
        }
        for (j, &g) in g.iter().enumerate() {
            work[i + j] ^= gf_mul(g, coefficient);
        }
    }
    let mut out = vec![0u8; message.len() + nsym];
    out[..message.len()].copy_from_slice(message);
    out[message.len()..].copy_from_slice(&work[work.len() - nsym..]);
    out
}

/// 根据校验子求错误定位多项式（最低次项在前）。
fn berlekamp_massey(synd: &[u8]) -> Vec<u8> {
    let mut lam = vec![1u8];
    let mut prev = vec![1u8];
    let mut l = 0usize;
    let mut m = 1usize;
    let mut b = 1u8;

    for n in 0..synd.len() {
        let mut d = synd[n];
        for i in 1..=l {
            if i < lam.len() {
                d ^= gf_mul(lam[i], synd[n - i]);
            }
        }
        if d == 0 {
            m += 1;
            continue;
        }

        let coef = gf_div(d, b).unwrap_or(0);
        let mut shifted = vec![0u8; m];
        shifted.extend_from_slice(&prev);
        let mut next = lam.clone();
        if next.len() < shifted.len() {
            next.resize(shifted.len(), 0);
        }
        for i in 0..shifted.len() {
            next[i] ^= gf_mul(coef, shifted[i]);
        }

        if 2 * l <= n {
            l = n + 1 - l;
            prev = lam;
            b = d;
            m = 1;
        } else {
            m += 1;
        }
        lam = next;
    }

    while lam.len() > 1 && lam[lam.len() - 1] == 0 {
        lam.pop();
    }
    lam
}

/// 纠正一个码字，返回 `(corrected, errors)`；不可纠正时返回 `Err`。
pub fn rs_correct(codeword: &[u8], nsym: usize, fcr: usize) -> Result<(Vec<u8>, usize), ()> {
    let synd = syndromes(codeword, nsym, fcr);
    if synd.iter().all(|&value| value == 0) {
        return Ok((codeword.to_vec(), 0));
    }

    let lam = berlekamp_massey(&synd);
    let nerr = lam.len().saturating_sub(1);
    if nerr == 0 || 2 * nerr > nsym {
        return Err(());
    }

    let n = codeword.len();
    let lam_rev: Vec<u8> = lam.iter().rev().copied().collect();
    // Chien 搜索：码字下标 i 处的错误位置为 X = a^(n-1-i)
    let mut positions: Vec<(usize, u8)> = Vec::with_capacity(nerr);
    for i in 0..n {
        let x = gf_pow(2, n - 1 - i);
        let xinv = gf_inv(x)?;
        if poly_eval(&lam_rev, xinv) == 0 {
            positions.push((i, x));
        }
    }
    if positions.len() != nerr {
        return Err(());
    }

    // Forney：Omega(x) = S(x) * Lambda(x) mod x^nsym，
    // 错误幅值 e = X * Omega(X^-1) / Lambda'(X^-1)
    let mut omega = vec![0u8; nsym];
    for i in 0..synd.len() {
        let sc = synd[i];
        if sc == 0 {
            continue;
        }
        for j in 0..lam.len() {
            if i + j < nsym {
                omega[i + j] ^= gf_mul(sc, lam[j]);
            }
        }
    }

    // lambda 的导数（系数按最低次项在前）：
    // 在特征 2 下，d/dx sum l_i x^i = sum (i mod 2) l_i x^(i-1)
    let mut dlam = vec![0u8; lam.len().saturating_sub(1)];
    for i in 1..lam.len() {
        if i & 1 == 1 {
            dlam[i - 1] = lam[i];
        }
    }

    let omega_rev: Vec<u8> = omega.iter().rev().copied().collect();
    let dlam_rev: Vec<u8> = dlam.iter().rev().copied().collect();
    let error_count = positions.len();
    let mut out = codeword.to_vec();
    for (index, x) in positions {
        let xinv = gf_inv(x)?;
        let num = poly_eval(&omega_rev, xinv);
        let den = poly_eval(&dlam_rev, xinv);
        if den == 0 {
            return Err(());
        }
        let magnitude = gf_mul(x, gf_div(num, den)?);
        out[index] ^= magnitude;
    }

    if syndromes(&out, nsym, fcr).iter().any(|&value| value != 0) {
        return Err(());
    }
    Ok((out, error_count))
}

#[cfg(test)]
mod tests {
    use super::*;

    const KNOWN_MESSAGE: [u8; 40] = [
        0x42, 0x16, 0x87, 0x47, 0x47, 0x07, 0x33, 0xa2, 0xf2, 0xf7, 0x62, 0xe6, 0x46, 0xf7, 0x57,
        0x96, 0x96, 0xe2, 0xe6, 0x36, 0xf6, 0xd2, 0xf7, 0x57, 0x46, 0x24, 0xb6, 0x75, 0x44, 0xa5,
        0x26, 0xd6, 0xc4, 0x92, 0xf0, 0xec, 0x11, 0xec, 0x11, 0xec,
    ];

    const KNOWN_PAYLOAD: [u8; 52] = [
        0x42, 0x16, 0x87, 0x47, 0x47, 0x07, 0x33, 0xa2, 0xf2, 0xf7, 0x62, 0xe6, 0x46, 0xf7, 0x57,
        0x96, 0x96, 0xe2, 0xe6, 0x36, 0xf6, 0xd2, 0xf7, 0x57, 0x46, 0x24, 0xb6, 0x75, 0x44, 0xa5,
        0x26, 0xd6, 0xc4, 0x92, 0xf0, 0xec, 0x11, 0xec, 0x11, 0xec, 0xe9, 0xd9, 0xe5, 0xae, 0x6b,
        0x32, 0x2f, 0x9d, 0x59, 0x4d, 0xd7, 0x3d,
    ];

    #[test]
    fn corrects_up_to_six_errors() {
        for count in 0..7 {
            let mut damaged = KNOWN_PAYLOAD;
            for i in 0..count {
                damaged[(i * 7 + 3) % damaged.len()] ^= 0x5a + i as u8;
            }
            let (corrected, errors) = rs_correct(&damaged, 12, 0).expect("correctable");
            assert_eq!(corrected, KNOWN_PAYLOAD);
            assert_eq!(errors, count);
        }
    }

    #[test]
    fn rejects_uncorrectable_block() {
        let mut damaged = KNOWN_PAYLOAD;
        for byte in damaged.iter_mut().take(7) {
            *byte ^= 0xff;
        }
        assert!(rs_correct(&damaged, 12, 0).is_err());
    }

    #[test]
    fn known_message_is_unchanged() {
        let (corrected, errors) = rs_correct(&KNOWN_PAYLOAD, 12, 0).expect("clean");
        assert_eq!(errors, 0);
        assert_eq!(&corrected[..40], &KNOWN_MESSAGE);
    }

    #[test]
    fn encoding_known_message_matches_official_payload() {
        let encoded = rs_encode(&KNOWN_MESSAGE, 12, 0);
        assert_eq!(encoded, KNOWN_PAYLOAD);
    }

    #[test]
    fn encoding_then_correcting_round_trips() {
        for count in 0..7 {
            let mut damaged = rs_encode(&KNOWN_MESSAGE, 12, 0);
            for i in 0..count {
                let index = (i * 11 + 5) % damaged.len();
                damaged[index] ^= 0x3c + i as u8;
            }
            let (corrected, errors) = rs_correct(&damaged, 12, 0).expect("correctable");
            assert_eq!(errors, count);
            assert_eq!(corrected, rs_encode(&KNOWN_MESSAGE, 12, 0));
        }
    }
}
