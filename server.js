const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { extractFrames } = require('./engine/frame_extractor');
const { analyzeVideoFrames } = require('./engine/vision_analyzer');
const { synthesizePlaywrightCode } = require('./engine/synthesizer');
const { runReproduction, validateActions } = require('./engine/runner');
const { runSimulatorReproduction, checkSimulatorAvailability } = require('./engine/device_runner');

const app = express();
const PORT = process.env.PORT || 3000;

// This is a local development tool. Reject rebinding hosts and cross-origin access.
app.use((req, res, next) => {
  const suffix = req.socket.localPort === 80 ? '' : `:${req.socket.localPort}`;
  const allowedHosts = new Set([`localhost${suffix}`, `127.0.0.1${suffix}`, `[::1]${suffix}`]);
  const host = (req.headers.host || '').toLowerCase();
  if (!allowedHosts.has(host) || (req.headers.origin && req.headers.origin !== `http://${host}`)) {
    return res.status(403).json({ error: 'Only same-origin loopback access is allowed.' });
  }
  next();
});
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

// Route for PRD, Architecture & Machine Task Division Spec page
app.get('/spec', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'spec.html'));
});

// Route for 90s Demo Video Previs Player
app.get('/previs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'previs.html'));
});

// Route for 90s Animated Motion Review Player
app.get('/motion', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'motion.html'));
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
    const targetUrl = `http://localhost:${req.socket.localPort}/checkout`;
    const framesDir = path.join(__dirname, 'public', 'extracted_frames');
    let frames = [];
    if (fs.existsSync(framesDir)) {
      frames = fs.readdirSync(framesDir).filter(f => f.endsWith('.jpg')).map((f, i) => ({
        frameIndex: i + 1,
        url: `/extracted_frames/${f}`
      }));
    }

    const analysis = await analyzeVideoFrames(frames, {
      baseUrl: targetUrl
    });

    const code = synthesizePlaywrightCode(analysis, {
      targetUrl,
      screenshotPath: 'public/screenshots/reproduced_bug.png'
    });

    res.json({
      success: true,
      analysis,
      code,
      source: analysis.source || 'fixture'
    });
  } catch (err) {
    console.error('Synthesis error:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Get iOS Simulator & runner availability status
app.get('/api/device-status', (req, res) => {
  try {
    const status = checkSimulatorAvailability();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Run reproduction test in headless browser or iOS Simulator
app.post('/api/run-reproduce', async (req, res) => {
  try {
    if (!req.is('application/json')) {
      return res.status(415).json({ error: 'Reproduction requests must use application/json.' });
    }
    const body = req.body;
    if (!body || Array.isArray(body) || typeof body !== 'object' ||
        Object.keys(body).some((key) => !['target', 'detectedActions'].includes(key))) {
      return res.status(400).json({ error: 'Only target and detectedActions are accepted; submitted code is not executed.' });
    }
    const target = body.target === undefined ? 'web' : body.target;
    if (!['web', 'ios-sim', 'simulator'].includes(target)) {
      return res.status(400).json({ error: 'Unsupported reproduction target.' });
    }
    const targetUrl = `http://localhost:${req.socket.localPort}/checkout`;
    const actions = validateActions(body.detectedActions, targetUrl);

    if (target === 'ios-sim' || target === 'simulator') {
      const availability = checkSimulatorAvailability();
      if (!availability.available) {
        return res.json({
          success: false,
          status: 'UNAVAILABLE',
          target: 'ios-sim',
          device: 'iPhone 16 Simulator (iOS 18.0)',
          durationMs: 0,
          logs: [
            `[+0.00s] [iOS Simulator] Target selected: iPhone 16 Simulator (iOS 18.0)`,
            `[+0.00s] [iOS Simulator] Execution aborted: ${availability.reason}`
          ],
          error: availability.reason
        });
      }

      const result = await runSimulatorReproduction({
        targetUrl
      });
      return res.json(result);
    }

    const result = await runReproduction(actions, { targetUrl });
    result.target = 'web';
    result.device = 'Headless Chromium';
    res.json(result);
  } catch (err) {
    if (!(err instanceof TypeError)) console.error('Execution error:', err);
    res.status(err instanceof TypeError ? 400 : 500).json({ error: err.message });
  }
});

if (require.main === module) {
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`ReproLens Studio server running at http://localhost:${PORT}`);
    console.log(`Checkout target webapp at http://localhost:${PORT}/checkout`);
  });
}

module.exports = app;
