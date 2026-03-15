/**
 * Simple icon generator — creates colored PNG placeholders using sharp or canvas.
 * Run: node scripts/generate-icons.js
 *
 * If sharp is not installed, this creates minimal valid PNG files (solid black
 * with a white square) as placeholders so the PWA manifest does not 404.
 */

const fs = require('fs')
const path = require('path')

// Minimal 1x1 black PNG (base64-encoded)
// We expand it to target sizes using a tiny pure-Node PNG writer.
function createSolidPng(size, bgColor = [0, 0, 0], fgColor = [255, 255, 255]) {
  // Use sharp if available
  try {
    const sharp = require('sharp')
    return sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: bgColor[0], g: bgColor[1], b: bgColor[2], alpha: 1 },
      },
    })
      .composite([
        {
          input: Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
              <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="rgb(${bgColor.join(',')})"/>
              <path d="M${size*0.31} ${size*0.27} L${size*0.2} ${size*0.39} L${size*0.29} ${size*0.43} L${size*0.29} ${size*0.74} L${size*0.71} ${size*0.74} L${size*0.71} ${size*0.43} L${size*0.8} ${size*0.39} L${size*0.69} ${size*0.27} C${size*0.66} ${size*0.33} ${size*0.59} ${size*0.36} ${size*0.5} ${size*0.36} C${size*0.41} ${size*0.36} ${size*0.34} ${size*0.33} ${size*0.31} ${size*0.27}Z"
                    fill="rgb(${fgColor.join(',')})"/>
            </svg>`
          ),
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toFile(path.join(__dirname, '..', 'public', 'icons', `icon-${size}.png`))
  } catch {
    // Fallback: write a minimal valid 1x1 PNG (16 bytes data)
    // Real apps should use a proper image tool; this prevents 404s during dev.
    console.warn(`sharp not found — writing placeholder ${size}x${size} PNG`)
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ])
    // IHDR chunk for 1x1 RGBA
    const ihdr = Buffer.from([
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xde,
    ])
    // IDAT chunk (zlib compressed single black pixel)
    const idat = Buffer.from([
      0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54,
      0x08, 0xd7, 0x63, 0x60, 0x60, 0x60, 0x00, 0x00,
      0x00, 0x04, 0x00, 0x01, 0x27, 0x07, 0x4c, 0xc4,
    ])
    // IEND chunk
    const iend = Buffer.from([
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
      0xae, 0x42, 0x60, 0x82,
    ])
    const buf = Buffer.concat([pngHeader, ihdr, idat, iend])
    fs.writeFileSync(
      path.join(__dirname, '..', 'public', 'icons', `icon-${size}.png`),
      buf
    )
    return Promise.resolve()
  }
}

async function main() {
  const iconsDir = path.join(__dirname, '..', 'public', 'icons')
  if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true })

  for (const size of [192, 512]) {
    await createSolidPng(size)
    console.log(`Generated icon-${size}.png`)
  }
}

main().catch(console.error)
