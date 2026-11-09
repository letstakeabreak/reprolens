const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { extractFrames } = require('./engine/frame_extractor');
const { analyzeVideoFrames } = require('./engine/vision_analyzer');
const { synthesizePlaywrightCode } = require('./engine/synthesizer');
const { runReproduction } = require('./engine/runner');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configure multer for video upload
const upload = multer({
  dest: path.join(__dirname, 'temp', 'uploads'),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Route for target checkout page
app.get('/checkout', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'checkout.html'));
});

// API: Get sample video info
app.get('/api/sample-video', (req, res) => {
  const samplePath = path.join(__dirname, 'public', 'sample_videos', 'sample_bug.mp4');
  if (fs.existsSync(samplePath)) {
    res.json({
      exists: true,
      url: '/sample_videos/sample_bug.mp4',
      name: 'checkout_conflict_bug_10s.mp4',
      size: fs.statSync(samplePath).size,
      duration: '7.3s'
    });
  } else {
    res.status(404).json({ error: 'Sample video not found' });
  }
});

// API: Extract frames from video (sample or uploaded)
app.post('/api/extract-frames', upload.single('video'), async (req, res) => {
  try {
    let videoPath;
    if (req.file) {
      videoPath = req.file.path;
    } else {
      videoPath = path.join(__dirname, 'public', 'sample_videos', 'sample_bug.mp4');
    }

    if (!fs.existsSync(videoPath)) {
      return res.status(400).json({ error: 'Video file not found' });
    }

    const outputDir = path.join(__dirname, 'public', 'extracted_frames');
    const frames = extractFrames(videoPath, outputDir);

    res.json({
      success: true,
      totalFrames: frames.length,
      frames
    });
  } catch (err) {
    console.error('Frame extraction error:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Analyze frames and synthesize Playwright code
app.post('/api/synthesize', async (req, res) => {
  try {
    const framesDir = path.join(__dirname, 'public', 'extracted_frames');
    let frames = [];
    if (fs.existsSync(framesDir)) {
      frames = fs.readdirSync(framesDir).filter(f => f.endsWith('.jpg')).map((f, i) => ({
        frameIndex: i + 1,
        url: `/extracted_frames/${f}`
      }));
    }

    const analysis = analyzeVideoFrames(frames, {
      baseUrl: `http://localhost:${PORT}/checkout`
    });

    const code = synthesizePlaywrightCode(analysis, {
      targetUrl: `http://localhost:${PORT}/checkout`,
      screenshotPath: 'public/screenshots/reproduced_bug.png'
    });

    res.json({
      success: true,
      analysis,
      code
    });
  } catch (err) {
    console.error('Synthesis error:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Run reproduction test in headless browser
app.post('/api/run-reproduce', async (req, res) => {
  try {
    const detectedActions = req.body ? req.body.detectedActions : null;
    let actions = detectedActions;

    if (!actions) {
      const analysis = analyzeVideoFrames([], {
        baseUrl: `http://localhost:${PORT}/checkout`
      });
      actions = analysis.detectedActions;
    }

    // Ensure target URL matches current port
    actions = actions.map(act => {
      if (act.type === 'navigate') {
        return { ...act, url: `http://localhost:${PORT}/checkout` };
      }
      return act;
    });

    const result = await runReproduction(actions);
    res.json(result);
  } catch (err) {
    console.error('Execution error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`ReproLens Studio server running at http://localhost:${PORT}`);
  console.log(`Checkout target webapp at http://localhost:${PORT}/checkout`);
});
