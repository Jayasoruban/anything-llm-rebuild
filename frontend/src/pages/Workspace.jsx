import { useParams } from "react-router-dom";
import WorkspaceChat from "../components/WorkspaceChat";

export default function Workspace() {
  const { slug = "default" } = useParams();
  return <WorkspaceChat slug={slug} />;
}
