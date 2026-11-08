import en from './en';
import hi from './hi';

export const dictionaries = {
    en,
    hi,
};

export const getStrings = (lang = 'en') => {
    return dictionaries[lang] || dictionaries.en;
};

export { en, hi };
export default dictionaries;

