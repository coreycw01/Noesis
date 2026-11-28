import { NoesisPersistentWorkspace } from './noesis-persistent-workspace';
import './startup.css';
import '../globals.css';
import '../prototype-skin.css';
import '../tokens.css';
import '../record.css';

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <NoesisPersistentWorkspace>{children}</NoesisPersistentWorkspace>;
}
