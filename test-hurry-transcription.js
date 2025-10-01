// Test script to debug "hurry" transcription issue
const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testTranscription() {
  console.log('🧪 Testing transcription with debug logging...');
  
  // Test with a simple text-to-speech generated "hurry" audio
  // This is a placeholder - in real testing, you'd use actual audio files
  
  const testCases = [
    { word: 'hurry', expected: 'hurry' },
    { word: 'thank you', expected: 'thank you' },
    { word: 'hello', expected: 'hello' },
    { word: 'quick', expected: 'quick' }
  ];
  
  console.log('📝 Test cases to verify:');
  testCases.forEach((testCase, index) => {
    console.log(`  ${index + 1}. "${testCase.word}" should transcribe as "${testCase.expected}"`);
  });
  
  console.log('\n🔍 To test this:');
  console.log('1. Open the web app: https://translation-5c1b8.web.app');
  console.log('2. Open browser developer tools (F12)');
  console.log('3. Go to Console tab');
  console.log('4. Say "hurry" clearly into the microphone');
  console.log('5. Check the console logs for:');
  console.log('   - 🎤 TRANSCRIPTION DEBUG: (frontend)');
  console.log('   - 🎤 BACKEND TRANSCRIPTION DEBUG: (backend)');
  console.log('   - 🔄 TRANSLATION DEBUG: (translation)');
  console.log('6. Look for what text was actually transcribed');
  
  console.log('\n🐛 Common issues to check:');
  console.log('- Audio quality: Speak clearly and close to microphone');
  console.log('- Background noise: Try in quiet environment');
  console.log('- Pronunciation: Make sure "hurry" sounds distinct from "thank you"');
  console.log('- Whisper model: The AI might be mishearing the audio');
}

testTranscription().catch(console.error);
