import Dexie, { Table } from 'dexie';

export interface VideoProject {
  id?: number;
  title: string;
  subreddit: string;
  author: string;
  score: number;
  comments: { id: string; body: string; author: string; score: number }[];
  templateStyle: string;
  createdAt: Date;
  status: 'draft' | 'rendering' | 'completed';
  videoUrl?: string;
}

export class RedditVideoDB extends Dexie {
  projects!: Table<VideoProject, number>;

  constructor() {
    super('RedditVideoDB');
    this.version(1).stores({
      projects: '++id, title, status, createdAt'
    });
  }
}

export const db = new RedditVideoDB();
