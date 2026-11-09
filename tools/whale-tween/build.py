"""离线生成鲸鱼的运动补间，浏览器只读取图集，不加载 OpenCV。"""

import argparse
import json
from pathlib import Path

import cv2
import numpy as np
from numpy.typing import NDArray
from PIL import Image, ImageDraw

# 光流、距离场与色彩扭曲统一使用 float32，避免整数截断补间位移。
type FloatImage = NDArray[np.float32]
# PNG 像素与语义分割掩码保留字节格式以适配 OpenCV 和 Pillow。
type ByteImage = NDArray[np.uint8]


def signed_distance(mask: ByteImage) -> FloatImage:
    """轮廓只插值一份有符号距离，避免左右透明轮廓重叠出重影。"""
    return np.asarray(
        cv2.distanceTransform(mask, cv2.DIST_L2, cv2.DIST_MASK_PRECISE)
        - cv2.distanceTransform(1 - mask, cv2.DIST_L2, cv2.DIST_MASK_PRECISE),
        dtype=np.float32,
    )


def extended_color(frame: ByteImage, mask: ByteImage) -> FloatImage:
    """向透明边缘延伸最近前景颜色，扭曲后的边缘不能混入透明黑色。"""
    if not np.any(mask):
        raise ValueError("Whale keyframe has no opaque foreground")
    _, labels = cv2.distanceTransformWithLabels(
        1 - mask, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL
    )
    palette: FloatImage = np.zeros((int(labels.max()) + 1, 3), dtype=np.float32)
    palette[labels[mask != 0]] = frame[:, :, :3][mask != 0]
    return np.asarray(palette[labels], dtype=np.float32)


def paint_masks(frame: ByteImage) -> tuple[ByteImage, ByteImage, ByteImage]:
    """把腹纹和眼睛作为表面材料搬运，不能把两张未对齐的脸直接混合。"""
    opaque: NDArray[np.bool_] = frame[:, :, 3] > 100
    light: ByteImage = np.asarray(opaque & (frame[:, :, 0] > 125) & (frame[:, :, 1] > 140), dtype=np.uint8)
    eye: ByteImage = np.asarray(opaque & (frame[:, :, 2] < 180) & (frame[:, :, 0] < 95), dtype=np.uint8)
    eye_margin: ByteImage = cv2.dilate(eye, np.ones((9, 9), dtype=np.uint8))
    blue: ByteImage = np.asarray(opaque & (light == 0) & (eye_margin == 0), dtype=np.uint8)
    return blue, light, eye


def eye_layer(frame: ByteImage, mask: ByteImage) -> tuple[tuple[float, float, float, float], FloatImage] | None:
    """把同一只眼睛归一到局部坐标；转向背面时收窄到被身体遮挡。"""
    yy, xx = np.where(mask != 0)
    if len(xx) < 4:
        return None
    x: int = max(0, int(xx.min()) - 2)
    y: int = max(0, int(yy.min()) - 2)
    right: int = min(256, int(xx.max()) + 3)
    bottom: int = min(256, int(yy.max()) + 3)
    alpha: FloatImage = cv2.GaussianBlur(mask.astype(np.float32), (3, 3), 0.5)
    patch: FloatImage = np.dstack((frame[y:bottom, x:right, :3].astype(np.float32), alpha[y:bottom, x:right]))
    return ((x + (right - x) / 2, y + (bottom - y) / 2, float(right - x), float(bottom - y)), cv2.resize(patch, (32, 32)))


def apply_eye(color: FloatImage, first: ByteImage, second: ByteImage, progress: float) -> FloatImage:
    """只绘制一个连续移动的眼部特征，避免光流在小色块上失配造成双眼重影。"""
    eye_first = eye_layer(first, paint_masks(first)[2])
    eye_second = eye_layer(second, paint_masks(second)[2])
    if eye_first is None and eye_second is None:
        return color
    if eye_first is None:
        assert eye_second is not None
        box, texture = eye_second
        eye_first = ((box[0], box[1], 0.0, box[3]), texture)
    if eye_second is None:
        box, texture = eye_first
        eye_second = ((box[0], box[1], 0.0, box[3]), texture)
    box_first, texture_first = eye_first
    box_second, texture_second = eye_second
    box: tuple[float, ...] = tuple(a * (1 - progress) + b * progress for a, b in zip(box_first, box_second, strict=True))
    width: int = round(box[2])
    height: int = round(box[3])
    if width < 1 or height < 1:
        return color
    texture: FloatImage = cv2.resize(texture_first * (1 - progress) + texture_second * progress, (width, height))
    x: int = max(0, min(256 - width, round(box[0] - width / 2)))
    y: int = max(0, min(256 - height, round(box[1] - height / 2)))
    result: FloatImage = color.copy()
    weight: FloatImage = texture[:, :, 3:]
    result[y:y + height, x:x + width] = result[y:y + height, x:x + width] * (1 - weight) + texture[:, :, :3] * weight
    return result


def flow_feature(frame: ByteImage) -> ByteImage:
    """同时跟踪轮廓和腹纹，纯蓝内部缺少纹理时仍有稳定的运动约束。"""
    alpha: FloatImage = frame[:, :, 3].astype(np.float32) / 255
    gray: FloatImage = cv2.cvtColor(frame[:, :, :3], cv2.COLOR_RGB2GRAY).astype(np.float32)
    contour: FloatImage = signed_distance(np.asarray(alpha > 0.4, dtype=np.uint8))
    feature: FloatImage = 0.62 * (gray * alpha + 128 * (1 - alpha)) + 0.38 * (
        np.clip(contour, -20, 20) * 5 + 128
    )
    return np.asarray(np.clip(feature, 0, 255), dtype=np.uint8)


def dense_flow(first: ByteImage, second: ByteImage) -> FloatImage:
    """相邻关键姿态之间估计稠密位移，生成几何补间而非重复原有七帧。"""
    return np.asarray(
        cv2.calcOpticalFlowFarneback(
            flow_feature(first), flow_feature(second), None,
            0.5, 5, 41, 8, 7, 1.5, cv2.OPTFLOW_FARNEBACK_GAUSSIAN,
        ),
        dtype=np.float32,
    )


def remap(image: FloatImage, coordinates: FloatImage) -> FloatImage:
    """扭曲采样只读输入，边界像素按纹理边缘延伸。"""
    return np.asarray(cv2.remap(
        image, coordinates[:, :, 0], coordinates[:, :, 1],
        cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE,
    ), dtype=np.float32)


def inverse_coordinates(flow: FloatImage, weight: float, grid: FloatImage) -> FloatImage:
    """反求中间画面到原图的位置，降低大位移时直接逆向位移的误差。"""
    coordinates: FloatImage = grid - flow * weight
    for _ in range(4):
        coordinates = grid - remap(flow, coordinates) * weight
    return coordinates


def interpolate(
    first: ByteImage, second: ByteImage, tail_first: ByteImage, tail_second: ByteImage,
    forward: FloatImage, backward: FloatImage, progress: float, grid: FloatImage,
) -> tuple[ByteImage, ByteImage]:
    """先对齐像素与轮廓，再合成一只实体鲸鱼，并传递尾部的分割区域。"""
    map_first: FloatImage = inverse_coordinates(forward, progress, grid)
    map_second: FloatImage = inverse_coordinates(backward, 1 - progress, grid)
    outline: FloatImage = (
        remap(signed_distance(np.asarray(first[:, :, 3] > 100, dtype=np.uint8)), map_first) * (1 - progress)
        + remap(signed_distance(np.asarray(second[:, :, 3] > 100, dtype=np.uint8)), map_second) * progress
    )
    alpha: FloatImage = np.clip(outline + 0.5, 0, 1)
    blue_first, light_first, _ = paint_masks(first)
    blue_second, light_second, _ = paint_masks(second)
    color: FloatImage = remap(extended_color(first, blue_first), map_first) * (1 - progress) + remap(extended_color(second, blue_second), map_second) * progress
    light_distance: FloatImage = remap(signed_distance(light_first), map_first) * (1 - progress) + remap(signed_distance(light_second), map_second) * progress
    light_weight: FloatImage = np.clip(light_distance + 0.5, 0, 1)[:, :, None]
    light_color: FloatImage = remap(extended_color(first, light_first), map_first) * (1 - progress) + remap(extended_color(second, light_second), map_second) * progress
    color = apply_eye(cv2.GaussianBlur(color * (1 - light_weight) + light_color * light_weight, (3, 3), 0.65), first, second, progress)
    tail_distance: FloatImage = (
        remap(signed_distance(np.asarray(tail_first[:, :, 3] > 20, dtype=np.uint8)), map_first) * (1 - progress)
        + remap(signed_distance(np.asarray(tail_second[:, :, 3] > 20, dtype=np.uint8)), map_second) * progress
    )
    rgba: ByteImage = np.asarray(np.dstack((np.clip(color, 0, 255), alpha * 255)), dtype=np.uint8)
    body: ByteImage = rgba.copy()
    tail: ByteImage = rgba.copy()
    body[:, :, 3] = np.asarray(alpha * np.clip(1 - tail_distance, 0, 1) * 255, dtype=np.uint8)
    tail[:, :, 3] = np.asarray(alpha * np.clip(tail_distance + 1, 0, 1) * 255, dtype=np.uint8)
    return body, tail


def build(source: Path, output: Path, metadata: Path, preview: Path) -> None:
    """所有姿态统一重建为 241 帧，关键帧交界不能混回另一套轮廓与着色方式。"""
    original: Image.Image = Image.open(source).convert("RGBA")
    if original.size != (1792, 512):
        raise ValueError(f"Expected seven 256px body/tail cells, got {source}: {original.size}")
    bodies: list[ByteImage] = [np.array(original.crop((i * 256, 0, (i + 1) * 256, 256))) for i in range(7)]
    tails: list[ByteImage] = [np.array(original.crop((i * 256, 256, (i + 1) * 256, 512))) for i in range(7)]
    keyframes: list[ByteImage] = [np.array(Image.alpha_composite(Image.fromarray(body), Image.fromarray(tail))) for body, tail in zip(bodies, tails, strict=True)]
    pivots: list[tuple[float, float]] = [(171.8, 135.4), (178.4, 137.4), (180.4, 128.4), (128, 108), (83, 129), (76, 131.4), (76, 133)]
    yy, xx = np.mgrid[:256, :256]
    grid: FloatImage = np.asarray(np.dstack((xx, yy)), dtype=np.float32)
    atlas: Image.Image = Image.new("RGBA", (2048, 4096))
    contact: Image.Image = Image.new("RGB", (640, 768), "#a8cbea")
    draw: ImageDraw.ImageDraw = ImageDraw.Draw(contact)
    points: list[tuple[float, float]] = []
    differences: list[float] = []
    previous: FloatImage | None = None
    for segment in range(6):
        forward: FloatImage = dense_flow(keyframes[segment], keyframes[segment + 1])
        backward: FloatImage = dense_flow(keyframes[segment + 1], keyframes[segment])
        for step in range(41 if segment == 5 else 40):
            progress: float = step / 40
            index: int = segment * 40 + step
            body, tail = interpolate(keyframes[segment], keyframes[segment + 1], tails[segment], tails[segment + 1], forward, backward, progress, grid)
            for layer, pixels in enumerate((body, tail)):
                atlas.paste(Image.fromarray(pixels).resize((128, 128), Image.Resampling.LANCZOS), ((index % 16) * 128, (index // 16 + layer * 16) * 128))
            point: tuple[float, float] = tuple(round((pivots[segment][axis] * (1 - progress) + pivots[segment + 1][axis] * progress) / 2, 3) for axis in range(2))
            points.append(point)
            combined: Image.Image = Image.alpha_composite(Image.fromarray(body), Image.fromarray(tail))
            composite: FloatImage = np.asarray(combined, dtype=np.float32) / 255
            visible: FloatImage = composite[:, :, :3] * composite[:, :, 3:] + (1 - composite[:, :, 3:]) * np.array([0.66, 0.8, 0.92])
            if previous is not None:
                differences.append(float(np.mean(np.abs(visible - previous))))
            previous = visible
            if step in (0, 10, 20, 30):
                x: int = (step // 10) * 128
                contact.paste(combined.resize((128, 128), Image.Resampling.LANCZOS), (x, segment * 128), combined.resize((128, 128), Image.Resampling.LANCZOS))
                draw.text((x + 4, segment * 128 + 4), f"{segment}-{segment + 1}  {progress:.2f}", fill="#263f57")
        contact.paste(Image.fromarray(keyframes[segment + 1]).resize((128, 128), Image.Resampling.LANCZOS), (512, segment * 128), Image.fromarray(keyframes[segment + 1]).resize((128, 128), Image.Resampling.LANCZOS))
    atlas.save(output, optimize=True)
    contact.save(preview)
    metadata.write_text(
        "/** 离线补间输出；单元大小和布局与本地 PNG 图集同步生成。 */\n"
        "export const WHALE_ATLAS_CELL: number = 128\n"
        "/** 每行最多容纳 16 个姿态，避免生成超宽纹理。 */\nexport const WHALE_ATLAS_COLUMNS: number = 16\n"
        "/** 身体和尾部分别占用十六行。 */\nexport const WHALE_ATLAS_LAYER_ROWS: number = 16\n"
        "/** 包含七个关键姿态和它们之间的运动补间。 */\nexport const WHALE_ATLAS_FRAMES: number = 241\n"
        "/** 尾柄位置与光流补间同步，坐标相对于 128px 单元。 */\n"
        "export const WHALE_TAIL_PIVOTS: readonly (readonly [number, number])[] = [\n"
        + "".join(f"  [{x}, {y}],\n" for x, y in points) + "]\n", encoding="utf-8",
    )
    print(json.dumps({"frames": len(points), "atlas_bytes": output.stat().st_size, "max_adjacent_difference": max(differences), "mean_adjacent_difference": float(np.mean(differences))}))


def main() -> None:
    """路径由调用方显式传入，素材生成不依赖开发服务器或网络服务。"""
    parser: argparse.ArgumentParser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--metadata", type=Path, required=True)
    parser.add_argument("--preview", type=Path, required=True)
    args: argparse.Namespace = parser.parse_args()
    build(args.source, args.output, args.metadata, args.preview)


if __name__ == "__main__":
    main()
