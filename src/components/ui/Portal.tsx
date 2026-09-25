import { createPortal } from 'react-dom';

// Renders children at the end of <body>. Needed for fixed overlays: an ancestor with
// backdrop-filter (our glass cards and header) would otherwise trap `position: fixed`.
const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) => createPortal(children, document.body);

export default Portal;
