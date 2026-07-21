#!/usr/bin/env python
"""Transcribe paired listening MP4s to German text — pure local ASR, no LLM.

Uses faster-whisper (CTranslate2) + PyAV to decode the MP4 audio track (no
system ffmpeg binary required). Per the locked v1 decision, completeness is
signalled by faster-whisper's own confidence numbers — low-confidence segments
are flagged inline; there is NO LLM cleanup or audio<->PDF cross-check yet.

First run downloads the model from Hugging Face:
    small  ~ 460 MB   (default; good for clean studio German)
    medium ~ 1.5 GB   (more accurate, slower)

Outputs, per collection with an `audio` entry in collections.json:
    <slug>/audio/_asr/listening.json   raw segments + timestamps + confidence
    <slug>/audio/listening.md          frontmatter + timestamped body (flags)

Usage:
    python _tools/transcribe_audio.py --all
    python _tools/transcribe_audio.py <slug> [<slug>…]
    python _tools/transcribe_audio.py --all --model medium
"""
import json
import os
import sys

TOOLS = os.path.dirname(os.path.abspath(__file__))
EXTRACTED = os.path.dirname(TOOLS)          # german/extracted/
GERMAN = os.path.dirname(EXTRACTED)         # german/
CONFIG = os.path.join(TOOLS, 'collections.json')

# Confidence thresholds for the low-confidence flag.
LOW_LOGPROB = -1.0
HIGH_NOSPEECH = 0.6


def load_collections():
    with open(CONFIG, encoding='utf-8') as f:
        return json.load(f)['collections']


def ts(sec):
    m, s = divmod(int(sec), 60)
    return '%02d:%02d' % (m, s)


def transcribe_one(model, collection, audio_path):
    slug = collection['slug']
    out_dir = os.path.join(EXTRACTED, slug, 'audio')
    asr_dir = os.path.join(out_dir, '_asr')
    os.makedirs(asr_dir, exist_ok=True)

    segments, info = model.transcribe(audio_path, language='de', vad_filter=True, beam_size=5)

    seg_rows, body, low = [], [], 0
    for s in segments:
        flagged = (s.avg_logprob < LOW_LOGPROB) or (s.no_speech_prob > HIGH_NOSPEECH)
        if flagged:
            low += 1
        seg_rows.append({
            'start': round(s.start, 2), 'end': round(s.end, 2), 'text': s.text.strip(),
            'avg_logprob': round(s.avg_logprob, 3), 'no_speech_prob': round(s.no_speech_prob, 3),
            'low_confidence': flagged,
        })
        line = '[%s–%s] %s' % (ts(s.start), ts(s.end), s.text.strip())
        if flagged:
            line += ' <!-- low-confidence -->'
        body.append(line)

    with open(os.path.join(asr_dir, 'listening.json'), 'w', encoding='utf-8') as f:
        json.dump({'source': os.path.basename(audio_path), 'language': info.language,
                   'duration': round(info.duration, 1), 'model': model_size,
                   'low_confidence_segments': low, 'segments': seg_rows}, f, ensure_ascii=False, indent=2)

    fm = [
        '---',
        'source: %s' % os.path.basename(audio_path),
        'collection: %s' % slug,
        'exam: %s' % collection.get('exam', ''),
        'level: %s' % collection.get('level', ''),
        'track: listening',
        'duration_sec: %.1f' % info.duration,
        'asr_model: %s' % model_size,
        'low_confidence_segments: %d' % low,
        'status: transcribed',
        'qa: pending',
        '---',
    ]
    with open(os.path.join(out_dir, 'listening.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(fm) + '\n' + '\n'.join(body) + '\n')

    print('%-32s %5.0fs  %3d segments (%d low-confidence)' % (slug, info.duration, len(seg_rows), low))


model_size = 'small'


def main(argv):
    global model_size
    if '--model' in argv:
        k = argv.index('--model')
        model_size = argv[k + 1]
        del argv[k:k + 2]

    cols = load_collections()
    if '--all' in argv:
        targets = [c for c in cols if c.get('audio')]
    else:
        wanted = set(argv)
        targets = [c for c in cols if c['slug'] in wanted and c.get('audio')]
    if not targets:
        print('No matching collections with audio. Use --all or a slug that has audio.')
        return

    from faster_whisper import WhisperModel
    print('Loading faster-whisper model "%s" (first run downloads it)…' % model_size)
    model = WhisperModel(model_size, device='cpu', compute_type='int8')

    for c in targets:
        audio_path = os.path.join(GERMAN, c['audio'])
        if not os.path.exists(audio_path):
            print('MISSING audio, skipping %s: %s' % (c['slug'], audio_path))
            continue
        transcribe_one(model, c, audio_path)


if __name__ == '__main__':
    main(sys.argv[1:])
