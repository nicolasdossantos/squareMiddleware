const onboardingService = require('../services/onboardingService');
const tenantService = require('../services/tenantService');
const { logger } = require('../utils/logger');
const fs = require('fs');
const path = require('path');

/**
 * Generate a simple valid WAV file (silent audio)
 * @param {number} durationMs - Duration in milliseconds
 * @returns {Buffer} Valid WAV file buffer
 */
function generateSilentWav(durationMs) {
  const sampleRate = 16000; // 16kHz
  const numChannels = 1; // Mono
  const bitsPerSample = 16; // 16-bit
  const bytesPerSample = bitsPerSample / 8; // 2 bytes
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const dataLength = numSamples * numChannels * bytesPerSample;

  // Total file size (44 byte header + audio data)
  const fileSize = 36 + dataLength;
  const totalSize = 44 + dataLength;

  // Create buffer for complete WAV file
  const wavBuffer = Buffer.alloc(totalSize);

  // Write RIFF header (positions 0-11)
  wavBuffer.write('RIFF', 0, 4, 'ascii');
  wavBuffer.writeUInt32LE(fileSize, 4);
  wavBuffer.write('WAVE', 8, 4, 'ascii');

  // Write fmt sub-chunk (positions 12-35)
  wavBuffer.write('fmt ', 12, 4, 'ascii');
  wavBuffer.writeUInt32LE(16, 16); // Subchunk1 size
  wavBuffer.writeUInt16LE(1, 20); // Audio format (1 = PCM)
  wavBuffer.writeUInt16LE(numChannels, 22); // Number of channels
  wavBuffer.writeUInt32LE(sampleRate, 24); // Sample rate
  wavBuffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28); // Byte rate
  wavBuffer.writeUInt16LE(numChannels * bytesPerSample, 32); // Block align
  wavBuffer.writeUInt16LE(bitsPerSample, 34); // Bits per sample

  // Write data sub-chunk (positions 36-43)
  wavBuffer.write('data', 36, 4, 'ascii');
  wavBuffer.writeUInt32LE(dataLength, 40); // Data size

  // Audio data is already zeros (silence), no need to fill
  // Positions 44+ are all zeros by default from Buffer.alloc()

  console.log('Generated WAV:', {
    totalSize,
    fileSize,
    dataLength,
    numSamples,
    bufferLength: wavBuffer.length,
    bufferByteLength: wavBuffer.byteLength
  });

  return wavBuffer;
}

async function getAvailableVoices(req, res) {
  try {
    // 10 curated voices - 4 male, 6 female
    const curatedVoiceIds = [
      '11labs-Hailey',
      '11labs-Nico',
      '11labs-Andrew',
      '11labs-Steve',
      '11labs-Brian',
      '11labs-Cimo',
      '11labs-Grace',
      '11labs-Nia',
      '11labs-Paola',
      '11labs-Cleo'
    ];

    // Curated voice metadata
    const curatedVoices = [
      {
        id: '11labs-Hailey',
        name: 'Hailey',
        gender: 'female',
        provider: 'elevenlabs',
        accent: 'American',
        language: 'English',
        default: true,
        previewUrl: '/api/onboarding/voices/11labs-Hailey/preview'
      },
      {
        id: '11labs-Nico',
        name: 'Nico',
        gender: 'male',
        provider: 'elevenlabs',
        accent: 'American',
        language: 'English',
        previewUrl: '/api/onboarding/voices/11labs-Nico/preview'
      },
      {
        id: '11labs-Andrew',
        name: 'Andrew',
        gender: 'male',
        provider: 'elevenlabs',
        accent: 'American',
        language: 'English',
        previewUrl: '/api/onboarding/voices/11labs-Andrew/preview'
      },
      {
        id: '11labs-Steve',
        name: 'Steve',
        gender: 'male',
        provider: 'elevenlabs',
        accent: 'American',
        language: 'English',
        previewUrl: '/api/onboarding/voices/11labs-Steve/preview'
      },
      {
        id: '11labs-Brian',
        name: 'Brian',
        gender: 'male',
        provider: 'elevenlabs',
        accent: 'American',
        language: 'English',
        previewUrl: '/api/onboarding/voices/11labs-Brian/preview'
      },
      {
        id: '11labs-Cimo',
        name: 'Cimo',
        gender: 'female',
        provider: 'elevenlabs',
        accent: 'American',
        language: 'English',
        previewUrl: '/api/onboarding/voices/11labs-Cimo/preview'
      },
      {
        id: '11labs-Grace',
        name: 'Grace',
        gender: 'female',
        provider: 'elevenlabs',
        accent: 'American',
        language: 'English',
        previewUrl: '/api/onboarding/voices/11labs-Grace/preview'
      },
      {
        id: '11labs-Nia',
        name: 'Nia',
        gender: 'female',
        provider: 'elevenlabs',
        accent: 'American',
        language: 'English',
        previewUrl: '/api/onboarding/voices/11labs-Nia/preview'
      },
      {
        id: '11labs-Paola',
        name: 'Paola',
        gender: 'female',
        provider: 'elevenlabs',
        accent: 'American',
        language: 'English',
        previewUrl: '/api/onboarding/voices/11labs-Paola/preview'
      },
      {
        id: '11labs-Cleo',
        name: 'Cleo',
        gender: 'female',
        provider: 'elevenlabs',
        accent: 'American',
        language: 'English',
        previewUrl: '/api/onboarding/voices/11labs-Cleo/preview'
      }
    ];

    logger.debug('voices_returned', {
      total: curatedVoices.length,
      voices: curatedVoiceIds
    });

    return res.status(200).json({
      success: true,
      voices: curatedVoices,
      total: curatedVoices.length
    });
  } catch (error) {
    logger.error('get_available_voices_failed', { message: error.message });
    return res.status(500).json({
      success: false,
      error: 'voices_fetch_failed',
      message: 'Failed to fetch available voices'
    });
  }
}

/**
 * Fallback function to fetch voices from local file
 */
function fetchVoicesFromFile(res) {
  try {
    const voicesPath = path.join(__dirname, '../services/available-voices');
    const voicesText = fs.readFileSync(voicesPath, 'utf8');

    const voices = [];
    const lines = voicesText.trim().split('\n');
    let currentGender = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === 'Male') {
        currentGender = 'male';
      } else if (trimmed === 'Female') {
        currentGender = 'female';
      } else if (trimmed && currentGender) {
        const [provider, ...voiceNameParts] = trimmed.split('-');
        const voiceName = voiceNameParts.join('-').replace(/\s*\(DEFAULT\)/, '');
        const id = trimmed.toLowerCase().replace(/\s+/g, '-').replace(/\(default\)/i, '').trim();

        voices.push({
          id,
          name: voiceName.trim(),
          gender: currentGender,
          provider: provider.toLowerCase(),
          accent: 'Standard',
          language: 'English',
          previewUrl: `/api/onboarding/voices/${id}/preview`
        });
      }
    }

    return res.status(200).json({
      success: true,
      voices,
      total: voices.length,
      source: 'local_file'
    });
  } catch (error) {
    logger.error('fetch_voices_from_file_failed', { message: error.message });
    return res.status(500).json({
      success: false,
      error: 'voices_fetch_failed',
      message: 'Failed to fetch available voices'
    });
  }
}

async function getVoicePreview(req, res) {
  try {
    const { voiceId } = req.params;

    if (!voiceId) {
      return res.status(400).json({
        success: false,
        error: 'missing_voice_id',
        message: 'voiceId is required'
      });
    }

    const retellApiKey = process.env.RETELL_API_KEY;
    if (!retellApiKey) {
      return res.status(500).json({
        success: false,
        error: 'retell_api_not_configured',
        message: 'Retell API is not configured'
      });
    }

    // Call Retell API to get voice details including preview audio URL
    // Retell voice IDs use format like "11labs-Adrian" (not "11labs_Adrian")
    const retellResponse = await fetch(`https://api.retellai.com/get-voice/${voiceId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${retellApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!retellResponse.ok) {
      const errorText = await retellResponse.text();
      logger.error('retell_get_voice_failed', {
        voiceId,
        status: retellResponse.status,
        statusText: retellResponse.statusText,
        error: errorText.substring(0, 200)
      });

      // Fallback to generating a silent WAV for development/testing
      const buffer = generateSilentWav(2000);
      res.writeHead(200, {
        'Content-Type': 'audio/wav',
        'Content-Length': buffer.byteLength,
        'Cache-Control': 'public, max-age=3600',
        'Content-Encoding': 'identity'
      });
      return res.end(buffer);
    }

    const voiceData = await retellResponse.json();
    const previewAudioUrl = voiceData.preview_audio_url;

    if (!previewAudioUrl) {
      logger.warn('voice_preview_url_missing', { voiceId, voiceData });
      const buffer = generateSilentWav(2000);
      res.writeHead(200, {
        'Content-Type': 'audio/wav',
        'Content-Length': buffer.byteLength,
        'Cache-Control': 'public, max-age=3600',
        'Content-Encoding': 'identity'
      });
      return res.end(buffer);
    }

    // Fetch the actual audio file from Retell's S3 URL
    const audioResponse = await fetch(previewAudioUrl);
    if (!audioResponse.ok) {
      logger.error('retell_audio_fetch_failed', {
        voiceId,
        previewAudioUrl,
        status: audioResponse.status
      });
      const buffer = generateSilentWav(2000);
      res.writeHead(200, {
        'Content-Type': 'audio/wav',
        'Content-Length': buffer.byteLength,
        'Cache-Control': 'public, max-age=3600',
        'Content-Encoding': 'identity'
      });
      return res.end(buffer);
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const buffer = Buffer.from(audioBuffer);
    const contentType = audioResponse.headers.get('content-type') || 'audio/mpeg';

    logger.debug('voice_preview_fetched', {
      voiceId,
      previewAudioUrl,
      bufferSize: buffer.byteLength,
      contentType
    });

    // Handle range requests for audio playback
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : buffer.length - 1;
      const chunksize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${buffer.length}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Content-Encoding': 'identity'
      });
      return res.end(buffer.slice(start, end + 1));
    }

    // Send the audio file
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': buffer.byteLength,
      'Cache-Control': 'public, max-age=3600',
      'Accept-Ranges': 'bytes',
      'Content-Encoding': 'identity'
    });

    return res.end(buffer);
  } catch (error) {
    logger.error('get_voice_preview_failed', { message: error.message, voiceId: req.params.voiceId });

    // Fallback to silent WAV on error
    try {
      const buffer = generateSilentWav(2000);
      res.writeHead(200, {
        'Content-Type': 'audio/wav',
        'Content-Length': buffer.byteLength,
        'Cache-Control': 'public, max-age=3600',
        'Content-Encoding': 'identity'
      });
      return res.end(buffer);
    } catch (fallbackError) {
      return res.status(500).json({
        success: false,
        error: 'voice_preview_failed',
        message: 'Failed to generate voice preview'
      });
    }
  }
}

async function submitPreferences(req, res) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        message: 'Authentication required'
      });
    }

    const {
      businessName,
      phoneNumber,
      timezone,
      industry,
      voiceKey,
      voiceName,
      voiceProvider,
      language,
      temperature,
      speakingRate,
      ambience
    } = req.body || {};

    if (!voiceKey) {
      return res.status(400).json({
        success: false,
        error: 'missing_voice_key',
        message: 'voiceKey is required to save preferences'
      });
    }

    const profile = await onboardingService.saveVoicePreferences(tenantId, {
      businessName,
      phoneNumber,
      timezone,
      industry,
      voiceKey,
      name: voiceName || voiceKey,
      provider: voiceProvider || 'retell',
      language,
      temperature,
      speakingRate,
      ambience
    });

    const tenant = await tenantService.getTenantById(tenantId);

    return res.status(200).json({
      success: true,
      voiceProfile: profile,
      tenant
    });
  } catch (error) {
    logger.error('onboarding_preferences_failed', { message: error.message, tenantId: req.user?.tenantId });
    return res.status(500).json({
      success: false,
      error: 'preferences_failed',
      message: 'Failed to save onboarding preferences'
    });
  }
}

module.exports = {
  getAvailableVoices,
  getVoicePreview,
  submitPreferences
};
