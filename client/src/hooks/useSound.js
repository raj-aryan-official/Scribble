import { useRef, useEffect } from 'react';
import { Howl } from 'howler';

const SOUNDS = {
    pop: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3', // Placeholder URL
    correct: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
    tick: 'https://assets.mixkit.co/active_storage/sfx/2578/2578-preview.mp3',
    end: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3'
};

export const useSound = () => {
    const soundsRef = useRef({});

    useEffect(() => {
        // Preload sounds
        Object.keys(SOUNDS).forEach(key => {
            soundsRef.current[key] = new Howl({
                src: [SOUNDS[key]],
                volume: 0.5
            });
        });
    }, []);

    const play = (name) => {
        if (soundsRef.current[name]) {
            soundsRef.current[name].play();
        }
    };

    return { play };
};
