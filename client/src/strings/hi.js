/**
 * Centralized Hindi (Devanagari) Strings Dictionary for Scribble
 *
 * Rules:
 * - Natural, warm, friendly Indian tone.
 * - Format all numbers, counts, and ordinals using Intl.NumberFormat.
 * - Tone: friendly, short, playful, calm, never marketing-like or loud.
 */

const numberFormatter = new Intl.NumberFormat('hi-IN');

export const formatNumber = (num) => numberFormatter.format(num);

export const formatOrdinal = (n) => {
    const ordinals = {
        1: 'पहला',
        2: 'दूसरा',
        3: 'तीसरा',
        4: 'चौथा',
        5: 'पांचवां',
        6: 'छठा',
        7: 'सातवां',
        8: 'आठवां',
        9: 'नौवां',
        10: 'दसवां',
    };
    return ordinals[n] || `${formatNumber(n)}वां`;
};

export const strings = {
    app: {
        name: 'Scribble',
        tagline: 'चित्र बनाओ। बूझो। और जीतो!',
        skipToContent: 'मुख्य सामग्री पर जाएं',
        muteSounds: 'ध्वनि बंद करें',
        unmuteSounds: 'ध्वनि चालू करें',
    },

    landing: {
        title: 'Scribble',
        heroCopy: 'चित्र बनाओ। बूझो। और जीतो!',
        nicknameLabel: 'आपका उपनाम',
        nicknamePlaceholder: (name) => `जैसे ${name}`,
        nicknameErrorEmpty: 'कृपया एक उपनाम चुनें (1-16 अक्षर)',
        avatarLabel: 'अवतार चुनें',
        createRoomButton: 'कमरा बनाएं',
        orDivider: 'या कोड से जुड़ें',
        roomCodePlaceholder: '6-अक्षरों का कोड या लिंक',
        joinRoomButton: 'कमरे में जुड़ें',
        howToPlayButton: 'कैसे खेलें',
        creditLine: 'दोस्ताना रेखाचित्रों के लिए प्यार से निर्मित',
    },

    join: {
        title: 'आपको निमंत्रण मिला है',
        roomSubtitle: (hostName, count, max, state) =>
            `${hostName} का कमरा: ${formatNumber(count)}/${formatNumber(max)} खिलाड़ी, ${
                state === 'LOBBY' ? 'लॉबी में प्रतीक्षा' : 'खेल जारी है'
            }`,
        nicknameLabel: 'आपका उपनाम',
        avatarLabel: 'अवतार चुनें',
        joinButton: (hostName) => `${hostName} के कमरे में जुड़ें`,
        spectateButton: 'अनुमानक के रूप में जुड़ें',
        roomClosedNotice: 'यह कमरा बंद हो चुका है।',
        roomFullNotice: 'यह कमरा भर चुका है।',
    },

    lobby: {
        title: (code) => `लॉबी ${code}`,
        playersTitle: (count, max) =>
            `खिलाड़ी (${formatNumber(count)}/${formatNumber(max)})`,
        youBadge: 'आप',
        hostBadge: 'होस्ट',
        awayBadge: 'दूर',
        roomCardTitle: 'कमरा कोड',
        copyCode: 'कोड कॉपी करें',
        copyLink: 'लिंक कॉपी करें',
        copied: 'कॉपी हो गया',
        share: 'शेयर करें',
        showQr: 'QR कोड दिखाएं',
        hideQr: 'QR कोड छुपाएं',
        qrInstruction: 'कमरे में जुड़ने के लिए अपने फ़ोन से स्कैन करें',
        settingsTitle: 'खेल के नियम',
        roundsLabel: 'राउंड',
        drawTimeLabel: 'चित्र समय',
        difficultyLabel: 'कठिनाई',
        maxPlayersLabel: 'अधिकतम खिलाड़ी',
        customWordsLabel: 'कस्टम शब्द',
        customWordsPlaceholder: 'अल्पविराम से अलग करके शब्द लिखें...',
        startGame: 'खेल शुरू करें',
        waitingForHost: 'होस्ट के शुरू करने की प्रतीक्षा है...',
        needMorePlayers: 'खेल शुरू करने के लिए कम से कम 2 खिलाड़ी चाहिए',
        leaveRoom: 'कमरा छोड़ें',
    },

    game: {
        roundProgress: (round, total) =>
            `राउंड ${formatNumber(round)} / ${formatNumber(total)}`,
        canvasAltGuesser: (name) => `${name} चित्र बना रहे हैं`,
        canvasAltDrawer: 'ड्राइंग पेपर। अपने गुप्त शब्द का चित्र बनाएं।',
        drawingPrompt: 'चित्र बनाना शुरू करें। कोई अक्षर या अंक नहीं!',
        typeYourGuess: 'अपना अनुमान लिखें',
        submitGuess: 'अनुमान भेजें',
        closeGuess: 'बहुत करीब!',
        correctGuess: (points) => `सही उत्तर! +${formatNumber(points)}`,
        chatWithGuessed: 'अनुमान लगा चुके खिलाड़ियों से बात करें...',
        slowDown: 'थोड़ा धीरे करें।',
        timeRemaining: (s) => `${formatNumber(s)} सेकंड बाकी`,
        timeUp: 'समय समाप्त!',
        drawerWordPrompt: 'आपका गुप्त शब्द है',
        autoPickedNotice: (word) => `समय समाप्त — हमने आपके लिए ${word} चुना। चित्र बनाएं!`,
        drawerLeftNotice: (name) => `${name} चले गए। अगले चित्रकार पर जा रहे हैं।`,
        whoIsDrawing: (name) => `${name} चित्र बना रहे हैं`,
        whoIsUp: (name) => `बारी है: ${name}`,
        chooseAWord: 'चित्र बनाने के लिए एक शब्द चुनें',
    },

    roundEnd: {
        wordWas: (word) => `शब्द था: ${word}`,
        nobodyGotIt: 'इस बार कोई अनुमान नहीं लगा सका।',
        drawerBonus: (pts) => `चित्रकार बोनस +${formatNumber(pts)}`,
        fastestGuesser: 'सबसे तेज़',
        nextDrawerIs: (name) => `अगला चित्रकार: ${name}`,
        skipIntermission: 'अगले राउंड पर जाएं',
    },

    gameEnd: {
        personalResult: (rank, points) =>
            `आप ${formatOrdinal(rank)} स्थान पर रहे, ${formatNumber(points)} अंकों के साथ`,
        podiumFirst: 'प्रथम स्थान',
        podiumSecond: 'द्वितीय स्थान',
        podiumThird: 'तृतीय स्थान',
        awardBestArtist: 'सर्वश्रेष्ठ कलाकार',
        awardBestArtistDesc: 'जिनके चित्र सबसे तेज़ी से बूझे गए',
        awardFastestGuesser: 'सबसे तेज़ अनुमानक',
        awardFastestGuesserDesc: 'सबसे कम औसत समय में सही अनुमान',
        matchDrawingsTitle: 'मैच के रेखाचित्र',
        saveDrawing: 'चित्र सहेजें',
        downloadSheet: 'संपर्क पत्रक डाउनलोड करें',
        playAgain: 'फिर से खेलें',
        backToLobby: 'लॉबी में वापस जाएं',
    },

    states: {
        connecting: 'कनेक्ट हो रहा है...',
        reconnecting: (attempt) =>
            attempt > 1 ? `पुनः कनेक्ट हो रहा है... (प्रयास ${formatNumber(attempt)})` : 'पुनः कनेक्ट हो रहा है...',
        retry: 'पुनः प्रयास',
        offline: 'आप ऑफ़लाइन हैं।',
        backOnline: 'वापस ऑनलाइन',
        lostTitle: 'संपर्क टूट गया।',
        lostSentence: 'कनेक्शन बहाल नहीं किया जा सका।',
        tryAgain: 'पुनः प्रयास करें',
        backToStart: 'शुरुआत पर लौटें',
        roomClosedTitle: 'यह कमरा बंद हो चुका है।',
        roomClosedSentence: 'होस्ट ने सत्र समाप्त कर दिया या खेल बंद कर दिया गया।',
        startNewRoom: 'नया कमरा बनाएं',
        roomFullTitle: 'यह कमरा भर चुका है।',
        roomFullSentence: 'इस कमरे में अधिकतम खिलाड़ियों की सीमा पूरी हो गई है।',
        startYourOwnRoom: 'अपना कमरा शुरू करें',
        kickedTitle: 'होस्ट ने आपको कमरे से हटा दिया।',
        kickedSentence: 'आप अब इस खेल सत्र में नहीं हैं।',
        hostEndedTitle: 'होस्ट ने खेल समाप्त कर दिया।',
        hostEndedSentence: 'सभी खिलाड़ियों के लिए मैच समय से पहले समाप्त हो गया।',
        seeScores: 'स्कोर देखें',
        everyoneLeftTitle: 'बाकी सभी चले गए, इसलिए खेल समाप्त हो गया।',
        everyoneLeftSentence: 'चित्र बनाने और अनुमान लगाने के लिए कम से कम 2 खिलाड़ी चाहिए।',
        unsupportedTitle: 'असमर्थित ब्राउज़र',
        unsupportedSentence:
            'Scribble को रीयल-टाइम चित्र और ऑडियो के लिए आधुनिक ब्राउज़र की आवश्यकता है। कृपया अपना ब्राउज़र अपडेट करें।',
        somethingWentWrongTitle: 'कुछ गलत हो गया',
        somethingWentWrongSentence: 'पृष्ठ लोड करते समय एक अप्रत्याशित समस्या आई।',
        reload: 'पुनः लोड करें',
    },

    voice: {
        title: 'आवाज़ चैट',
        micOn: 'माइक बंद करें',
        micOff: 'माइक चालू करें',
        audioOn: 'ऑडियो अक्षम करें',
        audioOff: 'ऑडियो सक्षम करें',
        roomLimit: (max) => `आवाज़ चैट अधिकतम ${formatNumber(max)} खिलाड़ियों के कमरे तक सीमित है`,
        accessNeeded: 'माइक्रोफ़ोन की अनुमति चाहिए',
        instructions: {
            chrome: 'एड्रेस बार में ताले के निशान पर क्लिक करें और माइक्रोफ़ोन को अनुमति दें।',
            safari: 'सेटिंग्स > वेबसाइट्स > माइक्रोफ़ोन में जाएं और अनुमति दें।',
            firefox: 'एड्रेस बार में माइक आइकन पर क्लिक करें और ब्लॉक की गई अनुमति हटाएं।',
        },
        tryAgain: 'पुनः प्रयास करें',
        dismiss: 'खारिज करें',
    },
};

export default strings;

