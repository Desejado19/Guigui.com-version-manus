/* Contadores de interacao por story (gostos, comentarios e partilhas).
   Estado local ao StoriesView; reage só a acoes do utilizador.
*/

import React from "react";

export type StoryInteractionCounts = Record<string, { likes: number; comments: number; shares: number }>;

export function useStoryInteractionCounts() {
  const [counts, setCounts] = React.useState<StoryInteractionCounts>({});

  const bump = (
    storyId: string,
    field: 'likes' | 'comments' | 'shares',
    delta: number,
  ) => setCounts((previous) => ({
    ...previous,
    [storyId]: {
      ...Object.assign({ likes: 0, comments: 0, shares: 0 }, previous[storyId]),
      [field]: Math.max(0, (previous[storyId]?.[field] ?? 0) + delta),
    },
  }));

  const setLikeDelta = (storyId: string, delta: number) => bump(storyId, 'likes', delta);
  const setCommentDelta = (storyId: string, delta: number) => bump(storyId, 'comments', delta);
  const setShareDelta = (storyId: string, delta: number) => bump(storyId, 'shares', delta);

  return { counts, setLikeDelta, setCommentDelta, setShareDelta };
}
