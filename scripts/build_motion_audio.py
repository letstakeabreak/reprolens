"""Builds the narration track for /motion (public/motion_audio.m4a).

Each line is placed at its start second on a silent bed of DURATION seconds.
Lines never read out text that is already on screen.
"""
import os
import subprocess

DURATION = 106
VOICE = 'Samantha'
RATE = '172'

LINES = [
    (0.8, "A customer hits a checkout bug. Support forwards the only evidence they have, a seven second screen recording."),
    (11.0, "It stops on a conflict error. No steps. No logs."),
    (20.0, "So Minwoo drops the clip into ReproLens."),
    (28.0, "It samples the recording twice a second and reads every frame for what changed on screen."),
    (40.5, "Four moments matter. The coupon, apply, the points box, and place order."),
    (47.5, "Each moment becomes one step, and each step becomes one line of Playwright."),
    (54.0, "Then it runs those lines in a real browser, against the same checkout."),
    (78.5, "Same screen. Same conflict. Reproduced on the first run."),
    (89.0, "The customer's frame, and ours."),
    (98.5, "From a clip, to a test you can run again."),
]


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    tmp = os.path.join(root, 'temp', 'motion_audio_v2')
    os.makedirs(tmp, exist_ok=True)
    out = os.path.join(root, 'public', 'motion_audio.m4a')

    inputs, filters, labels = [], [], []
    for i, (start, text) in enumerate(LINES):
        clip = os.path.join(tmp, f'line_{i:02d}.aiff')
        subprocess.run(['say', '-v', VOICE, '-r', RATE, text, '-o', clip], check=True)
        dur = float(subprocess.check_output(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', clip]).strip())
        print(f'{start:6.1f}s  {dur:4.1f}s  ends {start + dur:6.1f}s  {text}')
        inputs += ['-i', clip]
        ms = int(start * 1000)
        filters.append(f'[{i}:a]aformat=sample_rates=44100:channel_layouts=mono,adelay={ms}|{ms}[a{i}]')
        labels.append(f'[a{i}]')

    n = len(LINES)
    filters.append(f'anullsrc=r=44100:cl=mono,atrim=0:{DURATION}[bed]')
    filters.append(f'[bed]{"".join(labels)}amix=inputs={n + 1}:duration=first:dropout_transition=0:normalize=0[out]')
    subprocess.run(['ffmpeg', '-y', '-v', 'error'] + inputs +
                   ['-filter_complex', ';'.join(filters), '-map', '[out]', '-t', str(DURATION),
                    '-c:a', 'aac', '-b:a', '128k', out], check=True)
    print('wrote', out)


if __name__ == '__main__':
    main()
