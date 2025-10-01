"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const multer_1 = __importDefault(require("multer"));
const openai_1 = __importDefault(require("openai"));
const app = (0, express_1.default)();
const corsOptions = {
    origin: true, // Allow all origins temporarily for debugging
    credentials: true,
};
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json());
const upload = (0, multer_1.default)();
const openai = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY });
// Utility: buffer -> File-like for SDK
function bufferToFile(buffer, filename, type) {
    const uint8Array = new Uint8Array(buffer);
    const blob = new Blob([uint8Array], { type });
    return new File([blob], filename, { type });
}
// Calculate confidence based on text quality
function calculateConfidence(text) {
    // Base confidence starts at 0.8 (80%)
    let confidence = 0.8;
    // Length factor - longer text is generally more confident
    const length = text.length;
    if (length < 5)
        confidence -= 0.3; // Very short text
    else if (length < 10)
        confidence -= 0.2; // Short text
    else if (length > 50)
        confidence += 0.1; // Longer text
    // Word count factor
    const words = text.split(/\s+/).filter((word) => word.length > 0);
    if (words.length < 2)
        confidence -= 0.2; // Single word
    else if (words.length > 10)
        confidence += 0.1; // Many words
    // Punctuation factor - proper punctuation suggests better transcription
    const hasPunctuation = /[.!?]/.test(text);
    if (hasPunctuation)
        confidence += 0.1;
    // Capitalization factor - proper capitalization suggests better transcription
    const hasProperCapitalization = /^[A-Z]/.test(text) && /[a-z]/.test(text);
    if (hasProperCapitalization)
        confidence += 0.1;
    // Repetition factor - repeated words suggest lower confidence
    const wordsArray = text.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(wordsArray);
    const repetitionRatio = uniqueWords.size / wordsArray.length;
    if (repetitionRatio < 0.5)
        confidence -= 0.2; // High repetition
    // Common words factor - common words suggest higher confidence
    const commonWords = [
        'the',
        'and',
        'or',
        'but',
        'in',
        'on',
        'at',
        'to',
        'for',
        'of',
        'with',
        'by',
        'is',
        'are',
        'was',
        'were',
        'be',
        'been',
        'have',
        'has',
        'had',
        'do',
        'does',
        'did',
        'will',
        'would',
        'could',
        'should',
        'may',
        'might',
        'can',
        'this',
        'that',
        'these',
        'those',
        'i',
        'you',
        'he',
        'she',
        'it',
        'we',
        'they',
        'me',
        'him',
        'her',
        'us',
        'them',
    ];
    const commonWordCount = wordsArray.filter((word) => commonWords.includes(word)).length;
    const commonWordRatio = commonWordCount / wordsArray.length;
    if (commonWordRatio > 0.3)
        confidence += 0.1; // Many common words
    // Ensure confidence is between 0 and 1
    return Math.max(0, Math.min(1, confidence));
}
// Helper function to detect wrong language by character patterns
function detectWrongLanguageByPatterns(text, expectedLanguage) {
    const trimmedText = text.trim();
    // Korean characters (Hangul)
    const koreanPattern = /[가-힣]/;
    // Chinese characters
    const chinesePattern = /[一-龯]/;
    // Arabic characters
    const arabicPattern = /[ا-ي]/;
    // Cyrillic characters (Russian, Kyrgyz, Kazakh, etc.)
    const cyrillicPattern = /[а-яёА-ЯЁ]/;
    // Latin characters (English, Spanish, French, etc.)
    const latinPattern = /[a-zA-Z]/;
    if (expectedLanguage === 'en') {
        // English should only have Latin characters
        if (koreanPattern.test(trimmedText)) {
            return { detected: true, message: 'Please speak in English' };
        }
        if (chinesePattern.test(trimmedText)) {
            return { detected: true, message: 'Please speak in English' };
        }
        if (cyrillicPattern.test(trimmedText)) {
            return { detected: true, message: 'Please speak in English' };
        }
        // Additional check for Korean romanization patterns
        const koreanRomanizationPatterns = [
            /빨리/i,
            /집에/i,
            /가자/i,
            /가자요/i,
            /가요/i,
            /가세요/i,
            /안녕/i,
            /안녕하세요/i,
            /감사/i,
            /감사합니다/i,
            /죄송/i,
            /죄송합니다/i,
            /네/i,
            /아니요/i,
            /예/i,
            /아니/i,
            /좋아/i,
            /좋아요/i,
            /나쁘/i,
            /나빠요/i,
            /크/i,
            /큰/i,
            /작/i,
            /작은/i,
            /새/i,
            /새로운/i,
            /오래된/i,
            /오래/i,
            /빨간/i,
            /파란/i,
            /흰/i,
            /검은/i,
            /노란/i,
            /초록/i,
            /보라/i,
            /나/i,
            /너/i,
            /우리/i,
            /그들/i,
            /그/i,
            /그녀/i,
            /그것/i,
            /있/i,
            /없/i,
            /하/i,
            /해/i,
            /했/i,
            /할/i,
            /할게/i,
            /할까/i,
            /먹/i,
            /마시/i,
            /자/i,
            /자요/i,
            /잠/i,
            /일/i,
            /일해/i,
            /일하/i,
            /학교/i,
            /집/i,
            /회사/i,
            /병원/i,
            /은행/i,
            /가게/i,
            /식당/i,
            /공원/i,
            /버스/i,
            /지하철/i,
            /택시/i,
            /자동차/i,
            /비행기/i,
            /기차/i,
            /어디/i,
            /언제/i,
            /누구/i,
            /무엇/i,
            /왜/i,
            /어떻게/i,
            /얼마나/i,
            /오늘/i,
            /어제/i,
            /내일/i,
            /아침/i,
            /점심/i,
            /저녁/i,
            /밤/i,
            /시간/i,
            /분/i,
            /초/i,
            /년/i,
            /월/i,
            /일/i,
            /주/i,
            /주일/i,
        ];
        const hasKoreanRomanization = koreanRomanizationPatterns.some((pattern) => pattern.test(trimmedText));
        if (hasKoreanRomanization) {
            return { detected: true, message: 'Please speak in English' };
        }
    }
    else if (expectedLanguage === 'ko') {
        // Korean should only have Hangul characters
        if (latinPattern.test(trimmedText) && !koreanPattern.test(trimmedText)) {
            return { detected: true, message: '한국어로 말해주세요' };
        }
        if (chinesePattern.test(trimmedText)) {
            return { detected: true, message: '한국어로 말해주세요' };
        }
        if (cyrillicPattern.test(trimmedText)) {
            return { detected: true, message: '한국어로 말해주세요' };
        }
    }
    else if (expectedLanguage === 'zh') {
        // Chinese should only have Chinese characters
        if (latinPattern.test(trimmedText) && !chinesePattern.test(trimmedText)) {
            return { detected: true, message: '请说中文' };
        }
        if (koreanPattern.test(trimmedText)) {
            return { detected: true, message: '请说中文' };
        }
        if (cyrillicPattern.test(trimmedText)) {
            return { detected: true, message: '请说中文' };
        }
    }
    else if (expectedLanguage === 'ky' ||
        expectedLanguage === 'ru' ||
        expectedLanguage === 'kk') {
        // Cyrillic languages should only have Cyrillic characters
        if (latinPattern.test(trimmedText) && !cyrillicPattern.test(trimmedText)) {
            const message = expectedLanguage === 'ky'
                ? 'Кыргызча сүйлөңүз'
                : expectedLanguage === 'ru'
                    ? 'Говорите по-русски'
                    : 'Қазақша сөйлеңіз';
            return { detected: true, message };
        }
        if (koreanPattern.test(trimmedText)) {
            const message = expectedLanguage === 'ky'
                ? 'Кыргызча сүйлөңүз'
                : expectedLanguage === 'ru'
                    ? 'Говорите по-русски'
                    : 'Қазақша сөйлеңіз';
            return { detected: true, message };
        }
        if (chinesePattern.test(trimmedText)) {
            const message = expectedLanguage === 'ky'
                ? 'Кыргызча сүйлөңүз'
                : expectedLanguage === 'ru'
                    ? 'Говорите по-русски'
                    : 'Қазақша сөйлеңіз';
            return { detected: true, message };
        }
    }
    return { detected: false, message: '' };
}
// Helper function to detect wrong language by word patterns
function detectWrongLanguageWords(text, expectedLanguage) {
    const trimmedText = text.trim().toLowerCase();
    // Define word lists for each language
    const languageWords = {
        en: [
            'hello',
            'thank',
            'you',
            'how',
            'are',
            'what',
            'when',
            'where',
            'who',
            'good',
            'bad',
            'big',
            'small',
            'i',
            'you',
            'he',
            'she',
            'we',
            'they',
            'will',
            'was',
            'there',
            'is',
            'hurry',
            'quick',
            'fast',
            'slow',
            'help',
            'please',
            'sorry',
            'excuse',
        ],
        ko: [
            '안녕',
            '감사',
            '어떻게',
            '무엇',
            '언제',
            '어디',
            '누구',
            '좋아',
            '나쁘',
            '크',
            '작',
            '나',
            '너',
            '우리',
            '그들',
            '빨리',
            '천천히',
            '도움',
            '부탁',
            '미안',
            '실례',
        ],
        zh: [
            '你好',
            '谢谢',
            '怎么',
            '什么',
            '什么时候',
            '哪里',
            '谁',
            '好',
            '坏',
            '大',
            '小',
            '我',
            '你',
            '他',
            '她',
            '我们',
            '他们',
            '快',
            '慢',
            '帮助',
            '请',
            '对不起',
            '打扰',
        ],
        ky: [
            'салам',
            'рахмат',
            'кандай',
            'эмне',
            'качан',
            'кайда',
            'ким',
            'жакшы',
            'жаман',
            'улуу',
            'кичине',
            'мен',
            'сен',
            'ал',
            'биз',
            'силер',
            'алар',
            'тез',
            'жай',
            'жардам',
            'сураныч',
            'кечиресиз',
        ],
        ru: [
            'привет',
            'спасибо',
            'как',
            'что',
            'когда',
            'где',
            'кто',
            'хорошо',
            'плохо',
            'большой',
            'маленький',
            'я',
            'ты',
            'он',
            'она',
            'мы',
            'они',
            'быстро',
            'медленно',
            'помощь',
            'пожалуйста',
            'извините',
        ],
        kk: [
            'сәлем',
            'рахмет',
            'қалай',
            'не',
            'қашан',
            'қайда',
            'кім',
            'жақсы',
            'жаман',
            'үлкен',
            'кіші',
            'мен',
            'сен',
            'ол',
            'біз',
            'сіздер',
            'олар',
            'жылдам',
            'баяу',
            'көмек',
            'өтінемін',
            'кешіріңіз',
        ],
        tg: [
            'салом',
            'рахмат',
            'чӣ',
            'чӣ',
            'вақт',
            'куҷо',
            'кӣ',
            'хуб',
            'бад',
            'калон',
            'хурд',
            'ман',
            'ту',
            'ӯ',
            'мо',
            'шумо',
            'онҳо',
            'зуд',
            'оҳиста',
            'кумак',
            'лутфан',
            'бахшид',
        ],
        tk: [
            'salam',
            'rahmat',
            'näme',
            'näme',
            'haçan',
            'nire',
            'kim',
            'gowy',
            'erbet',
            'uly',
            'kiçi',
            'men',
            'sen',
            'ol',
            'biz',
            'siz',
            'olar',
            'çalt',
            'yavaş',
            'kömek',
            'haýyş',
            'bagyşlaň',
        ],
        uz: [
            'salom',
            'rahmat',
            'qanday',
            'nima',
            'qachon',
            'qayerda',
            'kim',
            'yaxshi',
            'yomon',
            'katta',
            'kichik',
            'men',
            'sen',
            'u',
            'biz',
            'sizlar',
            'ular',
            'tez',
            'sekin',
            'yordam',
            'iltimos',
            'kechirasiz',
        ],
    };
    // Check if text contains words from other languages
    for (const [lang, words] of Object.entries(languageWords)) {
        if (lang !== expectedLanguage) {
            const hasWrongLanguageWords = words.some((word) => trimmedText.includes(word.toLowerCase()));
            if (hasWrongLanguageWords) {
                const messages = {
                    en: 'Please speak in English',
                    ko: '한국어로 말해주세요',
                    zh: '请说中文',
                    ky: 'Кыргызча сүйлөңүз',
                    ru: 'Говорите по-русски',
                    kk: 'Қазақша сөйлеңіз',
                    tg: 'Тоҷикӣ сухан бигӯед',
                    tk: 'Türkmençe gürrüň',
                    uz: "O'zbekcha gapiring",
                };
                return {
                    detected: true,
                    message: messages[expectedLanguage] ||
                        'Please speak in the selected language',
                };
            }
        }
    }
    return { detected: false, message: '' };
}
// POST /api/prime-language - Prime the AI with language context
app.post('/api/prime-language', async (req, res) => {
    try {
        const { language } = req.body;
        let contextMessage = '';
        if (language === 'ky') {
            contextMessage =
                "The next audio will contain speech in KYRGYZ LANGUAGE ONLY. Please transcribe it exclusively in Kyrgyz. Common Kyrgyz words: салам, рахмат, кандайсыз, автобус, остановка, жол, кат, үй, мектеп, дүкөн, эмне, качан, кайда, ким, жакшы, жаман, улуу, кичине, мен, сен, ал, биз, силер, алар. IMPORTANT: Only transcribe actual speech content. Do not generate any additional text, greetings, or responses like 'Thank you for watching' or similar phrases.";
        }
        else if (language === 'en') {
            contextMessage =
                "The next audio will contain speech in ENGLISH LANGUAGE ONLY. Please transcribe it exclusively in English. Common English words: hello, thank you, how are you, bus, stop, street, building, house, school, shop, what, when, where, who, good, bad, big, small, I, you, he, she, we, they, hurry, quick, fast, slow, walk, run, go, come, leave, stay, wait, help, please, sorry, excuse me. IMPORTANT: Only transcribe actual speech content. Do not generate any additional text, greetings, or responses like 'Thank you for watching' or similar phrases.";
        }
        else if (language === 'ko') {
            contextMessage =
                "The next audio will contain speech in KOREAN LANGUAGE ONLY. Please transcribe it exclusively in Korean (한국어). Common Korean words: 안녕하세요, 감사합니다, 네, 아니요, 좋습니다, 안녕히 가세요, 만나서 반갑습니다, 죄송합니다, 괜찮습니다, 도와주세요. IMPORTANT: Only transcribe actual speech content. Do not generate any additional text, greetings, or responses like 'Thank you for watching' or similar phrases.";
        }
        else if (language === 'zh') {
            contextMessage =
                "The next audio will contain speech in CHINESE LANGUAGE ONLY. Please transcribe it exclusively in Chinese (中文). Common Chinese words: 你好, 谢谢, 是的, 不是, 好的, 再见, 很高兴认识你, 对不起, 没关系, 请帮助我. IMPORTANT: Only transcribe actual speech content. Do not generate any additional text, greetings, or responses like 'Thank you for watching' or similar phrases.";
        }
        else if (language === 'ru') {
            contextMessage =
                "The next audio will contain speech in RUSSIAN LANGUAGE ONLY. Please transcribe it exclusively in Russian (Русский). Common Russian words: привет, спасибо, да, нет, хорошо, до свидания, рад познакомиться, извините, ничего страшного, помогите мне. IMPORTANT: Only transcribe actual speech content. Do not generate any additional text, greetings, or responses like 'Thank you for watching' or similar phrases.";
        }
        else if (language === 'kk') {
            contextMessage =
                "The next audio will contain speech in KAZAKH LANGUAGE ONLY. Please transcribe it exclusively in Kazakh (Қазақша). Common Kazakh words: сәлем, рахмет, қалайсыз, автобус, аялдама, жол, қабат, үй, мектеп, дүкен, не, қашан, қайда, кім, жақсы, жаман, үлкен, кіші, мен, сен, ол, біз, сіздер, олар. IMPORTANT: Only transcribe actual speech content. Do not generate any additional text, greetings, or responses like 'Thank you for watching' or similar phrases.";
        }
        else if (language === 'tg') {
            contextMessage =
                "The next audio will contain speech in TAJIK LANGUAGE ONLY. Please transcribe it exclusively in Tajik (Тоҷикӣ). Common Tajik words: салом, раҳмат, чӣ хел, автобус, истгоҳ, роҳ, қабат, хона, мактаб, дӯкон, чӣ, кай, куҷо, кӣ, хуб, бад, калон, хурд, ман, ту, ӯ, мо, шумо, онҳо. IMPORTANT: Only transcribe actual speech content. Do not generate any additional text, greetings, or responses like 'Thank you for watching' or similar phrases.";
        }
        else if (language === 'tk') {
            contextMessage =
                "The next audio will contain speech in TURKMEN LANGUAGE ONLY. Please transcribe it exclusively in Turkmen (Türkmençe). Common Turkmen words: salam, sag bol, nähili, awtobus, duralga, ýol, gat, öý, mekdep, dükan, näme, haçan, nire, kim, gowy, erbet, uly, kiçi, men, sen, ol, biz, siz, olar. IMPORTANT: Only transcribe actual speech content. Do not generate any additional text, greetings, or responses like 'Thank you for watching' or similar phrases.";
        }
        else if (language === 'uz') {
            contextMessage =
                "The next audio will contain speech in UZBEK LANGUAGE ONLY. Please transcribe it exclusively in Uzbek (O'zbekcha). Common Uzbek words: salom, rahmat, qalaysiz, avtobus, bekat, yo'l, qavat, uy, maktab, do'kon, nima, qachon, qayerda, kim, yaxshi, yomon, katta, kichik, men, sen, u, biz, siz, ular. IMPORTANT: Only transcribe actual speech content. Do not generate any additional text, greetings, or responses like 'Thank you for watching' or similar phrases.";
        }
        // Send context to AI model (this is a placeholder - in practice, we'll use the prompt in transcription)
        res.json({
            success: true,
            message: `Language context set for ${language === 'ky'
                ? 'Kyrgyz'
                : language === 'en'
                    ? 'English'
                    : language === 'ko'
                        ? 'Korean'
                        : language === 'zh'
                            ? 'Chinese'
                            : language === 'ru'
                                ? 'Russian'
                                : language === 'kk'
                                    ? 'Kazakh'
                                    : language === 'tg'
                                        ? 'Tajik'
                                        : language === 'tk'
                                            ? 'Turkmen'
                                            : language === 'uz'
                                                ? 'Uzbek'
                                                : 'Unknown'}`,
            context: contextMessage,
        });
    }
    catch (err) {
        console.error('Language priming error:', err);
        res.status(500).json({ error: 'Language priming failed' });
    }
});
// POST /api/transcribe
// Body: multipart/form-data field "audio" (webm/ogg/wav), JSON fields: { translateToEnglish?: boolean, language?: string }
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file)
            return res.status(400).json({ error: 'No audio file' });
        const translate = req.body.translateToEnglish === 'true';
        const language = req.body.language || (translate ? 'ky' : 'en');
        // Determine file extension based on mime type
        // Determine file extension based on mimetype
        let extension = 'webm'; // Default to webm
        if (req.file.mimetype.includes('mp4'))
            extension = 'mp4';
        else if (req.file.mimetype.includes('wav'))
            extension = 'wav';
        else if (req.file.mimetype.includes('m4a'))
            extension = 'm4a';
        else if (req.file.mimetype.includes('mp3'))
            extension = 'mp3';
        else if (req.file.mimetype.includes('ogg'))
            extension = 'ogg';
        else if (req.file.mimetype.includes('webm'))
            extension = 'webm';
        else if (req.file.mimetype.includes('flac'))
            extension = 'flac';
        else if (req.file.mimetype.includes('mpeg'))
            extension = 'mpeg';
        else if (req.file.mimetype.includes('mpga'))
            extension = 'mpga';
        else if (req.file.mimetype.includes('oga'))
            extension = 'oga';
        console.log('Received file with mimetype:', req.file.mimetype, 'using extension:', extension);
        const file = bufferToFile(req.file.buffer, `input.${extension}`, req.file.mimetype);
        // Enhanced transcription with better accuracy settings
        const transcriptionParams = {
            file,
            model: 'whisper-1', // Using whisper-1 for better accuracy
            temperature: 0.0, // Lower temperature for more consistent results
        };
        // Handle language detection for different languages
        if (language === 'ky') {
            // Partner is speaking Kyrgyz - use auto-detection with strong Kyrgyz context
            // Don't set language parameter since 'ky' is not supported by Whisper
            transcriptionParams.prompt =
                'CRITICAL: You are transcribing audio for a real-time translation app. The user has selected KYRGYZ as their language. ONLY transcribe if the speech is in KYRGYZ (Кыргызча). If you detect ANY non-Kyrgyz language (English, Russian, Kazakh, Korean, Chinese, etc.), immediately return "WRONG_LANGUAGE_DETECTED: Кыргызча сүйлөңүз" and do NOT transcribe the content. Only transcribe actual Kyrgyz speech using Cyrillic script. Common Kyrgyz words: салам, рахмат, кандайсыз, эмне, качан, кайда, ким, жакшы, жаман, мен, сен, ал, биз, силер, алар.';
        }
        else if (language === 'en') {
            // User is speaking English - set language and English context
            transcriptionParams.language = 'en';
            transcriptionParams.prompt =
                'CRITICAL: You are transcribing audio for a real-time translation app. The user has selected ENGLISH as their language. ONLY transcribe if the speech is in ENGLISH. If you detect ANY non-English language (Korean, Chinese, Japanese, Russian, Kyrgyz, Arabic, Spanish, French, German, etc.), immediately return "WRONG_LANGUAGE_DETECTED: Please speak in English" and do NOT transcribe the content. Only transcribe actual English speech. Common English words: hello, thank you, how are you, what, when, where, who, good, bad, big, small, I, you, he, she, we, they, will, was, there is, hurry, quick, fast, slow, help, please, sorry, excuse me.';
        }
        else if (language === 'ru') {
            // Russian language detection
            transcriptionParams.language = 'ru';
            transcriptionParams.prompt =
                'IMPORTANT: This audio contains speech in RUSSIAN LANGUAGE ONLY. The speaker is speaking exclusively in Russian. If the speech is NOT in Russian (if it sounds like Kyrgyz, Kazakh, English, or other languages), return "WRONG_LANGUAGE_DETECTED: Говорите по-русски" instead of transcribing. Transcribe exactly what you hear in Russian.';
        }
        else if (language === 'ko') {
            // Korean language detection
            transcriptionParams.language = 'ko';
            transcriptionParams.prompt =
                'CRITICAL: You are transcribing audio for a real-time translation app. The user has selected KOREAN as their language. ONLY transcribe if the speech is in KOREAN (한국어). If you detect ANY non-Korean language (English, Chinese, Japanese, Russian, Spanish, etc.), immediately return "WRONG_LANGUAGE_DETECTED: 한국어로 말해주세요" and do NOT transcribe the content. Only transcribe actual Korean speech using Hangul characters.';
        }
        else if (language === 'zh') {
            // Chinese language detection
            transcriptionParams.language = 'zh';
            transcriptionParams.prompt =
                'IMPORTANT: This audio contains speech in CHINESE LANGUAGE ONLY. The speaker is speaking exclusively in Chinese (中文). If the speech is NOT in Chinese (if it sounds like English, Korean, Japanese, or other languages), return "WRONG_LANGUAGE_DETECTED: 请说中文" instead of transcribing. Transcribe exactly what you hear in Chinese.';
        }
        else if (language === 'kk') {
            // Kazakh language detection
            transcriptionParams.language = 'kk';
            transcriptionParams.prompt =
                'IMPORTANT: This audio contains speech in KAZAKH LANGUAGE ONLY. The speaker is speaking exclusively in Kazakh (Қазақша). If the speech is NOT in Kazakh (especially if it sounds like Kyrgyz, Russian, or other languages), return "WRONG_LANGUAGE_DETECTED: Қазақша сөйлеңіз" instead of transcribing. Transcribe exactly what you hear in Kazakh.';
        }
        else if (language === 'tg') {
            // Tajik language detection
            transcriptionParams.language = 'tg';
            transcriptionParams.prompt =
                'IMPORTANT: This audio contains speech in TAJIK LANGUAGE ONLY. The speaker is speaking exclusively in Tajik (Тоҷикӣ). If the speech is NOT in Tajik (if it sounds like Russian, Uzbek, or other languages), return "WRONG_LANGUAGE_DETECTED: Тоҷикӣ сухан бигӯед" instead of transcribing. Transcribe exactly what you hear in Tajik.';
        }
        else if (language === 'tk') {
            // Turkmen language detection
            transcriptionParams.language = 'tk';
            transcriptionParams.prompt =
                'IMPORTANT: This audio contains speech in TURKMEN LANGUAGE ONLY. The speaker is speaking exclusively in Turkmen (Türkmençe). If the speech is NOT in Turkmen (if it sounds like Turkish, Uzbek, or other languages), return "WRONG_LANGUAGE_DETECTED: Türkmençe gürrüň" instead of transcribing. Transcribe exactly what you hear in Turkmen.';
        }
        else if (language === 'uz') {
            // Uzbek language detection
            transcriptionParams.language = 'uz';
            transcriptionParams.prompt =
                'IMPORTANT: This audio contains speech in UZBEK LANGUAGE ONLY. The speaker is speaking exclusively in Uzbek (O\'zbekcha). If the speech is NOT in Uzbek (if it sounds like Turkish, Kazakh, or other languages), return "WRONG_LANGUAGE_DETECTED: O\'zbekcha gapiring" instead of transcribing. Transcribe exactly what you hear in Uzbek.';
        }
        else {
            // Fallback for other languages
            if (language) {
                transcriptionParams.language = language;
            }
            transcriptionParams.prompt =
                'This is speech that needs to be transcribed accurately.';
        }
        const response = await openai.audio.transcriptions.create(transcriptionParams);
        // Extract text from response
        const text = response.text || '';
        // Debug logging for transcription issues
        console.log('🎤 BACKEND TRANSCRIPTION DEBUG:');
        console.log('  - Language:', language);
        console.log('  - File mimetype:', req.file.mimetype);
        console.log('  - File size:', req.file.size, 'bytes');
        console.log('  - Raw transcription:', `"${text}"`);
        console.log('  - Transcription length:', text.length);
        // Check for wrong language detection
        if (text.includes('WRONG_LANGUAGE_DETECTED:')) {
            const wrongLanguageMessage = text
                .replace('WRONG_LANGUAGE_DETECTED:', '')
                .trim();
            console.log('🚫 Wrong language detected:', wrongLanguageMessage);
            res.json({
                text: '',
                confidence: 0,
                wrongLanguage: true,
                message: wrongLanguageMessage,
            });
            return;
        }
        // Additional language detection based on character patterns
        const isWrongLanguage = detectWrongLanguageByPatterns(text, language);
        if (isWrongLanguage.detected) {
            console.log('🚫 Wrong language detected by pattern analysis:', isWrongLanguage.message);
            res.json({
                text: '',
                confidence: 0,
                wrongLanguage: true,
                message: isWrongLanguage.message,
            });
            return;
        }
        // Additional check for wrong language words in transcription
        const wrongLanguageDetection = detectWrongLanguageWords(text, language);
        if (wrongLanguageDetection.detected) {
            console.log('🚫 Wrong language words detected:', wrongLanguageDetection.message);
            res.json({
                text: '',
                confidence: 0,
                wrongLanguage: true,
                message: wrongLanguageDetection.message,
            });
            return;
        }
        // Only return text if it's meaningful
        if (text && text.trim()) {
            // Calculate confidence based on text quality
            const confidence = calculateConfidence(text.trim());
            res.json({
                text: text.trim(),
                confidence: confidence,
            });
        }
        else {
            // Return empty response for silence/no speech
            res.json({
                text: '',
                confidence: 0,
            });
        }
    }
    catch (err) {
        console.error('Transcription error:', err);
        // Return empty response instead of error for invalid file formats
        if (err?.status === 400 && err?.message?.includes('Invalid file format')) {
            res.json({
                text: '',
                confidence: 0,
            });
        }
        else {
            res.status(500).json({ error: err?.message || 'Transcription failed' });
        }
    }
});
// POST /api/translate
// JSON: { text: string, target: 'ky'|'en' }
app.post('/api/translate', async (req, res) => {
    try {
        const { text, target } = req.body;
        // Don't translate empty text
        if (!text || !text.trim()) {
            res.json({ text: '' });
            return;
        }
        // Filter out unwanted translation responses
        const filteredText = text.toLowerCase().trim();
        if (filteredText.includes('thank you for watching') ||
            filteredText.includes('thank you for watching!') ||
            filteredText.includes('thanks for watching') ||
            filteredText.includes('thanks for watching!') ||
            filteredText === 'thank you for watching' ||
            filteredText === 'thanks for watching') {
            console.log('Filtered out unwanted translation response:', text);
            res.json({ text: '' });
            return;
        }
        // Filter out English speech when translating to English (Kyrgyz lane)
        if (target === 'en') {
            // Check if the text contains common English words/patterns
            const englishPatterns = [
                /\b(hello|hi|hey|good|morning|afternoon|evening|night|yes|no|please|thank|you|welcome|sorry|excuse|me|how|are|what|where|when|why|who|can|could|would|should|will|shall|have|has|had|do|does|did|am|is|are|was|were|be|been|being|the|a|an|and|or|but|so|if|then|because|although|while|during|before|after|until|since|for|with|without|by|from|to|in|on|at|up|down|out|off|over|under|through|across|around|between|among|against|toward|towards|into|onto|upon|within|beyond|behind|below|above|beneath|beside|besides|except|including|regarding|concerning|considering|given|provided|unless|whether|either|neither|both|all|some|any|every|each|other|another|such|same|different|similar|like|unlike|as|than|more|most|less|least|very|quite|rather|too|enough|so|such|much|many|few|little|several|all|both|half|double|triple|single|multiple|various|several|numerous|countless|infinite|limited|unlimited|restricted|unrestricted|free|bound|tied|loose|tight|loose|firm|soft|hard|easy|difficult|simple|complex|basic|advanced|beginner|expert|professional|amateur|skilled|unskilled|experienced|inexperienced|qualified|unqualified|certified|uncertified|licensed|unlicensed|authorized|unauthorized|official|unofficial|formal|informal|public|private|personal|professional|business|commercial|industrial|residential|urban|rural|domestic|international|local|global|national|regional|state|federal|municipal|county|city|town|village|neighborhood|community|society|culture|tradition|custom|habit|routine|practice|method|technique|approach|strategy|tactic|plan|schedule|agenda|program|project|task|job|work|career|profession|occupation|employment|business|company|organization|institution|agency|department|division|section|unit|team|group|committee|board|council|government|administration|management|leadership|supervision|direction|guidance|instruction|education|training|learning|teaching|studying|research|development|improvement|progress|advancement|growth|expansion|increase|decrease|reduction|cut|save|spend|invest|earn|make|lose|win|fail|succeed|achieve|accomplish|complete|finish|start|begin|continue|stop|end|pause|resume|delay|hurry|rush|slow|fast|quick|slow|early|late|on|time|punctual|tardy|available|unavailable|busy|free|occupied|vacant|empty|full|complete|incomplete|finished|unfinished|done|undone|ready|unready|prepared|unprepared|organized|disorganized|clean|dirty|neat|messy|tidy|untidy|orderly|disorderly|systematic|random|logical|illogical|reasonable|unreasonable|rational|irrational|sensible|nonsensical|practical|impractical|useful|useless|helpful|unhelpful|beneficial|harmful|safe|dangerous|secure|insecure|stable|unstable|steady|unsteady|firm|weak|strong|powerful|powerless|effective|ineffective|efficient|inefficient|productive|unproductive|successful|unsuccessful|profitable|unprofitable|valuable|worthless|important|unimportant|significant|insignificant|major|minor|main|secondary|primary|secondary|first|last|next|previous|current|past|future|present|recent|old|new|young|mature|immature|adult|child|baby|infant|teenager|elderly|senior|junior|beginner|expert|novice|veteran|fresh|stale|hot|cold|warm|cool|dry|wet|moist|damp|humid|arid|bright|dark|light|heavy|thick|thin|wide|narrow|broad|deep|shallow|high|low|tall|short|long|brief|big|small|large|tiny|huge|enormous|massive|giant|mini|micro|macro|super|mega|ultra|hyper|extra|special|unique|different|same|similar|identical|exact|precise|accurate|wrong|incorrect|right|correct|true|false|real|fake|genuine|authentic|original|copy|duplicate|single|double|triple|quadruple|multiple|many|few|several|some|all|none|nothing|everything|something|anything|someone|anyone|everyone|nobody|somebody|anybody|everybody|here|there|where|when|why|how|what|which|who|whom|whose|this|that|these|those|my|your|his|her|its|our|their|mine|yours|hers|ours|theirs|me|you|him|her|it|us|them|myself|yourself|himself|herself|itself|ourselves|yourselves|themselves|i|we|he|she|they|am|is|are|was|were|be|been|being|have|has|had|having|do|does|did|doing|will|would|could|should|may|might|must|can|cannot|can't|won't|wouldn't|couldn't|shouldn't|mayn't|mightn't|mustn't|shan't|ain't|isn't|aren't|wasn't|weren't|haven't|hasn't|hadn't|don't|doesn't|didn't)\b/gi,
            ];
            const isEnglish = englishPatterns.some((pattern) => pattern.test(text));
            if (isEnglish) {
                console.log('Filtered out English speech in Kyrgyz lane:', text);
                res.json({ text: '' });
                return;
            }
        }
        let system = '';
        if (target === 'ky') {
            system =
                "You are a professional translator. Translate the following text to Kyrgyz (Кыргызча) using Cyrillic script. Use natural, fluent Kyrgyz that sounds like a native speaker would say it. For commands like 'hurry up', use 'Тезирээк болуңуз!' (formal) or 'Шашыңыз!' (informal). Return only the translation, no explanations.";
        }
        else if (target === 'ru') {
            system =
                "You are a professional translator. Translate the following text to Russian (Русский) using Cyrillic script. Use natural, fluent Russian that sounds like a native speaker would say it. For commands like 'hurry up', use 'Торопитесь!' (formal) or 'Торопись!' (informal). Return only the translation, no explanations.";
        }
        else if (target === 'ko') {
            system =
                "You are a professional translator. Translate the following text to Korean (한국어) using Hangul script. Use natural, fluent Korean that sounds like a native speaker would say it. For commands like 'hurry up', use '빨리하세요!' (formal) or '빨리해!' (informal). Return only the translation, no explanations.";
        }
        else if (target === 'zh') {
            system =
                "You are a professional translator. Translate the following text to Chinese (中文) using Chinese characters. Use natural, fluent Chinese that sounds like a native speaker would say it. For commands like 'hurry up', use '快点!' (informal) or '请快点!' (formal). Return only the translation, no explanations.";
        }
        else if (target === 'kk') {
            system =
                "You are a professional translator. Translate the following text to Kazakh (Қазақша) using Cyrillic script. Use natural, fluent Kazakh that sounds like a native speaker would say it. For commands like 'hurry up', use 'Асықыңыз!' (formal) or 'Асық!' (informal). Return only the translation, no explanations.";
        }
        else if (target === 'tg') {
            system =
                "You are a professional translator. Translate the following text to Tajik (Тоҷикӣ) using Cyrillic script. Use natural, fluent Tajik that sounds like a native speaker would say it. For commands like 'hurry up', use 'Шитоб кунед!' (formal) or 'Шитоб кун!' (informal). Return only the translation, no explanations.";
        }
        else if (target === 'tk') {
            system =
                "You are a professional translator. Translate the following text to Turkmen (Türkmençe) using Latin script. Use natural, fluent Turkmen that sounds like a native speaker would say it. For commands like 'hurry up', use 'Çalt boluň!' (formal) or 'Çalt bol!' (informal). Return only the translation, no explanations.";
        }
        else if (target === 'uz') {
            system =
                "You are a professional translator. Translate the following text to Uzbek (O'zbekcha) using Latin script. Use natural, fluent Uzbek that sounds like a native speaker would say it. For commands like 'hurry up', use 'Shoshiling!' (formal) or 'Shoshil!' (informal). Return only the translation, no explanations.";
        }
        else {
            system =
                'You are a professional translator. Translate the following text to English. Use natural, fluent English that sounds like a native speaker would say it. If the text contains any English words, return empty string. Return only the translation, no explanations.';
        }
        console.log(`Translating "${text}" to ${target} with system: ${system}`);
        const chat = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: text },
            ],
        });
        const out = chat.choices[0]?.message?.content?.trim() || '';
        console.log(`Translation result: "${out}"`);
        res.json({ text: out });
    }
    catch (err) {
        console.error('Translation error:', err);
        res.status(500).json({ error: 'Translation failed' });
    }
});
// POST /api/tts
// JSON: { text: string, voice?: string, format?: 'mp3'|'wav' }
app.post('/api/tts', async (req, res) => {
    try {
        const { text, voice = 'alloy', format = 'mp3', } = req.body;
        // Don't generate TTS for empty text
        if (!text || !text.trim()) {
            res.status(400).json({ error: 'No text provided for TTS' });
            return;
        }
        const audio = await openai.audio.speech.create({
            model: 'gpt-4o-mini-tts',
            voice,
            input: text,
            format,
        });
        const arrayBuffer = await audio.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        res.setHeader('Content-Type', format === 'wav' ? 'audio/wav' : 'audio/mpeg');
        res.send(buffer);
    }
    catch (err) {
        console.error('TTS error:', err);
        res.status(500).json({ error: 'TTS failed' });
    }
});
app.get('/health', (_req, res) => res.json({ ok: true }));
// Simple test API endpoint for Android connectivity testing
app.post('/api/test', (req, res) => {
    try {
        const { message } = req.body;
        console.log('Test API called with message:', message);
        // Simple echo response
        const response = {
            success: true,
            originalMessage: message,
            echoMessage: `Echo: ${message}`,
            timestamp: new Date().toISOString(),
            server: 'Kyrgyz Translation API',
            version: '1.0.0',
        };
        res.json(response);
    }
    catch (error) {
        console.error('Test API error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            timestamp: new Date().toISOString(),
        });
    }
});
// Simple GET test endpoint
app.get('/api/test', (req, res) => {
    try {
        const response = {
            success: true,
            message: 'Test API is working!',
            timestamp: new Date().toISOString(),
            server: 'Kyrgyz Translation API',
            version: '1.0.0',
            method: 'GET',
        };
        res.json(response);
    }
    catch (error) {
        console.error('Test API error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            timestamp: new Date().toISOString(),
        });
    }
});
const PORT = parseInt(process.env.PORT || '8788', 10);
app.listen(PORT, '0.0.0.0', () => console.log(`Server listening on http://0.0.0.0:${PORT}`));
