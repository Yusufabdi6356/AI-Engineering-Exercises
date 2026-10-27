export const MAX_QUERY_LENGTH = 200;

export type Article = {
    title: string;
    link: string;
    summary: string;
    source?: string;
    imageUrl?: string;
    fullText?: string;
    scrapeStatus?: 'pending' | 'full text' | 'snippet only';
    scrapeError?: string;
};
