/**
 * Centralized English Strings Dictionary for Scribble
 *
 * Rules:
 * - No sentences built by joining fragments.
 * - Format all numbers, counts, and ordinals using Intl.NumberFormat.
 * - Tone: friendly, short, playful, calm, never marketing-like or loud.
 */

const numberFormatter = new Intl.NumberFormat('en-US');

export const formatNumber = (num) => numberFormatter.format(num);

export const formatOrdinal = (n) => {
    const pr = new Intl.PluralRules('en-US', { type: 'ordinal' });
    const suffixes = {
        one: 'st',
        two: 'nd',
        few: 'rd',
        other: 'th',
    };
    return `${formatNumber(n)}${suffixes[pr.select(n)] || 'th'}`;
};

export const strings = {
    app: {
        name: 'Scribble',
        tagline: 'Draw it. Guess it. Win bragging rights.',
        skipToContent: 'Skip to content',
        muteSounds: 'Mute game sounds',
        unmuteSounds: 'Unmute game sounds',
    },

    landing: {
        title: 'Scribble',
        heroCopy: 'Draw it. Guess it. Win bragging rights.',
        nicknameLabel: 'Your Nickname',
        nicknamePlaceholder: (name) => `e.g. ${name}`,
        nicknameErrorEmpty: 'Please pick a nickname (1-16 characters)',
        avatarLabel: 'Choose Avatar',
        createRoomButton: 'Create a room',
        orDivider: 'or join with a code',
        roomCodePlaceholder: '6-letter code or invite link',
        joinRoomButton: 'Join room',
        howToPlayButton: 'How to play',
        creditLine: 'Hand-crafted for friendly sketching',
    },

    join: {
        title: "You're invited",
        roomSubtitle: (hostName, count, max, state) =>
            `${hostName}'s room: ${formatNumber(count)} of ${formatNumber(max)} players, ${
                state === 'LOBBY' ? 'waiting in the lobby' : 'game in progress'
            }`,
        nicknameLabel: 'Your Nickname',
        avatarLabel: 'Choose Avatar',
        joinButton: (hostName) => `Join ${hostName}'s room`,
        spectateButton: "Join as guesser",
        roomClosedNotice: 'This room has closed.',
        roomFullNotice: 'That room is full.',
    },

    lobby: {
        title: (code) => `Lobby ${code}`,
        playersTitle: (count, max) =>
            `Players (${formatNumber(count)}/${formatNumber(max)})`,
        youBadge: 'You',
        hostBadge: 'Host',
        awayBadge: 'Away',
        roomCardTitle: 'Room Code',
        copyCode: 'Copy code',
        copyLink: 'Copy link',
        copied: 'Copied',
        share: 'Share',
        showQr: 'Show QR code',
        hideQr: 'Hide QR code',
        qrInstruction: 'Scan with your phone to join this room',
        settingsTitle: 'Game Rules',
        roundsLabel: 'Rounds',
        drawTimeLabel: 'Draw time',
        difficultyLabel: 'Difficulty',
        maxPlayersLabel: 'Max players',
        customWordsLabel: 'Custom words',
        customWordsPlaceholder: 'Type words separated by commas...',
        startGame: 'Start Game',
        waitingForHost: 'Waiting for host to start...',
        needMorePlayers: 'Need at least 2 players to start',
        leaveRoom: 'Leave room',
    },

    game: {
        roundProgress: (round, total) =>
            `Round ${formatNumber(round)} of ${formatNumber(total)}`,
        canvasAltGuesser: (name) => `Drawing in progress by ${name}`,
        canvasAltDrawer: 'Drawing paper. Sketch your secret word.',
        drawingPrompt: 'Start drawing. No letters or numbers!',
        typeYourGuess: 'Type your guess',
        submitGuess: 'Submit guess',
        closeGuess: 'Close!',
        correctGuess: (points) => `You got it! +${formatNumber(points)}`,
        chatWithGuessed: "Chat with players who've guessed...",
        slowDown: 'Slow down a little.',
        timeRemaining: (s) => `${formatNumber(s)} seconds remaining`,
        timeUp: 'Time is up!',
        drawerWordPrompt: 'Your secret word is',
        autoPickedNotice: (word) => `Time ran out — we picked ${word} for you. Draw!`,
        drawerLeftNotice: (name) => `${name} left. Skipping to the next drawer.`,
        whoIsDrawing: (name) => `${name} is drawing`,
        whoIsUp: (name) => `${name} is up`,
        chooseAWord: 'Pick a word to draw',
    },

    roundEnd: {
        wordWas: (word) => `The word was ${word}`,
        nobodyGotIt: 'Nobody got it this time.',
        drawerBonus: (pts) => `Drawer bonus +${formatNumber(pts)}`,
        fastestGuesser: 'Fastest',
        nextDrawerIs: (name) => `Next up: ${name}`,
        skipIntermission: 'Skip to next round',
    },

    gameEnd: {
        personalResult: (rank, points) =>
            `You finished ${formatOrdinal(rank)} with ${formatNumber(points)} points`,
        podiumFirst: '1st Place',
        podiumSecond: '2nd Place',
        podiumThird: '3rd Place',
        awardBestArtist: 'Best artist',
        awardBestArtistDesc: 'Drawings guessed fastest on average',
        awardFastestGuesser: 'Fastest guesser',
        awardFastestGuesserDesc: 'Lowest average time to guess correctly',
        matchDrawingsTitle: 'Match Drawings',
        saveDrawing: 'Save drawing',
        downloadSheet: 'Download contact sheet',
        playAgain: 'Play again',
        backToLobby: 'Back to lobby',
    },

    states: {
        connecting: 'Connecting...',
        reconnecting: (attempt) =>
            attempt > 1 ? `Reconnecting... (attempt ${formatNumber(attempt)})` : 'Reconnecting...',
        retry: 'Retry',
        offline: "You're offline.",
        backOnline: 'Back online',
        lostTitle: 'We lost you.',
        lostSentence: 'The connection could not be restored.',
        tryAgain: 'Try again',
        backToStart: 'Back to start',
        roomClosedTitle: 'This room has closed.',
        roomClosedSentence: 'The host ended the session or the game was closed.',
        startNewRoom: 'Start a new room',
        roomFullTitle: 'That room is full.',
        roomFullSentence: 'This room has reached maximum player capacity.',
        startYourOwnRoom: 'Start your own room',
        kickedTitle: 'The host removed you from the room.',
        kickedSentence: 'You are no longer in this game session.',
        hostEndedTitle: 'The host ended the game.',
        hostEndedSentence: 'The match has concluded early for all players.',
        seeScores: 'See the scores',
        everyoneLeftTitle: 'Everyone else left, so the game ended.',
        everyoneLeftSentence: 'Scribble requires at least 2 players to draw and guess.',
        unsupportedTitle: 'Unsupported browser',
        unsupportedSentence:
            'Scribble requires modern browser capabilities for real-time drawing and audio. Please update your browser.',
        somethingWentWrongTitle: 'Something went wrong',
        somethingWentWrongSentence: 'An unexpected issue occurred while rendering the page.',
        reload: 'Reload',
    },

    voice: {
        title: 'Voice Chat',
        micOn: 'Mute microphone',
        micOff: 'Unmute microphone',
        audioOn: 'Disable audio',
        audioOff: 'Enable audio',
        roomLimit: (max) => `Voice chat is limited to rooms of up to ${formatNumber(max)} players`,
        accessNeeded: 'Microphone access needed',
        instructions: {
            chrome: 'Click the lock icon in the address bar and set Microphone to Allow.',
            safari: 'Go to Settings > Websites > Microphone and set to Allow.',
            firefox: 'Click the microphone icon in the address bar and clear the Blocked permission.',
        },
        tryAgain: 'Try again',
        dismiss: 'Dismiss',
    },
};

export default strings;

