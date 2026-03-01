#!/usr/bin/env node

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const sizes = [16, 32, 48, 128];

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const s = size;

  // Background - dark rounded square
  const radius = s * 0.18;
  ctx.fillStyle = '#0A0A0A';
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(s - radius, 0);
  ctx.quadraticCurveTo(s, 0, s, radius);
  ctx.lineTo(s, s - radius);
  ctx.quadraticCurveTo(s, s, s - radius, s);
  ctx.lineTo(radius, s);
  ctx.quadraticCurveTo(0, s, 0, s - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fill();

  // Gold left accent bar
  const barWidth = Math.max(1, s * 0.06);
  const barMargin = s * 0.12;
  ctx.fillStyle = '#c9a962';
  ctx.fillRect(barMargin, barMargin, barWidth, s - barMargin * 2);

  // Package icon (box shape) - X-blue color
  const cx = s * 0.55;
  const cy = s * 0.48;
  const boxW = s * 0.36;
  const boxH = s * 0.30;

  ctx.strokeStyle = '#1d9bf0';
  ctx.lineWidth = Math.max(1, s * 0.04);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Box bottom
  ctx.beginPath();
  ctx.rect(cx - boxW / 2, cy - boxH / 2 + boxH * 0.25, boxW, boxH * 0.75);
  ctx.stroke();

  // Box flaps (open top)
  const flapH = boxH * 0.3;
  ctx.beginPath();
  ctx.moveTo(cx - boxW / 2, cy - boxH / 2 + boxH * 0.25);
  ctx.lineTo(cx - boxW / 2 - boxW * 0.08, cy - boxH / 2 + boxH * 0.25 - flapH);
  ctx.lineTo(cx, cy - boxH / 2 + boxH * 0.25 - flapH * 0.5);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx + boxW / 2, cy - boxH / 2 + boxH * 0.25);
  ctx.lineTo(cx + boxW / 2 + boxW * 0.08, cy - boxH / 2 + boxH * 0.25 - flapH);
  ctx.lineTo(cx, cy - boxH / 2 + boxH * 0.25 - flapH * 0.5);
  ctx.stroke();

  // Arrow pointing up from box
  const arrowY = cy - boxH * 0.15;
  const arrowLen = boxH * 0.5;
  ctx.beginPath();
  ctx.moveTo(cx, arrowY);
  ctx.lineTo(cx, arrowY - arrowLen);
  ctx.stroke();

  // Arrow head
  const headSize = s * 0.06;
  ctx.beginPath();
  ctx.moveTo(cx - headSize, arrowY - arrowLen + headSize);
  ctx.lineTo(cx, arrowY - arrowLen);
  ctx.lineTo(cx + headSize, arrowY - arrowLen + headSize);
  ctx.stroke();

  // "X" text mark bottom right (only for larger sizes)
  if (s >= 32) {
    ctx.fillStyle = '#FAFAFA';
    ctx.font = `bold ${Math.max(6, s * 0.18)}px -apple-system, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('X', s - barMargin, s - barMargin * 0.6);
  }

  return canvas;
}

const iconsDir = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

for (const size of sizes) {
  const canvas = drawIcon(size);
  const buffer = canvas.toBuffer('image/png');
  if (size === 32) {
    fs.writeFileSync(path.join(iconsDir, 'icon32.png'), buffer);
  }
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), buffer);
}

console.log('Icons generated:', sizes.map(s => `${s}x${s}`).join(', '));
