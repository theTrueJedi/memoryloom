declare module '@visx/wordcloud' {
  import { ReactNode } from 'react';

  export interface Word {
    text: string;
    value: number;
  }

  export interface WordcloudProps {
    width: number;
    height: number;
    words: Word[];
    font?: string;
    fontSize?: (datum: Word) => number;
    rotate?: (datum: Word) => number;
    padding?: number;
    spiral?: 'archimedean' | 'rectangular';
    random?: () => number;
    children?: (words: any[]) => ReactNode;
  }

  export function Wordcloud(props: WordcloudProps): JSX.Element;
}
