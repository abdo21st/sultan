declare module 'arabic-reshaper' {
    export function reshape(text: string): string;
    const arabicReshaper: {
        reshape: (text: string) => string;
    };
    export default arabicReshaper;
}

declare module 'rtl-detect' {
    export function isRtl(locale: string): boolean;
    export function getLangDir(locale: string): 'rtl' | 'ltr';
}
