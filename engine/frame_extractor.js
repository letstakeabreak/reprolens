const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Extracts keyframes from video at 2 fps.
 * @param {string} videoPath - Absolute path to video file
 * @param {string} outputDir - Directory to store extracted frames
 * @returns {Array<{frameIndex: number, timestamp: string, filePath: string, url: string}>}
 */
function extractFrames(videoPath, outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Clear existing frames in output directory
  const existingFiles = fs.readdirSync(outputDir);
  for (const f of existingFiles) {
    if (f.endsWith('.jpg') || f.endsWith('.png')) {
      fs.unlinkSync(path.join(outputDir, f));
    }
  }

  const outputPattern = path.join(outputDir, 'frame_%03d.jpg');
  // Sample at 2 frames per second, scaled to width 640 maintaining aspect ratio
  const cmd = `ffmpeg -y -i "${videoPath}" -vf "fps=2,scale=640:-1" -q:v 3 "${outputPattern}"`;
  execSync(cmd, { stdio: 'pipe' });

  const generatedFiles = fs.readdirSync(outputDir)
    .filter(f => f.startsWith('frame_') && f.endsWith('.jpg'))
    .sort();

  return generatedFiles.map((filename, index) => {
    const timeSec = (index * 0.5).toFixed(1);
    return {
      frameIndex: index + 1,
      timestamp: `${timeSec}s`,
      filename,
      filePath: path.join(outputDir, filename),
      url: `/extracted_frames/${filename}`
    };
  });
}

module.exports = { extractFrames };
