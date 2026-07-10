//! Logo image preprocessing utilities.

use image::codecs::png::PngEncoder;
use image::{ColorType, ImageEncoder};

/// Applies an anti-aliased rounded-rectangle alpha mask to a Logo image.
///
/// The radius is expressed as a ratio of each image axis so non-square source
/// images keep the same visual radius after the SVG renderer scales them. The
/// processed image is encoded as PNG because JPEG cannot preserve the newly
/// introduced transparent corners.
pub(crate) fn round_logo_corners(image_data: &[u8], round: f64) -> Result<Vec<u8>, String> {
    let round = normalize_round(round);
    if round == 0.0 {
        return Ok(image_data.to_vec());
    }

    let mut image = image::load_from_memory(image_data)
        .map_err(|error| format!("Logo image decode error: {error}"))?
        .to_rgba8();
    let (width, height) = image.dimensions();
    if width == 0 || height == 0 {
        return Err("Logo image dimensions must be greater than zero".to_string());
    }

    let radius_x = width as f64 * round;
    let radius_y = height as f64 * round;
    let feather = radius_x.min(radius_y).max(f64::EPSILON);

    for (x, y, pixel) in image.enumerate_pixels_mut() {
        let coverage = rounded_rect_coverage(
            x as f64 + 0.5,
            y as f64 + 0.5,
            width as f64,
            height as f64,
            radius_x,
            radius_y,
            feather,
        );
        pixel[3] = (f64::from(pixel[3]) * coverage).round() as u8;
    }

    let mut output = Vec::new();
    PngEncoder::new(&mut output)
        .write_image(image.as_raw(), width, height, ColorType::Rgba8.into())
        .map_err(|error| format!("Rounded Logo PNG encode error: {error}"))?;

    Ok(output)
}

fn normalize_round(round: f64) -> f64 {
    if round.is_finite() {
        round.clamp(0.0, 0.5)
    } else {
        0.0
    }
}

/// Returns pixel coverage for a rounded rectangle with a one-pixel soft edge.
fn rounded_rect_coverage(
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    radius_x: f64,
    radius_y: f64,
    feather: f64,
) -> f64 {
    if (radius_x..=width - radius_x).contains(&x) || (radius_y..=height - radius_y).contains(&y) {
        return 1.0;
    }

    let center_x = if x < radius_x {
        radius_x
    } else {
        width - radius_x
    };
    let center_y = if y < radius_y {
        radius_y
    } else {
        height - radius_y
    };
    let normalized_distance =
        (((x - center_x) / radius_x).powi(2) + ((y - center_y) / radius_y).powi(2)).sqrt();

    (0.5 + (1.0 - normalized_distance) * feather).clamp(0.0, 1.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgba, RgbaImage};

    fn solid_png(width: u32, height: u32) -> Vec<u8> {
        let image = RgbaImage::from_pixel(width, height, Rgba([255, 0, 0, 255]));
        let mut output = Vec::new();
        PngEncoder::new(&mut output)
            .write_image(image.as_raw(), width, height, ColorType::Rgba8.into())
            .expect("test PNG should encode");
        output
    }

    #[test]
    fn zero_round_keeps_original_bytes() {
        let source = solid_png(20, 20);
        assert_eq!(round_logo_corners(&source, 0.0).unwrap(), source);
    }

    #[test]
    fn half_round_makes_corners_transparent_and_keeps_center_opaque() {
        let rounded = round_logo_corners(&solid_png(20, 20), 0.5).unwrap();
        let image = image::load_from_memory(&rounded).unwrap().to_rgba8();

        assert_eq!(image.get_pixel(0, 0)[3], 0);
        assert_eq!(image.get_pixel(10, 10)[3], 255);
        assert!(image.get_pixel(2, 3)[3] > 0 && image.get_pixel(2, 3)[3] < 255);
    }

    #[test]
    fn non_finite_round_keeps_original_bytes() {
        let source = solid_png(20, 20);
        assert_eq!(round_logo_corners(&source, f64::NAN).unwrap(), source);
    }
}
