import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { setupIonicReact } from '@ionic/react';

/* Ionic core + the utilities its components rely on. */
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/text-alignment.css';

/* Fonts and icons are bundled, never fetched from a CDN — the app has to render
   identically with no connection. */
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
/* The stylesheet is named explicitly rather than using the package's bare
   `./regular` entry: that one resolves to an extensionless target TypeScript
   cannot type as a stylesheet. The `./*` export maps this onto src/ itself, so
   the path must not repeat it. */
import '@phosphor-icons/web/regular/style.css';
import '@phosphor-icons/web/fill/style.css';

import './theme/variables.css';
import App from './App';

setupIonicReact({ mode: 'ios' });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
