import { useEffect, useState } from "react";
import * as workspaceApi from "../services/workspaceApi";
import { REACTION_EMOJI, REACTION_TYPES } from "../utils/helpers";

export function useReactionChoices() {
  const [reactionEmoji, setReactionEmoji] = useState(REACTION_EMOJI);
  const [reactionTypes, setReactionTypes] = useState(REACTION_TYPES);

  useEffect(() => {
    workspaceApi
      .getReactionChoices()
      .then((res) => {
        const map = {};
        res.data.forEach(({ value, label }) => {
          map[value] = label;
        });
        if (Object.keys(map).length) {
          setReactionEmoji(map);
          setReactionTypes(Object.keys(map));
        }
      })
      .catch(() => {});
  }, []);

  return { reactionEmoji, reactionTypes };
}
