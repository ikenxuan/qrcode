//! 在图片中定位抖音码，并采样四条数据环。
//!
//! 支持两种版式：
//!
//! - 作品分享码：中心实心暗圆盘提供几何锚点；
//! - 个人名片码：中心是白色圆盘和头像，周围有三个圆形定位标记，
//!   分别位于 45/135/225 度方向。三个标记的外心即码心，
//!   它们到码心的平均距离用于计算尺度。

use std::cmp::Ordering;
use std::collections::VecDeque;

use image::GrayImage;

use super::layout::{DISK_RADIUS, RING_MODULES, RING_RADII};

/// 码心到定位圆环中心的距离（设计单位）。
pub const FINDER_DISTANCE: f64 = 100.0;

/// 名片码白色圆盘的设计半径（兜底尺度锚点）。
pub const BRIGHT_DISK_RADIUS: f64 = 121.0;

/// 定位器给出的一个中心/尺度假设。
#[derive(Clone, Debug)]
pub struct Locator {
    pub center: (f64, f64),
    pub scale_base: f64,
    pub span: f64,
    pub steps: usize,
    /// 该定位器对应的定位点（原图坐标）。
    ///
    /// 作品分享码只有中心圆盘这一个锚点；名片码是三个圆形定位标记的中心。
    pub points: Vec<(f64, f64)>,
}

#[derive(Clone, Copy, Debug, Default)]
pub struct ComponentStats {
    pub x: i64,
    pub y: i64,
    pub width: i64,
    pub height: i64,
    pub area: u64,
    pub cx: f64,
    pub cy: f64,
}

/// 对二值掩码做 8 连通域标记，返回每个连通域的统计信息。
fn connected_components(binary: &[u8], width: usize, height: usize) -> Vec<ComponentStats> {
    let mut labels = vec![0i32; width * height];
    let mut stats = vec![ComponentStats::default()];
    let mut queue: VecDeque<u32> = VecDeque::new();
    let mut label = 0i32;

    for start in 0..binary.len() {
        if binary[start] == 0 || labels[start] != 0 {
            continue;
        }
        label += 1;
        queue.clear();
        queue.push_back(start as u32);
        labels[start] = label;

        let mut min_x = width as i64;
        let mut min_y = height as i64;
        let mut max_x = -1i64;
        let mut max_y = -1i64;
        let mut area = 0u64;
        let mut sum_x = 0i128;
        let mut sum_y = 0i128;

        while let Some(index) = queue.pop_front() {
            let index = index as usize;
            let x = (index % width) as i64;
            let y = (index / width) as i64;
            area += 1;
            sum_x += x as i128;
            sum_y += y as i128;
            min_x = min_x.min(x);
            max_x = max_x.max(x);
            min_y = min_y.min(y);
            max_y = max_y.max(y);

            for dy in -1i64..=1 {
                let ny = y + dy;
                if ny < 0 || ny >= height as i64 {
                    continue;
                }
                for dx in -1i64..=1 {
                    if dx == 0 && dy == 0 {
                        continue;
                    }
                    let nx = x + dx;
                    if nx < 0 || nx >= width as i64 {
                        continue;
                    }
                    let nindex = ny as usize * width + nx as usize;
                    if binary[nindex] != 0 && labels[nindex] == 0 {
                        labels[nindex] = label;
                        queue.push_back(nindex as u32);
                    }
                }
            }
        }

        stats.push(ComponentStats {
            x: min_x,
            y: min_y,
            width: max_x - min_x + 1,
            height: max_y - min_y + 1,
            area,
            cx: sum_x as f64 / area as f64,
            cy: sum_y as f64 / area as f64,
        });
    }

    stats
}

/// 按谓词把灰度图转换成 0/1 掩码。
fn threshold_mask(gray: &GrayImage, predicate: impl Fn(u8) -> bool) -> Vec<u8> {
    gray.as_raw()
        .iter()
        .map(|&value| u8::from(predicate(value)))
        .collect()
}

/// 返回不接触图片边界、面积最大的连通域；没有时返回 `None`。
fn largest_non_border_component(
    binary: &[u8],
    width: usize,
    height: usize,
) -> Option<ComponentStats> {
    let stats = connected_components(binary, width, height);
    let mut best: Option<ComponentStats> = None;
    for stat in stats.iter().skip(1) {
        if stat.x <= 1
            || stat.y <= 1
            || stat.x + stat.width >= width as i64 - 1
            || stat.y + stat.height >= height as i64 - 1
        {
            continue;
        }
        if best.as_ref().is_none_or(|current| stat.area > current.area) {
            best = Some(*stat);
        }
    }
    best
}

/// 找到名片码的白色圆盘，返回 `(cx, cy, radius)`。
pub fn find_bright_disk(gray: &GrayImage) -> Option<(f64, f64, f64)> {
    let (width, height) = gray.dimensions();
    let bright = threshold_mask(gray, |value| value > 200);
    let found = largest_non_border_component(&bright, width as usize, height as usize)?;
    Some((
        found.cx,
        found.cy,
        (found.width + found.height) as f64 / 4.0,
    ))
}

/// 求三个点的外心；三点共线时返回 `None`。
pub fn circumcenter(points: &[(f64, f64); 3]) -> Option<(f64, f64)> {
    let [(x1, y1), (x2, y2), (x3, y3)] = *points;
    let d = 2.0 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
    if d.abs() < 1e-9 {
        return None;
    }
    let ux = ((x1 * x1 + y1 * y1) * (y2 - y3)
        + (x2 * x2 + y2 * y2) * (y3 - y1)
        + (x3 * x3 + y3 * y3) * (y1 - y2))
        / d;
    let uy = ((x1 * x1 + y1 * y1) * (x3 - x2)
        + (x2 * x2 + y2 * y2) * (x1 - x3)
        + (x3 * x3 + y3 * y3) * (x2 - x1))
        / d;
    Some((ux, uy))
}

#[derive(Clone, Copy, Debug)]
struct FinderCandidate {
    area: u64,
    dist: f64,
    x: f64,
    y: f64,
}

pub struct FinderResult {
    pub center: (f64, f64),
    pub distance: f64,
    /// 三个圆形定位标记的中心（原图坐标）。
    pub points: [(f64, f64); 3],
}

/// 找到名片码的三个圆形定位标记，返回外心与平均距离。
pub fn find_finders(
    gray: &GrayImage,
    center: (f64, f64),
    radius: f64,
) -> Option<FinderResult> {
    let (width, height) = gray.dimensions();
    let (cx, cy) = center;
    let dark = threshold_mask(gray, |value| value < 128);
    let stats = connected_components(&dark, width as usize, height as usize);
    let mut candidates: Vec<FinderCandidate> = Vec::new();

    for stat in stats.iter().skip(1) {
        let longest = stat.width.max(stat.height) as f64;
        if !(0.05 * radius <= longest && longest <= 0.32 * radius) {
            continue;
        }
        if stat.height == 0 {
            continue;
        }
        let aspect = stat.width as f64 / stat.height as f64;
        if !(0.6 <= aspect && aspect <= 1.6) {
            continue;
        }
        let fill = stat.area as f64 / (stat.width * stat.height) as f64;
        if !(0.25 <= fill && fill <= 0.8) {
            continue;
        }
        let dist = (stat.cx - cx).hypot(stat.cy - cy);
        if !(0.6 * radius <= dist && dist <= 0.95 * radius) {
            continue;
        }
        candidates.push(FinderCandidate {
            area: stat.area,
            dist,
            x: stat.cx,
            y: stat.cy,
        });
    }

    if candidates.len() < 3 {
        return None;
    }
    candidates.sort_by(|a, b| {
        b.area
            .cmp(&a.area)
            .then_with(|| b.dist.partial_cmp(&a.dist).unwrap_or(Ordering::Equal))
            .then_with(|| b.x.partial_cmp(&a.x).unwrap_or(Ordering::Equal))
            .then_with(|| b.y.partial_cmp(&a.y).unwrap_or(Ordering::Equal))
    });

    let top = &candidates[..candidates.len().min(8)];
    let mut best: Option<(u64, (f64, f64), f64, [(f64, f64); 3])> = None;

    for i in 0..top.len() {
        for j in (i + 1)..top.len() {
            for k in (j + 1)..top.len() {
                let trio = [top[i], top[j], top[k]];
                let max_distance = trio
                    .iter()
                    .map(|item| item.dist)
                    .fold(f64::NEG_INFINITY, f64::max);
                let min_distance = trio
                    .iter()
                    .map(|item| item.dist)
                    .fold(f64::INFINITY, f64::min);
                if max_distance / min_distance > 1.05 {
                    continue;
                }
                let points = [(trio[0].x, trio[0].y), (trio[1].x, trio[1].y), (trio[2].x, trio[2].y)];
                let Some(cc) = circumcenter(&points) else {
                    continue;
                };
                if (cc.0 - cx).hypot(cc.1 - cy) > 0.1 * radius {
                    continue;
                }
                let mut angles = [
                    (points[0].1 - cc.1).atan2(points[0].0 - cc.0),
                    (points[1].1 - cc.1).atan2(points[1].0 - cc.0),
                    (points[2].1 - cc.1).atan2(points[2].0 - cc.0),
                ];
                angles.sort_by(|a, b| a.partial_cmp(b).unwrap_or(Ordering::Equal));
                let tau = std::f64::consts::TAU;
                let gaps = [
                    (angles[1] - angles[0]).rem_euclid(tau),
                    (angles[2] - angles[1]).rem_euclid(tau),
                    (angles[0] + tau - angles[2]).rem_euclid(tau),
                ];
                if gaps.iter().copied().fold(f64::INFINITY, f64::min)
                    < (40.0 * std::f64::consts::PI) / 180.0
                {
                    continue;
                }
                let score = trio.iter().map(|item| item.area).sum::<u64>();
                if best.as_ref().is_none_or(|current| score > current.0) {
                    let distance = trio.iter().map(|item| item.dist).sum::<f64>() / 3.0;
                    best = Some((score, cc, distance, points));
                }
            }
        }
    }

    let (_, center, distance, points) = best?;
    Some(FinderResult {
        center,
        distance,
        points,
    })
}

/// 不依赖中心圆盘，直接在整张图中寻找三个定位圆环。
///
/// 中心换成自定义图片后，深色圆盘会消失，`find_finders` 依赖的白色圆盘
/// 半径也会变成中心留白，无法再作为尺度参考。这里改为按形状挑选环形
/// 连通域，再用“三个点近似正方形分布”筛选定位环。
pub fn find_finders_global(gray: &GrayImage) -> Option<FinderResult> {
    let (width, height) = gray.dimensions();
    let min_side = width.min(height) as f64;
    let dark = threshold_mask(gray, |value| value < 128);
    let stats = connected_components(&dark, width as usize, height as usize);
    let mut candidates: Vec<FinderCandidate> = Vec::new();

    for stat in stats.iter().skip(1) {
        if stat.x <= 1
            || stat.y <= 1
            || stat.x + stat.width >= width as i64 - 1
            || stat.y + stat.height >= height as i64 - 1
        {
            continue;
        }
        let longest = stat.width.max(stat.height) as f64;
        if !(0.035 * min_side <= longest && longest <= 0.13 * min_side) {
            continue;
        }
        if stat.height == 0 {
            continue;
        }
        let aspect = stat.width as f64 / stat.height as f64;
        if !(0.6 <= aspect && aspect <= 1.6) {
            continue;
        }
        let fill = stat.area as f64 / (stat.width * stat.height) as f64;
        if !(0.3..=0.8).contains(&fill) {
            continue;
        }
        candidates.push(FinderCandidate {
            area: stat.area,
            dist: 0.0,
            x: stat.cx,
            y: stat.cy,
        });
    }

    if candidates.len() < 3 {
        return None;
    }

    candidates.sort_by(|a, b| {
        b.area
            .cmp(&a.area)
            .then_with(|| a.x.partial_cmp(&b.x).unwrap_or(Ordering::Equal))
            .then_with(|| a.y.partial_cmp(&b.y).unwrap_or(Ordering::Equal))
    });

    let top = &candidates[..candidates.len().min(12)];
    let mut best: Option<(u64, (f64, f64), f64, [(f64, f64); 3])> = None;

    for i in 0..top.len() {
        for j in (i + 1)..top.len() {
            for k in (j + 1)..top.len() {
                let trio = [top[i], top[j], top[k]];
                let area_min = trio.iter().map(|item| item.area).min().unwrap_or(0);
                let area_max = trio.iter().map(|item| item.area).max().unwrap_or(0);
                if area_min == 0 || area_max > area_min * 2 {
                    continue;
                }
                let points = [
                    (trio[0].x, trio[0].y),
                    (trio[1].x, trio[1].y),
                    (trio[2].x, trio[2].y),
                ];
                let Some(cc) = circumcenter(&points) else {
                    continue;
                };
                if cc.0 < 0.0 || cc.1 < 0.0 || cc.0 > width as f64 || cc.1 > height as f64 {
                    continue;
                }

                let mut angles = [
                    (points[0].1 - cc.1).atan2(points[0].0 - cc.0),
                    (points[1].1 - cc.1).atan2(points[1].0 - cc.0),
                    (points[2].1 - cc.1).atan2(points[2].0 - cc.0),
                ];
                angles.sort_by(|a, b| a.partial_cmp(b).unwrap_or(Ordering::Equal));
                let tau = std::f64::consts::TAU;
                let gaps = [
                    (angles[1] - angles[0]).rem_euclid(tau),
                    (angles[2] - angles[1]).rem_euclid(tau),
                    (angles[0] + tau - angles[2]).rem_euclid(tau),
                ];
                let min_gap = gaps.iter().copied().fold(f64::INFINITY, f64::min);
                let max_gap = gaps.iter().copied().fold(f64::NEG_INFINITY, f64::max);
                // 三个定位环在 45° / 135° / 225°，间隔约为 90°、90°、180°。
                if min_gap < 60.0_f64.to_radians() || max_gap < 150.0_f64.to_radians() {
                    continue;
                }

                let distance = trio
                    .iter()
                    .map(|item| (item.x - cc.0).hypot(item.y - cc.1))
                    .sum::<f64>()
                    / 3.0;
                let score = trio.iter().map(|item| item.area).sum::<u64>();
                if best.as_ref().is_none_or(|current| score > current.0) {
                    best = Some((score, cc, distance, points));
                }
            }
        }
    }

    let (_, center, distance, points) = best?;
    Some(FinderResult {
        center,
        distance,
        points,
    })
}

/// 以 `base` 为中心、`+/- span` 为范围生成一组尺度因子。
pub fn scale_grid(base: f64, steps: usize, span: f64) -> Vec<f64> {
    if steps <= 1 {
        return vec![base];
    }
    (0..steps)
        .map(|i| {
            let offset = -span + (2.0 * span * i as f64) / (steps - 1) as f64;
            base * (1.0 + offset)
        })
        .collect()
}

/// 收集图中所有近似实心圆形的暗色连通域，按圆度排序。
///
/// 作品分享码的中心圆盘在整张截图里往往不是最大的暗色块（深色弹窗、
/// 视频画面都可能更大），因此不能只取最大连通域。这里按“接近圆盘”
/// 的形状筛选：外接框近似正方形、填充率接近 π/4，再用填充率和长宽比
/// 给圆度打分。
fn dark_disk_candidates(gray: &GrayImage) -> Vec<ComponentStats> {
    const MAX_CANDIDATES: usize = 8;
    const MIN_SIDE: i64 = 16;

    let (width, height) = gray.dimensions();
    let dark = threshold_mask(gray, |value| value < 128);
    let stats = connected_components(&dark, width as usize, height as usize);
    let mut scored: Vec<(f64, ComponentStats)> = Vec::new();

    for stat in stats.iter().skip(1) {
        if stat.width < MIN_SIDE || stat.height < MIN_SIDE {
            continue;
        }
        if stat.x <= 1
            || stat.y <= 1
            || stat.x + stat.width >= width as i64 - 1
            || stat.y + stat.height >= height as i64 - 1
        {
            continue;
        }
        let aspect = stat.width as f64 / stat.height as f64;
        if !(0.75..=1.33).contains(&aspect) {
            continue;
        }
        let fill = stat.area as f64 / (stat.width * stat.height) as f64;
        if !(0.55..=0.9).contains(&fill) {
            continue;
        }
        let score = (fill - std::f64::consts::FRAC_PI_4).abs() + (aspect - 1.0).abs() * 0.5;
        scored.push((score, *stat));
    }

    scored.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(Ordering::Equal));
    scored
        .into_iter()
        .take(MAX_CANDIDATES)
        .map(|(_, stat)| stat)
        .collect()
}

/// 返回中心/尺度假设，按可信度从高到低排列。
///
/// - 实心暗盘（作品分享码）；
/// - 图中其他近似圆形的暗色块（暗盘不是最大暗块时的兜底）；
/// - 白色名片上的三个定位标记（名片码）；
/// - 白色圆盘质心加校准半径（兜底方案）。
pub fn locator_candidates(gray: &GrayImage) -> Vec<Locator> {
    let (width, height) = gray.dimensions();
    let mut locators = Vec::new();

    let dark = threshold_mask(gray, |value| value < 128);
    let largest = largest_non_border_component(&dark, width as usize, height as usize);
    if let Some(found) = largest {
        let radius = (found.width + found.height) as f64 / 4.0;
        locators.push(Locator {
            center: (found.cx, found.cy),
            scale_base: radius / DISK_RADIUS,
            span: 0.03,
            steps: 13,
            points: vec![(found.cx, found.cy)],
        });
    }

    for disk in dark_disk_candidates(gray) {
        // 与最大暗块重复的候选跳过。
        if largest.is_some_and(|found| {
            (found.cx - disk.cx).hypot(found.cy - disk.cy) < 2.0
                && (found.width - disk.width).abs() <= 2
                && (found.height - disk.height).abs() <= 2
        }) {
            continue;
        }
        let radius = (disk.width + disk.height) as f64 / 4.0;
        locators.push(Locator {
            center: (disk.cx, disk.cy),
            scale_base: radius / DISK_RADIUS,
            span: 0.04,
            steps: 9,
            points: vec![(disk.cx, disk.cy)],
        });
    }

    if let Some((bx, by, bright_radius)) = find_bright_disk(gray) {
        if let Some(finders) = find_finders(gray, (bx, by), bright_radius) {
            locators.push(Locator {
                center: finders.center,
                scale_base: finders.distance / FINDER_DISTANCE,
                span: 0.05,
                steps: 21,
                points: finders.points.to_vec(),
            });
        }
        locators.push(Locator {
            center: (bx, by),
            scale_base: bright_radius / BRIGHT_DISK_RADIUS,
            span: 0.05,
            steps: 21,
            points: vec![(bx, by)],
        });
    }

    if let Some(finders) = find_finders_global(gray) {
        let scale_base = finders.distance / FINDER_DISTANCE;
        let duplicate = locators.iter().any(|locator| {
            (locator.center.0 - finders.center.0).hypot(locator.center.1 - finders.center.1) < 2.0
                && (locator.scale_base - scale_base).abs() < 0.05 * scale_base
        });
        if !duplicate {
            locators.push(Locator {
                center: finders.center,
                scale_base,
                span: 0.05,
                steps: 21,
                points: finders.points.to_vec(),
            });
        }
    }

    locators
}

/// 带常量白色边界的双线性采样。
///
/// 与常见的图像重采样约定一致：越界像素按 255（白色）处理。
fn sample_bilinear(gray: &GrayImage, x: f64, y: f64) -> f64 {
    let (width, height) = gray.dimensions();
    let width = width as i64;
    let height = height as i64;
    let raw = gray.as_raw();

    let border_pixel = |px: i64, py: i64| -> f64 {
        if px < 0 || px >= width || py < 0 || py >= height {
            return 255.0;
        }
        raw[(py * width + px) as usize] as f64
    };

    let x0 = x.floor();
    let y0 = y.floor();
    let fx = x - x0;
    let fy = y - y0;
    let (x0, y0) = (x0 as i64, y0 as i64);
    let v00 = border_pixel(x0, y0);
    let v10 = border_pixel(x0 + 1, y0);
    let v01 = border_pixel(x0, y0 + 1);
    let v11 = border_pixel(x0 + 1, y0 + 1);
    v00 * (1.0 - fx) * (1.0 - fy)
        + v10 * fx * (1.0 - fy)
        + v01 * (1.0 - fx) * fy
        + v11 * fx * fy
}

/// 在一条环上采样 `n` 个模块中心。
///
/// 每个模块沿半径方向在 `+/- radial_span` 像素内取 `radial_samples` 个点，
/// 求平均后以 128 为阈值判为暗（1）或亮（0）。
pub fn sample_ring(
    gray: &GrayImage,
    cx: f64,
    cy: f64,
    radius: f64,
    n: usize,
    radial_span: f64,
    radial_samples: usize,
) -> Vec<u8> {
    let mut sums = vec![0.0f64; n];
    for s in 0..radial_samples {
        let r = if radial_samples == 1 {
            radius
        } else {
            radius - radial_span + (2.0 * radial_span * s as f64) / (radial_samples - 1) as f64
        };
        for (k, sum) in sums.iter_mut().enumerate() {
            let angle = ((k as f64 + 0.5) * 360.0 / n as f64).to_radians();
            let x = cx + r * angle.cos();
            let y = cy + r * angle.sin();
            *sum += sample_bilinear(gray, x, y);
        }
    }

    sums.iter()
        .map(|&sum| u8::from(sum / (radial_samples as f64) < 128.0))
        .collect()
}

/// 按当前尺度采样四条数据环。
pub fn sample_rings(gray: &GrayImage, cx: f64, cy: f64, scale: f64) -> [[u8; RING_MODULES]; 4] {
    let mut rings = [[0u8; RING_MODULES]; 4];
    for (ring, &ring_radius) in rings.iter_mut().zip(RING_RADII.iter()) {
        let sampled = sample_ring(gray, cx, cy, ring_radius * scale, RING_MODULES, 1.8, 7);
        ring.copy_from_slice(&sampled);
    }
    rings
}
