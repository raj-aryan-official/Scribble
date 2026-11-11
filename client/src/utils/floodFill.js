// Flood fill computed on a downscaled mask so phone DPRs stay fast, then
// composited back at full resolution without touching existing strokes.
const MAX_MASK_WIDTH = 1600;
const MAX_MASK_HEIGHT = 1200;
const ALPHA_THRESHOLD = 64;
const COLOR_TOLERANCE = 40;

function parseHexColor(value) {
    const hex = (value || '#000000').replace('#', '').trim();
    if (hex.length === 3) {
        return {
            r: parseInt(hex[0] + hex[0], 16),
            g: parseInt(hex[1] + hex[1], 16),
            b: parseInt(hex[2] + hex[2], 16),
        };
    }
    if (hex.length === 6) {
        return {
            r: parseInt(hex.slice(0, 2), 16),
            g: parseInt(hex.slice(2, 4), 16),
            b: parseInt(hex.slice(4, 6), 16),
        };
    }
    return { r: 0, g: 0, b: 0 };
}

export function floodFill(ctx, x, y, color) {
    const canvas = ctx.canvas;
    const { width, height } = canvas;
    if (!width || !height) return false;

    const scale = Math.min(1, MAX_MASK_WIDTH / width, MAX_MASK_HEIGHT / height);
    const maskWidth = Math.max(1, Math.round(width * scale));
    const maskHeight = Math.max(1, Math.round(height * scale));

    const mask = document.createElement('canvas');
    mask.width = maskWidth;
    mask.height = maskHeight;
    const maskCtx = mask.getContext('2d', { willReadFrequently: true });
    maskCtx.drawImage(canvas, 0, 0, maskWidth, maskHeight);

    const startX = Math.max(0, Math.min(maskWidth - 1, Math.round(x * scale)));
    const startY = Math.max(0, Math.min(maskHeight - 1, Math.round(y * scale)));

    const image = maskCtx.getImageData(0, 0, maskWidth, maskHeight);
    const data = image.data;
    const fill = parseHexColor(color);

    const startIndex = (startY * maskWidth + startX) * 4;
    const targetR = data[startIndex];
    const targetG = data[startIndex + 1];
    const targetB = data[startIndex + 2];
    const targetAlpha = data[startIndex + 3];
    const fillingPaper = targetAlpha < ALPHA_THRESHOLD;

    if (
        !fillingPaper &&
        targetR === fill.r &&
        targetG === fill.g &&
        targetB === fill.b &&
        targetAlpha === 255
    ) {
        return false;
    }

    const matches = (index) => {
        const alpha = data[index + 3];
        if (fillingPaper) return alpha < ALPHA_THRESHOLD;
        if (alpha < ALPHA_THRESHOLD) return false;
        return (
            Math.abs(data[index] - targetR) <= COLOR_TOLERANCE &&
            Math.abs(data[index + 1] - targetG) <= COLOR_TOLERANCE &&
            Math.abs(data[index + 2] - targetB) <= COLOR_TOLERANCE
        );
    };

    if (!matches(startIndex)) return false;

    const filled = new Uint8Array(maskWidth * maskHeight);
    const stack = [startX, startY];
    let changed = false;

    while (stack.length > 0) {
        const py = stack.pop();
        const px = stack.pop();
        if (px < 0 || px >= maskWidth || py < 0 || py >= maskHeight) continue;

        const rowOffset = py * maskWidth;
        if (filled[rowOffset + px]) continue;
        if (!matches((rowOffset + px) * 4)) continue;

        let left = px;
        while (left > 0 && !filled[rowOffset + left - 1] && matches((rowOffset + left - 1) * 4)) {
            left--;
        }
        let right = px;
        while (
            right < maskWidth - 1 &&
            !filled[rowOffset + right + 1] &&
            matches((rowOffset + right + 1) * 4)
        ) {
            right++;
        }

        for (let cx = left; cx <= right; cx++) {
            const cell = rowOffset + cx;
            filled[cell] = 1;
            const index = cell * 4;
            data[index] = fill.r;
            data[index + 1] = fill.g;
            data[index + 2] = fill.b;
            data[index + 3] = 255;
            changed = true;
        }

        for (const ny of [py - 1, py + 1]) {
            if (ny < 0 || ny >= maskHeight) continue;
            const neighbourRow = ny * maskWidth;
            for (let cx = left; cx <= right; cx++) {
                const cell = neighbourRow + cx;
                if (!filled[cell] && matches(cell * 4)) stack.push(cx, ny);
            }
        }
    }

    if (!changed) return false;

    // Keep only the newly painted pixels so replaying a fill never resamples art
    for (let cell = 0; cell < filled.length; cell++) {
        if (!filled[cell]) {
            const index = cell * 4;
            data[index] = 0;
            data[index + 1] = 0;
            data[index + 2] = 0;
            data[index + 3] = 0;
        }
    }

    maskCtx.putImageData(image, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(mask, 0, 0, width, height);
    ctx.restore();
    return true;
}

export default floodFill;
