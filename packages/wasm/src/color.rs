use qr_code_styling::config::Color;

/// 解析 CSS 颜色字符串为 Color
///
/// 支持格式：
/// - hex: `#RGB`, `#RRGGBB`, `#RRGGBBAA`
/// - rgb/rgba: `rgb(r, g, b)`, `rgba(r, g, b, a)`, `rgb(r g b / a)`
/// - hsl/hsla: `hsl(h, s%, l%)`, `hsla(h, s%, l%, a)`, `hsl(h s% l% / a)`
/// - oklab: `oklab(L a b)`, `oklab(L a b / alpha)`
/// - oklch: `oklch(L C H)`, `oklch(L C H / alpha)`
/// - 命名颜色: `transparent`, `black`, `white` 等
pub fn parse_color(s: &str) -> Color {
    let s = s.trim();
    if let Some(c) = parse_rgba(s) { return c; }
    if let Some(c) = parse_rgb(s) { return c; }
    if let Some(c) = parse_hsla(s) { return c; }
    if let Some(c) = parse_hsl(s) { return c; }
    if let Some(c) = parse_oklab(s) { return c; }
    if let Some(c) = parse_oklch(s) { return c; }
    if let Some(c) = parse_named(s) { return c; }
    Color::from_hex(s).unwrap_or(Color::rgb(0, 0, 0))
}

fn parse_alpha(s: &str) -> u8 {
    if let Some(pct) = s.strip_suffix('%') {
        let v = pct.parse::<f64>().unwrap_or(100.0) / 100.0;
        (v.clamp(0.0, 1.0) * 255.0) as u8
    } else {
        let v = s.parse::<f64>().unwrap_or(1.0);
        (v.clamp(0.0, 1.0) * 255.0) as u8
    }
}

fn parse_rgba(s: &str) -> Option<Color> {
    let inner = s.strip_prefix("rgba(")?.strip_suffix(')')?;
    if let Some((rgb, a)) = inner.rsplit_once('/') {
        let parts: Vec<&str> = rgb.split_whitespace().collect();
        if parts.len() == 3 {
            let r = parts[0].trim().parse::<u8>().ok()?;
            let g = parts[1].trim().parse::<u8>().ok()?;
            let b = parts[2].trim().parse::<u8>().ok()?;
            let a = parse_alpha(a.trim());
            return Some(Color::rgba(r, g, b, a));
        }
    }
    let parts: Vec<&str> = inner.split(',').collect();
    if parts.len() == 4 {
        let r = parts[0].trim().parse::<u8>().ok()?;
        let g = parts[1].trim().parse::<u8>().ok()?;
        let b = parts[2].trim().parse::<u8>().ok()?;
        let a = parse_alpha(parts[3].trim());
        return Some(Color::rgba(r, g, b, a));
    }
    None
}

fn parse_rgb(s: &str) -> Option<Color> {
    let inner = s.strip_prefix("rgb(")?.strip_suffix(')')?;
    if let Some((rgb, a)) = inner.rsplit_once('/') {
        let parts: Vec<&str> = rgb.split_whitespace().collect();
        if parts.len() == 3 {
            let r = parts[0].trim().parse::<u8>().ok()?;
            let g = parts[1].trim().parse::<u8>().ok()?;
            let b = parts[2].trim().parse::<u8>().ok()?;
            let a = parse_alpha(a.trim());
            return Some(Color::rgba(r, g, b, a));
        }
    }
    let parts: Vec<&str> = inner.split(',').collect();
    if parts.len() == 3 {
        let r = parts[0].trim().parse::<u8>().ok()?;
        let g = parts[1].trim().parse::<u8>().ok()?;
        let b = parts[2].trim().parse::<u8>().ok()?;
        return Some(Color::rgb(r, g, b));
    }
    None
}

fn parse_hsla(s: &str) -> Option<Color> {
    let inner = s.strip_prefix("hsla(")?.strip_suffix(')')?;
    let parts: Vec<&str> = inner.split(',').collect();
    if parts.len() == 4 {
        let h = parts[0].trim().parse::<f64>().ok()?;
        let sat = parts[1].trim().trim_end_matches('%').parse::<f64>().ok()? / 100.0;
        let l = parts[2].trim().trim_end_matches('%').parse::<f64>().ok()? / 100.0;
        let a = parse_alpha(parts[3].trim());
        let (r, g, b) = hsl_to_rgb(h, sat, l);
        return Some(Color::rgba(r, g, b, a));
    }
    None
}

// PLACEHOLDER_HSL_AND_REST

fn parse_hsl(s: &str) -> Option<Color> {
    let inner = s.strip_prefix("hsl(")?.strip_suffix(')')?;
    if let Some((hsl, a)) = inner.rsplit_once('/') {
        let parts: Vec<&str> = hsl.split_whitespace().collect();
        if parts.len() == 3 {
            let h = parts[0].trim_end_matches("deg").parse::<f64>().ok()?;
            let sat = parts[1].trim_end_matches('%').parse::<f64>().ok()? / 100.0;
            let l = parts[2].trim_end_matches('%').parse::<f64>().ok()? / 100.0;
            let alpha = parse_alpha(a.trim());
            let (r, g, b) = hsl_to_rgb(h, sat, l);
            return Some(Color::rgba(r, g, b, alpha));
        }
    }
    let parts: Vec<&str> = inner.split(',').collect();
    if parts.len() == 3 {
        let h = parts[0].trim().parse::<f64>().ok()?;
        let sat = parts[1].trim().trim_end_matches('%').parse::<f64>().ok()? / 100.0;
        let l = parts[2].trim().trim_end_matches('%').parse::<f64>().ok()? / 100.0;
        let (r, g, b) = hsl_to_rgb(h, sat, l);
        return Some(Color::rgb(r, g, b));
    }
    None
}

fn parse_oklab(s: &str) -> Option<Color> {
    let inner = s.strip_prefix("oklab(")?.strip_suffix(')')?;
    let (vals, alpha) = split_alpha(inner);
    let parts: Vec<&str> = vals.split_whitespace().collect();
    if parts.len() != 3 { return None; }
    let l = parse_component_ratio(parts[0])?;
    let a_val = parse_signed_component(parts[1])?;
    let b_val = parse_signed_component(parts[2])?;
    let (r, g, b) = oklab_to_srgb(l, a_val, b_val);
    Some(match alpha {
        Some(a) => Color::rgba(r, g, b, a),
        None => Color::rgb(r, g, b),
    })
}

fn parse_oklch(s: &str) -> Option<Color> {
    let inner = s.strip_prefix("oklch(")?.strip_suffix(')')?;
    let (vals, alpha) = split_alpha(inner);
    let parts: Vec<&str> = vals.split_whitespace().collect();
    if parts.len() != 3 { return None; }
    let l = parse_component_ratio(parts[0])?;
    let c = parse_positive_component(parts[1])?;
    let h = parts[2].trim_end_matches("deg").parse::<f64>().ok()?;
    let h_rad = h.to_radians();
    let a_val = c * h_rad.cos();
    let b_val = c * h_rad.sin();
    let (r, g, b) = oklab_to_srgb(l, a_val, b_val);
    Some(match alpha {
        Some(a) => Color::rgba(r, g, b, a),
        None => Color::rgb(r, g, b),
    })
}

// PLACEHOLDER_HELPERS

fn split_alpha(s: &str) -> (&str, Option<u8>) {
    if let Some((vals, a)) = s.rsplit_once('/') {
        (vals.trim(), Some(parse_alpha(a.trim())))
    } else {
        (s, None)
    }
}

fn parse_component_ratio(s: &str) -> Option<f64> {
    if let Some(pct) = s.strip_suffix('%') {
        Some(pct.parse::<f64>().ok()? / 100.0)
    } else {
        s.parse::<f64>().ok()
    }
}

fn parse_signed_component(s: &str) -> Option<f64> {
    if let Some(pct) = s.strip_suffix('%') {
        Some(pct.parse::<f64>().ok()? / 100.0 * 0.4)
    } else {
        s.parse::<f64>().ok()
    }
}

fn parse_positive_component(s: &str) -> Option<f64> {
    if let Some(pct) = s.strip_suffix('%') {
        Some(pct.parse::<f64>().ok()? / 100.0 * 0.4)
    } else {
        s.parse::<f64>().ok()
    }
}

fn oklab_to_srgb(l: f64, a: f64, b: f64) -> (u8, u8, u8) {
    let l_ = l + 0.3963377774 * a + 0.2158037573 * b;
    let m_ = l - 0.1055613458 * a - 0.0638541728 * b;
    let s_ = l - 0.0894841775 * a - 1.2914855480 * b;

    let l3 = l_ * l_ * l_;
    let m3 = m_ * m_ * m_;
    let s3 = s_ * s_ * s_;

    let r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
    let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
    let b = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

    (
        linear_to_srgb(r),
        linear_to_srgb(g),
        linear_to_srgb(b),
    )
}

fn linear_to_srgb(x: f64) -> u8 {
    let c = if x >= 0.0031308 {
        1.055 * x.powf(1.0 / 2.4) - 0.055
    } else {
        12.92 * x
    };
    (c.clamp(0.0, 1.0) * 255.0).round() as u8
}

// PLACEHOLDER_HSL_HELPERS

fn hsl_to_rgb(h: f64, s: f64, l: f64) -> (u8, u8, u8) {
    let h = ((h % 360.0) + 360.0) % 360.0 / 360.0;
    let (r, g, b) = if s == 0.0 {
        (l, l, l)
    } else {
        let q = if l < 0.5 { l * (1.0 + s) } else { l + s - l * s };
        let p = 2.0 * l - q;
        (
            hue_to_rgb(p, q, h + 1.0 / 3.0),
            hue_to_rgb(p, q, h),
            hue_to_rgb(p, q, h - 1.0 / 3.0),
        )
    };
    ((r * 255.0) as u8, (g * 255.0) as u8, (b * 255.0) as u8)
}

fn hue_to_rgb(p: f64, q: f64, mut t: f64) -> f64 {
    if t < 0.0 { t += 1.0; }
    if t > 1.0 { t -= 1.0; }
    if t < 1.0 / 6.0 { return p + (q - p) * 6.0 * t; }
    if t < 1.0 / 2.0 { return q; }
    if t < 2.0 / 3.0 { return p + (q - p) * (2.0 / 3.0 - t) * 6.0; }
    p
}

fn parse_named(s: &str) -> Option<Color> {
    match s.to_lowercase().as_str() {
        "transparent" => Some(Color::rgba(0, 0, 0, 0)),
        "black" => Some(Color::rgb(0, 0, 0)),
        "white" => Some(Color::rgb(255, 255, 255)),
        "red" => Some(Color::rgb(255, 0, 0)),
        "green" => Some(Color::rgb(0, 128, 0)),
        "blue" => Some(Color::rgb(0, 0, 255)),
        "yellow" => Some(Color::rgb(255, 255, 0)),
        "cyan" | "aqua" => Some(Color::rgb(0, 255, 255)),
        "magenta" | "fuchsia" => Some(Color::rgb(255, 0, 255)),
        "orange" => Some(Color::rgb(255, 165, 0)),
        "purple" => Some(Color::rgb(128, 0, 128)),
        "gray" | "grey" => Some(Color::rgb(128, 128, 128)),
        _ => None,
    }
}

// PLACEHOLDER_TESTS

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hex() {
        assert_eq!(parse_color("#FF0000"), Color::rgb(255, 0, 0));
        assert_eq!(parse_color("#00FF00"), Color::rgb(0, 255, 0));
        assert_eq!(parse_color("#0000FF"), Color::rgb(0, 0, 255));
        assert_eq!(parse_color("#00000080"), Color::rgba(0, 0, 0, 128));
        assert_eq!(parse_color("#FFF"), Color::rgb(255, 255, 255));
    }

    #[test]
    fn test_rgb() {
        assert_eq!(parse_color("rgb(255, 0, 0)"), Color::rgb(255, 0, 0));
        assert_eq!(parse_color("rgb(0, 128, 255)"), Color::rgb(0, 128, 255));
    }

    #[test]
    fn test_rgb_with_alpha() {
        assert_eq!(parse_color("rgb(255 0 0 / 0.5)"), Color::rgba(255, 0, 0, 127));
        assert_eq!(parse_color("rgb(0 0 0 / 50%)"), Color::rgba(0, 0, 0, 127));
    }

    #[test]
    fn test_rgba() {
        assert_eq!(parse_color("rgba(0, 0, 0, 0.5)"), Color::rgba(0, 0, 0, 127));
        assert_eq!(parse_color("rgba(255, 255, 255, 1)"), Color::rgba(255, 255, 255, 255));
        assert_eq!(parse_color("rgba(255, 0, 0, 0)"), Color::rgba(255, 0, 0, 0));
        assert_eq!(parse_color("rgba(0, 0, 0, 50%)"), Color::rgba(0, 0, 0, 127));
    }

    #[test]
    fn test_rgba_space_syntax() {
        assert_eq!(parse_color("rgba(255 0 0 / 0.5)"), Color::rgba(255, 0, 0, 127));
    }

    #[test]
    fn test_hsl() {
        let c = parse_color("hsl(0, 100%, 50%)");
        assert_eq!(c, Color::rgb(255, 0, 0));
        let c = parse_color("hsl(120, 100%, 50%)");
        assert_eq!(c, Color::rgb(0, 255, 0));
        let c = parse_color("hsl(240, 100%, 50%)");
        assert_eq!(c, Color::rgb(0, 0, 255));
    }

    // PLACEHOLDER_MORE_TESTS

    #[test]
    fn test_hsl_space_syntax_with_alpha() {
        let c = parse_color("hsl(0deg 100% 50% / 0.5)");
        assert_eq!(c, Color::rgba(255, 0, 0, 127));
    }

    #[test]
    fn test_hsla() {
        let c = parse_color("hsla(0, 100%, 50%, 0.5)");
        assert_eq!(c, Color::rgba(255, 0, 0, 127));
    }

    #[test]
    fn test_oklab() {
        let c = parse_color("oklab(0 0 0)");
        assert_eq!(c, Color::rgb(0, 0, 0));
        let c = parse_color("oklab(1 0 0)");
        assert_eq!(c, Color::rgb(255, 255, 255));
    }

    #[test]
    fn test_oklab_with_alpha() {
        let c = parse_color("oklab(0.5 0 0 / 0.5)");
        assert_eq!(c.a, 127);
    }

    #[test]
    fn test_oklch() {
        let c = parse_color("oklch(0 0 0)");
        assert_eq!(c, Color::rgb(0, 0, 0));
        let c = parse_color("oklch(1 0 0)");
        assert_eq!(c, Color::rgb(255, 255, 255));
    }

    #[test]
    fn test_oklch_with_alpha() {
        let c = parse_color("oklch(0.7 0.1 150deg / 50%)");
        assert_eq!(c.a, 127);
    }

    #[test]
    fn test_oklch_chromatic() {
        let c = parse_color("oklch(0.7 0.15 30)");
        assert!(c.r > 150);
        assert!(c.g < c.r);
    }

    #[test]
    fn test_named_colors() {
        assert_eq!(parse_color("transparent"), Color::rgba(0, 0, 0, 0));
        assert_eq!(parse_color("black"), Color::rgb(0, 0, 0));
        assert_eq!(parse_color("white"), Color::rgb(255, 255, 255));
        assert_eq!(parse_color("red"), Color::rgb(255, 0, 0));
        assert_eq!(parse_color("Blue"), Color::rgb(0, 0, 255));
    }

    #[test]
    fn test_invalid_fallback() {
        assert_eq!(parse_color("not-a-color"), Color::rgb(0, 0, 0));
    }
}
