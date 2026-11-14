import { NoesisPersistentWorkspace } from './noesis-persistent-workspace';
import './startup.css';

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <NoesisPersistentWorkspace>{children}</NoesisPersistentWorkspace>;
}
