import { useWorkspace } from "../context/WorkspaceContext";

export function useProfile() {
  const { profile } = useWorkspace();
  return profile;
}
